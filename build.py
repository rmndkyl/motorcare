#!/usr/bin/env python3
"""MOTORCARE build step.

Kenapa ada file ini: index.html memuat JS/CSS dengan nama polos. Service worker
melakukan cache-first untuk aset, jadi HP yang sudah pernah membuka aplikasi bisa
menyajikan js/ui.js LAMA dari cache walau file di server sudah berubah. Akibatnya
perbaikan tidak pernah sampai ke user, dan gejalanya berbeda-beda per HP
tergantung kapan terakhir mereka membuka aplikasi.

Solusinya: tempel hash isi file ke URL (`js/ui.js?v=a1b2c3d4`). URL berubah setiap
konten berubah, jadi cache lama tidak pernah match — bahkan service worker versi
lama yang masih cache-first pun akan mengambil file baru dari jaringan.

Jalankan setiap kali selesai mengubah js/ atau css/:
    python3 build.py
"""
import hashlib
import re
import pathlib
import sys

ROOT = pathlib.Path(__file__).parent
INDEX = ROOT / "index.html"

ASSETS = sorted(
    [p for p in (ROOT / "js").glob("*.js")] +
    [p for p in (ROOT / "css").glob("*.css")]
)


def content_hash(paths):
    h = hashlib.sha1()
    for p in paths:
        h.update(p.name.encode())
        h.update(p.read_bytes())
    return h.hexdigest()[:10]


def main():
    digest = content_hash(ASSETS)
    html = INDEX.read_text()

    changed = 0

    # <script src="js/x.js"></script> -> <script src="js/x.js?v=HASH"></script>
    def fix_script(m):
        nonlocal changed
        path = m.group(1)
        if "?v=" not in path:
            changed += 1
        return f'src="{path.split("?")[0]}?v={digest}"'

    html = re.sub(r'src="((?:js)/[^"]+)"', fix_script, html)

    # <link rel="stylesheet" href="css/app.css"> -> ...?v=HASH
    def fix_css(m):
        nonlocal changed
        path = m.group(1)
        if "?v=" not in path:
            changed += 1
        return f'href="{path.split("?")[0]}?v={digest}"'

    html = re.sub(r'href="((?:css)/[^"]+)"', fix_css, html)

    INDEX.write_text(html)

    # buktikan hasilnya, bukan mengasumsikan
    stamped = re.findall(r'\?v=([a-f0-9]{10})', html)
    print(f"hash      : {digest}")
    print(f"di-stamp  : {len(stamped)} aset")
    print(f"unik      : {set(stamped)}")
    if len(stamped) < 10 or set(stamped) != {digest}:
        print("GAGAL: tidak semua aset dapat hash yang sama", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
