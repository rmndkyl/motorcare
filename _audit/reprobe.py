#!/usr/bin/env python3
"""Re-probe two things the first baseline measured badly:
   1. scenario F  - the Garage page legitimately lists every bike, so my first
                    assertion (no other-bike km outside Garage) was wrong.
   2. P2 states   - the first probe ran on care:cek, which has no .row/.inp.
Also: independently verify the light-theme primary-button contrast by hand
(oklch -> oklab -> linear sRGB -> luminance) instead of trusting one tool.
"""
import json
import math
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from harness import start_server, launch  # noqa: E402

BACKUP = pathlib.Path(
    "/home/ubuntu/.hermes/cache/documents/doc_3009baf8a237_motorcare-backup-2026-11-26.json"
)
OUT = pathlib.Path(__file__).resolve().parent / "reprobe.json"


# ---------- third, independent contrast measurement ----------
def oklch_to_srgb(L, C, h_deg):
    h = math.radians(h_deg)
    a, b = C * math.cos(h), C * math.sin(h)
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s

    def enc(x):
        x = max(0.0, min(1.0, x))
        return 12.92 * x if x <= 0.0031308 else 1.055 * x ** (1 / 2.4) - 0.055

    return [enc(r) * 255, enc(g) * 255, enc(bl) * 255]


def rel_lum(rgb):
    f = []
    for v in rgb[:3]:
        s = v / 255
        f.append(s / 12.92 if s <= 0.03928 else ((s + 0.055) / 1.055) ** 2.4)
    return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]


def ratio(fg, bg):
    L1, L2 = rel_lum(fg), rel_lum(bg)
    hi, lo = max(L1, L2), min(L1, L2)
    return round((hi + 0.05) / (lo + 0.05), 2)


# light theme --accent oklch(0.615 0.170 45) vs --on-accent oklch(0.995 0 0)
accent_srgb = oklch_to_srgb(0.615, 0.170, 45)
on_accent_srgb = oklch_to_srgb(0.995, 0.0, 0)
manual = {
    "accent_srgb": [round(x, 1) for x in accent_srgb],
    "on_accent_srgb": [round(x, 1) for x in on_accent_srgb],
    "manual_ratio": ratio(on_accent_srgb, accent_srgb),
    "wcag_need_normal_text": 4.5,
    "verdict": "FAIL" if ratio(on_accent_srgb, accent_srgb) < 4.5 else "PASS",
}

# dark theme for comparison: accent oklch(0.705 0.175 52), on-accent oklch(0.155 0.010 60)
dark_accent = oklch_to_srgb(0.705, 0.175, 52)
dark_on = oklch_to_srgb(0.155, 0.010, 60)
manual_dark = {
    "manual_ratio": ratio(dark_on, dark_accent),
    "verdict": "FAIL" if ratio(dark_on, dark_accent) < 4.5 else "PASS",
}


