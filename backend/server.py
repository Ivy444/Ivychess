import json
import logging
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

import requests

from api.chesscom import ChessComAPI
from api.lichess import LichessAPI


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

PLATFORMS = {
    "chesscom": ("Chess.com", ChessComAPI.get_player_stats),
    "lichess": ("Lichess", LichessAPI.get_player_stats),
}


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
        platform = query.get("platform", ["chesscom"])[0]

        if request.path != "/stats" or not username:
            self.send_json({"error": "Username is required."}, 400)
            return

        if platform not in PLATFORMS:
            self.send_json({"error": f"Unknown platform: {platform}."}, 400)
            return

        name, get_stats = PLATFORMS[platform]
        try:
            stats = get_stats(username)
        except requests.RequestException:
            logger.exception("Could not load %s stats for username=%s", name, username)
            self.send_json(
                {"error": f"{name} is temporarily unavailable. Please try again."},
                502,
            )
            return

        if stats is None:
            self.send_json({"error": f"{name} player was not found."}, 404)
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