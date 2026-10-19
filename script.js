const BOARD_SIZE = 9;
const MINE_TOTAL = 10;

const boardElement = document.querySelector('#board');
const mineCountElement = document.querySelector('#mine-count');
const timerElement = document.querySelector('#timer');
const messageElement = document.querySelector('#game-message');
const resetButton = document.querySelector('#reset-button');
const resetFaceElement = document.querySelector('#reset-face');

let cells = [];
let flagsPlaced = 0;
let revealedCount = 0;
let secondsElapsed = 0;
let timerId = null;
let gameStarted = false;
let gameOver = false;

function createBoard() {
  boardElement.replaceChildren();
  cells = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => ({
    index,
    isMine: false,
    isRevealed: false,
    isFlagged: false,
    adjacentMines: 0,
    element: document.createElement('button'),
  }));

  cells.forEach((cell) => {
    const row = Math.floor(cell.index / BOARD_SIZE) + 1;
    const column = (cell.index % BOARD_SIZE) + 1;
    cell.element.type = 'button';
    cell.element.className = 'cell';
    cell.element.setAttribute('role', 'gridcell');
    cell.element.setAttribute('aria-label', `${row}행 ${column}열, 닫힘`);
    cell.element.dataset.index = cell.index;
    cell.element.addEventListener('click', () => revealCell(cell.index));
    cell.element.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      toggleFlag(cell.index);
    });
    boardElement.append(cell.element);
  });
}

function placeMines(firstIndex) {
  const availableIndices = cells
    .map((cell) => cell.index)
    .filter((index) => index !== firstIndex);

  for (let index = availableIndices.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [availableIndices[index], availableIndices[randomIndex]] = [
      availableIndices[randomIndex],
      availableIndices[index],
    ];
  }

  availableIndices.slice(0, MINE_TOTAL).forEach((index) => {
    cells[index].isMine = true;
  });

  cells.forEach((cell) => {
    if (!cell.isMine) {
      cell.adjacentMines = getNeighbors(cell.index).filter((neighbor) => neighbor.isMine).length;
    }
  });
}

function getNeighbors(index) {
  const row = Math.floor(index / BOARD_SIZE);
  const column = index % BOARD_SIZE;
  const neighbors = [];

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      if (rowOffset === 0 && columnOffset === 0) continue;
      const neighborRow = row + rowOffset;
      const neighborColumn = column + columnOffset;
      if (
        neighborRow >= 0 && neighborRow < BOARD_SIZE &&
        neighborColumn >= 0 && neighborColumn < BOARD_SIZE
      ) {
        neighbors.push(cells[neighborRow * BOARD_SIZE + neighborColumn]);
      }
    }
  }

  return neighbors;
}

function startTimer() {
  if (timerId !== null) return;
  gameStarted = true;
  timerId = window.setInterval(() => {
    secondsElapsed = Math.min(secondsElapsed + 1, 999);
    timerElement.textContent = String(secondsElapsed).padStart(3, '0');
  }, 1000);
}

function revealCell(index) {
  const cell = cells[index];
  if (gameOver || cell.isRevealed || cell.isFlagged) return;

  if (!gameStarted) {
    placeMines(index);
    startTimer();
  }

  if (cell.isMine) {
    cell.isRevealed = true;
    renderCell(cell, true);
    finishGame(false);
    return;
  }

  revealSafeArea(cell);
  if (revealedCount === cells.length - MINE_TOTAL) {
    finishGame(true);
  }
}

function revealSafeArea(startCell) {
  const pending = [startCell];

  while (pending.length > 0) {
    const cell = pending.pop();
    if (cell.isRevealed || cell.isFlagged || cell.isMine) continue;

    cell.isRevealed = true;
    revealedCount += 1;
    renderCell(cell);

    if (cell.adjacentMines === 0) {
      getNeighbors(cell.index).forEach((neighbor) => {
        if (!neighbor.isRevealed && !neighbor.isFlagged) pending.push(neighbor);
      });
    }
  }
}

function toggleFlag(index) {
  const cell = cells[index];
  if (gameOver || cell.isRevealed) return;

  if (!cell.isFlagged && flagsPlaced >= MINE_TOTAL) {
    messageElement.textContent = '깃발은 10개까지만 놓을 수 있어요.';
    return;
  }

  cell.isFlagged = !cell.isFlagged;
  flagsPlaced += cell.isFlagged ? 1 : -1;
  mineCountElement.textContent = String(MINE_TOTAL - flagsPlaced).padStart(2, '0');
  renderCell(cell);
  messageElement.textContent = '주변을 살펴보고 안전한 칸을 찾아보세요.';
}

function renderCell(cell, wasHit = false) {
  const { element } = cell;
  const row = Math.floor(cell.index / BOARD_SIZE) + 1;
  const column = (cell.index % BOARD_SIZE) + 1;
  element.className = 'cell';

  if (cell.isRevealed) {
    element.classList.add('revealed');
    if (cell.isMine) {
      element.textContent = '✹';
      element.classList.add(wasHit ? 'mine-hit' : 'mine-shown');
      element.setAttribute('aria-label', `${row}행 ${column}열, 지뢰`);
    } else if (cell.adjacentMines > 0) {
      element.textContent = String(cell.adjacentMines);
      element.classList.add(`number-${cell.adjacentMines}`);
      element.setAttribute('aria-label', `${row}행 ${column}열, 주변 지뢰 ${cell.adjacentMines}개`);
    } else {
      element.textContent = '';
      element.setAttribute('aria-label', `${row}행 ${column}열, 빈 칸`);
    }
    return;
  }

  element.textContent = cell.isFlagged ? '⚑' : '';
  if (cell.isFlagged) {
    element.classList.add('flagged');
    element.setAttribute('aria-label', `${row}행 ${column}열, 깃발 표시됨`);
  } else {
    element.setAttribute('aria-label', `${row}행 ${column}열, 닫힘`);
  }
}

function finishGame(won) {
  gameOver = true;
  window.clearInterval(timerId);
  timerId = null;
  resetFaceElement.textContent = won ? '★' : '×';
  messageElement.textContent = won
    ? '탐사 성공! 모든 안전 구역을 찾았어요.'
    : '앗, 지뢰를 밟았어요. 다시 도전해보세요!';

  cells.forEach((cell) => {
    if (cell.isMine && !cell.isRevealed) {
      cell.isRevealed = true;
      renderCell(cell);
    } else if (!cell.isMine && cell.isFlagged) {
      cell.element.textContent = '×';
      cell.element.classList.add('wrong-flag');
    }
    cell.element.disabled = true;
  });
}

function resetGame() {
  window.clearInterval(timerId);
  flagsPlaced = 0;
  revealedCount = 0;
  secondsElapsed = 0;
  timerId = null;
  gameStarted = false;
  gameOver = false;
  mineCountElement.textContent = '10';
  timerElement.textContent = '000';
  resetFaceElement.textContent = '●';
  messageElement.textContent = '주변을 살펴보고 안전한 칸을 찾아보세요.';
  createBoard();
}

resetButton.addEventListener('click', resetGame);
createBoard();