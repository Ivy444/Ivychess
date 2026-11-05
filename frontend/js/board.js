import { el, IMG } from "./dom.js";

const FILES = "abcdefgh";
const PIECE_NAMES = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };

function parsePlacement(fen) {
  const pieces = {};
  fen.split(" ")[0].split("/").forEach((row, index) => {
    const rank = 8 - index;
    let file = 0;
    for (const char of row) {
      if (/\d/.test(char)) {
        file += Number(char);
      } else {
        pieces[`${FILES[file]}${rank}`] = char;
        file += 1;
      }
    }
  });
  return pieces;
}

function pieceImage(code) {
  const color = code === code.toUpperCase() ? "white" : "black";
  const name = PIECE_NAMES[code.toLowerCase()];
  return el("img", {
    className: "piece",
    src: `${IMG}/pieces/standard/${color}_${name}.svg`,
    alt: `${color} ${name}`,
    draggable: "false",
  });
}

const SVG_NS = "http://www.w3.org/2000/svg";

function squareCentre(square, orientation) {
  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]);
  const column = orientation === "white" ? file : 7 - file;
  const row = orientation === "white" ? 8 - rank : rank - 1;
  return { x: column + 0.5, y: row + 0.5 };
}

function arrowPoints(from, to) {
  const SHAFT = 0.09;
  const HEAD_WIDTH = 0.27;
  const HEAD_LENGTH = 0.42;
  const START_OFFSET = 0.12;

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const ux = dx / length;
  const uy = dy / length;
  const px = -uy;
  const py = ux;

  const start = { x: from.x + ux * START_OFFSET, y: from.y + uy * START_OFFSET };
  const neck = { x: to.x - ux * HEAD_LENGTH, y: to.y - uy * HEAD_LENGTH };
  const at = (base, side) => `${(base.x + px * side).toFixed(3)},${(base.y + py * side).toFixed(3)}`;

  return [
    at(start, SHAFT),
    at(neck, SHAFT),
    at(neck, HEAD_WIDTH),
    `${to.x.toFixed(3)},${to.y.toFixed(3)}`,
    at(neck, -HEAD_WIDTH),
    at(neck, -SHAFT),
    at(start, -SHAFT),
  ].join(" ");
}

export function createBoard() {
  const element = el("div", { className: "board", role: "img" });
  let orientation = "white";
  let squares = {};
  let current = { fen: null, lastMove: null };
  let bestMove = null;

  const overlay = document.createElementNS(SVG_NS, "svg");
  overlay.setAttribute("class", "board-overlay");
  overlay.setAttribute("viewBox", "0 0 8 8");
  overlay.setAttribute("aria-hidden", "true");

  function buildSquares() {
    squares = {};
    element.replaceChildren();
    const ranks = orientation === "white" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
    const files = orientation === "white" ? [...FILES] : [...FILES].reverse();

    ranks.forEach((rank, row) => {
      files.forEach((file, column) => {
        const isDark = (FILES.indexOf(file) + rank) % 2 === 1;
        const square = el("div", { className: `square ${isDark ? "dark" : "light"}` });
        if (column === 0) square.append(el("span", { className: "coord rank" }, String(rank)));
        if (row === 7) square.append(el("span", { className: "coord file" }, file));
        squares[`${file}${rank}`] = square;
        element.append(square);
      });
    });
    element.append(overlay);
  }

  function renderBestMove() {
    overlay.replaceChildren();
    element.querySelector(".square.best-from")?.classList.remove("best-from");
    if (!bestMove) return;

    const from = bestMove.slice(0, 2);
    const to = bestMove.slice(2, 4);
    squares[from]?.classList.add("best-from");

    const arrow = document.createElementNS(SVG_NS, "polygon");
    arrow.setAttribute("class", "best-arrow");
    arrow.setAttribute("points", arrowPoints(squareCentre(from, orientation), squareCentre(to, orientation)));
    overlay.append(arrow);
  }

  function render() {
    if (!current.fen) return;
    const pieces = parsePlacement(current.fen);
    const highlighted = current.lastMove ? [current.lastMove.slice(0, 2), current.lastMove.slice(2, 4)] : [];

    for (const [name, square] of Object.entries(squares)) {
      square.querySelector(".piece")?.remove();
      square.classList.toggle("last-move", highlighted.includes(name));
      if (pieces[name]) square.append(pieceImage(pieces[name]));
    }
    element.setAttribute("aria-label", `Chess position ${current.fen.split(" ")[0]}`);
    renderBestMove();
  }

  buildSquares();

  return {
    element,
    get orientation() {
      return orientation;
    },
    setOrientation(color) {
      if (color === orientation) return;
      orientation = color;
      buildSquares();
      render();
    },
    flip() {
      this.setOrientation(orientation === "white" ? "black" : "white");
    },
    setPosition(fen, lastMove = null) {
      current = { fen, lastMove };
      render();
    },
    setBestMove(uci) {
      bestMove = uci || null;
      renderBestMove();
    },
  };
}
