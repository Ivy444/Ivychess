const form = document.querySelector("#profile-form");
const usernameInput = document.querySelector("#username");
const messageElement = document.querySelector("#form-message");
const statsElement = document.querySelector("#stats");

console.info("Ivychess frontend loaded");

function formatGameType(value) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function renderStats(stats) {
  if (!stats || typeof stats !== "object" || Array.isArray(stats)) {
    throw new Error("Chess.com returned an invalid stats response.");
  }

  const rows = Object.entries(stats)
    .filter(([, data]) => data && typeof data === "object")
    .map(([gameType, data]) => {
      const current = data.last || {};
      const best = data.best || {};
      const record = data.record || {};
      return `<tr>
        <th scope="row">${formatGameType(gameType)}</th>
        <td>${current.rating ?? "-"}</td>
        <td>${best.rating ?? "-"}</td>
        <td>${record.win ?? "-"}</td>
        <td>${record.loss ?? "-"}</td>
        <td>${record.draw ?? "-"}</td>
      </tr>`;
    })
    .join("");

  statsElement.innerHTML = `
    <div class="table-wrapper">
      <table>
        <caption>Chess.com ratings and records</caption>
        <thead><tr>
          <th scope="col">Game type</th><th scope="col">Rating</th>
          <th scope="col">Best</th><th scope="col">Wins</th>
          <th scope="col">Losses</th><th scope="col">Draws</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const username = usernameInput.value.trim();
  if (!username) {
    messageElement.textContent = "Please enter your username.";
    usernameInput.focus();
    return;
  }

  const platform = new FormData(form).get("platform");
  statsElement.replaceChildren();
  statsElement.hidden = true;

  if (platform !== "chesscom") {
    messageElement.textContent = `Ready to analyse ${username} on Lichess.`;
    return;
  }

  messageElement.textContent = "Loading stats...";
  try {
    const url = `http://localhost:8000/stats?platform=${platform}&username=${encodeURIComponent(username)}`;
    console.info("Requesting player stats:", url);
    const response = await fetch(url);
    const responseText = await response.text();
    console.info("Stats response:", response.status, responseText);
    const result = JSON.parse(responseText);

    if (!response.ok) {
      throw new Error(result.error || `Request failed with status ${response.status}.`);
    }

    messageElement.textContent = `Stats for ${username}:`;
    renderStats(result);
    statsElement.hidden = false;
  } catch (error) {
    console.error("Could not display player stats:", error);
    messageElement.textContent =
      error instanceof Error ? error.message : "Could not load stats.";
  }
});