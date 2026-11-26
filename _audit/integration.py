#!/usr/bin/env python3
"""Integration regression test for the paths this work touched.

Not a unit test — it drives the real UI. Focus on what could plausibly break:
  - import/export round trip (importJson + sanitizeRow changed)
  - reminder recalculation after recording a service (buildReminders changed)
  - offline mode (sw.js VERSION changed)
  - theme persistence (untouched, but it is the most visible feature)
"""
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from harness import start_server, launch, CHROME  # noqa: E402

BACKUP = "/home/ubuntu/.hermes/cache/documents/doc_3009baf8a237_motorcare-backup-2026-11-26.json"
R = {}


def run():
    httpd, port = start_server()
    pw, browser, ctx, page = launch()
    errs = []
    page.on("console", lambda m: errs.append({"t": m.type, "x": m.text[:150]})
            if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: errs.append({"t": "pageerror", "x": str(e)[:150]}))

    page.goto(f"http://127.0.0.1:{port}/", wait_until="load")
    page.wait_for_timeout(900)

    # ---------- 1. IMPORT via the real UI path (sanitizeRow + Store loop) ----------
    raw = json.loads(pathlib.Path(BACKUP).read_text())
    R["import"] = page.evaluate(
        """async (dump) => {
            // exercise exactly what importJson does with the file, minus the file picker
            let imported = 0, rejected = 0;
            const STORES = ['bikes','services','damages','expenses','odoLog','reminders','checks','docs'];
            for (const store of STORES) {
                for (const rawRow of (dump.data[store] || [])) {
                    if (!rawRow || typeof rawRow !== 'object') { rejected++; continue; }
                    const r = MCData.sanitizeRow(store, rawRow);
                    await MC.Store.put(store, r);
                    imported++;
                }
            }
            await MCS.loadAll();
            return {imported, rejected,
                    bikes: MCS.S.bikes.length, services: MCS.S.services.length,
                    checks: MCS.S.checks.length, reminders: MCS.S.reminders.length,
                    odoLog: MCS.S.odoLog.length};
        }""",
        raw,
    )

    # ---------- 2. EXPORT round trip: read back and compare row counts ----------
    R["export_roundtrip"] = page.evaluate(
        """async () => {
            const STORES = ['bikes','services','damages','expenses','odoLog','reminders','checks','docs'];
            const dump = {app:'motorcare', version:1, exportedAt:new Date().toISOString(), data:{}};
            for (const s of STORES) dump.data[s] = await MC.Store.all(s);
            const json = JSON.stringify(dump);
            const back = JSON.parse(json);
            const counts = {};
            for (const s of STORES) counts[s] = [dump.data[s].length, back.data[s].length];
            // photos survive as data URLs
            const bike = back.data.bikes[0];
            const hasPhoto = Object.values(bike.photos || {}).some(v => typeof v === 'string' && v.startsWith('data:image/'));
            return {counts, allMatch: STORES.every(s => counts[s][0] === counts[s][1]),
                    photosSurvive: hasPhoto, bytes: json.length};
        }"""
    )

    # ---------- 3. reminder recalculation after recording a service ----------
    R["reminder_recalc"] = page.evaluate(
        """async () => {
            const b = MCS.activeBike();
            const ctx0 = MCS.ctxFor(b);
            const km0 = MCD.currentKm(b, ctx0.odoLog, ctx0.services);
            const rem0 = MCD.buildReminders(b, ctx0.services, ctx0.reminders, km0);
            const oli0 = rem0.find(r => r.kind === 'oli-mesin');
            const before = {lastKm: oli0.lastKm, nextKm: oli0.nextKm, intervalKm: oli0.intervalKm};

            // record a new oil service 1000 km ahead of current
            const newKm = km0 + 1000;
            await MC.Store.put('services', {id:'itest-svc', bikeId:b.id, types:['oli-mesin'],
                type:'oli-mesin', date:'2027-06-15', km:newKm, cost:60000, shop:'TEST'});
            await MCS.loadAll();
            const b2 = MCS.activeBike(); const ctx1 = MCS.ctxFor(b2);
            const km1 = MCD.currentKm(b2, ctx1.odoLog, ctx1.services);
            const rem1 = MCD.buildReminders(b2, ctx1.services, ctx1.reminders, km1);
            const oli1 = rem1.find(r => r.kind === 'oli-mesin');
            const after = {lastKm: oli1.lastKm, nextKm: oli1.nextKm, kmNow: km1};

            await MC.Store.del('services','itest-svc'); await MCS.loadAll();
            return {before, after, newKm,
                    lastKmAdvanced: after.lastKm === newKm,
                    nextKmRecalculated: after.nextKm === newKm + before.intervalKm};
        }"""
    )

    # ---------- 4. theme persistence across reload ----------
    page.evaluate("() => MCTheme.set('light')")
    page.wait_for_timeout(300)
    page.reload(wait_until="load")
    page.wait_for_timeout(900)
    R["theme_persist"] = page.evaluate(
        """() => ({
            attr: document.documentElement.getAttribute('data-theme'),
            stored: localStorage.getItem('motorcare-theme'),
            accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
        })"""
    )
    page.evaluate("() => MCTheme.set('dark')")

    # ---------- 5. OFFLINE ----------
    # Two separate things, tested two ways:
    #   (a) device offline  -> context.set_offline(True), the real user case
    #   (b) server down     -> close the listening socket so connections are
    #                          REFUSED. shutdown() alone leaves the socket open,
    #                          so requests hang instead of failing fast and the
    #                          SW's .catch() never fires (that is what timed out).
    page.wait_for_timeout(1800)   # let SW finish installing + caching
    R["sw"] = page.evaluate(
        """async () => {
            const reg = await navigator.serviceWorker.getRegistration();
            if (!reg) return {registered:false};
            await navigator.serviceWorker.ready;
            const keys = await caches.keys();
            // what is actually IN the cache?
            let entries = {};
            for (const k of keys) {
                const c = await caches.open(k);
                const reqs = await c.keys();
                entries[k] = reqs.length;
            }
            return {registered:true, active: !!reg.active, caches: keys, entries};
        }"""
    )

    # ---- (a) device offline ----
    ctx.set_offline(True)
    try:
        page.reload(wait_until="domcontentloaded", timeout=15000)
        page.wait_for_timeout(1800)
        R["offline_device"] = page.evaluate(
            """() => ({
                navPresent: !!document.querySelector('.navbar'),
                contentRendered: !!document.querySelector('.page'),
                title: document.title,
                bikes: (window.MCS && MCS.S && MCS.S.bikes) ? MCS.S.bikes.length : null,
                bikeName: (window.MCS && MCS.activeBike) ? (MCS.activeBike() || {}).nickname : null
            })"""
        )
        # and can we still write while offline?
        R["offline_device"]["canWrite"] = page.evaluate(
            """async () => {
                const b = MCS.activeBike();
                if (!b) return 'no bike';
                const before = MCS.S.odoLog.length;
                await MC.Store.put('odoLog', {id:'offline-test', bikeId:b.id,
                    date:'2026-11-26', km: (b.currentKm || 1) + 1, note:'offline write'});
                await MCS.loadAll();
                const after = MCS.S.odoLog.length;
                await MC.Store.del('odoLog','offline-test');
                await MCS.loadAll();
                return after === before + 1;
            }"""
        )
    except Exception as e:
        R["offline_device"] = {"error": str(e)[:200]}
    ctx.set_offline(False)
    page.wait_for_timeout(600)

    # ---- (b) server actually down: close the socket so it refuses ----
    httpd.shutdown()
    httpd.server_close()          # <-- this is what makes it fail fast
    page.wait_for_timeout(500)
    try:
        page.reload(wait_until="domcontentloaded", timeout=15000)
        page.wait_for_timeout(1800)
        R["offline_server_down"] = page.evaluate(
            """() => ({
                navPresent: !!document.querySelector('.navbar'),
                contentRendered: !!document.querySelector('.page'),
                title: document.title,
                bikes: (window.MCS && MCS.S && MCS.S.bikes) ? MCS.S.bikes.length : null
            })"""
        )
    except Exception as e:
        R["offline_server_down"] = {"error": str(e)[:200]}

    R["console"] = errs
    print(json.dumps(R, indent=1, ensure_ascii=False))

    browser.close()
    pw.stop()


if __name__ == "__main__":
    run()
