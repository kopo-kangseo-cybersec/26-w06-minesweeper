const DIFFICULTIES = {
  beginner: { columns: 9, rows: 9, mines: 10, label: '초급' },
  intermediate: { columns: 16, rows: 16, mines: 40, label: '중급' },
  expert: { columns: 30, rows: 16, mines: 99, label: '고급' },
};

const boardElement = document.querySelector('#board');
const mineCountElement = document.querySelector('#mine-count');
const timerElement = document.querySelector('#timer');
const messageElement = document.querySelector('#game-message');
const resetButton = document.querySelector('#reset-button');
const resetFaceElement = document.querySelector('#reset-face');
const difficultySelect = document.querySelector('#difficulty-select');
const customSettings = document.querySelector('#custom-settings');
const flagModeButton = document.querySelector('#flag-mode-button');
const questionModeButton = document.querySelector('#question-mode-button');
const bestTimeElement = document.querySelector('#best-time');
const boardSizeElement = document.querySelector('#board-size');

let currentDifficulty = 'beginner';
let boardConfig = { ...DIFFICULTIES.beginner };
let cells = [];
let flagsPlaced = 0;
let revealedCount = 0;
let secondsElapsed = 0;
let timerId = null;
let gameStarted = false;
let gameOver = false;
let flagMode = false;
let questionMode = false;
let longPressTimer = null;
let suppressNextClick = false;
let suppressNextContextMenu = false;

function formatCounter(value) {
  return value < 0 ? `-${String(Math.abs(value)).padStart(2, '0')}` : String(value).padStart(2, '0');
}

function formatTime(value) {
  return String(value).padStart(3, '0');
}

function formatDimensions(columns, rows) {
  return `${String(columns).padStart(2, '0')} × ${String(rows).padStart(2, '0')}`;
}

function updateBoardSizing() {
  const availableWidth = Math.min(window.innerWidth - 72, 440);
  const cellSize = Math.max(16, Math.min(42, Math.floor(availableWidth / boardConfig.columns)));
  boardElement.style.setProperty('--columns', boardConfig.columns);
  boardElement.style.setProperty('--cell-size', `${cellSize}px`);
  boardElement.style.setProperty('--cell-font-size', `${Math.max(10, Math.min(17, Math.floor(cellSize * 0.46)))}px`);
}

function createBoard() {
  boardElement.replaceChildren();
  cells = Array.from({ length: boardConfig.columns * boardConfig.rows }, (_, index) => ({
    index,
    isMine: false,
    isRevealed: false,
    isFlagged: false,
    isQuestioned: false,
    adjacentMines: 0,
    element: document.createElement('button'),
  }));

  updateBoardSizing();
  boardElement.setAttribute('aria-label', `${boardConfig.columns}열 ${boardConfig.rows}행 지뢰찾기 게임판`);

  cells.forEach((cell) => {
    cell.element.type = 'button';
    cell.element.className = 'cell';
    cell.element.setAttribute('role', 'gridcell');
    cell.element.dataset.index = cell.index;
    renderCell(cell);

    cell.element.addEventListener('click', () => {
      if (suppressNextClick) {
        suppressNextClick = false;
        return;
      }
      if (flagMode) toggleFlag(cell.index);
      else if (questionMode) toggleQuestion(cell.index);
      else revealCell(cell.index);
    });

    cell.element.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      if (suppressNextContextMenu) {
        suppressNextContextMenu = false;
        return;
      }
      if (cell.isRevealed) chord(cell.index);
      else toggleFlag(cell.index);
    });

    cell.element.addEventListener('dblclick', (event) => {
      event.preventDefault();
      chord(cell.index);
    });

    cell.element.addEventListener('pointerdown', (event) => {
      if (gameOver) return;
      if (event.button === 0 || event.pointerType === 'touch') resetFaceElement.textContent = '😮';
      if (event.pointerType === 'touch' && !cell.isRevealed) {
        longPressTimer = window.setTimeout(() => {
          toggleFlag(cell.index);
          suppressNextClick = true;
          suppressNextContextMenu = true;
          longPressTimer = null;
        }, 450);
      }
      if (event.pointerType === 'mouse' && event.buttons === 3 && cell.isRevealed) {
        chord(cell.index);
        suppressNextContextMenu = true;
      }
    });

    cell.element.addEventListener('pointerup', stopLongPress);
    cell.element.addEventListener('pointerleave', stopLongPress);
    cell.element.addEventListener('pointercancel', stopLongPress);
    boardElement.append(cell.element);
  });

  boardSizeElement.textContent = formatDimensions(boardConfig.columns, boardConfig.rows);
}

