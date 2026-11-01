import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

from api.chesscom import ChessComAPI


class StatsHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        request = urlparse(self.path)
        if request.path == "/":
            self.send_response(302)
            self.send_header("Location", "http://localhost:5500/")
            self.end_headers()
            return

        query = parse_qs(request.query)
        username = query.get("username", [""])[0].strip()

        if request.path != "/stats" or not username:
            self.send_json({"error": "Username is required."}, 400)
            return

        stats = ChessComAPI.get_player_stats(username)
        if stats is None:
            self.send_json({"error": "Player stats could not be found."}, 404)
            return

        self.send_json(stats)

    def send_json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    print("Backend running at http://localhost:8000")
    HTTPServer(("localhost", 8000), StatsHandler).serve_forever()
