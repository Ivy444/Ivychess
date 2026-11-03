# Chess Analyser

Look up a player's ratings on Chess.com or Lichess, pick one of their games
month by month, and step through it on a board.

Plain HTML/CSS/JavaScript frontend and a small Python backend.

## Requirements

- Python 3.11 or newer
- Internet access (the backend calls the public Chess.com and Lichess APIs;
  no account or API key is needed)

## Run locally

Install the Python dependencies once, from `C:\Code\ivychess`:

```powershell
pip install -r requirements.txt
```

Start the frontend:

```powershell
python -m http.server 5500 --directory frontend
```

Run the backend in another terminal:

```powershell
python backend/server.py
```

Open http://localhost:5500. The backend only accepts requests from this
address (port 5500), so keep the frontend on that port.

## Stockfish (needed later for game analysis)

You do **not** need Stockfish yet: stats, the game picker and the board work
without it. The upcoming move analysis runs the Stockfish engine on your own
computer, so each developer has to download it themselves:

1. Download Stockfish for your system from https://stockfishchess.org/download/.
2. Put the program at `backend/engine/stockfish.exe` (on macOS/Linux:
   `backend/engine/stockfish`), or set the `STOCKFISH_PATH` environment
   variable to wherever you put it.

The engine is not committed to the repository: `backend/engine/*.exe` is in
`.gitignore`, because the binary is large and differs per operating system.

## Tests

```powershell
pip install -r requirements-dev.txt
python -m pytest backend/tests
```

## Credits

Chess pieces: "cburnett" set by Colin M.L. Burnett, CC BY-SA 3.0
(see `frontend/img/pieces/standard/LICENSE.txt`).