function stopLongPress() {
  if (longPressTimer !== null) {
    window.clearTimeout(longPressTimer);
    longPressTimer = null;
  }
  if (!gameOver) resetFaceElement.textContent = '🙂';
}

function getNeighbors(index) {
  const row = Math.floor(index / boardConfig.columns);
  const column = index % boardConfig.columns;
  const neighbors = [];

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      if (rowOffset === 0 && columnOffset === 0) continue;
      const neighborRow = row + rowOffset;
      const neighborColumn = column + columnOffset;
      if (
        neighborRow >= 0 && neighborRow < boardConfig.rows &&
        neighborColumn >= 0 && neighborColumn < boardConfig.columns
      ) {
        neighbors.push(cells[neighborRow * boardConfig.columns + neighborColumn]);
      }
    }
  }
  return neighbors;
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

  availableIndices.slice(0, boardConfig.mines).forEach((index) => {
    cells[index].isMine = true;
  });

  cells.forEach((cell) => {
    if (!cell.isMine) {
      cell.adjacentMines = getNeighbors(cell.index).filter((neighbor) => neighbor.isMine).length;
    }
  });
}

function startTimer() {
  if (timerId !== null) return;
  gameStarted = true;
  timerId = window.setInterval(() => {
    secondsElapsed = Math.min(secondsElapsed + 1, 999);
    timerElement.textContent = formatTime(secondsElapsed);
    if (secondsElapsed === 999) {
      window.clearInterval(timerId);
      timerId = null;
    }
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
  checkVictory();
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

  cell.isFlagged = !cell.isFlagged;
  cell.isQuestioned = false;
  flagsPlaced += cell.isFlagged ? 1 : -1;
  mineCountElement.textContent = formatCounter(boardConfig.mines - flagsPlaced);
  renderCell(cell);
  messageElement.textContent = '주변을 살펴보고 안전한 칸을 찾아보세요.';
}

function toggleQuestion(index) {
  const cell = cells[index];
  if (gameOver || cell.isRevealed || cell.isFlagged) return;

  cell.isQuestioned = !cell.isQuestioned;
  renderCell(cell);
}

function chord(index) {
  const cell = cells[index];
  if (gameOver || !cell.isRevealed || cell.adjacentMines === 0) return;

  const neighbors = getNeighbors(index);
  const adjacentFlags = neighbors.filter((neighbor) => neighbor.isFlagged).length;
  if (adjacentFlags !== cell.adjacentMines) return;

  neighbors
    .filter((neighbor) => !neighbor.isFlagged && !neighbor.isRevealed)
    .forEach((neighbor) => {
      if (!gameOver) revealCell(neighbor.index);
    });
}

function renderCell(cell, wasHit = false) {
  const { element } = cell;
  const row = Math.floor(cell.index / boardConfig.columns) + 1;
  const column = (cell.index % boardConfig.columns) + 1;
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

  element.textContent = cell.isFlagged ? '⚑' : cell.isQuestioned ? '?' : '';
  if (cell.isFlagged) {
    element.classList.add('flagged');
    element.setAttribute('aria-label', `${row}행 ${column}열, 깃발 표시됨`);
  } else if (cell.isQuestioned) {
    element.classList.add('questioned');
    element.setAttribute('aria-label', `${row}행 ${column}열, 물음표 표시됨`);
  } else {
    element.setAttribute('aria-label', `${row}행 ${column}열, 닫힘`);
  }
}

function getRecordKey() {
  if (currentDifficulty !== 'custom') return `minesweeper-best-${currentDifficulty}`;
  return `minesweeper-best-custom-${boardConfig.columns}x${boardConfig.rows}-${boardConfig.mines}`;
}

function readBestTime() {
  try {
    const value = Number(window.localStorage.getItem(getRecordKey()));
    return Number.isInteger(value) && value >= 0 && value <= 999 ? value : null;
  } catch {
    return null;
  }
}

function updateBestTime() {
  const bestTime = readBestTime();
  bestTimeElement.textContent = bestTime === null ? '---' : formatTime(bestTime);
}

function saveBestTime() {
  const bestTime = readBestTime();
  if (bestTime !== null && bestTime <= secondsElapsed) return;
  try {
    window.localStorage.setItem(getRecordKey(), String(secondsElapsed));
    updateBestTime();
  } catch {
    messageElement.textContent = '기록을 저장할 수 없지만 게임은 계속할 수 있어요.';
  }
}

function checkVictory() {
  if (revealedCount === cells.length - boardConfig.mines) finishGame(true);
}

function finishGame(won) {
  gameOver = true;
  window.clearInterval(timerId);
  timerId = null;
  resetFaceElement.textContent = won ? '😎' : '😵';
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

  if (won) saveBestTime();
}

function resetGame() {
  window.clearInterval(timerId);
  flagsPlaced = 0;
  revealedCount = 0;
  secondsElapsed = 0;
  timerId = null;
  gameStarted = false;
  gameOver = false;
  mineCountElement.textContent = formatCounter(boardConfig.mines);
  timerElement.textContent = formatTime(0);
  resetFaceElement.textContent = '🙂';
  messageElement.textContent = '주변을 살펴보고 안전한 칸을 찾아보세요.';
  updateBestTime();
  createBoard();
}

function applyDifficulty(key) {
  currentDifficulty = key;
  boardConfig = { ...DIFFICULTIES[key] };
  customSettings.hidden = true;
  resetGame();
}

difficultySelect.addEventListener('change', () => {
  if (difficultySelect.value === 'custom') {
    customSettings.hidden = false;
    document.querySelector('#custom-width').focus();
    return;
  }
  applyDifficulty(difficultySelect.value);
});

customSettings.addEventListener('submit', (event) => {
  event.preventDefault();
  const columns = Number(document.querySelector('#custom-width').value);
  const rows = Number(document.querySelector('#custom-height').value);
  const mines = Number(document.querySelector('#custom-mines').value);
  const validDimensions = Number.isInteger(columns) && Number.isInteger(rows) &&
    columns >= 5 && columns <= 30 && rows >= 5 && rows <= 30;
  const validMineCount = Number.isInteger(mines) && mines >= 1 && mines < columns * rows;

  if (!validDimensions || !validMineCount) {
    messageElement.textContent = '가로·세로는 5~30, 지뢰는 칸 수보다 적게 입력해주세요.';
    return;
  }

  boardConfig = { columns, rows, mines, label: '사용자 지정' };
  currentDifficulty = 'custom';
  customSettings.hidden = true;
  resetGame();
});

function updateMarkModeButtons() {
  flagModeButton.setAttribute('aria-pressed', String(flagMode));
  flagModeButton.querySelector('kbd').textContent = flagMode ? '켬' : '끔';
  questionModeButton.setAttribute('aria-pressed', String(questionMode));
  questionModeButton.querySelector('kbd').textContent = questionMode ? '켬' : '끔';
}

flagModeButton.addEventListener('click', () => {
  flagMode = !flagMode;
  if (flagMode) questionMode = false;
  updateMarkModeButtons();
});

questionModeButton.addEventListener('click', () => {
  questionMode = !questionMode;
  if (questionMode) flagMode = false;
  updateMarkModeButtons();
});

resetButton.addEventListener('click', resetGame);
window.addEventListener('resize', updateBoardSizing);
createBoard();
updateBestTime();
mineCountElement.textContent = formatCounter(boardConfig.mines);