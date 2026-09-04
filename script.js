const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const nextCanvas = document.getElementById("next");
const nextCtx = nextCanvas.getContext("2d");

const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const startBtn = document.getElementById("startBtn");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = {
  I: "#38bdf8",
  O: "#facc15",
  T: "#c084fc",
  S: "#4ade80",
  Z: "#fb7185",
  J: "#60a5fa",
  L: "#fb923c",
};

const SHAPES = {
  I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  O: [[1,1],[1,1]],
  T: [[0,1,0],[1,1,1],[0,0,0]],
  S: [[0,1,1],[1,1,0],[0,0,0]],
  Z: [[1,1,0],[0,1,1],[0,0,0]],
  J: [[1,0,0],[1,1,1],[0,0,0]],
  L: [[0,0,1],[1,1,1],[0,0,0]],
};

let board;
let current;
let nextPiece;
let score = 0;
let lines = 0;
let level = 1;
let running = false;
let paused = false;
let lastTime = 0;
let dropCounter = 0;
let animationId = null;

function makeBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randomPiece() {
  const names = Object.keys(SHAPES);
  const name = names[Math.floor(Math.random() * names.length)];
  return {
    name,
    matrix: SHAPES[name].map(row => [...row]),
    x: Math.floor(COLS / 2) - Math.ceil(SHAPES[name][0].length / 2),
    y: -1,
  };
}

function resetGame() {
  board = makeBoard();
  score = 0;
  lines = 0;
  level = 1;
  current = randomPiece();
  nextPiece = randomPiece();
  running = true;
  paused = false;
  lastTime = performance.now();
  dropCounter = 0;
  updateUI();
  hideOverlay();
  cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(update);
}

function updateUI() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function dropInterval() {
  return Math.max(90, 850 - (level - 1) * 70);
}

function collide(piece = current, offsetX = 0, offsetY = 0, matrix = piece.matrix) {
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[y].length; x++) {
      if (!matrix[y][x]) continue;

      const boardX = piece.x + x + offsetX;
      const boardY = piece.y + y + offsetY;

      if (boardX < 0 || boardX >= COLS || boardY >= ROWS) return true;
      if (boardY >= 0 && board[boardY][boardX]) return true;
    }
  }
  return false;
}

function merge() {
  current.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) return;
      const boardY = current.y + y;
      const boardX = current.x + x;
      if (boardY >= 0) {
        board[boardY][boardX] = current.name;
      }
    });
  });
}

function clearLines() {
  let cleared = 0;

  outer:
  for (let y = ROWS - 1; y >= 0; y--) {
    for (let x = 0; x < COLS; x++) {
      if (!board[y][x]) continue outer;
    }

    const row = board.splice(y, 1)[0];
    row.fill(null);
    board.unshift(row);
    cleared++;
    y++;
  }

  if (cleared > 0) {
    const table = [0, 100, 300, 500, 800];
    score += table[cleared] * level;
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
    updateUI();
  }
}

function spawnNext() {
  current = nextPiece;
  current.x = Math.floor(COLS / 2) - Math.ceil(current.matrix[0].length / 2);
  current.y = -1;
  nextPiece = randomPiece();

  if (collide(current, 0, 0)) {
    gameOver();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawnNext();
}

function move(dx) {
  if (!running || paused) return;
  if (!collide(current, dx, 0)) {
    current.x += dx;
  }
}

function softDrop() {
  if (!running || paused) return;
  if (!collide(current, 0, 1)) {
    current.y++;
    score += 1;
    updateUI();
  } else {
    lockPiece();
  }
  dropCounter = 0;
}

function hardDrop() {
  if (!running || paused) return;
  let distance = 0;
  while (!collide(current, 0, 1)) {
    current.y++;
    distance++;
  }
  score += distance * 2;
  updateUI();
  lockPiece();
  dropCounter = 0;
}

function rotateMatrix(matrix, dir) {
  const n = matrix.length;
  const result = Array.from({ length: n }, () => Array(n).fill(0));

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (dir > 0) result[x][n - 1 - y] = matrix[y][x];
      else result[n - 1 - x][y] = matrix[y][x];
    }
  }
  return result;
}

