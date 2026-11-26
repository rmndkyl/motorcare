import sys, json, pathlib
sys.path.insert(0, "/home/ubuntu/LYID-BOTS/motorcare/_audit")
from harness import start_server, launch

BACKUP = "/home/ubuntu/.hermes/cache/documents/doc_3009baf8a237_motorcare-backup-2026-11-26.json"
httpd, port = start_server()
pw, browser, ctx, page = launch()
page.goto(f"http://127.0.0.1:{port}/", wait_until="load")
page.wait_for_timeout(900)

raw = json.load(open(BACKUP))
page.evaluate("""async (dump) => {
    for (const st of Object.keys(dump.data))
        for (const row of dump.data[st]) await MC.Store.put(st, row);
    await MCS.loadAll();
}""", raw)
page.wait_for_timeout(600)

# The stored backup has a 'rantai-gear' reminder for a MATIC bike (legacy bug).
stored = page.evaluate("""() => {
    const b = MCS.activeBike();
    return {segment: b.segment, resolved: MC.resolveSegment(b), trans: b.transmission,
            storedKinds: MCS.S.reminders.filter(r=>r.bikeId===b.id).map(r=>r.kind)};
}""")
built = page.evaluate("""() => {
    const b = MCS.activeBike(); const ctx = MCS.ctxFor(b);
    const km = MCD.currentKm(b, ctx.odoLog, ctx.services);
    const rems = MCD.buildReminders(b, ctx.services, ctx.reminders, km);
    const h = MCD.healthScore(b, ctx);
    return {builtKinds: rems.map(r=>r.kind),
            hasRantai: rems.some(r=>r.kind==='rantai-gear'),
            hasCvt: rems.some(r=>r.kind==='cvt'),
            healthTotal: h.total, score: h.score, checked: h.checked};
}""")
print("STORED :", json.dumps(stored))
print("BUILT  :", json.dumps(built))
print()
print("Legacy 'rantai-gear' stored in DB but suppressed in engine?",
      ('rantai-gear' in stored['storedKinds']) and not built['hasRantai'])

# reminder tab must not render the chain row
page.evaluate("() => { MCPages.care.setTab('reminder'); MCApp.go('care'); }")
page.wait_for_timeout(600)
tab = page.evaluate("""() => {
    const t = document.getElementById('view').innerText;
    return {showsRantai: /Rantai & gear/i.test(t), showsCvt: /Servis CVT/i.test(t),
            reminderRowCount: document.querySelectorAll('.rows .row').length};
}""")
print("REMINDER TAB:", json.dumps(tab))
browser.close(); pw.stop(); httpd.shutdown()
