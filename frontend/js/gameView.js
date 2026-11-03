import { replayGame } from "./api.js";
import { createBoard } from "./board.js";
import { el, IMG, safeUrl } from "./dom.js";

const RESULT_TEXT = { win: "You won", loss: "You lost", draw: "Draw", unknown: "Unfinished" };

function iconButton(icon, label, onClick, extraClass = "") {
  return el(
    "button",
    { className: `icon-button ${extraClass}`, type: "button", "aria-label": label, title: label, onclick: onClick },
    el("img", { src: `${IMG}/interface/${icon}.svg`, alt: "" }),
  );
}

function playerBar(player, color, isUser) {
  return el(
    "div",
    { className: `player-bar ${isUser ? "is-user" : ""}` },
    el("img", { className: "avatar", src: `${IMG}/defaultprofileimage.png`, alt: "" }),
    el("span", { className: `color-dot ${color}`, title: color === "white" ? "White" : "Black" }),
    el("span", { className: "player-name" }, player.username),
    player.rating && el("span", { className: "player-rating" }, `(${player.rating})`),
  );
}

/**
 * The game view: board, players, move list and navigation.
 *
 *   const view = createGameView(sectionElement, { onBack });
 *   view.open(game);   // game as returned by /games
 *   view.close();
 */
export function createGameView(section, { onBack }) {
  const board = createBoard();
  let game = null;
  let replay = null;
  let index = 0; // 0 = start position, n = position after move n
  let openId = 0;

  const topBar = el("div", { className: "player-slot" });
  const bottomBar = el("div", { className: "player-slot" });
  const moveList = el("ol", { className: "move-list" });
  const status = el("p", { className: "game-status", role: "status" });
  const title = el("h1", { className: "game-title" });
  const subtitle = el("p", { className: "subtitle game-subtitle" });

  const controls = el(
    "div",
    { className: "board-controls" },
    iconButton("start", "First move (Home)", () => go(0)),
    iconButton("back", "Previous move (←)", () => go(index - 1)),
    iconButton("next", "Next move (→)", () => go(index + 1)),
    iconButton("end", "Last move (End)", () => replay && go(replay.moves.length)),
    iconButton("flip", "Flip board", () => {
      board.flip();
      renderPlayers();
    }, "flip-button"),
  );

  section.replaceChildren(
    el(
      "header",
      { className: "game-header" },
      el(
        "button",
        { className: "back-button", type: "button", onclick: () => onBack() },
        el("img", { src: `${IMG}/interface/back.svg`, alt: "" }),
        "Back",
      ),
      el("div", {}, title, subtitle),
    ),
    status,
    el(
      "div",
      { className: "game-layout" },
      el("div", { className: "board-column" }, topBar, board.element, bottomBar, controls),
      el("div", { className: "moves-column" }, el("h2", {}, "Moves"), moveList),
    ),
  );

  function renderPlayers() {
    const bottom = board.orientation;
    const top = bottom === "white" ? "black" : "white";
    topBar.replaceChildren(playerBar(game[top], top, game.user_color === top));
    bottomBar.replaceChildren(playerBar(game[bottom], bottom, game.user_color === bottom));
  }

  function renderMoveList() {
    const rows = [];
    for (let i = 0; i < replay.moves.length; i += 2) {
      rows.push(
        el(
          "li",
          {},
          el("span", { className: "move-number" }, `${i / 2 + 1}.`),
          replay.moves.slice(i, i + 2).map((move) =>
            el("button", { className: "move", type: "button", "data-ply": move.ply, onclick: () => go(move.ply) }, move.san),
          ),
        ),
      );
    }
    moveList.replaceChildren(...rows);
  }

  function go(target) {
    if (!replay) return;
    index = Math.max(0, Math.min(target, replay.moves.length));
    const move = replay.moves[index - 1];
    board.setPosition(move ? move.fen : replay.start_fen, move?.uci);

    moveList.querySelector(".move.active")?.classList.remove("active");
    const active = moveList.querySelector(`[data-ply="${index}"]`);
    if (active) {
      active.classList.add("active");
      // Keep the current move visible inside the list without scrolling the page.
      const listBox = moveList.getBoundingClientRect();
      const moveBox = active.getBoundingClientRect();
      if (moveBox.top < listBox.top) moveList.scrollTop -= listBox.top - moveBox.top;
      if (moveBox.bottom > listBox.bottom) moveList.scrollTop += moveBox.bottom - listBox.bottom;
    } else if (index === 0) {
      moveList.scrollTop = 0;
    }
  }

  function onKey(event) {
    if (!replay || event.target.closest?.("input, textarea") || document.querySelector("dialog[open]")) return;
    const actions = {
      ArrowLeft: () => go(index - 1),
      ArrowRight: () => go(index + 1),
      Home: () => go(0),
      End: () => go(replay.moves.length),
    };
    if (actions[event.key]) {
      event.preventDefault();
      actions[event.key]();
    }
  }

  async function load() {
    const thisOpen = ++openId;
    replay = null;
    moveList.replaceChildren();
    board.setPosition("8/8/8/8/8/8/8/8 w - - 0 1");
    status.hidden = false;
    status.className = "game-status";
    status.textContent = "Loading game…";

    try {
      const result = await replayGame(game.pgn);
      if (thisOpen !== openId) return;
      replay = result;
    } catch (error) {
      if (thisOpen !== openId) return;
      status.className = "game-status error";
      status.replaceChildren(
        error.message || "Could not load the game.",
        el("button", { className: "secondary-button inline", type: "button", onclick: load }, "Retry"),
      );
      return;
    }

    status.hidden = true;
    renderMoveList();
    go(0);
  }

  return {
    open(selectedGame) {
      game = selectedGame;
      const opponent = game.user_color === "black" ? game.white : game.black;
      title.textContent = `vs ${opponent.username}`;
      const date = new Date(game.end_time * 1000).toLocaleDateString("en-GB", { dateStyle: "medium" });
      const link = safeUrl(game.url);
      subtitle.replaceChildren(
        `${RESULT_TEXT[game.user_result]} · ${game.time_class} · ${date}`,
        link && " · ",
        link && el("a", { href: link, target: "_blank", rel: "noopener noreferrer" }, "Open on site"),
      );

      board.setOrientation(game.user_color === "black" ? "black" : "white");
      renderPlayers();
      section.hidden = false;
      document.addEventListener("keydown", onKey);
      load();
    },
    close() {
      openId += 1;
      replay = null;
      section.hidden = true;
      document.removeEventListener("keydown", onKey);
    },
  };
}
