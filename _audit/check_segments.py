import sys, pathlib, json
sys.path.insert(0, "/home/ubuntu/LYID-BOTS/motorcare/_audit")
from harness import start_server, launch

httpd, port = start_server()
pw, browser, ctx, page = launch()
page.goto(f"http://127.0.0.1:{port}/", wait_until="load")
page.wait_for_timeout(900)

r = page.evaluate("""() => {
    const out = {};
    ['matic-baru','matic-lama','bebek-manual','sport'].forEach(seg => {
        const rems = MCS.defaultReminders('x', seg);
        const kinds = rems.map(x => x.kind);
        out[seg] = {
            count: rems.length,
            kinds,
            hasCvt: kinds.includes('cvt'),
            hasOliGardan: kinds.includes('oli-gardan'),
            hasRantai: kinds.includes('rantai-gear'),
            activeCount: rems.filter(x=>x.active).length
        };
    });
    return out;
}""")
print(json.dumps(r, indent=1))

# Now: a manual bike that DOES get default reminders -> reminder tab must show rantai, not CVT
page.evaluate("""async () => {
    const b = {id:'m1', nickname:'MANUAL', brand:'Honda', model:'Supra', year:2018,
               transmission:'manual', segment:'bebek-manual', startKm:0, currentKm:50000, photos:{}};
    await MC.Store.put('bikes', b);
    for (const r of MCS.defaultReminders('m1','bebek-manual')) await MC.Store.put('reminders', r);
    await MCS.setActiveBike('m1'); await MCS.loadAll(); MCApp.refresh();
    MCPages.care.setTab('reminder'); MCApp.go('care');
}""")
page.wait_for_timeout(700)
r2 = page.evaluate("""() => {
    const t = document.getElementById('view').innerText;
    return {showsCvt: /Servis CVT/i.test(t), showsOliGardan: /Ganti oli gardan/i.test(t),
            showsRantai: /Rantai & gear/i.test(t),
            reminderRows: document.querySelectorAll('.row').length};
}""")
print("MANUAL REMINDER TAB:", json.dumps(r2, indent=1))

# And a matic bike must NOT show rantai
page.evaluate("""async () => {
    const b = {id:'v1', nickname:'MATIC', brand:'Honda', model:'Vario', year:2024,
               transmission:'matik', segment:'matic-baru', startKm:0, currentKm:5000, photos:{}};
    await MC.Store.put('bikes', b);
    for (const r of MCS.defaultReminders('v1','matic-baru')) await MC.Store.put('reminders', r);
    await MCS.setActiveBike('v1'); await MCS.loadAll();
    MCPages.care.setTab('reminder'); MCApp.go('care');
}""")
page.wait_for_timeout(600)
r3 = page.evaluate("""() => {
    const t = document.getElementById('view').innerText;
    return {showsCvt: /Servis CVT/i.test(t), showsRantai: /Rantai & gear/i.test(t)};
}""")
print("MATIC REMINDER TAB:", json.dumps(r3, indent=1))

browser.close(); pw.stop(); httpd.shutdown()
