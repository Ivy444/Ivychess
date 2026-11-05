import { el } from "./dom.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const WIDTH = 1000;
const HEIGHT = 120;

export function whiteWinPercent(evaluation) {
  if (!evaluation) return null;
  if ("mate" in evaluation) {
    if (evaluation.mate === 0) return evaluation.winner === "white" ? 100 : 0;
    return evaluation.mate > 0 ? 100 : 0;
  }
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * evaluation.cp)) - 1);
}

export function formatEval(evaluation) {
  if (!evaluation) return "…";
  if ("mate" in evaluation) {
    if (evaluation.mate === 0) return evaluation.winner === "white" ? "1-0" : "0-1";
    return `${evaluation.mate > 0 ? "" : "-"}M${Math.abs(evaluation.mate)}`;
  }
  const pawns = evaluation.cp / 100;
  return `${pawns > 0 ? "+" : ""}${pawns.toFixed(1)}`;
}

function svg(tag, attributes = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}

export function createEvalGraph({ onSelect }) {
  let moves = [];
  let evals = [];
  let current = 0;

  const area = svg("path", { class: "eval-area" });
  const line = svg("path", { class: "eval-line" });
  const midline = svg("line", { class: "eval-midline", x1: 0, x2: WIDTH, y1: HEIGHT / 2, y2: HEIGHT / 2 });
  const currentMarker = svg("line", { class: "eval-current", y1: 0, y2: HEIGHT });
  const hoverMarker = svg("line", { class: "eval-hover", y1: 0, y2: HEIGHT, visibility: "hidden" });

  const plot = svg("svg", {
    class: "eval-plot",
    viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
    preserveAspectRatio: "none",
    "aria-hidden": "true",
  });
  plot.append(area, midline, line, hoverMarker, currentMarker);

  const tooltip = el("div", { className: "eval-tooltip", hidden: true });
  const element = el(
    "div",
    { className: "eval-graph", role: "img", "aria-label": "Advantage graph" },
    plot,
    tooltip,
  );

  const positions = () => moves.length + 1;
  const xOf = (index) => (moves.length ? (index / moves.length) * WIDTH : 0);
  const yOf = (percent) => HEIGHT * (1 - percent / 100);

  function indexAt(clientX) {
    const box = element.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientX - box.left) / box.width, 0), 1);
    return Math.round(ratio * moves.length);
  }

  function render() {
    const points = [];
    for (let index = 0; index < positions(); index += 1) {
      const percent = whiteWinPercent(evals[index]);
      if (percent === null) break;
      points.push([xOf(index), yOf(percent)]);
    }

    if (points.length === 0) {
      area.setAttribute("d", "");
      line.setAttribute("d", "");
    } else {
      const path = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
      const lastX = points[points.length - 1][0].toFixed(1);
      area.setAttribute("d", `M0,${HEIGHT} ${path.replace(/^M/, "L")} L${lastX},${HEIGHT} Z`);
      line.setAttribute("d", path);
    }

    const x = xOf(current);
    currentMarker.setAttribute("x1", x);
    currentMarker.setAttribute("x2", x);
    const latest = evals[current];
    element.setAttribute(
      "aria-label",
      latest ? `Advantage graph. Current evaluation ${formatEval(latest)}` : "Advantage graph",
    );
  }

  function showHover(clientX) {
    if (!moves.length) return;
    const index = indexAt(clientX);
    const x = xOf(index);
    hoverMarker.setAttribute("x1", x);
    hoverMarker.setAttribute("x2", x);
    hoverMarker.setAttribute("visibility", "visible");

    const move = moves[index - 1];
    const label = move ? `${Math.ceil(move.ply / 2)}.${move.ply % 2 ? "" : ".."} ${move.san}` : "Start";
    tooltip.replaceChildren(
      el("span", { className: "eval-tooltip-move" }, label),
      el("span", { className: "eval-tooltip-value" }, formatEval(evals[index])),
    );
    tooltip.hidden = false;
    tooltip.style.left = `${(x / WIDTH) * 100}%`;
  }

  function hideHover() {
    hoverMarker.setAttribute("visibility", "hidden");
    tooltip.hidden = true;
  }

  element.addEventListener("pointermove", (event) => showHover(event.clientX));
  element.addEventListener("pointerleave", hideHover);
  element.addEventListener("click", (event) => {
    if (moves.length) onSelect(indexAt(event.clientX));
  });

  return {
    element,
    setGame(gameMoves) {
      moves = gameMoves;
      evals = [];
      current = 0;
      hideHover();
      render();
    },
    setEval(index, evaluation) {
      evals[index] = evaluation;
      render();
    },
    setCurrent(index) {
      current = index;
      render();
    },
  };
}

export function createEvalBar() {
  let orientation = "white";
  let evaluation = null;

  const fill = el("div", { className: "eval-bar-fill" });
  const label = el("span", { className: "eval-bar-label" });
  const element = el("div", { className: "eval-bar", role: "img", "aria-label": "Evaluation" }, fill, label);

  function render() {
    const percent = whiteWinPercent(evaluation);
    element.classList.toggle("is-pending", percent === null);
    element.classList.toggle("flipped", orientation === "black");
    fill.style.height = `${percent ?? 50}%`;

    const whiteBetter = percent === null || percent >= 50;
    label.textContent = evaluation ? formatEval(evaluation).replace(/^[+-]/, "") : "";
    label.classList.toggle("on-white", whiteBetter);
    const atBottom = whiteBetter === (orientation === "white");
    label.classList.toggle("at-bottom", atBottom);
    element.setAttribute("aria-label", evaluation ? `Evaluation ${formatEval(evaluation)}` : "Evaluation pending");
  }

  render();
  return {
    element,
    setOrientation(color) {
      orientation = color;
      render();
    },
    setEval(value) {
      evaluation = value || null;
      render();
    },
  };
}
