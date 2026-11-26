#!/usr/bin/env python3
"""FINAL verification on the built assets (after build.py + SW bump).

Re-runs every acceptance check and writes screenshots. This is the run whose
numbers go in the report.
"""
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from harness import start_server, launch  # noqa: E402

BACKUP = "/home/ubuntu/.hermes/cache/documents/doc_3009baf8a237_motorcare-backup-2026-11-26.json"
SHOTS = pathlib.Path(__file__).resolve().parent / "shots"
SHOTS.mkdir(exist_ok=True)
OUT = pathlib.Path(__file__).resolve().parent / "final.json"

JS_LIB = r"""
window.__A = {
  toRgb(css) {
    const c=document.createElement('canvas'); c.width=c.height=1;
    const x=c.getContext('2d',{willReadFrequently:true}); x.clearRect(0,0,1,1);
    x.fillStyle=css; x.fillRect(0,0,1,1);
    const d=x.getImageData(0,0,1,1).data; return [d[0],d[1],d[2],d[3]/255];
  },
  composite(fg,bg){const a=fg[3];return [Math.round(fg[0]*a+bg[0]*(1-a)),Math.round(fg[1]*a+bg[1]*(1-a)),Math.round(fg[2]*a+bg[2]*(1-a))];},
  lum(rgb){const f=rgb.slice(0,3).map(v=>{const s=v/255;return s<=0.03928?s/12.92:Math.pow((s+0.055)/1.055,2.4);});return 0.2126*f[0]+0.7152*f[1]+0.0722*f[2];},
  ratio(f,b){const fg=this.toRgb(f),bg=this.toRgb(b);const s=fg[3]<1?this.composite(fg,bg):fg.slice(0,3);
    const L1=this.lum(s),L2=this.lum(bg);const hi=Math.max(L1,L2),lo=Math.min(L1,L2);
    return Math.round(((hi+0.05)/(lo+0.05))*100)/100;},
  bgBehind(el){let n=el;while(n&&n!==document.documentElement){const bg=getComputedStyle(n).backgroundColor;
    if(this.toRgb(bg)[3]>0.95)return bg;n=n.parentElement;}return getComputedStyle(document.body).backgroundColor;}
};
"""


def collect_contrast(page):
    got = page.evaluate(
        """() => {
            const out=[]; const seen=new Set();
            document.querySelectorAll('#view *, .appbar *, .navbar *').forEach((el)=>{
                if(!el.childNodes.length) return;
                const hasText=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim().length>1);
                if(!hasText) return;
                const r=el.getBoundingClientRect(); if(r.width<1||r.height<1) return;
                const s=getComputedStyle(el);
                if(s.visibility==='hidden'||+s.opacity===0) return;
                const bg=__A.bgBehind(el);
                const key=s.color+'|'+bg+'|'+s.fontSize+'|'+s.fontWeight;
                if(seen.has(key)) return; seen.add(key);
                out.push({text:el.textContent.trim().slice(0,28),
                    cls:(el.className||'').toString().slice(0,30),
                    fg:s.color,bg:bg,size:parseFloat(s.fontSize),weight:s.fontWeight,
                    ratio:__A.ratio(s.color,bg)});
            });
            return out;
        }"""
    )
    fails = []
    worst = None
    for p in got:
        large = p["size"] >= 24 or (p["size"] >= 18.66 and int(p["weight"] or 400) >= 700)
        need = 3.0 if large else 4.5
        if worst is None or p["ratio"] < worst["ratio"]:
            worst = {**p, "need": need, "large": large}
        if p["ratio"] < need:
            fails.append({**p, "need": need})
    return {"pairs": len(got), "fails": fails, "worst": worst,
            "min": min([p["ratio"] for p in got], default=None)}


