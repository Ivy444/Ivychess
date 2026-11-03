import { el, IMG } from "./dom.js";

const FILES = "abcdefgh";
const PIECE_NAMES = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };

/** "rnbqkbnr/pppppppp/8/..." -> { e1: "K", e8: "k", ... } */
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

/**
 * A board drawn from FEN strings. It knows no chess rules; it only shows positions.
 *
 *   const board = createBoard();
 *   container.append(board.element);
 *   board.setOrientation("black");
 *   board.setPosition(fen, "e2e4");   // second argument highlights the last move
 */
export function createBoard() {
  const element = el("div", { className: "board", role: "img" });
  let orientation = "white";
  let squares = {};
  let current = { fen: null, lastMove: null };

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
  };
}
