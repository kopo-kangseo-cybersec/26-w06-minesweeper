let rows = 10;
let cols = 10;
let mineTotal = 10;

const boardElement = document.querySelector("#board");
const boardViewportElement = document.querySelector(".board-viewport");
const mineCountElement = document.querySelector("#mine-count");
const timerElement = document.querySelector("#timer");
const messageElement = document.querySelector("#message");
const restartButton = document.querySelector("#restart");
const difficultyElement = document.querySelector("#difficulty");
const customSettingsElement = document.querySelector("#custom-settings");
const customRowsElement = document.querySelector("#custom-rows");
const customColsElement = document.querySelector("#custom-cols");
const customMinesElement = document.querySelector("#custom-mines");

const difficultySettings = {
  basic: { rows: 10, cols: 10, mines: 10 },
  beginner: { rows: 9, cols: 9, mines: 10 },
  intermediate: { rows: 16, cols: 16, mines: 40 },
  advanced: { rows: 16, cols: 30, mines: 99 },
};

let cells = [];
let flags = 0;
let elapsedSeconds = 0;
let timerId = null;
let gameStarted = false;
let gameOver = false;

function createBoard() {
  cells = Array.from({ length: rows * cols }, (_, index) => ({
    index,
    mine: false,
    adjacentMines: 0,
    revealed: false,
    flagged: false,
    element: null,
  }));

  boardElement.replaceChildren();
  boardElement.style.setProperty("--columns", cols);
  boardElement.setAttribute("aria-label", `${rows}행 ${cols}열 지뢰찾기 보드`);
  updateBoardCellSize();
  cells.forEach((cell) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cell";
    button.setAttribute("role", "gridcell");
    button.setAttribute(
      "aria-label",
      `닫힌 칸 ${rowOf(cell.index) + 1}행 ${colOf(cell.index) + 1}열`,
    );
    button.addEventListener("click", () => revealCell(cell.index));
    button.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      toggleFlag(cell.index);
    });
    cell.element = button;
    boardElement.append(button);
  });

  flags = 0;
  elapsedSeconds = 0;
  gameStarted = false;
  gameOver = false;
  window.clearInterval(timerId);
  timerId = null;
  timerElement.textContent = "000";
  restartButton.textContent = "😀";
  messageElement.textContent = "지뢰를 조심하세요!";
  updateMineCount();
}

function updateBoardCellSize() {
  const boardStyle = window.getComputedStyle(boardElement);
  const horizontalPadding =
    Number.parseFloat(boardStyle.paddingLeft) +
    Number.parseFloat(boardStyle.paddingRight) +
    Number.parseFloat(boardStyle.borderLeftWidth) +
    Number.parseFloat(boardStyle.borderRightWidth);
  const columnGap = Number.parseFloat(boardStyle.columnGap);
  const availableCellWidth =
    boardViewportElement.clientWidth -
    horizontalPadding -
    columnGap * (cols - 1);
  const cellSize = Math.max(
    22,
    Math.min(44, Math.floor(availableCellWidth / cols)),
  );
  boardElement.style.setProperty("--cell-size", `${cellSize}px`);
}

function rowOf(index) {
  return Math.floor(index / cols);
}

function colOf(index) {
  return index % cols;
}

function neighborsOf(index) {
  const row = rowOf(index);
  const col = colOf(index);
  const neighbors = [];

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
      if (rowOffset === 0 && colOffset === 0) continue;
      const neighborRow = row + rowOffset;
      const neighborCol = col + colOffset;
      if (
        neighborRow < 0 ||
        neighborRow >= rows ||
        neighborCol < 0 ||
        neighborCol >= cols
      ) {
        continue;
      }
      neighbors.push(neighborRow * cols + neighborCol);
    }
  }
  return neighbors;
}

function placeMines(safeIndex) {
  const candidates = cells.filter((cell) => cell.index !== safeIndex);
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [candidates[index], candidates[randomIndex]] = [
      candidates[randomIndex],
      candidates[index],
    ];
  }

  candidates.slice(0, mineTotal).forEach((cell) => {
    cell.mine = true;
  });

  cells.forEach((cell) => {
    if (!cell.mine) {
      cell.adjacentMines = neighborsOf(cell.index).filter(
        (index) => cells[index].mine,
      ).length;
    }
  });
}

function startTimer() {
  if (timerId !== null || gameOver) return;
  timerId = window.setInterval(() => {
    elapsedSeconds += 1;
    timerElement.textContent = String(Math.min(elapsedSeconds, 999)).padStart(
      3,
      "0",
    );
    if (elapsedSeconds >= 999) {
      window.clearInterval(timerId);
      timerId = null;
    }
  }, 1000);
}

function revealCell(index) {
  const cell = cells[index];
  if (gameOver || cell.revealed || cell.flagged) return;

  if (!gameStarted) {
    gameStarted = true;
    placeMines(index);
    startTimer();
  }

  if (cell.mine) {
    cell.revealed = true;
    renderCell(cell);
    finishGame(false);
    return;
  }

  revealArea(index);
  checkForWin();
}

