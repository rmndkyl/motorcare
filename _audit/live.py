#!/usr/bin/env python3
"""Verify the LIVE production URL, not the local build.

Local passing means the files are right. This proves GitHub Pages actually
serves them -- a deploy can silently serve an old build from cache.
"""
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from harness import launch  # noqa: E402

LIVE = "https://rmndkyl.github.io/motorcare/"
BACKUP = "/home/ubuntu/.hermes/cache/documents/doc_3009baf8a237_motorcare-backup-2026-11-26.json"

JS_LIB = r"""
window.__A = {
  toRgb(css){const c=document.createElement('canvas');c.width=c.height=1;
    const x=c.getContext('2d',{willReadFrequently:true});x.clearRect(0,0,1,1);
    x.fillStyle=css;x.fillRect(0,0,1,1);const d=x.getImageData(0,0,1,1).data;
    return [d[0],d[1],d[2],d[3]/255];},
  composite(fg,bg){const a=fg[3];return [Math.round(fg[0]*a+bg[0]*(1-a)),
    Math.round(fg[1]*a+bg[1]*(1-a)),Math.round(fg[2]*a+bg[2]*(1-a))];},
  lum(rgb){const f=rgb.slice(0,3).map(v=>{const s=v/255;
    return s<=0.03928?s/12.92:Math.pow((s+0.055)/1.055,2.4);});
    return 0.2126*f[0]+0.7152*f[1]+0.0722*f[2];},
  ratio(f,b){const fg=this.toRgb(f),bg=this.toRgb(b);
    const s=fg[3]<1?this.composite(fg,bg):fg.slice(0,3);
    const L1=this.lum(s),L2=this.lum(bg);const hi=Math.max(L1,L2),lo=Math.min(L1,L2);
    return Math.round(((hi+0.05)/(lo+0.05))*100)/100;},
  bgBehind(el){let n=el;while(n&&n!==document.documentElement){
    const bg=getComputedStyle(n).backgroundColor;
    if(this.toRgb(bg)[3]>0.95)return bg;n=n.parentElement;}
    return getComputedStyle(document.body).backgroundColor;}
};
"""


