#!/usr/bin/env python3
"""MOTORCARE BASELINE AUDIT — measure before touching any code.

Stores result to _audit/baseline.json. Contrast is measured by resolving colours
through canvas -> composite alpha -> relative luminance. NOT by regex on
getComputedStyle: the tokens are oklch()/oklab(), and a regex parser silently
returns ratio 1.0 for every pair. That mistake was made twice before.
"""
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from harness import start_server, launch  # noqa: E402

OUT = pathlib.Path(__file__).resolve().parent / "baseline.json"
BACKUP = pathlib.Path(
    "/home/ubuntu/.hermes/cache/documents/doc_3009baf8a237_motorcare-backup-2026-11-26.json"
)

# ---- injected measurement library (runs in the page) ----
JS_LIB = r"""
window.__A = {
  // resolve ANY css colour string (oklch/oklab/color-mix/rgba) to sRGB 0-255
  // by letting the browser rasterise it on a 1x1 canvas.
  toRgb(css) {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.clearRect(0, 0, 1, 1);
    x.fillStyle = '#000';           // sentinel; catch failures below
    x.fillStyle = css;
    if (x.fillStyle === '#000000' && !/^(#000|black|rgb\(0,\s*0,\s*0)/i.test(String(css).trim())) {
      // fillStyle rejected the value -> it stays the previous value
      x.fillStyle = '#000';
    }
    x.fillRect(0, 0, 1, 1);
    const d = x.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  },
  // composite fg over bg using real alpha
  composite(fg, bg) {
    const a = fg[3];
    return [
      Math.round(fg[0] * a + bg[0] * (1 - a)),
      Math.round(fg[1] * a + bg[1] * (1 - a)),
      Math.round(fg[2] * a + bg[2] * (1 - a)),
    ];
  },
  lum(rgb) {
    const f = rgb.slice(0, 3).map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
  },
  ratio(fgCss, bgCss) {
    const fg = this.toRgb(fgCss);
    const bg = this.toRgb(bgCss);
    // if fg is translucent, composite against the actual bg first
    const solid = fg[3] < 1 ? this.composite(fg, bg) : fg.slice(0, 3);
    const L1 = this.lum(solid), L2 = this.lum(bg);
    const hi = Math.max(L1, L2), lo = Math.min(L1, L2);
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
  },
  // effective background behind an element: walk up until an opaque bg is found
  bgBehind(el) {
    let n = el;
    while (n && n !== document.documentElement) {
      const bg = getComputedStyle(n).backgroundColor;
      const rgb = this.toRgb(bg);
      if (rgb[3] > 0.95) return bg;
      n = n.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor;
  }
};
"""


