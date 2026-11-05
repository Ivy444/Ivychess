# Chess Analyser

Simple frontend prototype for choosing a chess platform and entering a
username. It currently uses plain HTML, CSS, and JavaScript.

## Run locally

Install the Python dependencies once:

```powershell
pip install -r requirements.txt
```

From `C:\Code\ivychess`:

```powershell
python -m http.server 5500 --directory frontend
```

Open http://localhost:5500.

Run the backend in another terminal:

```powershell
python backend/server.py
```