def run():
    httpd, port = start_server()
    pw, browser, ctx, page = launch()
    R = {}
    errs = []
    page.on("console", lambda m: errs.append({"t": m.type, "x": m.text[:180]})
            if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: errs.append({"t": "pageerror", "x": str(e)[:180]}))

    page.goto(f"http://127.0.0.1:{port}/", wait_until="load")
    page.wait_for_timeout(1000)

    # confirm the BUILD is what we are testing, not stale files
    R["build"] = page.evaluate(
        """() => {
            const s = document.querySelector('script[src*="?v="]');
            return {assetHash: s ? (s.getAttribute('src').match(/\\?v=([a-f0-9]+)/)||[])[1] : null,
                    scriptCount: document.querySelectorAll('script[src*="?v="]').length,
                    swVersion: null};
        }"""
    )
    R["build"]["swVersion"] = page.evaluate(
        "async () => { const r = await navigator.serviceWorker.getRegistration(); return r ? 'registered' : 'none'; }"
    )

    raw = json.loads(pathlib.Path(BACKUP).read_text())
    page.evaluate(
        """async (dump) => {
            for (const st of Object.keys(dump.data))
                for (const row of dump.data[st]) await MC.Store.put(st, row);
            await MCS.loadAll();
        }""",
        raw,
    )
    page.reload(wait_until="load")
    page.wait_for_timeout(1000)
    page.evaluate(JS_LIB)

    # ---------- acceptance checks ----------
    A = {}
    A["p0_components_per_segment"] = page.evaluate(
        """() => {
            const out = {};
            ['matic-baru','matic-lama','bebek-manual','sport'].forEach(seg => {
                const ids = MC.componentsFor(seg).map(c=>c.id);
                const rems = MCS.defaultReminders('x', seg).map(r=>r.kind);
                const h = MCD.healthScore({id:'p',segment:seg,transmission:seg==='bebek-manual'?'manual':'matik'},
                    {checks:[],services:[],damages:[],reminders:[],odoLog:[]});
                out[seg] = {n: ids.length, hasCvt: ids.includes('cvt'), hasRantai: ids.includes('rantai-gear'),
                    total: h.total, consistent: (rems.includes('cvt')===ids.includes('cvt'))
                        && (rems.includes('rantai-gear')===ids.includes('rantai-gear'))};
            });
            return out;
        }"""
    )
    A["p0_all_segments_consistent"] = all(v["consistent"] for v in A["p0_components_per_segment"].values())

    # interval notice in UI
    page.evaluate("() => { MCPages.care.setTab('reminder'); MCApp.go('care'); }")
    page.wait_for_timeout(500)
    A["p1_interval_notice"] = page.evaluate(
        """() => { const t = document.getElementById('view').innerText.toLowerCase();
            return {shown: t.includes('belum diverifikasi') && t.includes('bukan dari'), 
                    exact: (document.getElementById('view').innerText.match(/Angka awal[^\\n]{0,90}/)||[''])[0]}; }"""
    )

    # score panel
    page.evaluate("() => { MCPages.care.setTab('cek'); MCApp.go('care'); }")
    page.wait_for_timeout(500)
    page.evaluate("() => { const d=document.querySelector('details.sd'); if(d) d.open=true; }")
    page.wait_for_timeout(400)
    A["p1_score_panel"] = page.evaluate(
        """() => {
            const d = document.querySelector('details.sd');
            if (!d) return {present:false};
            const t = d.innerText.toLowerCase();
            return {present:true, formula: d.querySelector('.sd-formula').textContent,
                    rows: d.querySelectorAll('.sd-row').length,
                    hasWeights: /bobot \\d/.test(t), hasValues: /\\d{1,3}%/.test(t),
                    hasPenaltySection: /penalti yang diterapkan/.test(t)};
        }"""
    )

    # async state
    page.evaluate("() => MCApp.go('profile')")
    page.wait_for_timeout(400)
    A["p2_async_state"] = page.evaluate(
        """async () => {
            const btn = document.querySelector('[data-act="export-json"]');
            const p = MCData.exportJson(btn);
            // sample ::after WHILE busy — reading it after await returns "none"
            const cssDuring = getComputedStyle(btn, '::after');
            const during = {busy: btn.getAttribute('aria-busy'), disabled: btn.disabled,
                            spinnerW: cssDuring.width, spinnerAnim: cssDuring.animationName,
                            spinnerContent: cssDuring.content};
            await p;
            const cssAfter = getComputedStyle(btn, '::after');
            const after = {busy: btn.getAttribute('aria-busy'), disabled: btn.disabled,
                           spinnerAnim: cssAfter.animationName};
            // and the row variant used by import/export from the Profile list
            const rowBtn = document.querySelector('.row[data-act="export-json"]');
            let rowDuring = null;
            if (rowBtn) {
                const p2 = MCData.exportJson(rowBtn);
                const rc = getComputedStyle(rowBtn, '::after');
                rowDuring = {busy: rowBtn.getAttribute('aria-busy'),
                             spinnerW: rc.width, spinnerAnim: rc.animationName};
                await p2;
            }
            return {during, after, rowDuring};
        }"""
    )

    # ---------- screenshots ----------
    page.evaluate("() => { MCPages.care.setTab('cek'); MCApp.go('care'); }")
    page.wait_for_timeout(600)
    page.evaluate("() => { const d=document.querySelector('details.sd'); if(d) d.open=true; }")
    page.wait_for_timeout(400)
    page.screenshot(path=str(SHOTS / "01-score-panel-dark.png"), full_page=True)
    page.evaluate("() => MCTheme.set('light')")
    page.wait_for_timeout(500)
    page.screenshot(path=str(SHOTS / "02-score-panel-light.png"), full_page=True)
    page.evaluate("() => MCTheme.set('dark')")
    page.wait_for_timeout(400)

    page.evaluate("() => { MCPages.care.setTab('reminder'); MCApp.go('care'); }")
    page.wait_for_timeout(600)
    page.screenshot(path=str(SHOTS / "03-reminder-notice-dark.png"), full_page=True)
    page.evaluate("() => MCTheme.set('light')")
    page.wait_for_timeout(500)
    page.screenshot(path=str(SHOTS / "04-reminder-light.png"), full_page=True)
    page.evaluate("() => MCTheme.set('dark')")
    page.wait_for_timeout(400)

    page.evaluate("() => MCApp.go('home')")
    page.wait_for_timeout(500)
    page.screenshot(path=str(SHOTS / "05-home-dark.png"), full_page=True)

    # ---------- contrast, all routes, both themes ----------
    R["contrast"] = {}
    for theme in ("dark", "light"):
        page.evaluate("(t) => MCTheme.set(t)", theme)
        page.wait_for_timeout(400)
        page.evaluate(JS_LIB)
        agg = {"pairs": 0, "fails": [], "min": None}
        for route, tab in (("home", None), ("garage", None), ("care", "servis"),
                           ("care", "reminder"), ("care", "cek"), ("history", "timeline"),
                           ("history", "rusak"), ("history", "biaya"), ("history", "odo"),
                           ("profile", None)):
            if tab and route == "care":
                page.evaluate("(t) => MCPages.care.setTab(t)", tab)
            if tab and route == "history":
                page.evaluate("(t) => MCPages.history.setTab(t)", tab)
            page.evaluate("(r) => MCApp.go(r)", route)
            page.wait_for_timeout(330)
            c = collect_contrast(page)
            agg["pairs"] += c["pairs"]
            agg["fails"] += [{**f, "route": route + (":" + tab if tab else "")} for f in c["fails"]]
            if c["min"] is not None and (agg["min"] is None or c["min"] < agg["min"]):
                agg["min"] = c["min"]
                agg["worst"] = {**c["worst"], "route": route + (":" + tab if tab else "")}
        R["contrast"][theme] = agg
    page.evaluate("() => MCTheme.set('dark')")

    # ---------- layout / touch / console ----------
    page.evaluate("() => MCApp.go('home')")
    page.wait_for_timeout(400)
    R["layout"] = page.evaluate(
        """() => {
            window.scrollTo(0, document.documentElement.scrollHeight);
            const nav=document.querySelector('.navbar'); const navTop=nav.getBoundingClientRect().top;
            const last=document.querySelector('.page').lastElementChild;
            const lb=last?last.getBoundingClientRect().bottom:null;
            return {scrollW:document.documentElement.scrollWidth, innerW:window.innerWidth,
                overflowX:document.documentElement.scrollWidth>window.innerWidth,
                navTop:Math.round(navTop), lastElBottom:lb===null?null:Math.round(lb),
                navOverlapsLast:lb!==null&&lb>navTop};
        }"""
    )
    page.set_viewport_size({"width": 320, "height": 720})
    page.wait_for_timeout(500)
    R["layout"]["reflow320_home"] = page.evaluate(
        "() => ({sw: document.documentElement.scrollWidth, iw: window.innerWidth})")
    page.evaluate("() => { MCPages.care.setTab('cek'); MCApp.go('care'); }")
    page.wait_for_timeout(500)
    page.evaluate("() => { const d=document.querySelector('details.sd'); if(d) d.open=true; }")
    page.wait_for_timeout(400)
    R["layout"]["reflow320_scoreOpen"] = page.evaluate(
        "() => ({sw: document.documentElement.scrollWidth, iw: window.innerWidth})")
    page.screenshot(path=str(SHOTS / "06-320px-score-open.png"), full_page=True)
    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(400)

    R["touch"] = page.evaluate(
        """() => {
            const small=[];
            document.querySelectorAll('button,a,input,select,[data-act]').forEach(el=>{
                const r=el.getBoundingClientRect();
                if(r.width<1||r.height<1) return;
                if(r.width<24||r.height<24) small.push({w:Math.round(r.width),h:Math.round(r.height),
                    label:(el.textContent||'').trim().slice(0,20)});
            });
            return {count: small.length, items: small};
        }"""
    )

    # functional smoke on final build
    R["smoke"] = page.evaluate(
        """async () => {
            const b = MCS.activeBike(); const before = MCS.S.checks.length;
            // date must be LATER than any existing check for the same component,
            // otherwise the tie-break keeps the old "sehat" row and nothing changes
            await MC.Store.put('checks', {id:'fin-1', bikeId:b.id, component:'oli',
                status:'perlu-perawatan', date:'2027-06-01', km:12168, note:'final'});
            await MCS.loadAll();
            const mid = MCS.S.checks.length;
            const h = MCD.healthScore(MCS.activeBike(), MCS.ctxFor(MCS.activeBike()));
            await MC.Store.del('checks','fin-1'); await MCS.loadAll();
            return {saved: mid===before+1, scoreWithBadOli: h.score, base: h.base, total: h.total};
        }"""
    )

    # regression: a corrupt status string must NOT be scored as "Sehat" (100).
    # Decisive test on a FRESH bike whose only check has an unknown status:
    # nothing is countable, so the score must be null -- not 100.
    R["unknown_status"] = page.evaluate(
        """async () => {
            await MC.Store.put('bikes', {id:'bad-bike', nickname:'BAD', brand:'Honda',
                model:'X', year:2024, transmission:'matik', segment:'matic-baru',
                startKm:0, currentKm:1000, currentKmDate:'2026-11-26', photos:{}});
            await MC.Store.put('checks', {id:'bad-1', bikeId:'bad-bike', component:'mesin',
                status:'RUSAK_TOTAL', date:'2026-11-26', km:1000});
            await MCS.setActiveBike('bad-bike');
            await MCS.loadAll();
            const h = MCD.healthScore(MCS.activeBike(), MCS.ctxFor(MCS.activeBike()));
            const mesinRow = h.breakdown.find(x => x.id === 'mesin');
            const sanitized = MCData.sanitizeRow('checks',
                {id:'x', bikeId:'bad-bike', component:'mesin', status:'RUSAK_TOTAL'});
            const sanitizedDamage = MCData.sanitizeRow('damages',
                {id:'y', bikeId:'bad-bike', name:'n', status:'ANEHPOL'});
            // cleanup
            await MC.Store.del('checks','bad-1');
            await MC.Store.del('bikes','bad-bike');
            await MCS.setActiveBike('mwxbvysvxfz5uwi');
            await MCS.loadAll();
            return {
                scoreIsNull: h.score === null,
                score: h.score,
                checked: h.checked,
                mesinExcluded: mesinRow && mesinRow.counted === false,
                mesinStatusLabel: mesinRow ? mesinRow.statusLabel : null,
                sanitizedCheckStatus: sanitized.status,
                sanitizedDamageStatus: sanitizedDamage.status
            };
        }"""
    )

    R["acceptance"] = A
    R["console"] = errs
    OUT.write_text(json.dumps(R, indent=2, ensure_ascii=False))
    print(json.dumps({k: R[k] for k in ("build", "acceptance", "smoke", "layout", "touch")},
                     indent=1, ensure_ascii=False))
    print("\nCONTRAST:", json.dumps({k: {"pairs": v["pairs"], "min": v["min"],
                                        "fails": len(v["fails"]),
                                        "worst": {kk: v["worst"][kk] for kk in ("ratio","need","large","text","route")}}
                                    for k, v in R["contrast"].items()}, indent=1))
    print("CONSOLE:", json.dumps(errs))
    print("\nwritten", OUT)

    browser.close()
    pw.stop()
    httpd.shutdown()


if __name__ == "__main__":
    run()
