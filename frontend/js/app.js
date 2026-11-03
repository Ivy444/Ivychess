import { getStats } from "./api.js";
import { escapeHtml } from "./dom.js";
import { createGamePicker } from "./gamePicker.js";
import { createGameView } from "./gameView.js";

const container = document.querySelector(".container");
const homeView = document.querySelector("#home-view");
const form = document.querySelector("#profile-form");
const usernameInput = document.querySelector("#username");
const messageElement = document.querySelector("#form-message");
const statsElement = document.querySelector("#stats");
const openPickerButton = document.querySelector("#open-picker");

console.info("Ivychess frontend loaded");

const PLATFORM_NAMES = { chesscom: "Chess.com", lichess: "Lichess" };

/** The player whose stats are shown; the game picker lists their games. */
let currentPlayer = null;

const gameView = createGameView(document.querySelector("#game-view"), {
  onBack() {
    gameView.close();
    container.classList.remove("wide");
    homeView.hidden = false;
    openPickerButton.focus();
  },
});

const picker = createGamePicker(document.querySelector("#game-picker"), {
  onSelect(game) {
    homeView.hidden = true;
    container.classList.add("wide");
    gameView.open(game);
  },
});

openPickerButton.addEventListener("click", () => {
  if (currentPlayer) picker.open(currentPlayer.platform, currentPlayer.username);
});

function formatGameType(value) {
  return value
    .replace(/^chess_/, "")
    .replaceAll("_", " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function renderStats(stats, platformName) {
  if (!stats || typeof stats !== "object" || Array.isArray(stats)) {
    throw new Error(`${platformName} returned an invalid stats response.`);
  }

  const rows = Object.entries(stats)
    .filter(([, data]) => data && typeof data === "object")
    .map(([gameType, data]) => {
      const current = data.last || {};
      const best = data.best || {};
      const record = data.record || {};
      // Values come from Chess.com / Lichess, so escape them before building HTML.
      const cell = (value) => `<td>${escapeHtml(value ?? "-")}</td>`;
      return `<tr>
        <th scope="row">${escapeHtml(formatGameType(gameType))}</th>
        ${cell(current.rating)}${cell(best.rating)}
        ${cell(record.win)}${cell(record.loss)}${cell(record.draw)}
      </tr>`;
    })
    .join("");

  statsElement.innerHTML = `
    <div class="table-wrapper">
      <table>
        <caption>${platformName} ratings and records</caption>
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
  openPickerButton.hidden = true;
  currentPlayer = null;

  messageElement.textContent = "Loading stats...";
  try {
    const stats = await getStats(platform, username);
    messageElement.textContent = `Stats for ${username}:`;
    renderStats(stats, PLATFORM_NAMES[platform]);
    statsElement.hidden = false;
    currentPlayer = { platform, username };
    openPickerButton.hidden = false;
  } catch (error) {
    console.error("Could not display player stats:", error);
    messageElement.textContent =
      error instanceof Error ? error.message : "Could not load stats.";
  }
});
