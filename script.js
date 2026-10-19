const DIFFICULTIES = {
  beginner: { label: "초급", rows: 9, columns: 9, mines: 10, cellSize: 42 },
  intermediate: { label: "중급", rows: 16, columns: 16, mines: 40, cellSize: 30 },
  expert: { label: "고급", rows: 16, columns: 30, mines: 99, cellSize: 26 },
};

const boardElement = document.querySelector("#game-board");
const mineCounterElement = document.querySelector("#mine-counter");
const timerElement = document.querySelector("#timer");
const messageElement = document.querySelector("#game-message");
const restartButton = document.querySelector("#restart-button");
const difficultySelect = document.querySelector("#difficulty-select");

let difficulty = DIFFICULTIES.beginner;
let board = [];
let flagCount = 0;
let revealedCount = 0;
let gameStatus = "ready";
let firstClick = true;
let elapsedSeconds = 0;
let timerId = null;

function createEmptyBoard() {
  return Array.from({ length: difficulty.rows }, () =>
    Array.from({ length: difficulty.columns }, () => ({
      mine: false,
      revealed: false,
      flagged: false,
      adjacentMines: 0,
      exploded: false,
    })),
  );
}

function resetGame() {
  stopTimer();
  board = createEmptyBoard();
  flagCount = 0;
  revealedCount = 0;
  gameStatus = "ready";
  firstClick = true;
  elapsedSeconds = 0;
  timerElement.textContent = "000";
  mineCounterElement.textContent = formatCounter(difficulty.mines);
  messageElement.textContent = "첫 칸을 열어 게임을 시작하세요.";
  messageElement.className = "game-message";
  restartButton.textContent = "🙂";
  boardElement.style.setProperty("--board-columns", difficulty.columns);
  boardElement.style.setProperty("--cell-size", `${difficulty.cellSize}px`);
  boardElement.setAttribute(
    "aria-label",
    `${difficulty.rows}x${difficulty.columns} ${difficulty.label} 지뢰찾기 게임 보드`,
  );
  renderBoard();
}

function formatCounter(value) {
  return String(Math.max(0, value)).padStart(3, "0");
}

function renderBoard() {
  boardElement.replaceChildren();

  board.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const cellElement = document.createElement("button");
      cellElement.type = "button";
      cellElement.className = "cell";
      cellElement.dataset.row = String(rowIndex);
      cellElement.dataset.col = String(colIndex);
      cellElement.setAttribute("role", "gridcell");
      cellElement.setAttribute("aria-label", getCellLabel(cell));

      if (cell.revealed) {
        cellElement.classList.add("is-revealed");
        if (cell.mine) {
          cellElement.textContent = cell.exploded ? "💥" : "💣";
          cellElement.classList.add(cell.exploded ? "is-exploded" : "is-mine");
        } else if (cell.adjacentMines > 0) {
          cellElement.textContent = String(cell.adjacentMines);
          cellElement.classList.add(`number-${cell.adjacentMines}`);
        }

      } else if (cell.flagged) {
        cellElement.textContent = "🚩";
        cellElement.classList.add("is-flagged");
      }

      boardElement.append(cellElement);
    });
  });
}

function getCellLabel(cell) {
  if (cell.flagged) return "깃발이 꽂힌 칸";
  if (!cell.revealed) return "닫힌 칸";
  if (cell.mine) return cell.exploded ? "폭발한 지뢰" : "지뢰";
  return cell.adjacentMines > 0
    ? `주변 지뢰 ${cell.adjacentMines}개`
    : "안전한 빈 칸";
}

function getNeighbors(row, col) {
  const neighbors = [];
  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
      if (rowOffset === 0 && colOffset === 0) continue;
      const neighborRow = row + rowOffset;
      const neighborCol = col + colOffset;
      if (
        neighborRow >= 0 &&
        neighborRow < difficulty.rows &&
        neighborCol >= 0 &&
        neighborCol < difficulty.columns
      ) {
        neighbors.push([neighborRow, neighborCol]);
      }
    }
  }
  return neighbors;
}

