#!/usr/bin/env python3
"""MOTORCARE audit harness — server + browser, fresh origin each run.

Rule from the prompt: never reuse an already-opened origin (HTTP cache serves
stale CSS/JS and makes a fix look broken). So every run gets a NEW port.
"""
import http.server
import socketserver
import threading
import socket
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
CHROME = "/home/ubuntu/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def log_message(self, *a):
        pass

    def end_headers(self):
        # no-store: audit must see the files on disk, not a cached copy
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        super().end_headers()


def start_server():
    port = free_port()
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", port), Handler)
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd, port


def launch(viewport=(390, 844)):
    from patchright.sync_api import sync_playwright
    pw = sync_playwright().start()
    browser = pw.chromium.launch(
        executable_path=CHROME,
        headless=True,
        args=["--no-sandbox", "--disable-dev-shm-usage"],
    )
    ctx = browser.new_context(
        viewport={"width": viewport[0], "height": viewport[1]},
        device_scale_factor=2,
        is_mobile=True,
        has_touch=True,
        locale="id-ID",
        timezone_id="Asia/Jakarta",
    )
    page = ctx.new_page()

    # patchright evaluates in an isolated world by default, so the app's globals
    # (MC, MCS, MCD, MCApp...) are invisible. Every audit call must run in the
    # main world -- wrap evaluate once here instead of remembering at 40 call sites.
    _orig_evaluate = page.evaluate

    def evaluate(expr, arg=None, **kw):
        kw.setdefault("isolated_context", False)
        return _orig_evaluate(expr, arg, **kw) if arg is not None else _orig_evaluate(expr, **kw)

    page.evaluate = evaluate

    return pw, browser, ctx, page


if __name__ == "__main__":
    httpd, port = start_server()
    print("server on", port, "root", ROOT)
    pw, browser, ctx, page = launch()
    page.goto(f"http://127.0.0.1:{port}/", wait_until="load")
    page.wait_for_timeout(1200)
    print("title:", page.title())
    print("h1:", page.eval_on_selector_all("h1", "els=>els.map(e=>e.textContent)"))
    browser.close()
    pw.stop()
    httpd.shutdown()
