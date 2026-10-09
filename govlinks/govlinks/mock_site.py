"""A tiny fake government portal on 127.0.0.1, used to exercise the fetcher without touching real sites."""
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PAGES = {
    "/": ("Municipal Citizen Portal", """<h1>Citizen Portal</h1>
        <a href="/services/water-complaint">File water supply complaint</a>
        <a href="/sanitation/new">Garbage pickup complaint</a>
        <a href="/about">About the department</a>
        <a href="http://other.example/x">Partner site water supply</a>
        <a href="#top">Back to top</a>"""),
    "/jaipur/water/complaint-form": ("Water Supply Complaint Form", "<h1>Register water supply complaint</h1>"),
    "/citizen/water": ("Water Services", "<h1>Water services</h1>"),
    "/phed/grievance/new": ("New Water Grievance", "<h1>File a grievance</h1>"),
    "/sanitation/complaint": ("Garbage Complaint", "<h1>Garbage pickup complaint</h1>"),
    "/portal/water/new-complaint": ("New Water Complaint", "<h1>Water complaint</h1>"),
    "/portal/water/shortcut": ("Water Shortcut", "<h1>Shortcut</h1>"),
    "/services/water-complaint": ("Water Complaint", "<h1>Water complaint</h1>"),
    "/private/data": ("Private", "<h1>Private</h1>"),
    "/soft404": ("Page not found", "<h1>Sorry, nothing here</h1>"),
}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, body="", headers=None):
        data = body.encode()
        self.send_response(code)
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        try:
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/robots.txt":
            return self._send(200, "User-agent: *\nDisallow: /private/\n")
        if path == "/citizen/water-old":
            return self._send(301, "", {"Location": "/citizen/water"})
        if path == "/offsite":
            return self._send(302, "", {"Location": "http://elsewhere.test/page"})
        if path == "/slow":
            time.sleep(3)
            return self._send(200, "<title>Slow</title>")
        if path in PAGES:
            title, body = PAGES[path]
            return self._send(200, f"<html><head><title>{title}</title></head><body>{body}</body></html>")
        return self._send(404, "<html><head><title>Not Found</title></head><body><h1>Not Found</h1></body></html>")


def start(port=8099):
    srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv
