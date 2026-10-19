const DIFFICULTIES = {
  beginner: { name: "초급", rows: 9, columns: 9, mines: 10 },
  intermediate: { name: "중급", rows: 16, columns: 16, mines: 40 },
  expert: { name: "고급", rows: 16, columns: 30, mines: 99 },
};

const boardElement = document.querySelector("#board");
const mineCountElement = document.querySelector("#mine-count");
const timerElement = document.querySelector("#timer");
const restartButton = document.querySelector("#restart-button");
const gameMessage = document.querySelector("#game-message");
const difficultyButtons = document.querySelectorAll("[data-difficulty]");
const gameDetails = document.querySelector("#game-details");

let cells = [];
let difficulty = DIFFICULTIES.beginner;
let flags = 0;
let revealedCount = 0;
let seconds = 0;
let timerId = null;
let gameState = "ready";

function createBoard() {
  cells = Array.from({ length: difficulty.rows * difficulty.columns }, (_, index) => ({
    row: Math.floor(index / difficulty.columns),
    column: index % difficulty.columns,
    mine: false,
    adjacent: 0,
    revealed: false,
    flagged: false,
    element: null,
  }));

  boardElement.replaceChildren();
  boardElement.style.setProperty("--columns", difficulty.columns);
  boardElement.setAttribute("aria-label", `${difficulty.rows}행 ${difficulty.columns}열 게임판`);
  for (const cell of cells) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cell";
    button.setAttribute("aria-label", `행 ${cell.row + 1}, 열 ${cell.column + 1}, 닫힌 칸`);
    button.addEventListener("click", () => openCell(cell));
    button.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      if (cell.revealed) chordCell(cell);
      else toggleFlag(cell);
    });
    button.addEventListener("mousedown", (event) => {
      if (event.buttons === 3 && cell.revealed) {
        event.preventDefault();
        chordCell(cell);
      }
    });
    cell.element = button;
    boardElement.append(button);
  }
}

function getNeighbors(cell) {
  const neighbors = [];
  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      if (rowOffset === 0 && columnOffset === 0) continue;
      const row = cell.row + rowOffset;
      const column = cell.column + columnOffset;
      if (row >= 0 && row < difficulty.rows && column >= 0 && column < difficulty.columns) {
        neighbors.push(cells[row * difficulty.columns + column]);
      }
    }
  }
  return neighbors;
}

function placeMines(firstCell) {
  const safeZone = new Set([firstCell, ...getNeighbors(firstCell)]);
  const available = cells.filter((cell) => !safeZone.has(cell));

  for (let index = 0; index < difficulty.mines; index += 1) {
    const randomIndex = Math.floor(Math.random() * available.length);
    available[randomIndex].mine = true;
    available.splice(randomIndex, 1);
  }

  for (const cell of cells) {
    cell.adjacent = getNeighbors(cell).filter((neighbor) => neighbor.mine).length;
  }
}

function startTimer() {
  if (timerId !== null) return;
  timerId = window.setInterval(() => {
    seconds += 1;
    timerElement.textContent = String(Math.min(seconds, 999)).padStart(3, "0");
  }, 1000);
}

function formatMineCount(count) {
  return count < 0
    ? `-${String(Math.abs(count)).padStart(2, "0")}`
    : String(count).padStart(3, "0");
}

function openCell(cell) {
  if (gameState === "won" || gameState === "lost") return;
  if (cell.revealed) {
    chordCell(cell);
    return;
  }
  if (cell.flagged) return;

  if (gameState === "ready") {
    placeMines(cell);
    gameState = "playing";
    startTimer();
  }

  if (cell.mine) {
    revealAllMines(cell);
    finishGame("lost", "💥 지뢰를 밟았어요! 새 게임으로 다시 도전해보세요.");
    return;
  }

  revealCell(cell);
  if (revealedCount === cells.length - difficulty.mines) {
    finishGame("won", "🎉 성공! 모든 안전한 칸을 찾았어요.");
  }
}

