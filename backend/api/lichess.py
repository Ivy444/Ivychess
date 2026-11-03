import json
from urllib.parse import quote

import requests


class LichessAPI:
    BASE_URL = "https://lichess.org/api"
    TIMEOUT = 10
    NON_GAME_PERFS = {"puzzle", "storm", "racer", "streak"}
    # One shared session keeps the HTTPS connection open between requests,
    # so the per-game-type calls skip a new TLS handshake each time (~7s -> ~1.5s).
    SESSION = requests.Session()
    # Lichess answers 404 to the games export when the client uses a generic
    # User-Agent (python-requests, curl), so identify the app like for Chess.com.
    SESSION.headers["User-Agent"] = "Ivychess/0.1 (chess stats analyser)"

    @staticmethod
    def _get(path):
        response = LichessAPI.SESSION.get(f"{LichessAPI.BASE_URL}{path}", timeout=LichessAPI.TIMEOUT)
        if response.status_code == 404:
            return None
        response.raise_for_status()
        return response.json()

    @staticmethod
    def get_player_stats(username):
        """Return stats in the same shape as Chess.com: {perf: {last, best, record}}."""
        name = quote(username, safe="")
        user = LichessAPI._get(f"/user/{name}")
        if not user or user.get("disabled"):
            return None

        stats = {}
        for perf, summary in user.get("perfs", {}).items():
            if perf in LichessAPI.NON_GAME_PERFS or not summary.get("games"):
                continue
            details = LichessAPI._get(f"/user/{name}/perf/{perf}") or {}
            stat = details.get("stat", {})
            count = stat.get("count", {})
            stats[perf] = {
                "last": {"rating": summary.get("rating")},
                "best": {"rating": (stat.get("highest") or {}).get("int")},
                "record": {key: count.get(key) for key in ("win", "loss", "draw")},
            }
        return stats

    @staticmethod
    def get_player_games(username, since_ms, until_ms):
        """Return the raw games played between the two timestamps, or None if the user is unknown.

        Lichess streams one JSON game per line (NDJSON) instead of one JSON document.
        """
        response = LichessAPI.SESSION.get(
            f"{LichessAPI.BASE_URL}/games/user/{quote(username, safe='')}",
            params={"since": since_ms, "until": until_ms, "pgnInJson": "true", "opening": "true"},
            headers={"Accept": "application/x-ndjson"},
            timeout=LichessAPI.TIMEOUT,
            stream=True,
        )
        with response:
            if response.status_code == 404:
                return None
            response.raise_for_status()
            try:
                return [json.loads(line) for line in response.iter_lines() if line]
            except ValueError as error:
                raise requests.RequestException("Lichess sent an invalid game line.") from error
