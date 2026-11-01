const form = document.querySelector("#profile-form");
const usernameInput = document.querySelector("#username");
const messageElement = document.querySelector("#form-message");
const statsElement = document.querySelector("#stats");

function formatGameType(value) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function renderStats(stats) {
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
    const response = await fetch(
      `http://localhost:8000/stats?username=${encodeURIComponent(username)}`
    );
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error);
    }

    messageElement.textContent = `Stats for ${username}:`;
    renderStats(result);
    statsElement.hidden = false;
  } catch (error) {
    messageElement.textContent = error.message || "Could not load stats.";
  }
});
