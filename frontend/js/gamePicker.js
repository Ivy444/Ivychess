import { getGames } from "./api.js";
import { el, IMG } from "./dom.js";

const RESULT_ICONS = {
  win: "opinionated_win.png",
  loss: "opinionated_lose.png",
  draw: "draw.png",
  unknown: "unknown.png",
};
const RESULT_LABELS = { win: "Win", loss: "Loss", draw: "Draw", unknown: "Unfinished" };
const TIME_CLASS_ICONS = {
  bullet: "bullet.png",
  blitz: "blitz.png",
  rapid: "rapid.png",
  classical: "classical.svg",
  correspondence: "correspondence.png",
};

const monthFormat = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function capitalise(text) {
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}

function playerLabel(player) {
  return player.rating ? `${player.username} (${player.rating})` : player.username;
}

function gameRow(game, onClick) {
  const opponent = game.user_color === "black" ? game.white : game.black;
  const timeIcon = TIME_CLASS_ICONS[game.time_class];

  return el(
    "li",
    {},
    el(
      "button",
      { className: "game-row", type: "button", onclick: onClick },
      el("img", {
        className: "result-icon",
        src: `${IMG}/gameResults/${RESULT_ICONS[game.user_result]}`,
        alt: RESULT_LABELS[game.user_result],
        title: RESULT_LABELS[game.user_result],
      }),
      el(
        "span",
        { className: "game-main" },
        el(
          "span",
          { className: "opponent" },
          el("span", { className: `color-dot ${game.user_color === "black" ? "white" : "black"}`, title: "Opponent's colour" }),
          `vs ${playerLabel(opponent)}`,
        ),
        el("span", { className: "opening" }, game.opening || "Unknown opening"),
      ),
      el(
        "span",
        { className: "game-meta" },
        el(
          "span",
          { className: "time-class" },
          timeIcon && el("img", { src: `${IMG}/timeControls/${timeIcon}`, alt: "" }),
          capitalise(game.time_class),
        ),
        el("span", { className: "game-date" }, dateFormat.format(new Date(game.end_time * 1000))),
      ),
    ),
  );
}

export function createGamePicker(dialog, { onSelect }) {
  const label = dialog.querySelector(".month-label");
  const body = dialog.querySelector(".picker-body");
  const nextButton = dialog.querySelector('[data-action="next-month"]');
  const cache = new Map();
  let player = null;
  let shown = null;
  let requestId = 0;

  function currentMonth() {
    const now = new Date();
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  }

  function isCurrentMonth({ year, month }) {
    const now = currentMonth();
    return year === now.year && month === now.month;
  }

  function setBody(...children) {
    body.replaceChildren(...children);
  }

  async function showMonth(year, month) {
    shown = { year, month };
    label.textContent = monthFormat.format(new Date(year, month - 1, 1));
    nextButton.disabled = isCurrentMonth(shown);

    const key = `${player.platform}|${player.username.toLowerCase()}|${year}-${month}`;
    const thisRequest = ++requestId;

    let games = cache.get(key);
    if (!games) {
      setBody(el("p", { className: "picker-state" }, "Loading games…"));
      try {
        games = await getGames(player.platform, player.username, year, month);
      } catch (error) {
        if (thisRequest !== requestId) return;
        setBody(
          el(
            "div",
            { className: "picker-state error" },
            el("p", {}, error.message || "Could not load games."),
            el("button", { type: "button", className: "secondary-button", onclick: () => showMonth(year, month) }, "Retry"),
          ),
        );
        return;
      }
      if (!isCurrentMonth(shown)) cache.set(key, games);
    }
    if (thisRequest !== requestId) return;

    if (games.length === 0) {
      setBody(el("p", { className: "picker-state" }, `No games in ${label.textContent}.`));
      return;
    }
    setBody(
      el(
        "ul",
        { className: "game-list" },
        games.map((game) =>
          gameRow(game, () => {
            dialog.close();
            onSelect(game);
          }),
        ),
      ),
    );
    body.scrollTop = 0;
  }

  function moveMonth(delta) {
    const date = new Date(shown.year, shown.month - 1 + delta, 1);
    showMonth(date.getFullYear(), date.getMonth() + 1);
  }

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "close") dialog.close();
    if (action === "previous-month") moveMonth(-1);
    if (action === "next-month" && !isCurrentMonth(shown)) moveMonth(1);
  });

  return {
    open(platform, username) {
      if (player?.platform !== platform || player?.username !== username) cache.clear();
      player = { platform, username };
      const { year, month } = currentMonth();
      dialog.showModal();
      showMonth(year, month);
    },
  };
}
