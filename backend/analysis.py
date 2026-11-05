import os
import shutil
from pathlib import Path

import chess
import chess.engine

ENGINE_DIR = Path(__file__).resolve().parent / "engine"
TIME_PER_POSITION = float(os.environ.get("ANALYSIS_TIME_PER_POSITION", "0.1"))


class EngineNotFound(Exception):
    pass


def find_stockfish():
    configured = os.environ.get("STOCKFISH_PATH")
    if configured:
        if Path(configured).is_file():
            return configured
        raise EngineNotFound(f"STOCKFISH_PATH points to a missing file: {configured}")

    for candidate in sorted(ENGINE_DIR.glob("stockfish*")):
        if candidate.is_file() and candidate.suffix in ("", ".exe"):
            return str(candidate)

    on_path = shutil.which("stockfish")
    if on_path:
        return on_path
    raise EngineNotFound(
        "Stockfish was not found. Put it at backend/engine/stockfish.exe or set STOCKFISH_PATH."
    )


def _score(pov_score):
    white = pov_score.white()
    if white.is_mate():
        return {"mate": white.mate()}
    return {"cp": white.score()}


def evaluate_position(engine, board, limit):
    if board.is_checkmate():
        winner = "black" if board.turn == chess.WHITE else "white"
        return {"eval": {"mate": 0, "winner": winner}, "best_uci": None, "best_san": None}
    if board.is_game_over():
        return {"eval": {"cp": 0}, "best_uci": None, "best_san": None}

    info = engine.analyse(board, limit)
    best = (info.get("pv") or [None])[0]
    return {
        "eval": _score(info["score"]),
        "best_uci": best.uci() if best else None,
        "best_san": board.san(best) if best else None,
    }


def open_engine(engine_path):
    return chess.engine.SimpleEngine.popen_uci(engine_path)


def analyse_fens(engine, fens, time_per_position=TIME_PER_POSITION):
    limit = chess.engine.Limit(time=time_per_position)
    for index, fen in enumerate(fens):
        yield {"index": index, **evaluate_position(engine, chess.Board(fen), limit)}