function rotate(dir) {
  if (!running || paused) return;
  const rotated = rotateMatrix(current.matrix, dir);

  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(current, kick, 0, rotated)) {
      current.matrix = rotated;
      current.x += kick;
      return;
    }
  }
}

function ghostY() {
  let y = current.y;
  while (true) {
    const ghost = { ...current, y };
    if (collide(ghost, 0, 1)) return y;
    y++;
  }
}

function drawCell(context, x, y, color, size = BLOCK, alpha = 1) {
  context.save();
  context.globalAlpha = alpha;

  const px = x * size;
  const py = y * size;

  context.fillStyle = color;
  context.fillRect(px + 1.5, py + 1.5, size - 3, size - 3);

  context.fillStyle = "rgba(255,255,255,.22)";
  context.fillRect(px + 4, py + 4, size - 8, 4);

  context.strokeStyle = "rgba(0,0,0,.28)";
  context.strokeRect(px + 1.5, py + 1.5, size - 3, size - 3);
  context.restore();
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#090c13";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(255,255,255,.035)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * BLOCK, 0);
    ctx.lineTo(x * BLOCK, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * BLOCK);
    ctx.lineTo(canvas.width, y * BLOCK);
    ctx.stroke();
  }

  board.forEach((row, y) => {
    row.forEach((name, x) => {
      if (name) drawCell(ctx, x, y, COLORS[name]);
    });
  });
}

function drawPiece(piece, drawY = piece.y, alpha = 1) {
  piece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) return;
      const py = drawY + y;
      if (py >= 0) drawCell(ctx, piece.x + x, py, COLORS[piece.name], BLOCK, alpha);
    });
  });
}

function drawGhost() {
  const gy = ghostY();
  drawPiece(current, gy, 0.18);
}

function drawNext() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  nextCtx.fillStyle = "#111827";
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

  const matrix = nextPiece.matrix;
  const size = 24;
  const width = matrix[0].length * size;
  const height = matrix.length * size;
  const offsetX = (nextCanvas.width - width) / 2;
  const offsetY = (nextCanvas.height - height) / 2;

  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) return;
      nextCtx.save();
      nextCtx.translate(offsetX, offsetY);
      drawCell(nextCtx, x, y, COLORS[nextPiece.name], size);
      nextCtx.restore();
    });
  });
}

function draw() {
  drawBoard();
  if (current) {
    drawGhost();
    drawPiece(current);
  }
  if (nextPiece) drawNext();
}

function update(time = 0) {
  if (!running) {
    draw();
    return;
  }

  const delta = time - lastTime;
  lastTime = time;

  if (!paused) {
    dropCounter += delta;
    if (dropCounter >= dropInterval()) {
      if (!collide(current, 0, 1)) {
        current.y++;
      } else {
        lockPiece();
      }
      dropCounter = 0;
    }
  }

  draw();
  animationId = requestAnimationFrame(update);
}

function togglePause() {
  if (!running) return;
  paused = !paused;
  if (paused) {
    showOverlay("PAUSED", "PキーまたはPAUSEで再開");
  } else {
    hideOverlay();
    lastTime = performance.now();
  }
}

function gameOver() {
  running = false;
  paused = false;
  showOverlay("GAME OVER", `SCORE ${score.toLocaleString()} — STARTで再挑戦`);
}

function showOverlay(title, text) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

document.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();

  if (["arrowleft", "arrowright", "arrowdown", "arrowup", " "].includes(key)) {
    e.preventDefault();
  }

  if (key === "arrowleft") move(-1);
  else if (key === "arrowright") move(1);
  else if (key === "arrowdown") softDrop();
  else if (key === "arrowup" || key === "x") rotate(1);
  else if (key === "z") rotate(-1);
  else if (key === " ") hardDrop();
  else if (key === "p") togglePause();
});

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.action;
    if (action === "left") move(-1);
    if (action === "right") move(1);
    if (action === "down") softDrop();
    if (action === "rotate-left") rotate(-1);
    if (action === "rotate-right") rotate(1);
    if (action === "drop") hardDrop();
    if (action === "pause") togglePause();
  });
});

startBtn.addEventListener("click", resetGame);

board = makeBoard();
current = randomPiece();
nextPiece = randomPiece();
draw();
showOverlay("BLOCK DROP", "STARTを押してゲーム開始");