function chordCell(cell) {
  if (gameState !== "playing" || !cell.revealed || cell.adjacent === 0) return;

  const neighbors = getNeighbors(cell);
  const flaggedNeighbors = neighbors.filter((neighbor) => neighbor.flagged).length;
  if (flaggedNeighbors !== cell.adjacent) return;

  for (const neighbor of neighbors) {
    if (!neighbor.revealed && !neighbor.flagged) openCell(neighbor);
  }
}

function revealCell(cell) {
  if (cell.revealed || cell.flagged || cell.mine) return;

  cell.revealed = true;
  revealedCount += 1;
  cell.element.classList.add("revealed");
  cell.element.textContent = cell.adjacent === 0 ? "" : String(cell.adjacent);
  const description = cell.adjacent === 0 ? "빈 칸" : `주변 지뢰 ${cell.adjacent}개`;
  cell.element.setAttribute("aria-label", `행 ${cell.row + 1}, 열 ${cell.column + 1}, ${description}`);

  if (cell.adjacent > 0) {
    cell.element.dataset.number = String(cell.adjacent);
    return;
  }

  for (const neighbor of getNeighbors(cell)) revealCell(neighbor);
}

function toggleFlag(cell) {
  if (gameState === "won" || gameState === "lost" || cell.revealed) return;

  cell.flagged = !cell.flagged;
  flags += cell.flagged ? 1 : -1;
  cell.element.classList.toggle("flagged", cell.flagged);
  cell.element.textContent = cell.flagged ? "🚩" : "";
  const description = cell.flagged ? "깃발 표시됨" : "닫힌 칸";
  cell.element.setAttribute("aria-label", `행 ${cell.row + 1}, 열 ${cell.column + 1}, ${description}`);
  mineCountElement.textContent = formatMineCount(difficulty.mines - flags);
}

function revealAllMines(triggeredMine) {
  for (const cell of cells) {
    if (cell.mine) {
      cell.element.classList.add("revealed", "mine");
      cell.element.textContent = "💣";
      cell.element.setAttribute("aria-label", `행 ${cell.row + 1}, 열 ${cell.column + 1}, 지뢰`);
    } else if (cell.flagged) {
      cell.element.classList.add("wrong-flag");
      cell.element.textContent = "❌";
    }
  }
  triggeredMine.element.classList.add("triggered");
}

function finishGame(state, message) {
  gameState = state;
  window.clearInterval(timerId);
  timerId = null;
  restartButton.textContent = state === "won" ? "😎" : "😵";
  gameMessage.textContent = message;
  gameMessage.dataset.state = state;
  for (const cell of cells) cell.element.disabled = true;
}

function resetGame() {
  window.clearInterval(timerId);
  timerId = null;
  flags = 0;
  revealedCount = 0;
  seconds = 0;
  gameState = "ready";
  mineCountElement.textContent = formatMineCount(difficulty.mines);
  timerElement.textContent = "000";
  restartButton.textContent = "🙂";
  gameMessage.textContent = "왼쪽 클릭으로 칸을 열고, 오른쪽 클릭으로 깃발을 표시하세요.";
  gameDetails.textContent = `${difficulty.name} · ${difficulty.columns} × ${difficulty.rows} · 지뢰 ${difficulty.mines}개`;
  delete gameMessage.dataset.state;
  createBoard();
}

function changeDifficulty(event) {
  const selectedDifficulty = event.currentTarget.dataset.difficulty;
  difficulty = DIFFICULTIES[selectedDifficulty];
  for (const button of difficultyButtons) {
    button.setAttribute("aria-pressed", String(button === event.currentTarget));
  }
  resetGame();
}

restartButton.addEventListener("click", resetGame);
for (const button of difficultyButtons) button.addEventListener("click", changeDifficulty);
resetGame();
