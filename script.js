
const SIZE = 9;
const MINE_COUNT = 10;

const boardElement = document.getElementById("board");
const minesElement = document.getElementById("mines");
const timerElement = document.getElementById("timer");
const messageElement = document.getElementById("message");
const restartButton = document.getElementById("restart");

let board = [];
let firstClick = true;
let gameOver = false;
let flags = 0;
let openedCount = 0;
let seconds = 0;
let timerId = null;

function startGame() {
  clearInterval(timerId);

  board = [];
  firstClick = true;
  gameOver = false;
  flags = 0;
  openedCount = 0;
  seconds = 0;

  timerElement.textContent = "⏱ 시간: 0초";
  minesElement.textContent = `🚩 남은 지뢰: ${MINE_COUNT}`;
  messageElement.textContent = "칸을 클릭해서 게임을 시작하세요!";

  boardElement.innerHTML = "";

  // 9x9 보드 생성
  for (let r = 0; r < SIZE; r++) {
    board[r] = [];

    for (let c = 0; c < SIZE; c++) {
      board[r][c] = {
        mine: false,
        number: 0,
        opened: false,
        flagged: false
      };

      const cell = document.createElement("button");
      cell.className = "cell";
      cell.type = "button";
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.setAttribute("aria-label", `${r + 1}행 ${c + 1}열`);

      cell.addEventListener("click", () => openCell(r, c));

      cell.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        toggleFlag(r, c);
      });

      boardElement.appendChild(cell);
    }
  }
}

function placeMines(safeR, safeC) {
  let placed = 0;

  while (placed < MINE_COUNT) {
    const r = Math.floor(Math.random() * SIZE);
    const c = Math.floor(Math.random() * SIZE);

    // 첫 클릭과 주변 8칸은 안전하게 유지
    if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) {
      continue;
    }

    if (board[r][c].mine) {
      continue;
    }

    board[r][c].mine = true;
    placed++;
  }

  // 각 칸 주변의 지뢰 수 계산
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c].mine) continue;

      let count = 0;

      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;

          if (
            nr >= 0 && nr < SIZE &&
            nc >= 0 && nc < SIZE &&
            board[nr][nc].mine
          ) {
            count++;
          }
        }
      }

      board[r][c].number = count;
    }
  }
}

function getCellElement(r, c) {
  return boardElement.children[r * SIZE + c];
}


function openCell(r, c) {
  if (gameOver) return;

  const cell = board[r][c];

  // 이미 열린 숫자 칸을 클릭하면 주변 칸 빠르게 열기
  if (cell.opened) {
    if (cell.number > 0) {
      openAroundNumber(r, c);
    }
    return;
  }

  if (cell.flagged) return;

  if (firstClick) {
    firstClick = false;
    placeMines(r, c);

    timerId = setInterval(() => {
      seconds++;
      timerElement.textContent = `⏱ 시간: ${seconds}초`;
    }, 1000);
  }

  if (cell.mine) {
    cell.opened = true;
    getCellElement(r, c).classList.add("open", "mine");
    getCellElement(r, c).textContent = "💣";
    endGame(false);
    return;
  }

  revealArea(r, c);
  checkWin();
}


function openAroundNumber(r, c) {
  const cell = board[r][c];
  let flagCount = 0;

  // 주변에 꽂힌 깃발 개수 세기
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const nr = r + dr;
      const nc = c + dc;

      if (
        nr >= 0 && nr < SIZE &&
        nc >= 0 && nc < SIZE &&
        board[nr][nc].flagged
      ) {
        flagCount++;
      }
    }
  }

  // 숫자와 깃발 개수가 일치하지 않으면 실행하지 않음
  if (flagCount !== cell.number) return;

  // 주변의 열리지 않은 칸을 모두 열기
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;

      const nr = r + dr;
      const nc = c + dc;

      if (
        nr >= 0 && nr < SIZE &&
        nc >= 0 && nc < SIZE &&
        !board[nr][nc].opened &&
        !board[nr][nc].flagged
      ) {
        openCell(nr, nc);

        // 지뢰를 밟아 게임이 끝났다면 중단
        if (gameOver) return;
      }
    }
  }
}


function revealArea(startR, startC) {
  const stack = [[startR, startC]];

  while (stack.length > 0) {
    const [r, c] = stack.pop();

    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) continue;

    const cell = board[r][c];

    if (cell.opened || cell.flagged || cell.mine) continue;

    cell.opened = true;
    openedCount++;

    const element = getCellElement(r, c);
    element.classList.add("open");

    if (cell.number > 0) {
      element.textContent = cell.number;
      element.classList.add(`num-${cell.number}`);
    } else {
      // 숫자가 0인 칸은 주변 칸도 자동으로 열기
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr !== 0 || dc !== 0) {
            stack.push([r + dr, c + dc]);
          }
        }
      }
    }
  }
}

function toggleFlag(r, c) {
  if (gameOver || board[r][c].opened) return;

  const cell = board[r][c];
  const element = getCellElement(r, c);

  if (cell.flagged) {
    cell.flagged = false;
    flags--;
    element.textContent = "";
    element.classList.remove("flagged");
  } else {
    if (flags >= MINE_COUNT) return;

    cell.flagged = true;
    flags++;
    element.textContent = "🚩";
    element.classList.add("flagged");
  }

  minesElement.textContent = `🚩 남은 지뢰: ${MINE_COUNT - flags}`;
}

function checkWin() {
  if (openedCount === SIZE * SIZE - MINE_COUNT) {
    endGame(true);
  }
}

function endGame(won) {
  gameOver = true;
  clearInterval(timerId);

  // 게임 종료 시 모든 지뢰 공개
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = board[r][c];
      const element = getCellElement(r, c);

      if (cell.mine && !cell.opened) {
        element.textContent = "💣";
        element.classList.add("open", "mine");
      }

      element.disabled = true;
    }
  }

  messageElement.textContent = won
    ? `🎉 승리했습니다! 기록: ${seconds}초`
    : "💥 지뢰를 밟았습니다! 다시 시작해 보세요.";
}

restartButton.addEventListener("click", startGame);

startGame();
