#!/usr/bin/env python3
"""MOTORCARE AFTER-AUDIT — same probes as baseline.py + the new features.

Comparing baseline.json against after.json is the point. A score computed only
at the end can always be made to look good.
"""
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from harness import start_server, launch  # noqa: E402

OUT = pathlib.Path(__file__).resolve().parent / "after.json"
BACKUP = pathlib.Path(
    "/home/ubuntu/.hermes/cache/documents/doc_3009baf8a237_motorcare-backup-2026-11-26.json"
)

JS_LIB = r"""
window.__A = {
  toRgb(css) {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.clearRect(0, 0, 1, 1);
    x.fillStyle = css;
    x.fillRect(0, 0, 1, 1);
    const d = x.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  },
  composite(fg, bg) {
    const a = fg[3];
    return [Math.round(fg[0]*a + bg[0]*(1-a)), Math.round(fg[1]*a + bg[1]*(1-a)),
            Math.round(fg[2]*a + bg[2]*(1-a))];
  },
  lum(rgb) {
    const f = rgb.slice(0,3).map((v) => {
      const s = v/255;
      return s <= 0.03928 ? s/12.92 : Math.pow((s+0.055)/1.055, 2.4);
    });
    return 0.2126*f[0] + 0.7152*f[1] + 0.0722*f[2];
  },
  ratio(fgCss, bgCss) {
    const fg = this.toRgb(fgCss), bg = this.toRgb(bgCss);
    const solid = fg[3] < 1 ? this.composite(fg, bg) : fg.slice(0,3);
    const L1 = this.lum(solid), L2 = this.lum(bg);
    const hi = Math.max(L1,L2), lo = Math.min(L1,L2);
    return Math.round(((hi+0.05)/(lo+0.05))*100)/100;
  },
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
    errors = []
    page.on("console", lambda m: errors.append({"type": m.type, "text": m.text[:200]})
            if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: errors.append({"type": "pageerror", "text": str(e)[:200]}))

    page.goto(url, wait_until="load")
    page.wait_for_timeout(900)
    page.evaluate(JS_LIB)

    raw = json.loads(BACKUP.read_text())
    page.evaluate(
        """async (dump) => {
            for (const st of Object.keys(dump.data))
                for (const row of dump.data[st]) await MC.Store.put(st, row);
            await MCS.loadAll();
        }""",
        raw,
    )
    page.reload(wait_until="load")
    page.wait_for_timeout(900)
    page.evaluate(JS_LIB)

    R["data"] = page.evaluate(
        """() => ({bikes: MCS.S.bikes.map(b => ({nick:b.nickname, segment:b.segment||null,
            trans:b.transmission, year:b.year, km:b.currentKm})),
            services: MCS.S.services.length, checks: MCS.S.checks.length,
            reminders: MCS.S.reminders.length})"""
    )

    # ---------- P0 verification: per-segment components ----------
    R["p0"] = page.evaluate(
        """() => {
            const bike = MCS.activeBike();
            const out = {active: {}, perSegment: {}};
            const ctx = MCS.ctxFor(bike);
            const h = MCD.healthScore(bike, ctx);
            out.active = {
                segment: h.segment, total: h.total, checked: h.checked, score: h.score,
                componentIds: MC.componentsFor(h.segment).map(c => c.id)
            };
            // every segment must produce a coherent, self-consistent component list
            ['matic-baru','matic-lama','bebek-manual','sport'].forEach((seg) => {
                const comps = MC.componentsFor(seg);
                const ids = comps.map(c => c.id);
                const rems = MCS.defaultReminders('probe', seg).map(r => r.kind);
                const hh = MCD.healthScore(
                    {id:'p', segment: seg, transmission: seg === 'bebek-manual' ? 'manual' : 'matik'},
                    {checks: [], services: [], damages: [], reminders: [], odoLog: []});
                out.perSegment[seg] = {
                    n: ids.length,
                    hasCvt: ids.includes('cvt'),
                    hasRantai: ids.includes('rantai-gear'),
                    healthTotal: hh.total,
                    reminderHasCvt: rems.includes('cvt'),
                    reminderHasRantai: rems.includes('rantai-gear'),
                    // the contradiction that existed before: reminder says no CVT,
                    // component list says CVT
                    contradiction: (rems.includes('cvt') !== ids.includes('cvt'))
                };
            });
            return out;
        }"""
    )

    # check form must not offer CVT to a manual bike
    R["p0_checkform"] = page.evaluate(
        """async () => {
            const orig = MCS.S.bikes.slice();
            // temporarily point active bike at a manual one
            const manual = Object.assign({}, MCS.activeBike(), {id:'__manual', segment:'bebek-manual', transmission:'manual'});
            MCS.S.bikes.push(manual); MCS.S.activeBikeId = '__manual';
            MCForms.checkForm();
            await new Promise(r => setTimeout(r, 400));
            const opts = [...document.querySelectorAll('.sheet select[name=component] option')].map(o => o.value);
            MCU.closeTopSheet();
            MCS.S.bikes = orig; MCS.S.activeBikeId = orig[0].id;
            return {offeredComponents: opts, offersCvt: opts.includes('cvt'),
                    offersRantai: opts.includes('rantai-gear'), count: opts.length};
        }"""
    )

    # ---------- P1: interval provenance visible in UI ----------
    page.evaluate("() => { MCPages.care.setTab('reminder'); MCApp.go('care'); }")
    page.wait_for_timeout(450)
    R["p1_interval_ui"] = page.evaluate(
        """() => {
            const t = document.getElementById('view').innerText.toLowerCase();
            return {
                saysUnverified: t.includes('belum diverifikasi'),
                saysNotManualBook: t.includes('bukan dari buku servis') || t.includes('bukan angka buku servis'),
                hasSourceLabel: t.includes('angka awal'),
                snippet: (document.getElementById('view').innerText.match(/Angka awal[^\\n]{0,120}/) || [''])[0]
            };
        }"""
    )

    R["p1_score_detail"] = {}
    page.evaluate("() => { MCPages.care.setTab('cek'); MCApp.go('care'); }")
    page.wait_for_timeout(450)
    R["p1_score_detail"]["closed"] = page.evaluate(
        """() => {
            const sd = document.querySelector('details.sd');
            return {hasDetails: !!sd, isOpen: sd ? sd.open : null,
                    summary: sd ? sd.querySelector('summary').textContent.trim() : null};
        }"""
    )
    page.evaluate("() => { const d = document.querySelector('details.sd'); if (d) d.open = true; }")
    page.wait_for_timeout(350)
    R["p1_score_detail"]["open"] = page.evaluate(
        """() => {
            const d = document.querySelector('details.sd');
            if (!d) return null;
            // innerText reflects CSS text-transform, so match case-insensitively:
            // the section headers render uppercase but the source is sentence case
            const t = d.innerText.toLowerCase();
            return {
                formula: (d.querySelector('.sd-formula') || {}).textContent || '',
                rows: d.querySelectorAll('.sd-row').length,
                sections: [...d.querySelectorAll('.sd-sec')].map(s => s.textContent),
                hasExcludedNote: /dikeluarkan dari penyebut/.test(t),
                hasPenaltySection: /penalti yang diterapkan/.test(t),
                hasWeightLabel: /bobot \\d/.test(t),
                hasComponentValues: /\\d{1,3}%/.test(t),
                finalLine: (d.innerText.match(/\\d+ − \\d+ penalti = \\d+/) || [''])[0]
            };
        }"""
    )

    # ---------- P2: async states ----------
    page.evaluate("() => MCApp.go('profile')")
    page.wait_for_timeout(400)
    R["p2"] = page.evaluate(
        """() => {
            const btn = document.querySelector('[data-act="export-json"]');
            const out = {beforeExport: {ariaBusy: btn.getAttribute('aria-busy'), disabled: btn.disabled}};
            return out;
        }"""
    )
    # actually trigger export and sample the state synchronously during the call
    busy_seen = page.evaluate(
        """async () => {
            const btn = document.querySelector('[data-act="export-json"]');
            if (!btn) return {error: 'no button'};
            // call the handler and sample immediately (before await resolves)
            const p = MCData.exportJson(btn);
            const during = {ariaBusy: btn.getAttribute('aria-busy'),
                            ariaDisabled: btn.getAttribute('aria-disabled'),
                            disabled: btn.disabled};
            await p;
            const after = {ariaBusy: btn.getAttribute('aria-busy'), disabled: btn.disabled};
            return {during, after};
        }"""
    )
    R["p2"]["exportBusy"] = busy_seen

    # spinner must be visible in CSS while busy
    R["p2"]["spinnerCss"] = page.evaluate(
        """() => {
            const btn = document.querySelector('[data-act="export-json"]');
            btn.setAttribute('aria-busy', 'true');
            const after = getComputedStyle(btn, '::after');
            const out = {content: after.content, width: after.width, animation: after.animationName,
                         color: after.color};
            btn.removeAttribute('aria-busy');
            return out;
        }"""
    )

    # ---------- contrast, both themes, all routes ----------
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
                    const out = []; const seen = new Set();
                    document.querySelectorAll('#view *, .appbar *, .navbar *').forEach((el) => {
                        if (!el.childNodes.length) return;
                        const hasText = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim().length > 1);
                        if (!hasText) return;
                        const r = el.getBoundingClientRect();
                        if (r.width < 1 || r.height < 1) return;
                        const s = getComputedStyle(el);
                        if (s.visibility === 'hidden' || +s.opacity === 0) return;
                        const bg = __A.bgBehind(el);
                        const key = s.color+'|'+bg+'|'+s.fontSize+'|'+s.fontWeight;
                        if (seen.has(key)) return;
                        seen.add(key);
                        out.push({text: el.textContent.trim().slice(0,32),
                            cls: el.className && typeof el.className === 'string' ? el.className.slice(0,40) : '',
                            fg: s.color, bg: bg, size: parseFloat(s.fontSize), weight: s.fontWeight,
                            ratio: __A.ratio(s.color, bg)});
                    });
                    return out;
                }"""
            )
            for g in got:
                g["route"] = route + (":" + tab if tab else "")
                pairs.append(g)
        fails = []
        worst = None
        for p in pairs:
            large = p["size"] >= 24 or (p["size"] >= 18.66 and int(p["weight"] or 400) >= 700)
            need = 3.0 if large else 4.5
            if worst is None or p["ratio"] < worst["ratio"]:
                worst = {**p, "need": need, "large": large}
            if p["ratio"] < need:
                fails.append({**p, "need": need})
        R["contrast"][theme] = {"pairsChecked": len(pairs), "fails": fails,
                                "min": min([p["ratio"] for p in pairs], default=None),
                                "worst": worst}
    page.evaluate("() => MCTheme.set('dark')")

    # ---------- layout ----------
    page.evaluate("() => MCApp.go('home')")
    page.wait_for_timeout(300)
    R["layout"] = page.evaluate(
        """() => {
            window.scrollTo(0, document.documentElement.scrollHeight);
            const nav = document.querySelector('.navbar');
            const navTop = nav.getBoundingClientRect().top;
            const page = document.querySelector('.page');
            const last = page.lastElementChild;
            const lastBottom = last ? last.getBoundingClientRect().bottom : null;
            return {scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth,
                overflowX: document.documentElement.scrollWidth > window.innerWidth,
                navTop: Math.round(navTop), lastElBottom: lastBottom === null ? null : Math.round(lastBottom),
                navOverlapsLast: lastBottom !== null && lastBottom > navTop};
        }"""
    )
    page.set_viewport_size({"width": 320, "height": 720})
    page.wait_for_timeout(400)
    R["layout"]["reflow320"] = page.evaluate(
        "() => ({scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth})")
    # 320px with the score panel OPEN — the formula line is the risk
    page.evaluate("() => { MCPages.care.setTab('cek'); MCApp.go('care'); }")
    page.wait_for_timeout(400)
    R["layout"]["reflow320_scoreOpen"] = page.evaluate(
        """() => {
            const d = document.querySelector('details.sd');
            if (d) d.open = true;
            return new Promise(res => setTimeout(() => res({
                scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth,
                overflowX: document.documentElement.scrollWidth > window.innerWidth,
                formulaW: d ? Math.round(d.querySelector('.sd-formula').getBoundingClientRect().width) : null
            }), 250));
        }"""
    )
    page.set_viewport_size({"width": 390, "height": 844})

    # ---------- touch ----------
    R["touch"] = page.evaluate(
        """() => {
            const small = [];
            document.querySelectorAll('button, a, input, select, [data-act]').forEach((el) => {
                const r = el.getBoundingClientRect();
                if (r.width < 1 || r.height < 1) return;
                if (r.width < 24 || r.height < 24) small.push({
                    tag: el.tagName, w: Math.round(r.width), h: Math.round(r.height),
                    label: (el.textContent||'').trim().slice(0,24)});
            });
            return {under24: small, count: small.length};
        }"""
    )

    # ---------- functional smoke: does a save still work end-to-end? ----------
    R["smoke"] = page.evaluate(
        """async () => {
            const b = MCS.activeBike();
            const before = MCS.S.checks.length;
            await MC.Store.put('checks', {id:'smoke-1', bikeId:b.id, component:'oli',
                status:'perlu-dirawat', date:'2026-11-26', km:12168, note:'smoke'});
            await MCS.loadAll();
            const after = MCS.S.checks.length;
            const h = MCD.healthScore(MCS.activeBike(), MCS.ctxFor(MCS.activeBike()));
            await MC.Store.del('checks', 'smoke-1');
            await MCS.loadAll();
            return {before, after, saved: after === before + 1,
                    scoreAfterSave: h.score, total: h.total};
        }"""
    )

    R["console"] = errors
    OUT.write_text(json.dumps(R, indent=2, ensure_ascii=False))
    print(json.dumps(R, indent=1, ensure_ascii=False)[:6500])
    print("\n... written to", OUT)

    browser.close()
    pw.stop()
    httpd.shutdown()


if __name__ == "__main__":
    run()
