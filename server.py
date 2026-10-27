#!/usr/bin/env python3
"""Tiny local server: serves this folder and saves page edits to state.json."""
import http.server, json, os, socketserver, sys, threading, webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(ROOT, "state.json")
NARRATIVE = os.path.join(ROOT, "narrative.md")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5500


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def _json(self, code, obj):
        data = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path.split("?")[0] == "/api/state":
            try:
                with open(STATE, encoding="utf-8") as f:
                    return self._json(200, json.load(f))
            except (FileNotFoundError, ValueError):
                return self._json(200, {})
        if self.path.split("?")[0] == "/api/narrative":
            return self._json(200, {"ok": True})  # probe target; the page fetches narrative.md itself
        return super().do_GET()

    def do_POST(self):
        path = self.path.split("?")[0]
        if path == "/api/state":
            n = int(self.headers.get("Content-Length", 0))
            try:
                obj = json.loads(self.rfile.read(n) or b"{}")
            except ValueError:
                return self._json(400, {"error": "bad json"})
            # never overwrite saved edits with an empty state unless Reset asked for it
            if not obj.get("texts") and not obj.get("arrows") and "reset=1" not in self.path:
                return self._json(200, {"ok": True, "skipped": "empty"})
            tmp = STATE + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(obj, f, ensure_ascii=False, indent=2)
            os.replace(tmp, STATE)  # atomic write
            return self._json(200, {"ok": True})
        if path == "/api/narrative":
            n = int(self.headers.get("Content-Length", 0))
            text = self.rfile.read(n).decode("utf-8")
            if not text.strip():
                return self._json(200, {"ok": True, "skipped": "empty"})
            tmp = NARRATIVE + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                f.write(text)
            os.replace(tmp, NARRATIVE)  # atomic write
            return self._json(200, {"ok": True})
        return self._json(404, {"error": "not found"})

    def log_message(self, *a):
        pass


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
    url = "http://127.0.0.1:%d/" % PORT
    print("Calm AI page running at", url, "(Ctrl+C to stop). Edits save to", STATE)
    threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
