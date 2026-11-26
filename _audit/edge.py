#!/usr/bin/env python3
"""Edge-state verification: partial data, penalties, manual bike UI, empty state.

The real user backup has all 12 components checked and a perfect score, so it
never exercises the excluded-note or the penalty line. Those paths only run when
data is INCOMPLETE — which is the normal case for a new user. Testing only with
complete data would leave the most important branch unverified.
"""
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from harness import start_server, launch  # noqa: E402

OUT = pathlib.Path(__file__).resolve().parent / "edge.json"

JS_LIB = r"""
window.__A = {
  toRgb(css) {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.clearRect(0, 0, 1, 1);
    x.fillStyle = css; x.fillRect(0, 0, 1, 1);
    const d = x.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  },
  composite(fg, bg) {
    const a = fg[3];
    return [Math.round(fg[0]*a+bg[0]*(1-a)), Math.round(fg[1]*a+bg[1]*(1-a)), Math.round(fg[2]*a+bg[2]*(1-a))];
  },
  lum(rgb) {
    const f = rgb.slice(0,3).map(v => { const s=v/255; return s<=0.03928 ? s/12.92 : Math.pow((s+0.055)/1.055,2.4); });
    return 0.2126*f[0]+0.7152*f[1]+0.0722*f[2];
  },
  ratio(fgCss, bgCss) {
    const fg=this.toRgb(fgCss), bg=this.toRgb(bgCss);
    const solid = fg[3]<1 ? this.composite(fg,bg) : fg.slice(0,3);
    const L1=this.lum(solid), L2=this.lum(bg);
    const hi=Math.max(L1,L2), lo=Math.min(L1,L2);
    return Math.round(((hi+0.05)/(lo+0.05))*100)/100;
  },
  bgBehind(el) {
    let n = el;
    while (n && n !== document.documentElement) {
      const bg = getComputedStyle(n).backgroundColor;
      if (this.toRgb(bg)[3] > 0.95) return bg;
      n = n.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor;
  }
};
"""