function revealArea(startIndex) {
  const queue = [startIndex];
  const queued = new Set(queue);

  while (queue.length > 0) {
    const index = queue.shift();
    const cell = cells[index];
    if (cell.revealed || cell.flagged || cell.mine) continue;

    cell.revealed = true;
    renderCell(cell);
    if (cell.adjacentMines === 0) {
      neighborsOf(index).forEach((neighborIndex) => {
        if (!queued.has(neighborIndex)) {
          queued.add(neighborIndex);
          queue.push(neighborIndex);
        }
      });
    }
  }
}

function toggleFlag(index) {
  const cell = cells[index];
  if (gameOver || cell.revealed) return;

  cell.flagged = !cell.flagged;
  flags += cell.flagged ? 1 : -1;
  renderCell(cell);
  updateMineCount();
  messageElement.textContent = cell.flagged
    ? "깃발을 표시했어요."
    : "깃발을 회수했어요.";
}

function renderCell(cell) {
  const button = cell.element;
  button.className = "cell";
  button.textContent = "";

  if (cell.flagged && !cell.revealed) {
    button.classList.add("flagged");
    button.textContent = "🚩";
    button.setAttribute(
      "aria-label",
      `깃발 표시된 칸 ${rowOf(cell.index) + 1}행 ${colOf(cell.index) + 1}열`,
    );
    return;
  }

  if (!cell.revealed) {
    button.setAttribute(
      "aria-label",
      `닫힌 칸 ${rowOf(cell.index) + 1}행 ${colOf(cell.index) + 1}열`,
    );
    return;
  }

  button.classList.add("revealed");
  if (cell.mine) {
    button.textContent = "💣";
    button.classList.add("mine-shown");
    button.setAttribute("aria-label", "지뢰");
  } else if (cell.adjacentMines > 0) {
    button.textContent = String(cell.adjacentMines);
    button.classList.add(`number-${cell.adjacentMines}`);
    button.setAttribute("aria-label", `주변 지뢰 ${cell.adjacentMines}개`);
  } else {
    button.setAttribute("aria-label", "주변에 지뢰가 없는 칸");
  }
}

function updateMineCount() {
  const remaining = mineTotal - flags;
  mineCountElement.textContent =
    remaining < 0
      ? `-${String(Math.abs(remaining)).padStart(2, "0")}`
      : String(remaining).padStart(3, "0");
}

function checkForWin() {
  if (cells.every((cell) => cell.mine || cell.revealed)) {
    finishGame(true);
  }
}

function finishGame(won) {
  gameOver = true;
  window.clearInterval(timerId);
  timerId = null;
  restartButton.textContent = won ? "😀" : "😵";
  messageElement.textContent = won
    ? "성공! 모든 안전한 칸을 열었어요."
    : "앗, 지뢰를 밟았어요. 다시 도전해 보세요!";

  if (!won) {
    cells.forEach((cell) => {
      if (cell.mine && !cell.revealed && !cell.flagged) {
        cell.revealed = true;
        renderCell(cell);
      } else if (!cell.mine && cell.flagged) {
        cell.element.classList.add("wrong-flag");
        cell.element.textContent = "❌";
        cell.element.setAttribute("aria-label", "잘못 표시한 깃발");
      }
    });
  }
}

restartButton.addEventListener("click", createBoard);

difficultyElement.addEventListener("change", () => {
  const selectedDifficulty = difficultyElement.value;
  const customSelected = selectedDifficulty === "custom";
  customSettingsElement.hidden = !customSelected;

  if (customSelected) {
    customRowsElement.value = rows;
    customColsElement.value = cols;
    customMinesElement.value = mineTotal;
    updateCustomMineLimit();
    messageElement.textContent = "원하는 보드 크기와 지뢰 수를 입력하세요.";
    return;
  }

  const settings = difficultySettings[selectedDifficulty];
  if (!settings) {
    throw new Error(`알 수 없는 난이도 설정: ${selectedDifficulty}`);
  }
  rows = settings.rows;
  cols = settings.cols;
  mineTotal = settings.mines;
  createBoard();
});

function updateCustomMineLimit() {
  const customRows = Number(customRowsElement.value);
  const customCols = Number(customColsElement.value);
  if (
    Number.isInteger(customRows) &&
    Number.isInteger(customCols) &&
    customRows >= 5 &&
    customRows <= 30 &&
    customCols >= 5 &&
    customCols <= 30
  ) {
    customMinesElement.max = String(customRows * customCols - 1);
  }
}

customRowsElement.addEventListener("input", updateCustomMineLimit);
customColsElement.addEventListener("input", updateCustomMineLimit);

customSettingsElement.addEventListener("submit", (event) => {
  event.preventDefault();
  const customRows = Number(customRowsElement.value);
  const customCols = Number(customColsElement.value);
  const customMines = Number(customMinesElement.value);

  if (
    !Number.isInteger(customRows) ||
    !Number.isInteger(customCols) ||
    !Number.isInteger(customMines) ||
    customRows < 5 ||
    customRows > 30 ||
    customCols < 5 ||
    customCols > 30 ||
    customMines < 1 ||
    customMines >= customRows * customCols
  ) {
    messageElement.textContent =
      "행과 열은 5~30, 지뢰는 1개 이상 칸 수보다 적게 입력하세요.";
    return;
  }

  rows = customRows;
  cols = customCols;
  mineTotal = customMines;
  createBoard();
  messageElement.textContent = `사용자 설정을 적용했어요 (${rows}×${cols}, 지뢰 ${mineTotal}개).`;
});

window.addEventListener("resize", updateBoardCellSize);
createBoard();
