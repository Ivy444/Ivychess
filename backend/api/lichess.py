import requests
from urllib.parse import quote


class LichessAPI:
    BASE_URL = "https://lichess.org/api"
    HEADERS = {"User-Agent": "Ivychess/0.1 (chess stats analyser)"}
    TIMEOUT = 10
    NON_GAME_PERFS = {"puzzle", "storm", "racer", "streak"}

    @staticmethod
    def _get(path):
        response = requests.get(
            f"{LichessAPI.BASE_URL}{path}",
            headers=LichessAPI.HEADERS,
            timeout=LichessAPI.TIMEOUT,
        )
        if response.status_code == 404:
            return None
        response.raise_for_status()
        return response.json()

    @staticmethod
    def get_user(username):
        data = LichessAPI._get(f"/user/{quote(username, safe='')}")
        if data is None or data.get("disabled"):
            return None
        return data

    @staticmethod
    def get_perf_stats(username, perf):
        return LichessAPI._get(
            f"/user/{quote(username, safe='')}/perf/{quote(perf, safe='')}"
        )

    @staticmethod
    def get_player_stats(username):
        user = LichessAPI.get_user(username)
        if user is None:
            return None

        stats = {}
        for perf, summary in user.get("perfs", {}).items():
            if perf in LichessAPI.NON_GAME_PERFS or not summary.get("games"):
                continue

            entry = {"last": {"rating": summary.get("rating")}, "games": summary["games"]}
            details = LichessAPI.get_perf_stats(user["username"], perf)
            if details:
                stat = details.get("stat", {})
                count = stat.get("count", {})
                highest = stat.get("highest")
                if highest:
                    entry["best"] = {"rating": highest.get("int")}
                entry["record"] = {
                    "win": count.get("win"),
                    "loss": count.get("loss"),
                    "draw": count.get("draw"),
                }
            stats[perf] = entry

        return {"username": user["username"], "stats": stats}