def run():
    httpd, port = start_server()
    url = f"http://127.0.0.1:{port}/"
    pw, browser, ctx, page = launch()
    R = {"url": url, "viewport": "390x844"}

    page.goto(url, wait_until="load")
    page.wait_for_timeout(900)
    page.evaluate(JS_LIB)

    # ---------- 1. import the REAL user backup ----------
    raw = json.loads(BACKUP.read_text())
    page.evaluate(
        """async (dump) => {
            for (const store of Object.keys(dump.data)) {
                for (const row of dump.data[store]) {
                    await MC.Store.put(store, row);
                }
            }
            await MCS.loadAll();
        }""",
        raw,
    )
    page.wait_for_timeout(600)
    page.reload(wait_until="load")
    page.wait_for_timeout(900)
    page.evaluate(JS_LIB)

    R["data"] = page.evaluate(
        """() => ({
            bikes: MCS.S.bikes.map(b => ({id:b.id, nick:b.nickname, segment:b.segment||null,
                trans:b.transmission, year:b.year, km:b.currentKm})),
            services: MCS.S.services.length,
            checks: MCS.S.checks.length,
            reminders: MCS.S.reminders.length,
            odoLog: MCS.S.odoLog.length
        })"""
    )

    # ---------- 2. P0: components are global, not per-vehicle ----------
    R["p0_components"] = page.evaluate(
        """() => {
            const bike = MCS.activeBike();
            const ctx = MCS.ctxFor(bike);
            const health = MCD.healthScore(bike, ctx);
            const rems = MCD.buildReminders(bike, ctx.services, ctx.reminders,
                MCD.currentKm(bike, ctx.odoLog, ctx.services));
            const remKinds = rems.map(r => r.kind);
            return {
                segment: bike.segment,
                transmission: bike.transmission,
                globalComponents: MC.COMPONENTS.map(c => c.id),
                globalCount: MC.COMPONENTS.length,
                healthTotal: health.total,
                healthChecked: health.checked,
                score: health.score,
                // does a manual bike get asked about CVT?
                remindersHaveCvt: remKinds.includes('cvt'),
                remindersHaveOliGardan: remKinds.includes('oli-gardan'),
                remindersHaveRantai: remKinds.includes('rantai-gear'),
                checkFormComponents: MC.COMPONENTS.length
            };
        }"""
    )

    # ---------- 3. simulate a manual bike: does the check list still show CVT? ----------
    R["p0_manual_sim"] = page.evaluate(
        """() => {
            const bike = Object.assign({}, MCS.activeBike(), {
                id: '__probe_manual', nickname: '__probe', transmission: 'manual',
                segment: 'bebek-manual'
            });
            const rems = MCS.defaultReminders(bike.id, 'bebek-manual').map(r => r.kind);
            const health = MCD.healthScore(bike, {checks: [], services: [], damages: [],
                reminders: [], odoLog: []});
            return {
                manualReminderKinds: rems,
                manualHasCvtReminder: rems.includes('cvt'),
                manualHealthTotal: health.total,
                // the checks the UI would offer for this bike:
                uiComponentCount: MC.COMPONENTS.length,
                contradiction: !rems.includes('cvt') && MC.COMPONENTS.some(c => c.id === 'cvt')
            };
        }"""
    )

    # ---------- 4. P1: matic-lama interval provenance ----------
    R["p1_intervals"] = page.evaluate(
        """() => ({
            maticLama: MC.SEGMENT_INTERVALS['matic-lama'],
            hints: MC.BIKE_SEGMENTS.map(s => ({id:s.id, label:s.label, hint:s.hint})),
            // is any interval labelled as unverified anywhere in the UI?
            uiSaysUnverified: document.body.innerText.toLowerCase().includes('belum terverifikasi'),
            uiSaysManualBook: document.body.innerText.toLowerCase().includes('buku servis'),
            bikeSegmentIsSet: !!(MCS.activeBike() || {}).segment
        })"""
    )

    # ---------- 5. P1: score explanation detail ----------
    page.evaluate("""() => { MCPages.care.setTab('cek'); MCApp.go('care'); }""")
    page.wait_for_timeout(500)
    R["p1_score_expl"] = page.evaluate(
        """() => {
            const txt = document.getElementById('view').innerText;
            return {
                visibleFactorLines: (txt.match(/:/g) || []).length,
                hasWeightBreakdown: /bobot/i.test(txt),
                hasExpandableDetail: !!document.querySelector('[data-score-detail], details, .acc-head'),
                hasPerComponentValue: /100%|70%|40%|10%/.test(txt),
                bodyHasPenaltyList: /penalti/i.test(txt)
            };
        }"""
    )

    # ---------- 6. P2: component states in CSS ----------
    R["p2_states"] = page.evaluate(
        """() => {
            const grab = (sel) => {
                const el = document.querySelector(sel);
                if (!el) return null;
                const s = getComputedStyle(el);
                return {bg: s.backgroundColor, color: s.color, opacity: s.opacity,
                        transition: s.transitionProperty, cursor: s.cursor,
                        ariaBusy: el.getAttribute('aria-busy'),
                        disabled: el.disabled === true};
            };
            return {
                btn: grab('.btn.primary'),
                row: grab('button.row'),
                inp: grab('.inp'),
                comp: grab('.comp'),
                // do any async controls expose a busy state?
                anyAriaBusy: !!document.querySelector('[aria-busy]'),
                anySpinner: !!document.querySelector('.spinner, .loading, [data-loading]'),
                // disabled buttons present in DOM right now?
                disabledCount: document.querySelectorAll('[disabled]').length
            };
        }"""
    )

    # ---------- 7. contrast: BOTH themes, real rendered pairs ----------
    R["contrast"] = {}
    for theme in ("dark", "light"):
        page.evaluate("(t) => MCTheme.set(t)", theme)
        page.wait_for_timeout(350)
        page.evaluate(JS_LIB)
        pairs = []
        for route, tab in (("home", None), ("care", "cek"), ("care", "reminder"),
                           ("history", "biaya"), ("garage", None), ("profile", None)):
            if tab and route == "care":
                page.evaluate("(t) => MCPages.care.setTab(t)", tab)
            if tab and route == "history":
                page.evaluate("(t) => MCPages.history.setTab(t)", tab)
            page.evaluate("(r) => MCApp.go(r)", route)
            page.wait_for_timeout(380)
            got = page.evaluate(
                """() => {
                    const out = [];
                    const seen = new Set();
                    // every text-bearing leaf node in the visible view
                    document.querySelectorAll('#view *, .appbar *, .navbar *').forEach((el) => {
                        if (!el.childNodes.length) return;
                        const hasText = Array.from(el.childNodes)
                            .some(n => n.nodeType === 3 && n.textContent.trim().length > 1);
                        if (!hasText) return;
                        const r = el.getBoundingClientRect();
                        if (r.width < 1 || r.height < 1) return;
                        const s = getComputedStyle(el);
                        if (s.visibility === 'hidden' || +s.opacity === 0) return;
                        const bg = __A.bgBehind(el);
                        const key = s.color + '|' + bg + '|' + s.fontSize + '|' + s.fontWeight;
                        if (seen.has(key)) return;
                        seen.add(key);
                        out.push({
                            text: el.textContent.trim().slice(0, 32),
                            cls: el.className && typeof el.className === 'string' ? el.className.slice(0, 40) : '',
                            fg: s.color, bg: bg, size: parseFloat(s.fontSize),
                            weight: s.fontWeight,
                            ratio: __A.ratio(s.color, bg)
                        });
                    });
                    return out;
                }"""
            )
            for g in got:
                g["route"] = route + (":" + tab if tab else "")
                pairs.append(g)
        fails = []
        for p in pairs:
            large = p["size"] >= 24 or (p["size"] >= 18.66 and int(p["weight"] or 400) >= 700)
            need = 3.0 if large else 4.5
            if p["ratio"] < need:
                fails.append({**p, "need": need})
        R["contrast"][theme] = {
            "pairsChecked": len(pairs),
            "fails": fails,
            "min": min([p["ratio"] for p in pairs], default=None),
        }

    # ---------- 8. console errors across every route/tab ----------
    page.evaluate("() => MCTheme.set('dark')")
    errors = []
    page.on("console", lambda m: errors.append({"type": m.type, "text": m.text[:200]})
            if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: errors.append({"type": "pageerror", "text": str(e)[:200]}))
    for route, tab in (("home", None), ("garage", None), ("care", "servis"),
                       ("care", "reminder"), ("care", "cek"), ("history", "timeline"),
                       ("history", "rusak"), ("history", "biaya"), ("history", "odo"),
                       ("profile", None)):
        if tab and route == "care":
            page.evaluate("(t) => MCPages.care.setTab(t)", tab)
        if tab and route == "history":
            page.evaluate("(t) => MCPages.history.setTab(t)", tab)
        page.evaluate("(r) => MCApp.go(r)", route)
        page.wait_for_timeout(280)
    R["console"] = errors

    # ---------- 9. reflow & bottom nav ----------
    page.evaluate("() => MCApp.go('home')")
    page.wait_for_timeout(300)
    R["layout"] = page.evaluate(
        """() => {
            window.scrollTo(0, document.documentElement.scrollHeight);
            const nav = document.querySelector('.navbar');
            const navTop = nav.getBoundingClientRect().top;
            const page = document.querySelector('.page');
            const lastEl = page.lastElementChild;
            const lastBottom = lastEl ? lastEl.getBoundingClientRect().bottom : null;
            return {
                scrollW: document.documentElement.scrollWidth,
                innerW: window.innerWidth,
                overflowX: document.documentElement.scrollWidth > window.innerWidth,
                navTop: Math.round(navTop),
                lastElBottom: lastBottom === null ? null : Math.round(lastBottom),
                navOverlapsLast: lastBottom !== null && lastBottom > navTop
            };
        }"""
    )
    # 320px reflow
    page.set_viewport_size({"width": 320, "height": 720})
    page.wait_for_timeout(400)
    R["layout"]["reflow320"] = page.evaluate(
        "() => ({scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth})"
    )
    page.set_viewport_size({"width": 390, "height": 844})

    # ---------- 10. multi-vehicle scenario F (currently untested) ----------
    page.evaluate(
        """async () => {
            const a = MCS.activeBike();
            const b = Object.assign({}, a, {
                id: 'probe-bike-2', nickname: 'PROBE MOTOR 2',
                transmission: 'manual', segment: 'bebek-manual',
                currentKm: 45000, photos: {}, plate: 'B 9999 ZZ'
            });
            await MC.Store.put('bikes', b);
            await MC.Store.put('services', {id:'probe-svc-2', bikeId:'probe-bike-2',
                types:['oli-mesin'], type:'oli-mesin', date:'2026-11-01', km:44000, cost:50000});
            await MC.Store.put('checks', {id:'probe-chk-2', bikeId:'probe-bike-2',
                component:'mesin', status:'segera', date:'2026-11-20', km:44900});
            await MCS.loadAll();
        }"""
    )
    page.wait_for_timeout(400)
    leaks = []
    for route in ("home", "garage", "care", "history", "profile"):
        page.evaluate("(r) => MCApp.go(r)", route)
        page.wait_for_timeout(260)
        txt = page.evaluate("() => document.getElementById('view').innerText")
        # bike A (PCX) is active; bike B's data must not show up
        if "PROBE MOTOR 2" in txt and route != "garage":
            leaks.append({"route": route, "leak": "PROBE MOTOR 2 name visible while PCX active"})
        if "44.000" in txt or "45.000" in txt:
            leaks.append({"route": route, "leak": "bike B km visible while PCX active"})
    # now switch to bike B and check A's data doesn't leak
    page.evaluate("async () => { await MCS.setActiveBike('probe-bike-2'); await MCS.loadAll(); MCApp.refresh(); }")
    page.wait_for_timeout(400)
    for route in ("home", "care", "history"):
        page.evaluate("(r) => MCApp.go(r)", route)
        page.wait_for_timeout(260)
        txt = page.evaluate("() => document.getElementById('view').innerText")
        if "PCX MANDAYY" in txt:
            leaks.append({"route": route + " (bike B active)", "leak": "PCX name visible"})
        if "12.168" in txt or "12168" in txt:
            leaks.append({"route": route + " (bike B active)", "leak": "PCX km visible"})
    R["scenarioF"] = {"leaks": leaks, "clean": len(leaks) == 0}

    # cleanup probe data + restore
    page.evaluate(
        """async () => {
            for (const st of ['services','checks','reminders','odoLog','damages','expenses','docs']) {
                const rows = await MC.Store.byBike(st, 'probe-bike-2');
                for (const r of rows) await MC.Store.del(st, r.id);
            }
            await MC.Store.del('bikes', 'probe-bike-2');
            await MCS.setActiveBike('mwxbvysvxfz5uwi');
            await MCS.loadAll();
        }"""
    )

    # ---------- 11. touch targets ----------
    page.evaluate("() => MCApp.go('home')")
    page.wait_for_timeout(300)
    R["touch"] = page.evaluate(
        """() => {
            const small = [];
            document.querySelectorAll('button, a, input, select, [data-act]').forEach((el) => {
                const r = el.getBoundingClientRect();
                if (r.width < 1 || r.height < 1) return;
                if (r.width < 24 || r.height < 24) {
                    small.push({tag: el.tagName, cls: (el.className||'').toString().slice(0,30),
                                w: Math.round(r.width), h: Math.round(r.height),
                                label: (el.textContent||'').trim().slice(0,24)});
                }
            });
            return {under24: small, count: small.length};
        }"""
    )

    # ---------- 12. storage / limits status ----------
    R["storage"] = page.evaluate(
        """async () => {
            const est = navigator.storage && navigator.storage.estimate
                ? await navigator.storage.estimate() : null;
            return {estimate: est ? {usage: est.usage, quota: est.quota} : null};
        }"""
    )

    out = json.dumps(R, indent=2, ensure_ascii=False)
    OUT.write_text(out)
    print(out[:6000])
    print("\n... written to", OUT)

    browser.close()
    pw.stop()
    httpd.shutdown()


if __name__ == "__main__":
    run()