function placeMines(safeRow, safeCol) {
  const candidates = [];
  for (let row = 0; row < difficulty.rows; row += 1) {
    for (let col = 0; col < difficulty.columns; col += 1) {
      if (row !== safeRow || col !== safeCol) candidates.push([row, col]);
    }
  }

  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [candidates[index], candidates[randomIndex]] = [candidates[randomIndex], candidates[index]];
  }

  candidates.slice(0, difficulty.mines).forEach(([row, col]) => {
    board[row][col].mine = true;
  });

  for (let row = 0; row < difficulty.rows; row += 1) {
    for (let col = 0; col < difficulty.columns; col += 1) {
      board[row][col].adjacentMines = getNeighbors(row, col)
        .filter(([neighborRow, neighborCol]) => board[neighborRow][neighborCol].mine)
        .length;
    }
  }
}

function startTimer() {
  if (timerId !== null) return;
  timerId = window.setInterval(() => {
    elapsedSeconds += 1;
    timerElement.textContent = formatCounter(elapsedSeconds);
  }, 1000);
}

function stopTimer() {
  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }
}

function revealCell(row, col) {
  const cell = board[row][col];
  if (cell.revealed || cell.flagged) return;

  cell.revealed = true;
  revealedCount += 1;

  if (cell.adjacentMines !== 0) return;

  const queue = [[row, col]];
  while (queue.length > 0) {
    const [currentRow, currentCol] = queue.shift();
    getNeighbors(currentRow, currentCol).forEach(([neighborRow, neighborCol]) => {
      const neighbor = board[neighborRow][neighborCol];
      if (neighbor.revealed || neighbor.flagged || neighbor.mine) return;

      neighbor.revealed = true;
      revealedCount += 1;
      if (neighbor.adjacentMines === 0) {
        queue.push([neighborRow, neighborCol]);
      }
    });
  }
}

function revealMines() {
  board.forEach((row) => {
    row.forEach((cell) => {
      if (cell.mine) cell.revealed = true;
    });
  });
}

function checkWin() {
  return revealedCount === difficulty.rows * difficulty.columns - difficulty.mines;
}

function finishGame(status) {
  gameStatus = status;
  stopTimer();
  if (status === "won") {
    messageElement.textContent = "🎉 축하합니다! 모든 안전한 칸을 열었습니다.";
    messageElement.className = "game-message is-won";
    restartButton.textContent = "😎";
  } else {
    revealMines();
    messageElement.textContent = "💥 지뢰를 밟았습니다. 다시 도전해보세요!";
    messageElement.className = "game-message is-lost";
    restartButton.textContent = "😵";
  }
}

function handleLeftClick(row, col) {
  if (gameStatus === "won" || gameStatus === "lost") return;
  const cell = board[row][col];
  if (cell.flagged || cell.revealed) return;

  if (firstClick) {
    placeMines(row, col);
    firstClick = false;
    gameStatus = "playing";
    startTimer();
  }

  if (cell.mine) {
    cell.exploded = true;
    finishGame("lost");
  } else {
    revealCell(row, col);
    if (checkWin()) finishGame("won");
  }

  renderBoard();
}

function handleRightClick(row, col) {
  if (gameStatus === "won" || gameStatus === "lost") return;
  const cell = board[row][col];
  if (cell.revealed) return;

  if (cell.flagged) {
    cell.flagged = false;
    flagCount -= 1;
  } else if (flagCount < difficulty.mines) {
    cell.flagged = true;
    flagCount += 1;
  }

  mineCounterElement.textContent = formatCounter(difficulty.mines - flagCount);
  renderBoard();
}

boardElement.addEventListener("click", (event) => {
  const cellElement = event.target.closest(".cell");
  if (!cellElement) return;
  handleLeftClick(Number(cellElement.dataset.row), Number(cellElement.dataset.col));
});

boardElement.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  const cellElement = event.target.closest(".cell");
  if (!cellElement) return;
  handleRightClick(Number(cellElement.dataset.row), Number(cellElement.dataset.col));
});

restartButton.addEventListener("click", resetGame);
difficultySelect.addEventListener("change", (event) => {
  difficulty = DIFFICULTIES[event.target.value];
  resetGame();
});

resetGame();
