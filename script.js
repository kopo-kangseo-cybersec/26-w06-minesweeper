const BOARD_SIZE = 9;
const MINE_TOTAL = 10;

const boardElement = document.querySelector('#board');
const mineCounter = document.querySelector('#mine-counter');
const timerElement = document.querySelector('#timer');
const statusElement = document.querySelector('#game-status');
const resetButton = document.querySelector('#reset-button');
const modeButtons = document.querySelectorAll('.mode-button');

let cells = [];
let firstMove = true;
let gameEnded = false;
let elapsedSeconds = 0;
let timerId = null;
let inputMode = 'reveal';

function startGame() {
  clearInterval(timerId);
  cells = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => ({
    row: Math.floor(index / BOARD_SIZE),
    col: index % BOARD_SIZE,
    mine: false,
    adjacent: 0,
    revealed: false,
    flagged: false,
    exploded: false,
  }));
  firstMove = true;
  gameEnded = false;
  elapsedSeconds = 0;
  timerId = null;
  inputMode = 'reveal';
  timerElement.value = '000';
  mineCounter.value = String(MINE_TOTAL).padStart(3, '0');
  statusElement.textContent = '첫 칸을 열어 게임을 시작하세요.';
  resetButton.textContent = '🙂';
  resetButton.setAttribute('aria-label', '새 게임 시작');
  setMode('reveal');
  renderBoard();
}

function placeMines(safeRow, safeCol) {
  const excluded = new Set();
  for (let row = Math.max(0, safeRow - 1); row <= Math.min(BOARD_SIZE - 1, safeRow + 1); row += 1) {
    for (let col = Math.max(0, safeCol - 1); col <= Math.min(BOARD_SIZE - 1, safeCol + 1); col += 1) {
      excluded.add(row * BOARD_SIZE + col);
    }
  }

  const candidates = cells.map((_, index) => index).filter((index) => !excluded.has(index));
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
  }

  candidates.slice(0, MINE_TOTAL).forEach((index) => { cells[index].mine = true; });
  cells.forEach((cell) => {
    if (cell.mine) return;
    cell.adjacent = getNeighbors(cell).filter((neighbor) => neighbor.mine).length;
  });
}

function getNeighbors(cell) {
  const neighbors = [];
  for (let row = Math.max(0, cell.row - 1); row <= Math.min(BOARD_SIZE - 1, cell.row + 1); row += 1) {
    for (let col = Math.max(0, cell.col - 1); col <= Math.min(BOARD_SIZE - 1, cell.col + 1); col += 1) {
      if (row !== cell.row || col !== cell.col) neighbors.push(cells[row * BOARD_SIZE + col]);
    }
  }
  return neighbors;
}

function renderBoard() {
  const fragment = document.createDocumentFragment();
  cells.forEach((cell, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cell';
    button.setAttribute('role', 'gridcell');
    button.setAttribute('aria-label', `행 ${cell.row + 1}, 열 ${cell.col + 1}, 닫힘`);
    button.dataset.index = String(index);
    button.addEventListener('click', () => handleCellClick(index));
    button.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      toggleFlag(index);
    });
    fragment.append(button);
  });
  boardElement.replaceChildren(fragment);
}

function updateBoard() {
  cells.forEach((cell, index) => {
    const button = boardElement.children[index];
    button.className = 'cell';
    button.textContent = '';
    button.removeAttribute('data-number');

    if (cell.revealed) {
      button.classList.add('is-open');
      if (cell.mine) {
        button.textContent = '✹';
        button.classList.add('is-mine');
        if (cell.exploded) button.setAttribute('aria-label', `행 ${cell.row + 1}, 열 ${cell.col + 1}, 폭발한 지뢰`);
        else button.setAttribute('aria-label', `행 ${cell.row + 1}, 열 ${cell.col + 1}, 지뢰`);
      } else if (cell.adjacent > 0) {
        button.textContent = String(cell.adjacent);
        button.dataset.number = String(cell.adjacent);
        button.setAttribute('aria-label', `행 ${cell.row + 1}, 열 ${cell.col + 1}, 주변 지뢰 ${cell.adjacent}개`);
      } else {
        button.setAttribute('aria-label', `행 ${cell.row + 1}, 열 ${cell.col + 1}, 빈 칸`);
      }
    } else if (cell.flagged) {
      button.textContent = '⚑';
      button.classList.add('is-flagged');
      button.setAttribute('aria-label', `행 ${cell.row + 1}, 열 ${cell.col + 1}, 깃발 표시`);
    } else {
      button.setAttribute('aria-label', `행 ${cell.row + 1}, 열 ${cell.col + 1}, 닫힘`);
    }

    if (gameEnded) {
      if (cell.flagged && !cell.mine) {
        button.textContent = '×';
        button.classList.add('is-wrong');
      } else if (cell.mine && !cell.flagged) {
        button.textContent = '✹';
        button.classList.add('is-mine');
      }
      button.disabled = true;
    } else {
      button.disabled = cell.revealed;
    }
  });
}

function handleCellClick(index) {
  if (gameEnded) return;
  if (inputMode === 'flag') {
    toggleFlag(index);
    return;
  }

  const cell = cells[index];
  if (cell.revealed || cell.flagged) return;
  if (firstMove) {
    placeMines(cell.row, cell.col);
    firstMove = false;
    timerId = setInterval(() => {
      elapsedSeconds += 1;
      timerElement.value = String(Math.min(elapsedSeconds, 999)).padStart(3, '0');
    }, 1000);
  }
  revealCell(cell);
}

function revealCell(startCell) {
  if (startCell.mine) {
    startCell.revealed = true;
    startCell.exploded = true;
    endGame(false);
    return;
  }

  const pending = [startCell];
  while (pending.length > 0) {
    const cell = pending.pop();
    if (cell.revealed || cell.flagged || cell.mine) continue;
    cell.revealed = true;
    if (cell.adjacent === 0) pending.push(...getNeighbors(cell));
  }

  updateBoard();
  if (cells.filter((cell) => cell.revealed).length === BOARD_SIZE * BOARD_SIZE - MINE_TOTAL) endGame(true);
}

function toggleFlag(index) {
  const cell = cells[index];
  if (gameEnded || cell.revealed) return;
  if (!cell.flagged && cells.filter((item) => item.flagged).length >= MINE_TOTAL) return;
  cell.flagged = !cell.flagged;
  const flagCount = cells.filter((item) => item.flagged).length;
  mineCounter.value = String(MINE_TOTAL - flagCount).padStart(3, '0');
  updateBoard();
}

function endGame(won) {
  gameEnded = true;
  clearInterval(timerId);
  if (won) {
    cells.filter((cell) => cell.mine).forEach((cell) => { cell.flagged = true; });
    mineCounter.value = '000';
    statusElement.textContent = `완벽합니다. ${elapsedSeconds}초 만에 모든 지뢰를 찾았습니다.`;
    resetButton.textContent = '😎';
  } else {
    statusElement.textContent = '지뢰를 밟았습니다. 새 게임으로 다시 도전하세요.';
    resetButton.textContent = '😵';
  }
  resetButton.setAttribute('aria-label', '다시 시작');
  updateBoard();
}

function setMode(mode) {
  inputMode = mode;
  modeButtons.forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelector('.control-hint').textContent = mode === 'reveal' ? '칸을 여세요' : '표시할 칸을 선택하세요';
}

resetButton.addEventListener('click', startGame);
modeButtons.forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
startGame();