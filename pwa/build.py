#!/usr/bin/env python3
"""Build the standalone Lean Loken PWA into pwa/dist (or --out DIR).

  python3 pwa/build.py [--out DIR]

Steps: runs app/build.py into a temp file (the artifact fragment: head tags,
<style>, shell markup, <script>), splits it, and writes a full HTML document
plus app.js, the window.claude shim, auth/PWA scripts, sw.js, the manifest
and PNG icons. Every URL is relative, so the folder can be served from a
GitHub Pages subpath (https://<user>.github.io/<repo>/).

config.js comes from pwa/config.local.js when present (gitignored), else from
src/config.example.js with the env vars LL_SUPABASE_URL and LL_SUPABASE_ANON_KEY
substituted when set.
"""
import argparse, hashlib, json, os, re, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(HERE, "src")
SUPABASE_UMD = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"
COBALT = (0x23, 0x50, 0xD8)
BG = "#F3F5F8"


def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()


def write(p, s, mode="w"):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, mode, **({} if "b" in mode else {"encoding": "utf-8"})) as f:
        f.write(s)


def build_fragment():
    fd, tmp = tempfile.mkstemp(suffix=".html")
    os.close(fd)
    try:
        subprocess.run([sys.executable, os.path.join(ROOT, "app", "build.py"), tmp], check=True, stdout=subprocess.DEVNULL)
        return read(tmp)
    finally:
        os.unlink(tmp)


def split_fragment(out):
    """head tags | css | shell markup | js"""
    i = out.index("\n<style>\n")
    head = out[:i]
    j = out.index("\n</style>\n", i)
    css = out[i + len("\n<style>\n"):j]
    k = out.index("\n<script>\n", j)
    shell = out[j + len("\n</style>\n"):k]
    m = out.rindex("\n</script>")
    js = out[k + len("\n<script>\n"):m]
    assert "<script" not in shell and 'id="app"' in shell, "unexpected app/build.py output"
    return head.strip(), css, shell.strip(), js


def config_js():
    local = os.path.join(HERE, "config.local.js")
    if os.path.exists(local):
        return read(local)
    s = read(os.path.join(SRC, "config.example.js"))
    for key in ("SUPABASE_URL", "SUPABASE_ANON_KEY"):
        v = os.environ.get("LL_" + key)
        if v:
            s = re.sub(rf'{key}: "[^"]*"', lambda m: f"{key}: {json.dumps(v)}", s)
    return s


# ---------- icons ----------
def make_icons(dst):
    from PIL import Image, ImageDraw
    os.makedirs(dst, exist_ok=True)
    LINES = [[(5, 5), (5, 19), (19, 19)], [(9, 13), (12, 10), (15, 13), (19, 8)]]  # the logo mark, 24-unit box

    def mark(draw, cx, cy, size, color, ss):
        # stroke-width 2.4, round caps and joins: a quad per segment plus a disc at every vertex
        sc = size / 24.0
        r = 1.2 * sc
        for pts in LINES:
            p = [(cx + (x - 12) * sc, cy + (y - 12) * sc) for x, y in pts]
            for (x1, y1), (x2, y2) in zip(p, p[1:]):
                dx, dy = x2 - x1, y2 - y1
                L = (dx * dx + dy * dy) ** 0.5
                nx, ny = -dy / L * r, dx / L * r
                draw.polygon([(x1 + nx, y1 + ny), (x2 + nx, y2 + ny), (x2 - nx, y2 - ny), (x1 - nx, y1 - ny)], fill=color)
            for x, y in p:
                draw.ellipse([x - r, y - r, x + r, y + r], fill=color)

    def icon(n, *, rounded, mark_frac, bg=COBALT + (255,), fg=(255, 255, 255, 255), transparent=False):
        ss = 4
        N = n * ss
        im = Image.new("RGBA", (N, N), (0, 0, 0, 0) if (rounded or transparent) else bg)
        d = ImageDraw.Draw(im)
        if rounded:
            d.rounded_rectangle([0, 0, N - 1, N - 1], radius=round(N * 0.225), fill=bg)
        mark(d, N / 2, N / 2, N * mark_frac, fg, ss)
        return im.resize((n, n), Image.LANCZOS)

    out = {
        "icon-192.png": icon(192, rounded=True, mark_frac=0.62),
        "icon-512.png": icon(512, rounded=True, mark_frac=0.62),
        "icon-maskable-512.png": icon(512, rounded=False, mark_frac=0.46),
        "apple-touch-icon.png": icon(180, rounded=False, mark_frac=0.58).convert("RGB"),
        "badge-96.png": icon(96, rounded=False, mark_frac=0.86, transparent=True),
    }
    for name, im in out.items():
        im.save(os.path.join(dst, name), optimize=True)
    return sorted(out)


