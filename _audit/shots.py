import sys, json, pathlib
sys.path.insert(0, "/home/ubuntu/LYID-BOTS/motorcare/_audit")
from harness import start_server, launch

BACKUP = "/home/ubuntu/.hermes/cache/documents/doc_3009baf8a237_motorcare-backup-2026-11-26.json"
SHOTS = pathlib.Path("/home/ubuntu/LYID-BOTS/motorcare/_audit/shots")
SHOTS.mkdir(exist_ok=True)

httpd, port = start_server()
pw, browser, ctx, page = launch()
page.goto(f"http://127.0.0.1:{port}/", wait_until="load")
page.wait_for_timeout(900)
raw = json.load(open(BACKUP))
page.evaluate("""async (d) => {
  for (const st of Object.keys(d.data)) for (const r of d.data[st]) await MC.Store.put(st,r);
  await MCS.loadAll();
}""", raw)
page.reload(wait_until="load")
page.wait_for_timeout(1200)

# score panel — force dark EXPLICITLY first (headless defaults to light,
# so without this the "dark" shot is just the light one again)
page.evaluate("() => MCTheme.set('dark')")
page.wait_for_timeout(900)
page.evaluate("() => { MCPages.care.setTab('cek'); MCApp.go('care'); }")
page.wait_for_timeout(900)
page.evaluate("() => { const d=document.querySelector('details.sd'); if(d) d.open=true; }")
page.wait_for_timeout(700)
assert page.evaluate("() => document.documentElement.getAttribute('data-theme')") == "dark"
page.screenshot(path=str(SHOTS/"clean-01-score-dark.png"), full_page=True)

page.evaluate("() => MCTheme.set('light')")
page.wait_for_timeout(900)
assert page.evaluate("() => document.documentElement.getAttribute('data-theme')") == "light"
page.screenshot(path=str(SHOTS/"clean-02-score-light.png"), full_page=True)

# reminder tab with the provenance notice
page.evaluate("() => { MCPages.care.setTab('reminder'); MCApp.go('care'); }")
page.wait_for_timeout(900)
page.screenshot(path=str(SHOTS/"clean-03-reminder-light.png"), full_page=True)
page.evaluate("() => MCTheme.set('dark')")
page.wait_for_timeout(700)
page.screenshot(path=str(SHOTS/"clean-04-reminder-dark.png"), full_page=True)

# home both themes
page.evaluate("() => MCApp.go('home')")
page.wait_for_timeout(800)
page.screenshot(path=str(SHOTS/"clean-05-home-dark.png"), full_page=True)
page.evaluate("() => MCTheme.set('light')")
page.wait_for_timeout(700)
page.screenshot(path=str(SHOTS/"clean-06-home-light.png"), full_page=True)

# bike form: interval provenance hint
page.evaluate("() => MCTheme.set('dark')")
page.wait_for_timeout(500)
page.evaluate("() => { const b=MCS.activeBike(); MCBikeForm.bikeForm(b, ()=>{}); }")
page.wait_for_timeout(900)
page.screenshot(path=str(SHOTS/"clean-07-bikeform-dark.png"), full_page=True)
page.evaluate("() => MCU.closeTopSheet()")
page.wait_for_timeout(400)

# empty state (fresh DB) for comparison
page.evaluate("""async () => {
  await MC.Store.clearAll(); await MCS.loadAll(); MCApp.refresh(); MCApp.go('home');
}""")
page.wait_for_timeout(900)
page.screenshot(path=str(SHOTS/"clean-08-empty-home.png"), full_page=True)

print("done")
browser.close(); pw.stop(); httpd.shutdown()
