import json
import logging
import re
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import chess.engine
import requests

import analysis
import games
from api.chesscom import ChessComAPI
from api.lichess import LichessAPI


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

PLATFORMS = {
    "chesscom": ("Chess.com", ChessComAPI.get_player_stats),
    "lichess": ("Lichess", LichessAPI.get_player_stats),
}
MAX_PGN_BYTES = 1_000_000
USERNAME_PATTERN = re.compile(r"[A-Za-z0-9_-]{1,50}")
ALLOWED_ORIGINS = {"http://localhost:5500", "http://127.0.0.1:5500"}


class StatsHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.run_safely(self.route_get)

    def do_POST(self):
        self.run_safely(self.route_post)

    def run_safely(self, route):
        try:
            route()
        except Exception:
            logger.exception("Unexpected error while handling %s %s", self.command, self.path)
            self.send_json({"error": "Something went wrong on the server."}, 500)

    def route_get(self):
        request = urlparse(self.path)
        if request.path == "/":
            self.send_response(302)
            self.send_header("Location", "http://localhost:5500/")
            self.end_headers()
            return

        routes = {"/stats": self.handle_stats, "/games": self.handle_games}
        handler = routes.get(request.path)
        if handler is None:
            self.send_json({"error": "Not found."}, 404)
            return
        query = {key: values[0].strip() for key, values in parse_qs(request.query).items()}
        handler(query)

    def route_post(self):
        routes = {"/replay": self.handle_replay, "/analyse": self.handle_analyse}
        handler = routes.get(urlparse(self.path).path)
        if handler is None:
            self.send_json({"error": "Not found."}, 404)
            return
        handler()

    def read_platform_and_username(self, query):
        username = query.get("username", "")
        platform = query.get("platform", "chesscom")
        if not username:
            self.send_json({"error": "Username is required."}, 400)
            return None
        if not USERNAME_PATTERN.fullmatch(username):
            self.send_json({"error": "Username is invalid."}, 400)
            return None
        if platform not in PLATFORMS:
            self.send_json({"error": f"Unknown platform: {platform}."}, 400)
            return None
        return platform, username

    def handle_stats(self, query):
        params = self.read_platform_and_username(query)
        if params is None:
            return
        platform, username = params

        name, get_stats = PLATFORMS[platform]
        try:
            stats = get_stats(username)
        except requests.RequestException:
            logger.exception("Could not load %s stats for username=%s", name, username)
            self.send_unavailable(name)
            return

        if stats is None:
            self.send_json({"error": f"{name} player was not found."}, 404)
            return

        self.send_json(stats)

    def handle_games(self, query):
        params = self.read_platform_and_username(query)
        if params is None:
            return
        platform, username = params

        try:
            year, month = games.parse_month(
                query.get("year"), query.get("month"), datetime.now(timezone.utc).date()
            )
        except ValueError as error:
            self.send_json({"error": str(error)}, 400)
            return

        name = PLATFORMS[platform][0]
        try:
            game_list = games.get_games(platform, username, year, month)
        except requests.RequestException:
            logger.exception("Could not load %s games for username=%s %d-%02d", name, username, year, month)
            self.send_unavailable(name)
            return

        self.send_json({"games": game_list})

    def read_pgn(self):
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if not 0 < length <= MAX_PGN_BYTES:
            self.send_json({"error": "A PGN is required."}, 400)
            return None
        return self.rfile.read(length).decode("utf-8", errors="replace")

    def handle_replay(self):
        pgn = self.read_pgn()
        if pgn is None:
            return
        try:
            self.send_json(games.replay_pgn(pgn))
        except ValueError as error:
            self.send_json({"error": str(error)}, 400)

    def handle_analyse(self):
        pgn = self.read_pgn()
        if pgn is None:
            return
        try:
            replay = games.replay_pgn(pgn)
        except ValueError as error:
            self.send_json({"error": str(error)}, 400)
            return
        try:
            stockfish = analysis.open_engine(analysis.find_stockfish())
        except analysis.EngineNotFound as error:
            self.send_json({"error": str(error)}, 503)
            return
        except (OSError, chess.engine.EngineError):
            logger.exception("Could not start Stockfish")
            self.send_json({"error": "Stockfish could not be started."}, 503)
            return

        fens = [replay["start_fen"], *(move["fen"] for move in replay["moves"])]
        self.close_connection = True
        try:
            self.send_response(200)
            self.send_header("Content-Type", "application/x-ndjson")
            self.send_header("Cache-Control", "no-cache")
            self.send_cors_headers()
            self.end_headers()
            self.write_line({"type": "start", "total": len(fens)})
            try:
                for position in analysis.analyse_fens(stockfish, fens):
                    self.write_line({"type": "position", **position})
            except chess.engine.EngineError:
                logger.exception("Stockfish failed during analysis")
                self.write_line({"type": "error", "message": "The engine stopped unexpectedly."})
                return
            self.write_line({"type": "done"})
        except ConnectionError:
            logger.info("Browser closed the analysis stream early")
        finally:
            try:
                stockfish.quit()
            except chess.engine.EngineError:
                pass

    def write_line(self, data):
        self.wfile.write(json.dumps(data).encode() + b"\n")
        self.wfile.flush()

    def send_unavailable(self, name):
        self.send_json({"error": f"{name} is temporarily unavailable. Please try again."}, 502)

    def send_json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_cors_headers()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_cors_headers(self):
        origin = self.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")


if __name__ == "__main__":
    print("Backend running at http://localhost:8000")
    ThreadingHTTPServer(("localhost", 8000), StatsHandler).serve_forever()
