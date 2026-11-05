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

export function replayGame(pgn) {
  return request("/replay", {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: pgn,
  });
}

export async function analyseGame(pgn, onMessage, signal) {
  const response = await fetch(`${API_BASE}/analyse`, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: pgn,
    signal,
  });
  if (!response.ok) {
    let message = `Analysis failed with status ${response.status}.`;
    try {
      message = (await response.json()).error || message;
    } catch {
    }
    throw new Error(message);
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let finished = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      const message = JSON.parse(line);
      if (message.type === "error") throw new Error(message.message);
      if (message.type === "done") finished = true;
      onMessage(message);
    }
  }
  if (!finished) throw new Error("The analysis was interrupted.");
}
