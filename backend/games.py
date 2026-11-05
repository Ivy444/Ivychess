import io
import re
from datetime import datetime, timezone

import chess.pgn

from api.chesscom import ChessComAPI
from api.lichess import LichessAPI

PLATFORMS = ("chesscom", "lichess")

CHESSCOM_DRAW_CODES = {"agreed", "repetition", "stalemate", "insufficient", "50move", "timevsinsufficient"}
LICHESS_UNFINISHED = {"created", "started", "aborted", "noStart", "unknownFinish"}
TIME_CLASS_ALIASES = {"daily": "correspondence", "ultraBullet": "bullet"}
FIRST_YEAR = 2000


def parse_month(year, month, today):
    try:
        year, month = int(year), int(month)
    except (TypeError, ValueError):
        raise ValueError("Year and month must be numbers.") from None
    if not 1 <= month <= 12:
        raise ValueError("Month must be between 1 and 12.")
    if year < FIRST_YEAR or (year, month) > (today.year, today.month):
        raise ValueError("That month is out of range.")
    return year, month


def month_range_ms(year, month):
    start = datetime(year, month, 1, tzinfo=timezone.utc)
    end = datetime(year + month // 12, month % 12 + 1, 1, tzinfo=timezone.utc)
    return int(start.timestamp() * 1000), int(end.timestamp() * 1000) - 1


def get_games(platform, username, year, month):
    if platform == "chesscom":
        raw = (ChessComAPI.get_player_games(username, year, month) or {}).get("games", [])
        normalize = normalize_chesscom_game
    else:
        raw = LichessAPI.get_player_games(username, *month_range_ms(year, month)) or []
        normalize = normalize_lichess_game

    games = [game for game in (normalize(item, username) for item in raw) if game]
    games.sort(key=lambda game: game["end_time"], reverse=True)
    return games


def _user_color(white_name, black_name, username):
    name = username.lower()
    if (white_name or "").lower() == name:
        return "white"
    if (black_name or "").lower() == name:
        return "black"
    return None


def _pgn_header(pgn, key):
    match = re.search(rf'^\[{key} "([^"]*)"\]', pgn, re.MULTILINE)
    return match.group(1) if match else None


def _chesscom_opening(pgn):
    eco_url = _pgn_header(pgn, "ECOUrl")
    if not eco_url:
        return None
    name = eco_url.rstrip("/").rsplit("/", 1)[-1].replace("-", " ")
    return re.sub(r"\s*\d+\..*$", "", name) or None


def normalize_chesscom_game(game, username):
    if game.get("rules") != "chess" or not game.get("pgn"):
        return None

    white, black = game.get("white", {}), game.get("black", {})
    color = _user_color(white.get("username"), black.get("username"), username)
    if color is None:
        result = "unknown"
    else:
        code = game[color].get("result")
        result = "win" if code == "win" else "draw" if code in CHESSCOM_DRAW_CODES else "loss"

    time_class = game.get("time_class")
    return {
        "platform": "chesscom",
        "id": game.get("url"),
        "url": game.get("url"),
        "end_time": game.get("end_time"),
        "time_class": TIME_CLASS_ALIASES.get(time_class, time_class),
        "white": {"username": white.get("username"), "rating": white.get("rating")},
        "black": {"username": black.get("username"), "rating": black.get("rating")},
        "user_color": color,
        "user_result": result,
        "opening": _chesscom_opening(game["pgn"]),
        "pgn": game["pgn"],
    }


def _lichess_player(player):
    if "aiLevel" in player:
        return {"username": f"Stockfish level {player['aiLevel']}", "rating": None}
    return {"username": (player.get("user") or {}).get("name", "Anonymous"), "rating": player.get("rating")}


def normalize_lichess_game(game, username):
    if game.get("variant") not in ("standard", "fromPosition") or not game.get("pgn"):
        return None

    players = game.get("players", {})
    white, black = _lichess_player(players.get("white", {})), _lichess_player(players.get("black", {}))
    color = _user_color(white["username"], black["username"], username)

    winner = game.get("winner")
    if color is None or (not winner and game.get("status") in LICHESS_UNFINISHED):
        result = "unknown"
    elif winner:
        result = "win" if winner == color else "loss"
    else:
        result = "draw"

    speed = game.get("speed")
    return {
        "platform": "lichess",
        "id": game.get("id"),
        "url": f"https://lichess.org/{game.get('id')}",
        "end_time": (game.get("lastMoveAt") or game.get("createdAt") or 0) // 1000,
        "time_class": TIME_CLASS_ALIASES.get(speed, speed),
        "white": white,
        "black": black,
        "user_color": color,
        "user_result": result,
        "opening": (game.get("opening") or {}).get("name"),
        "pgn": game["pgn"],
    }


def replay_pgn(pgn):
    game = chess.pgn.read_game(io.StringIO(pgn or ""))
    if game is None or game.errors:
        raise ValueError("The game could not be read.")

    board = game.board()
    start_fen = board.fen()
    moves = []
    for ply, move in enumerate(game.mainline_moves(), start=1):
        san = board.san(move)
        board.push(move)
        moves.append({"ply": ply, "san": san, "uci": move.uci(), "fen": board.fen()})

    if not moves:
        raise ValueError("The game has no moves.")
    return {"start_fen": start_fen, "moves": moves, "result": game.headers.get("Result", "*")}