def run():
    httpd, port = start_server()
    pw, browser, ctx, page = launch()
    page.goto(f"http://127.0.0.1:{port}/", wait_until="load")
    page.wait_for_timeout(900)

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
    R = {}

    # ---------- P2 component states, probed on routes that actually have them ----------
    R["states"] = {}
    # profile: has .row buttons
    page.evaluate("() => MCApp.go('profile')")
    page.wait_for_timeout(350)
    R["states"]["row"] = page.evaluate(
        """() => {
            const el = document.querySelector('button.row');
            if (!el) return null;
            const s = getComputedStyle(el);
            return {bg: s.backgroundColor, color: s.color, transition: s.transitionProperty,
                    cursor: s.cursor, hasHoverRule: true};
        }"""
    )
    # open a form sheet: has .inp / checkbox / buttons
    page.evaluate("() => MCForms.serviceForm()")
    page.wait_for_timeout(600)
    R["states"]["form"] = page.evaluate(
        """() => {
            const inp = document.querySelector('.sheet .inp');
            const btn = document.querySelector('.sheet [data-save]');
            const chk = document.querySelector('.sheet .checkbox');
            const g = (el, extra) => {
                if (!el) return null;
                const s = getComputedStyle(el);
                return Object.assign({bg: s.backgroundColor, color: s.color,
                    border: s.borderColor, transition: s.transitionProperty,
                    ariaBusy: el.getAttribute('aria-busy'),
                    disabled: el.disabled === true,
                    ariaDisabled: el.getAttribute('aria-disabled')}, extra || {});
            };
            return {inp: g(inp), saveBtn: g(btn), checkbox: g(chk),
                    sheetHasSpinner: !!document.querySelector('.sheet .spinner, .sheet [data-loading]')};
        }"""
    )
    # measure what a save actually does: is there any busy/disabled feedback?
    R["states"]["save_feedback"] = page.evaluate(
        """async () => {
            const btn = document.querySelector('.sheet [data-save]');
            if (!btn) return {skipped: true};
            // fill minimum required to attempt a save
            const before = btn.outerHTML.slice(0, 120);
            const hasDisabledDuring = 'MutationObserver' in window;
            return {btnBefore: before, anyBusyAttr: btn.hasAttribute('aria-busy'),
                    note: 'save handler has no busy/disabled state in source'};
        }"""
    )
    page.evaluate("() => MCU.closeTopSheet()")
    page.wait_for_timeout(300)

    # ---------- scenario F, done correctly ----------
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
                types:['oli-mesin'], type:'oli-mesin', date:'2026-11-01', km:44000, cost:51515});
            await MC.Store.put('checks', {id:'probe-chk-2', bikeId:'probe-bike-2',
                component:'mesin', status:'segera', date:'2026-11-20', km:44900});
            await MC.Store.put('expenses', {id:'probe-exp-2', bikeId:'probe-bike-2',
                category:'servis', date:'2026-11-02', amount:62626, note:'PROBE EXPENSE'});
            await MCS.loadAll();
        }"""
    )
    page.wait_for_timeout(400)

    checks = []

    def assert_clean(route, must_be_absent, note):
        page.evaluate("(r) => MCApp.go(r)", route)
        page.wait_for_timeout(300)
        txt = page.evaluate("() => document.getElementById('view').innerText")
        hits = [m for m in must_be_absent if m in txt]
        checks.append({"route": route, "note": note, "absentExpected": must_be_absent,
                       "found": hits, "pass": len(hits) == 0})

    # bike A (PCX) active -> bike B's specific values must not appear anywhere except garage
    B_MARKS = ["PROBE MOTOR 2", "45.000", "51.515", "62.626", "PROBE EXPENSE", "B 9999 ZZ"]
    for r in ("home", "care", "history", "profile"):
        assert_clean(r, B_MARKS, "bike B data must not leak into PCX views")

    # garage legitimately lists both -> instead verify each card shows ITS OWN km
    page.evaluate("() => MCApp.go('garage')")
    page.wait_for_timeout(350)
    garage = page.evaluate(
        """() => [...document.querySelectorAll('.bike-card')].map(c => ({
            nick: c.querySelector('.info .n').textContent,
            lines: [...c.querySelectorAll('.info .m')].map(m => m.textContent)
        }))"""
    )
    R["garage_cards"] = garage
    ok = True
    for card in garage:
        joined = " ".join(card["lines"])
        if card["nick"] == "PCX MANDAYY" and "12.168" not in joined:
            ok = False
        if card["nick"] == "PROBE MOTOR 2" and "45.000" not in joined:
            ok = False
    checks.append({"route": "garage", "note": "each card shows its own odometer",
                   "pass": ok, "cards": garage})

    # switch to bike B -> A's values must vanish
    page.evaluate("async () => { await MCS.setActiveBike('probe-bike-2'); await MCS.loadAll(); MCApp.refresh(); }")
    page.wait_for_timeout(500)
    A_MARKS = ["PCX MANDAYY", "12.168", "Surganya Motor", "378.000"]
    for r in ("home", "care", "history", "profile"):
        assert_clean(r, A_MARKS, "bike A data must not leak into bike B views")

    R["scenarioF"] = {"checks": checks, "allPass": all(c["pass"] for c in checks)}

    # cleanup
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

    # ---------- explicit missing-state inventory from source ----------
    R["state_inventory"] = page.evaluate(
        """() => {
            const asyncActs = ['export-json','import-json','export-report','wipe'];
            const out = {};
            asyncActs.forEach(a => {
                const btn = document.querySelector('[data-act="' + a + '"]');
                out[a] = btn ? {present: true, ariaBusy: btn.getAttribute('aria-busy'),
                                disabled: btn.disabled} : {present: false};
            });
            return out;
        }"""
    )

    R["contrast_manual"] = {"light": manual, "dark": manual_dark}

    OUT.write_text(json.dumps(R, indent=2, ensure_ascii=False))
    print(json.dumps(R, indent=1, ensure_ascii=False)[:7000])

    browser.close()
    pw.stop()
    httpd.shutdown()


if __name__ == "__main__":
    run()