def run():
    pw, browser, ctx, page = launch()
    R = {"live": LIVE}
    errs = []
    page.on("console", lambda m: errs.append({"t": m.type, "x": m.text[:160]})
            if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: errs.append({"t": "pageerror", "x": str(e)[:160]}))

    page.goto(LIVE, wait_until="load")
    page.wait_for_timeout(2500)

    R["served_build"] = page.evaluate(
        """() => {
            const s = document.querySelector('script[src*="?v="]');
            return {assetHash: s ? (s.getAttribute('src').match(/\\?v=([a-f0-9]+)/)||[])[1] : null,
                    scriptCount: document.querySelectorAll('script[src*="?v="]').length};
        }"""
    )

    # import the real backup on the LIVE site
    raw = json.loads(pathlib.Path(BACKUP).read_text())
    page.evaluate(
        """async (dump) => {
            for (const st of Object.keys(dump.data))
                for (const row of dump.data[st]) await MC.Store.put(st, row);
            await MCS.loadAll();
        }""",
        raw,
    )
    page.wait_for_timeout(700)
    page.evaluate(JS_LIB)

    A = {}
    A["data"] = page.evaluate("() => ({bikes: MCS.S.bikes.length, checks: MCS.S.checks.length, "
                              "reminders: MCS.S.reminders.length, name: (MCS.activeBike()||{}).nickname})")

    # P0 on production
    A["p0"] = page.evaluate(
        """() => {
            const out = {};
            ['matic-baru','matic-lama','bebek-manual','sport'].forEach(seg => {
                const ids = MC.componentsFor(seg).map(c=>c.id);
                const rems = MCS.defaultReminders('x', seg).map(r=>r.kind);
                out[seg] = {n: ids.length, hasCvt: ids.includes('cvt'), hasRantai: ids.includes('rantai-gear'),
                    consistent: (rems.includes('cvt')===ids.includes('cvt'))
                        && (rems.includes('rantai-gear')===ids.includes('rantai-gear'))};
            });
            return out;
        }"""
    )
    A["p0_consistent"] = all(v["consistent"] for v in A["p0"].values())

    # P1 score panel on production
    page.evaluate("() => { MCPages.care.setTab('cek'); MCApp.go('care'); }")
    page.wait_for_timeout(700)
    page.evaluate("() => { const d=document.querySelector('details.sd'); if(d) d.open=true; }")
    page.wait_for_timeout(600)
    A["p1_score_panel"] = page.evaluate(
        """() => {
            const d = document.querySelector('details.sd');
            if (!d) return {present:false};
            const t = d.innerText.toLowerCase();
            return {present:true, rows: d.querySelectorAll('.sd-row').length,
                    hasFormula: !!d.querySelector('.sd-formula'),
                    formula: d.querySelector('.sd-formula').textContent.slice(0,90),
                    hasWeights: /bobot \\d/.test(t)};
        }"""
    )

    # P1 interval notice
    page.evaluate("() => { MCPages.care.setTab('reminder'); MCApp.go('care'); }")
    page.wait_for_timeout(700)
    A["p1_interval_notice"] = page.evaluate(
        """() => { const t = document.getElementById('view').innerText.toLowerCase();
            return {shown: t.includes('belum diverifikasi') && t.includes('bukan dari')}; }"""
    )

    # contrast both themes on production
    R["contrast"] = {}
    for theme in ("dark", "light"):
        page.evaluate("(t) => MCTheme.set(t)", theme)
        page.wait_for_timeout(500)
        page.evaluate(JS_LIB)
        agg = {"pairs": 0, "fails": [], "min": None}
        for route, tab in (("home", None), ("care", "cek"), ("care", "reminder"),
                           ("history", "biaya"), ("garage", None), ("profile", None)):
            if tab and route == "care":
                page.evaluate("(t) => MCPages.care.setTab(t)", tab)
            if tab and route == "history":
                page.evaluate("(t) => MCPages.history.setTab(t)", tab)
            page.evaluate("(r) => MCApp.go(r)", route)
            page.wait_for_timeout(400)
            got = page.evaluate(
                """() => {
                    const out=[];const seen=new Set();
                    document.querySelectorAll('#view *, .appbar *, .navbar *').forEach(el=>{
                        if(!el.childNodes.length) return;
                        const hasText=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim().length>1);
                        if(!hasText) return;
                        const r=el.getBoundingClientRect(); if(r.width<1||r.height<1) return;
                        const s=getComputedStyle(el);
                        if(s.visibility==='hidden'||+s.opacity===0) return;
                        const bg=__A.bgBehind(el);
                        const key=s.color+'|'+bg+'|'+s.fontSize+'|'+s.fontWeight;
                        if(seen.has(key)) return; seen.add(key);
                        out.push({text:el.textContent.trim().slice(0,26),cls:(el.className||'').toString().slice(0,26),
                            fg:s.color,bg:bg,size:parseFloat(s.fontSize),weight:s.fontWeight,
                            ratio:__A.ratio(s.color,bg)});
                    });
                    return out;
                }"""
            )
            for p in got:
                large = p["size"] >= 24 or (p["size"] >= 18.66 and int(p["weight"] or 400) >= 700)
                need = 3.0 if large else 4.5
                agg["pairs"] += 1
                if agg["min"] is None or p["ratio"] < agg["min"]:
                    agg["min"] = p["ratio"]
                if p["ratio"] < need:
                    agg["fails"].append({**p, "need": need, "route": route})
        R["contrast"][theme] = agg
    page.evaluate("() => MCTheme.set('dark')")

    # layout + touch on production
    page.evaluate("() => MCApp.go('home')")
    page.wait_for_timeout(500)
    R["layout"] = page.evaluate(
        """() => {
            window.scrollTo(0, document.documentElement.scrollHeight);
            const nav=document.querySelector('.navbar');const navTop=nav.getBoundingClientRect().top;
            const last=document.querySelector('.page').lastElementChild;
            const lb=last?last.getBoundingClientRect().bottom:null;
            return {overflowX:document.documentElement.scrollWidth>window.innerWidth,
                navTop:Math.round(navTop),lastElBottom:lb===null?null:Math.round(lb),
                navOverlapsLast:lb!==null&&lb>navTop};
        }"""
    )
    R["touch"] = page.evaluate(
        """() => { let n=0;
            document.querySelectorAll('button,a,input,select,[data-act]').forEach(el=>{
                const r=el.getBoundingClientRect();
                if(r.width<1||r.height<1) return;
                if(r.width<24||r.height<24) n++;
            }); return n; }"""
    )

    # PWA installability on production
    R["pwa"] = page.evaluate(
        """async () => {
            const m = document.querySelector('link[rel=manifest]');
            const res = m ? await fetch(m.href).then(r=>r.json()).catch(()=>null) : null;
            const reg = await navigator.serviceWorker.getRegistration();
            return {manifest: !!res, name: res ? res.name : null,
                    display: res ? res.display : null, icons: res ? res.icons.length : null,
                    swActive: reg ? !!reg.active : false};
        }"""
    )

    R["acceptance"] = A
    R["console"] = errs
    print(json.dumps(R, indent=1, ensure_ascii=False))

    browser.close()
    pw.stop()


if __name__ == "__main__":
    run()