def manifest():
    return json.dumps({
        "name": "Lean Loken",
        "short_name": "Lean Loken",
        "description": "Your 12-week lean-out plan, daily log and coach.",
        "id": "./",
        "start_url": "./#today",
        "scope": "./",
        "display": "standalone",
        "background_color": BG,
        "theme_color": BG,
        "icons": [
            {"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
            {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
            {"src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
        ],
        "shortcuts": [
            {"name": "Today", "url": "./#today"},
            {"name": "Train", "url": "./#train"},
            {"name": "Fuel", "url": "./#fuel"},
        ],
    }, indent=2) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(HERE, "dist"))
    a = ap.parse_args()
    out = os.path.abspath(a.out)

    head, css, shell, js = split_fragment(build_fragment())
    files = {
        "app.js": js + "\n",
        "config.js": config_js(),
        "claude-shim.js": read(os.path.join(SRC, "claude-shim.js")),
        "auth.js": read(os.path.join(SRC, "auth.js")),
        "pwa.js": read(os.path.join(SRC, "pwa.js")),
        "manifest.webmanifest": manifest(),
    }
    pwa_css = read(os.path.join(SRC, "pwa.css"))
    pwa_head = read(os.path.join(SRC, "head.html")).strip()

    if os.path.isdir(out):
        shutil.rmtree(out)
    os.makedirs(out)
    icons = make_icons(os.path.join(out, "icons"))

    h = hashlib.sha256()
    for k in sorted(files):
        h.update(k.encode() + b"\0" + files[k].encode())
    h.update((head + css + shell + pwa_css + pwa_head + read(os.path.join(SRC, "sw.js"))).encode())
    for n in icons:
        h.update(open(os.path.join(out, "icons", n), "rb").read())
    ver = h.hexdigest()[:10]
    v = lambda p: f"{p}?v={ver}"

    index = f"""<!doctype html>
<html lang="en" data-app-src="{v('app.js')}" data-build="{ver}">
<head>
{pwa_head}
{head}
<style>
{css}
{pwa_css}</style>
</head>
<body>
{shell}
<script src="{SUPABASE_UMD}"></script>
<script src="{v('config.js')}"></script>
<script src="{v('claude-shim.js')}"></script>
<script src="{v('pwa.js')}"></script>
<script src="{v('auth.js')}"></script>
</body>
</html>
"""
    shell_list = ["./", "index.html", v("app.js"), v("config.js"), v("claude-shim.js"), v("pwa.js"), v("auth.js"),
                  "manifest.webmanifest"] + ["icons/" + n for n in icons]
    sw = read(os.path.join(SRC, "sw.js")).replace("__VERSION__", ver).replace("__SHELL__", json.dumps(shell_list))

    files["index.html"] = index
    files["sw.js"] = sw
    files[".nojekyll"] = ""
    for k, s in files.items():
        write(os.path.join(out, k), s)
    # sanity: nothing root-relative (GitHub Pages serves from /<repo>/)
    for k in ("index.html", "manifest.webmanifest"):
        bad = re.findall(r'(?:href|src)="/(?!/)[^"]*"', files[k]) + re.findall(r'"(?:src|url|start_url|scope)":\s*"/[^"]*"', files[k])
        assert not bad, f"root-relative URL in {k}: {bad}"
    total = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(out) for f in fs)
    print(f"built {out} (version {ver}, {total:,} bytes)")


if __name__ == "__main__":
    main()