def run():
    httpd, port = start_server()
    pw, browser, ctx, page = launch()
    R = {}
    errs = []
    page.on("console", lambda m: errs.append({"t": m.type, "x": m.text[:160]})
            if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: errs.append({"t": "pageerror", "x": str(e)[:160]}))

    page.goto(f"http://127.0.0.1:{port}/", wait_until="load")
    page.wait_for_timeout(900)
    page.evaluate(JS_LIB)

    # ---------- 1. EMPTY STATE (no bike at all) ----------
    R["empty"] = page.evaluate(
        """() => ({
            bikes: MCS.S.bikes.length,
            hasOnboarding: /Mulai rekam/i.test(document.body.innerText),
            h1Count: document.querySelectorAll('h1').length,
            navCount: document.querySelectorAll('[data-nav]').length
        })"""
    )
    for r in ("garage", "care", "history", "profile"):
        page.evaluate("(x) => MCApp.go(x)", r)
        page.wait_for_timeout(220)
    R["empty"]["routesSurviveNoBike"] = True

    # ---------- 2. PARTIAL DATA: 3 of 12 components + overdue + critical damage ----------
    page.evaluate(
        """async () => {
            const bike = {
                id: 'edge-bike', nickname: 'EDGE', brand: 'Honda', model: 'Vario',
                year: 2020, transmission: 'matik', segment: 'matic-baru',
                startKm: 0, startDate: '2020-01-01', currentKm: 30000,
                currentKmDate: '2026-11-20', photos: {}
            };
            await MC.Store.put('bikes', bike);
            // only 3 components checked, one of them bad
            const chk = [
                {component:'mesin', status:'sehat', date:'2026-11-20', km:30000},
                {component:'oli',   status:'perlu-perawatan', date:'2026-11-20', km:30000},
                {component:'rem-depan', status:'segera', date:'2026-11-20', km:30000}
            ];
            for (const c of chk) {
                await MC.Store.put('checks', Object.assign({id: MC.uid(), bikeId:'edge-bike'}, c));
            }
            // a critical damage
            await MC.Store.put('damages', {id:'edge-dmg', bikeId:'edge-bike', name:'Rem blong',
                part:'rem depan', priority:'kritis', status:'belum', date:'2026-11-01', km:29500});
            // an overdue reminder: oli last done at 1000 km, interval 4000
            await MC.Store.put('reminders', {id:'edge-rem', bikeId:'edge-bike', kind:'oli-mesin',
                label:'Ganti oli mesin', intervalKm:4000, intervalDays:120,
                lastDoneKm:1000, lastDoneDate:'2025-01-01', serviceType:'oli-mesin',
                active:true, soonKm:300, soonDays:21});
            await MCS.setActiveBike('edge-bike');
            await MCS.loadAll();
            MCApp.refresh();
        }"""
    )
    page.wait_for_timeout(600)

    page.evaluate("() => { MCPages.care.setTab('cek'); MCApp.go('care'); }")
    page.wait_for_timeout(500)
    page.evaluate("() => { const d = document.querySelector('details.sd'); if (d) d.open = true; }")
    page.wait_for_timeout(400)

    R["partial"] = page.evaluate(
        """() => {
            const d = document.querySelector('details.sd');
            const t = d ? d.innerText.toLowerCase() : '';
            const h = MCD.healthScore(MCS.activeBike(), MCS.ctxFor(MCS.activeBike()));
            return {
                score: h.score, base: h.base, checked: h.checked, total: h.total,
                penaltyCount: h.penalties.length,
                penaltyLabels: h.penalties.map(p => p.label),
                excludedCount: h.breakdown.filter(b => !b.counted).length,
                excludedNoteShown: /dikeluarkan dari penyebut/.test(t),
                excludedNoteText: (d ? d.innerText.match(/Dikeluarkan dari penyebut[^.]*\\.?/) : [''])[0] || '',
                finalLineShown: /penalti =/.test(t),
                finalLineText: (d ? d.innerText.match(/\\d+ − \\d+ penalti = \\d+/) : [''])[0] || '',
                formulaText: d ? d.querySelector('.sd-formula').textContent : '',
                penaltyRows: d ? [...d.querySelectorAll('.sd-row')].filter(r => /−/.test(r.textContent)).length : 0,
                notCountedShownInGrid: [...document.querySelectorAll('.comp .st')].filter(e => /Belum diperiksa/.test(e.textContent)).length
            };
        }"""
    )

    # ---------- 3. MANUAL BIKE: full UI, not just the form ----------
    page.evaluate(
        """async () => {
            await MC.Store.put('bikes', {
                id: 'edge-manual', nickname: 'MANUAL', brand: 'Honda', model: 'Supra',
                year: 2018, transmission: 'manual', segment: 'bebek-manual',
                startKm: 0, currentKm: 50000, photos: {}
            });
            await MCS.setActiveBike('edge-manual');
            await MCS.loadAll();
            MCApp.refresh();
        }"""
    )
    page.wait_for_timeout(600)
    page.evaluate("() => { MCPages.care.setTab('cek'); MCApp.go('care'); }")
    page.wait_for_timeout(450)
    R["manual"] = page.evaluate(
        """() => {
            const comps = [...document.querySelectorAll('.comp .name')].map(e => e.textContent);
            const h = MCD.healthScore(MCS.activeBike(), MCS.ctxFor(MCS.activeBike()));
            return {
                segment: h.segment, total: h.total,
                gridComponents: comps, gridCount: comps.length,
                gridHasCvt: comps.some(c => /CVT/i.test(c)),
                gridHasRantai: comps.some(c => /Rantai/i.test(c)),
                // no checks for this bike -> score must be null, not 0
                scoreIsNull: h.score === null,
                showsBelumAdaData: /Belum ada data/.test(document.getElementById('view').innerText),
                showsWhyEmpty: /tidak dianggap sehat/i.test(document.getElementById('view').innerText)
            };
        }"""
    )
    # reminder tab: no CVT/oli-gardan rows for a manual bike
    page.evaluate("() => { MCPages.care.setTab('reminder'); MCApp.go('care'); }")
    page.wait_for_timeout(450)
    R["manual"]["reminders"] = page.evaluate(
        """() => {
            const txt = document.getElementById('view').innerText;
            return {showsCvt: /Servis CVT/i.test(txt), showsOliGardan: /oli gardan/i.test(txt),
                    showsRantai: /Rantai & gear/i.test(txt)};
        }"""
    )

    # ---------- 4. contrast with the score panel OPEN, both themes ----------
    page.evaluate("async () => { await MCS.setActiveBike('edge-bike'); await MCS.loadAll(); MCPages.care.setTab('cek'); MCApp.go('care'); }")
    page.wait_for_timeout(500)
    page.evaluate("() => { const d = document.querySelector('details.sd'); if (d) d.open = true; }")
    page.wait_for_timeout(400)
    R["contrast_panel_open"] = {}
    for theme in ("dark", "light"):
        page.evaluate("(t) => MCTheme.set(t)", theme)
        page.wait_for_timeout(400)
        page.evaluate(JS_LIB)
        got = page.evaluate(
            """() => {
                const d = document.querySelector('details.sd');
                if (!d) return [];
                const out = [];
                d.querySelectorAll('*').forEach((el) => {
                    if (!el.childNodes.length) return;
                    const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1);
                    if (!hasText) return;
                    const r = el.getBoundingClientRect();
                    if (r.width < 1 || r.height < 1) return;
                    const s = getComputedStyle(el);
                    const bg = __A.bgBehind(el);
                    out.push({text: el.textContent.trim().slice(0,28), cls: (el.className||'').toString().slice(0,24),
                              fg: s.color, bg: bg, size: parseFloat(s.fontSize), weight: s.fontWeight,
                              ratio: __A.ratio(s.color, bg)});
                });
                return out;
            }"""
        )
        fails = []
        for p in got:
            large = p["size"] >= 24 or (p["size"] >= 18.66 and int(p["weight"] or 400) >= 700)
            need = 3.0 if large else 4.5
            if p["ratio"] < need:
                fails.append({**p, "need": need})
        R["contrast_panel_open"][theme] = {"pairs": len(got), "fails": fails,
                                           "min": min([p["ratio"] for p in got], default=None)}
    page.evaluate("() => MCTheme.set('dark')")

    # ---------- 5. cleanup Edge/Manual bikes, verify real backup still intact ----------
    page.evaluate(
        """async () => {
            for (const bid of ['edge-bike','edge-manual']) {
                for (const st of ['services','checks','reminders','odoLog','damages','expenses','docs']) {
                    const rows = await MC.Store.byBike(st, bid);
                    for (const r of rows) await MC.Store.del(st, r.id);
                }
                await MC.Store.del('bikes', bid);
            }
            await MCS.loadAll();
        }"""
    )
    R["nowBikes"] = page.evaluate("() => MCS.S.bikes.map(b => b.nickname)")
    R["console"] = errs

    OUT.write_text(json.dumps(R, indent=2, ensure_ascii=False))
    print(json.dumps(R, indent=1, ensure_ascii=False)[:6000])
    print("\n... written to", OUT)

    browser.close()
    pw.stop()
    httpd.shutdown()


if __name__ == "__main__":
    run()
