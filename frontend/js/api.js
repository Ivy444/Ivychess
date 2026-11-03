const API_BASE = "http://localhost:8000";

async function request(path, options) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Unexpected response from the server (status ${response.status}).`);
  }
  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}.`);
  }
  return data;
}

function query(params) {
  return new URLSearchParams(params).toString();
}

export function getStats(platform, username) {
  return request(`/stats?${query({ platform, username })}`);
}

export async function getGames(platform, username, year, month) {
  const data = await request(`/games?${query({ platform, username, year, month })}`);
  return data.games;
}

/** Every position of a game: {start_fen, moves: [{ply, san, uci, fen}], result}. */
export function replayGame(pgn) {
  // text/plain keeps this a "simple" request, so the browser skips the CORS preflight.
  return request("/replay", {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: pgn,
  });
}
