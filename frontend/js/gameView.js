import { analyseGame, replayGame } from "./api.js";
import { createBoard } from "./board.js";
import { createEvalBar, createEvalGraph } from "./evalGraph.js";
import { el, IMG } from "./dom.js";

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

export function createGameView(section, { onBack }) {
  const board = createBoard();
  let game = null;
  let replay = null;
  let index = 0;
  let openId = 0;
  let analysis = [];
  let analysisAbort = null;
  let showBestMove = true;

  const graph = createEvalGraph({ onSelect: (target) => go(target) });
  const evalBar = createEvalBar();
  const bestMoveText = el("span", { className: "best-move-text" });
  const analysisStatus = el("span", { className: "analysis-status", role: "status" });
  const analysisInfo = el("div", { className: "analysis-info" }, bestMoveText, analysisStatus);

  const bestMoveIcon = el("img", { src: `${IMG}/interface/visible_enabled.svg`, alt: "" });
  const bestMoveButton = el(
    "button",
    {
      className: "icon-button best-move-toggle",
      type: "button",
      title: "Show best move",
      "aria-label": "Show best move",
      "aria-pressed": "true",
      onclick: () => {
        showBestMove = !showBestMove;
        bestMoveButton.setAttribute("aria-pressed", String(showBestMove));
        bestMoveIcon.src = `${IMG}/interface/${showBestMove ? "visible_enabled" : "visible_disabled"}.svg`;
        renderAnalysis();
      },
    },
    bestMoveIcon,
  );

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
    bestMoveButton,
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
      el(
        "div",
        { className: "board-column" },
        topBar,
        el("div", { className: "board-row" }, evalBar.element, board.element),
        bottomBar,
        controls,
        analysisInfo,
      ),
      el(
        "div",
        { className: "moves-column" },
        el("h2", {}, "Moves"),
        moveList,
        el("h2", { className: "advantage-heading" }, "Advantage"),
        graph.element,
      ),
    ),
  );

  function renderPlayers() {
    const bottom = board.orientation;
    const top = bottom === "white" ? "black" : "white";
    evalBar.setOrientation(bottom);
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
      const listBox = moveList.getBoundingClientRect();
      const moveBox = active.getBoundingClientRect();
      if (moveBox.top < listBox.top) moveList.scrollTop -= listBox.top - moveBox.top;
      if (moveBox.bottom > listBox.bottom) moveList.scrollTop += moveBox.bottom - listBox.bottom;
    } else if (index === 0) {
      moveList.scrollTop = 0;
    }
    graph.setCurrent(index);
    renderAnalysis();
  }

  function renderAnalysis() {
    const position = replay && analysis[index];
    evalBar.setEval(position ? position.eval : null);

    if (!position || !position.best_san) {
      bestMoveText.textContent = "";
      board.setBestMove(null);
      return;
    }
    const fen = index === 0 ? replay.start_fen : replay.moves[index - 1].fen;
    const side = fen.split(" ")[1] === "w" ? "White" : "Black";
    bestMoveText.textContent = `Best move for ${side}: ${position.best_san}`;
    board.setBestMove(showBestMove ? position.best_uci : null);
  }

  async function runAnalysis() {
    analysisAbort?.abort();
    const controller = new AbortController();
    analysisAbort = controller;
    analysis = [];
    graph.setGame(replay.moves);
    graph.setCurrent(index);
    renderAnalysis();
    let total = replay.moves.length + 1;
    analysisStatus.className = "analysis-status";
    analysisStatus.textContent = "Analysing…";

    try {
      await analyseGame(
        game.pgn,
        (message) => {
          if (message.type === "start") total = message.total;
          if (message.type !== "position") return;
          analysis[message.index] = message;
          graph.setEval(message.index, message.eval);
          analysisStatus.textContent = `Analysing… ${message.index + 1} / ${total}`;
          if (message.index === index) renderAnalysis();
        },
        controller.signal,
      );
      analysisStatus.textContent = "";
    } catch (error) {
      if (controller.signal.aborted) return;
      analysisStatus.className = "analysis-status error";
      analysisStatus.replaceChildren(
        error.message || "The analysis failed.",
        el("button", { className: "secondary-button inline", type: "button", onclick: runAnalysis }, "Retry"),
      );
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
    analysisAbort?.abort();
    replay = null;
    analysis = [];
    graph.setGame([]);
    analysisStatus.textContent = "";
    renderAnalysis();
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
    runAnalysis();
  }

  return {
    open(selectedGame) {
      game = selectedGame;
      const opponent = game.user_color === "black" ? game.white : game.black;
      title.textContent = `vs ${opponent.username}`;
      const date = new Date(game.end_time * 1000).toLocaleDateString("en-GB", { dateStyle: "medium" });
      subtitle.replaceChildren(
        `${RESULT_TEXT[game.user_result]} · ${game.time_class} · ${date} · `,
        el("a", { href: game.url, target: "_blank", rel: "noopener" }, "Open on site"),
      );

      board.setOrientation(game.user_color === "black" ? "black" : "white");
      renderPlayers();
      section.hidden = false;
      document.addEventListener("keydown", onKey);
      load();
    },
    close() {
      openId += 1;
      analysisAbort?.abort();
      replay = null;
      section.hidden = true;
      document.removeEventListener("keydown", onKey);
    },
  };
}
