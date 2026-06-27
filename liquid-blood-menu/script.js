const svg = document.querySelector("#menuSvg");
const hitButton = document.querySelector("#hitButton");
const buttonShape = document.querySelector("#buttonShape");
const buttonText = document.querySelector("#buttonText");
const dropShape = document.querySelector("#dropShape");
const bridgeShape = document.querySelector("#bridgeShape");
const itemGroups = [...document.querySelectorAll(".menu-item")];

const state = {
  width: window.innerWidth,
  height: window.innerHeight,
  open: false,
  animating: false,
  startTime: performance.now(),
  button: { cx: 0, cy: 0, w: 260, h: 92 },
  progress: 0,
  impulse: 0,
};

const items = [
  { label: "Élet", dx: -128, dy: 138, w: 126, h: 58 },
  { label: "Remény", dx: 128, dy: 138, w: 144, h: 58 },
  { label: "Erő", dx: -112, dy: 218, w: 116, h: 56 },
  { label: "Segítség", dx: 124, dy: 218, w: 154, h: 56 },
];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function catmullRomPath(points) {
  let d = `M ${points[0].x} ${points[0].y}`;
  const size = points.length;

  for (let i = 0; i < size; i += 1) {
    const p0 = points[(i - 1 + size) % size];
    const p1 = points[i];
    const p2 = points[(i + 1) % size];
    const p3 = points[(i + 2) % size];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`;
  }

  return `${d} Z`;
}

function wavySuperellipse({ cx, cy, w, h, amp, phase, seed = 0, points = 56, power = 4 }) {
  const result = [];
  const a = w / 2;
  const b = h / 2;

  for (let i = 0; i < points; i += 1) {
    const theta = (Math.PI * 2 * i) / points;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const x = a * Math.sign(cos) * Math.pow(Math.abs(cos), 2 / power);
    const y = b * Math.sign(sin) * Math.pow(Math.abs(sin), 2 / power);
    const wave =
      Math.sin(theta * 5 + phase + seed) * amp +
      Math.sin(theta * 9 - phase * 0.7 + seed * 1.7) * amp * 0.35;
    const len = Math.hypot(x / a, y / b) || 1;

    result.push({
      x: cx + x + (x / a / len) * wave,
      y: cy + y + (y / b / len) * wave,
    });
  }

  return catmullRomPath(result);
}

function dropPath(cx, cy, size, amp, phase) {
  const points = [];
  const rx = size * 0.36;
  const ry = size * 0.48;

  for (let i = 0; i < 48; i += 1) {
    const theta = (Math.PI * 2 * i) / 48;
    const topPull = Math.max(0, -Math.sin(theta)) * size * 0.16;
    const x = Math.cos(theta) * rx;
    const y = Math.sin(theta) * ry - topPull;
    const wave = Math.sin(theta * 6 + phase) * amp;
    const len = Math.hypot(x / rx, y / ry) || 1;
    points.push({
      x: cx + x + (x / rx / len) * wave,
      y: cy + y + (y / ry / len) * wave,
    });
  }

  return catmullRomPath(points);
}

function bridgePath(cx, topY, bottomY, topWidth, bottomWidth, amp, phase) {
  if (bottomY <= topY || topWidth < 1 || bottomWidth < 1) {
    return "";
  }

  const height = bottomY - topY;
  const waist = Math.max(10, Math.min(topWidth, bottomWidth) * 0.5);
  const pinchY = topY + height * 0.58;
  const wobble = Math.sin(phase * 1.4) * amp;
  const leftTop = { x: cx - topWidth / 2, y: topY };
  const rightTop = { x: cx + topWidth / 2, y: topY };
  const leftBottom = { x: cx - bottomWidth / 2, y: bottomY };
  const rightBottom = { x: cx + bottomWidth / 2, y: bottomY };
  const leftPinch = { x: cx - waist / 2 + wobble, y: pinchY };
  const rightPinch = { x: cx + waist / 2 + wobble, y: pinchY };

  return [
    "M", leftTop.x, leftTop.y,
    "C", cx - topWidth * 0.56, topY + height * 0.24, leftPinch.x, pinchY - height * 0.18, leftPinch.x, leftPinch.y,
    "C", leftPinch.x, pinchY + height * 0.2, leftBottom.x, bottomY - height * 0.28, leftBottom.x, leftBottom.y,
    "C", cx - bottomWidth * 0.18, bottomY + height * 0.08, cx + bottomWidth * 0.18, bottomY + height * 0.08, rightBottom.x, rightBottom.y,
    "C", rightBottom.x, bottomY - height * 0.28, rightPinch.x, pinchY + height * 0.2, rightPinch.x, rightPinch.y,
    "C", rightPinch.x, pinchY - height * 0.18, cx + topWidth * 0.56, topY + height * 0.24, rightTop.x, rightTop.y,
    "Z",
  ].join(" ");
}

function resize() {
  state.width = window.innerWidth;
  state.height = window.innerHeight;
  svg.setAttribute("viewBox", `0 0 ${state.width} ${state.height}`);
  state.button.cx = state.width / 2;
  state.button.cy = state.height / 2;
  state.button.w = Math.min(276, state.width * 0.72);
  state.button.h = 92;
  render(performance.now());
}

function animateTo(targetOpen) {
  if (state.animating) {
    return;
  }

  const from = state.progress;
  const to = targetOpen ? 1 : 0;
  const started = performance.now();
  const duration = targetOpen ? 760 : 440;
  state.animating = true;
  state.open = targetOpen;
  state.impulse = 20;

  function tick(now) {
    const t = clamp((now - started) / duration, 0, 1);
    const eased = targetOpen ? easeOutCubic(t) : easeInOutCubic(t);
    state.progress = lerp(from, to, eased);
    state.impulse *= 0.92;
    render(now);

    if (t < 1) {
      requestAnimationFrame(tick);
      return;
    }

    state.progress = to;
    state.animating = false;
    render(performance.now());
  }

  requestAnimationFrame(tick);
}

function render(now) {
  const phase = (now - state.startTime) / 180;
  const p = state.progress;
  const buttonPulse = state.animating ? state.impulse : 2.4 + Math.sin(phase * 0.7) * 1.2;
  const buttonAmp = buttonPulse * (1 - p * 0.45);
  const dropP = clamp(p / 0.46, 0, 1);
  const splitP = clamp((p - 0.58) / 0.42, 0, 1);
  const cx = state.button.cx;
  const cy = state.button.cy;

  buttonShape.setAttribute("d", wavySuperellipse({
    cx,
    cy,
    w: state.button.w - splitP * 18,
    h: state.button.h - splitP * 8,
    amp: buttonAmp,
    phase,
    seed: 0.4,
    power: 4.2,
  }));
  buttonText.setAttribute("x", cx);
  buttonText.setAttribute("y", cy + 1);
  buttonText.style.opacity = String(1 - splitP * 0.82);

  const dropSize = lerp(4, 88, dropP) * (1 - splitP * 0.22);
  const dropY = cy + state.button.h / 2 + lerp(2, 92, dropP) - splitP * 18;
  const buttonBottom = cy + (state.button.h - splitP * 8) / 2 - 2;
  const dropTop = dropY - dropSize * 0.54;
  const bridgeP = clamp((p - 0.08) / 0.55, 0, 1);
  const tearP = clamp((p - 0.6) / 0.18, 0, 1);
  const topWidth = lerp(state.button.w * 0.42, 42, bridgeP) * (1 - tearP * 0.72);
  const bottomWidth = lerp(12, dropSize * 0.55, dropP) * (1 - tearP * 0.84);
  dropShape.setAttribute("d", dropSize > 2 ? dropPath(cx, dropY, dropSize, 4 + state.impulse * 0.16, phase * 1.2) : "");
  dropShape.style.opacity = String(clamp(dropP * 1.4 - splitP * 0.7, 0, 1));
  bridgeShape.setAttribute("d", bridgePath(cx, buttonBottom, dropTop + 6, topWidth, bottomWidth, 5 + state.impulse * 0.06, phase));
  bridgeShape.style.opacity = String(clamp(bridgeP * 1.3 - tearP * 1.25, 0, 1));

  itemGroups.forEach((group, index) => {
    const item = items[index];
    const local = clamp((splitP - index * 0.06) / 0.82, 0, 1);
    const eased = easeOutCubic(local);
    const itemCx = lerp(cx, cx + item.dx, eased);
    const itemCy = lerp(dropY, cy + item.dy, eased);
    const itemW = lerp(42, item.w, eased);
    const itemH = lerp(34, item.h, eased);
    const amp = (1 - eased) * 14 + Math.sin(phase + index) * 1.6;
    const shape = group.querySelector(".item-shape");
    const text = group.querySelector(".item-label");

    shape.setAttribute("d", wavySuperellipse({
      cx: itemCx,
      cy: itemCy,
      w: itemW,
      h: itemH,
      amp,
      phase: phase * 1.15,
      seed: index * 1.7,
      power: 3.7,
    }));
    text.setAttribute("x", itemCx);
    text.setAttribute("y", itemCy + 1);
    group.style.opacity = String(eased);
  });
}

hitButton.addEventListener("click", () => {
  animateTo(!state.open);
});

window.addEventListener("resize", resize);

function idle(now) {
  if (!state.animating) {
    render(now);
  }
  requestAnimationFrame(idle);
}

resize();
requestAnimationFrame(idle);
