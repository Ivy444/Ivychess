from urllib.parse import quote

import requests


class ChessComAPI:
    BASE_URL = "https://api.chess.com/pub"
    # Chess.com (Cloudflare) answers 403 to requests without a User-Agent.
    HEADERS = {"User-Agent": "Ivychess/0.1 (chess stats analyser)"}
    TIMEOUT = 10

    @staticmethod
    def _get(path):
        url = f"{ChessComAPI.BASE_URL}{path}"
        response = requests.get(url, headers=ChessComAPI.HEADERS, timeout=ChessComAPI.TIMEOUT)
        if response.status_code == 404:
            return None
        # Any other error (403, 429, 5xx) is not "player not found";
        # raising lets server.py answer with a 502 instead of a misleading 404.
        response.raise_for_status()
        return response.json()

    @staticmethod
    def get_player_profile(username):
        return ChessComAPI._get(f"/player/{quote(username, safe='')}")

    @staticmethod
    def get_player_stats(username):
        return ChessComAPI._get(f"/player/{quote(username, safe='')}/stats")

    @staticmethod
    def get_player_games(username, year, month):
        return ChessComAPI._get(
            f"/player/{quote(username, safe='')}/games/{year}/{month:02d}"
        )
