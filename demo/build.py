"""Bundle the demo into one self-contained HTML file (demo/dist/roi-demo.html)."""
import base64, pathlib, re
root = pathlib.Path(__file__).parent
html = (root / "index.html").read_text(encoding="utf-8")
def data_uri(rel):
    b = (root / rel).read_bytes()
    return "data:image/jpeg;base64," + base64.b64encode(b).decode()
css = (root / "styles.css").read_text(encoding="utf-8")
css = re.sub(r'url\("(assets/[^"]+)"\)', lambda m: f'url("{data_uri(m.group(1))}")', css)
js = (root / "data.js").read_text(encoding="utf-8") + "\n" + (root / "app.js").read_text(encoding="utf-8")
js = js.replace('"assets/logo-360.jpg"', '"' + data_uri("assets/logo-360.jpg") + '"').replace('src="assets/logo-360.jpg"', 'src="' + data_uri("assets/logo-360.jpg") + '"')
html = html.replace('<link rel="stylesheet" href="styles.css">', f"<style>\n{css}\n</style>")
html = html.replace('<script src="data.js"></script>\n<script src="app.js"></script>', f"<script>\n{js}\n</script>")
assert "assets/" not in html.replace("data:image", ""), "unbundled asset reference left"
out = root / "dist"; out.mkdir(exist_ok=True)
(out / "roi-demo.html").write_text(html, encoding="utf-8")
print("wrote", out / "roi-demo.html", len(html) // 1024, "KB")
