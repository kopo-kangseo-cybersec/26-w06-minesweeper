
"use strict";

// 난이도 설정
const DIFFICULTIES = {
  beginner: {
    rows: 9,
    cols: 9,
    mines: 10
  },
  intermediate: {
    rows: 16,
    cols: 16,
    mines: 40
  },
  advanced: {
    rows: 16,
    cols: 30,
    mines: 99
  }
};

// HTML 요소
const boardElement = document.getElementById("board");
const difficultyElement = document.getElementById("difficulty");
const restartButton = document.getElementById("restart");
const mineCounterElement = document.getElementById("mine-counter");
const timerElement = document.getElementById("timer");
const messageElement = document.getElementById("message");

// 게임 상태
let settings;
let board = [];
let flags = 0;
let openedSafeCount = 0;
let seconds = 0;
let timerId = null;
let timerStarted = false;
let firstClick = true;
let gameOver = false;


// 새 게임 시작
function startGame() {
  clearInterval(timerId);
  timerId = null;

  settings = DIFFICULTIES[difficultyElement.value];

  flags = 0;
  openedSafeCount = 0;
  seconds = 0;
  timerStarted = false;
  firstClick = true;
  gameOver = false;

  timerElement.textContent = "00:00";
  mineCounterElement.textContent = settings.mines;
  messageElement.textContent = "칸을 클릭해서 게임을 시작하세요!";

  // 보드 초기화
  board = Array.from(
    { length: settings.rows },
    () =>
      Array.from(
        { length: settings.cols },
        () => ({
          mine: false,
          number: 0,
          opened: false,
          flagged: false
        })
      )
  );

  // 모든 칸을 닫힌 상태로 생성
  boardElement.replaceChildren();
  boardElement.style.setProperty("--cols", settings.cols);

  createBoardElements();
  updateMineCounter();
}


// 게임판의 버튼 생성
function createBoardElements() {
  const fragment = document.createDocumentFragment();

  for (let r = 0; r < settings.rows; r++) {
    for (let c = 0; c < settings.cols; c++) {
      const element = document.createElement("button");

      element.type = "button";
      element.className = "cell";
      element.setAttribute("aria-label", `${r + 1}행 ${c + 1}열`);

      element.addEventListener("click", () => {
        openCell(r, c);
      });

      // 우클릭: 깃발 표시 및 해제
      element.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        toggleFlag(r, c);
      });

      fragment.appendChild(element);
    }
  }

  boardElement.appendChild(fragment);
}


// 지뢰 배치
// 첫 클릭한 칸과 주변 8칸, 이미 깃발이 있는 칸은 제외
function placeMines(safeR, safeC) {
  const candidates = [];

  for (let r = 0; r < settings.rows; r++) {
    for (let c = 0; c < settings.cols; c++) {
      const inSafeArea =
        Math.abs(r - safeR) <= 1 &&
        Math.abs(c - safeC) <= 1;

      if (inSafeArea) {
        continue;
      }

      if (board[r][c].flagged) {
        continue;
      }

      candidates.push({ r, c });
    }
  }

  // 후보 위치를 무작위로 섞기
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] =
      [candidates[j], candidates[i]];
  }

  // 설정된 수만큼 지뢰 배치
  for (let i = 0; i < settings.mines; i++) {
    const position = candidates[i];

    if (position) {
      board[position.r][position.c].mine = true;
    }
  }
}


// 각 칸 주변의 지뢰 개수 계산
function calculateNumbers() {
  for (let r = 0; r < settings.rows; r++) {
    for (let c = 0; c < settings.cols; c++) {
      const cell = board[r][c];
      cell.number = 0;

      if (cell.mine) {
        continue;
      }

      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) {
            continue;
          }

          const nr = r + dr;
          const nc = c + dc;

          if (
            isInsideBoard(nr, nc) &&
            board[nr][nc].mine
          ) {
            cell.number++;
          }
        }
      }
    }
  }
}


// 좌표가 게임판 안에 있는지 확인
function isInsideBoard(r, c) {
  return (
    r >= 0 &&
    r < settings.rows &&
    c >= 0 &&
    c < settings.cols
  );
}


// 게임판 버튼 가져오기
function getCellElement(r, c) {
  return boardElement.children[r * settings.cols + c];
}


// 칸 화면 갱신
function renderCell(r, c) {
  const cell = board[r][c];
  const element = getCellElement(r, c);

  element.className = "cell";
  element.textContent = "";
  element.disabled = gameOver;

  const position = `${r + 1}행 ${c + 1}열`;

  if (cell.opened) {
    element.classList.add("open");

    if (cell.mine) {
      element.classList.add("mine");
      element.textContent = "💣";
      element.setAttribute("aria-label", `${position}, 지뢰`);
    } else if (cell.number > 0) {
      element.textContent = cell.number;
      element.classList.add(`num-${cell.number}`);
      element.setAttribute(
        "aria-label",
        `${position}, 주변 지뢰 ${cell.number}개`
      );
    } else {
      element.setAttribute("aria-label", `${position}, 빈 칸`);
    }

    return;
  }

  if (cell.flagged) {
    element.classList.add("flagged");
    element.textContent = "🚩";
    element.setAttribute("aria-label", `${position}, 깃발`);
  } else {
    element.setAttribute("aria-label", `${position}, 닫힌 칸`);
  }
}


// 전체 보드 화면 갱신
function renderAllCells() {
  for (let r = 0; r < settings.rows; r++) {
    for (let c = 0; c < settings.cols; c++) {
      renderCell(r, c);
    }
  }
}


// 타이머 시작
function startTimer() {
  if (timerStarted || gameOver) {
    return;
  }

  timerStarted = true;

  timerId = setInterval(() => {
    seconds++;
    timerElement.textContent = formatTime(seconds);
  }, 1000);
}


// 초를 분:초로 표시
function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  return (
    String(minutes).padStart(2, "0") +
    ":" +
    String(remainingSeconds).padStart(2, "0")
  );
}


// 칸 열기
function openCell(r, c) {
  if (gameOver) {
    return;
  }

  const cell = board[r][c];

  // 이미 열린 숫자 칸을 클릭하면 빠른 열기
  if (cell.opened) {
    if (cell.number > 0) {
      openAroundNumber(r, c);
    }
    return;
  }

  // 깃발이 있는 칸은 열지 않음
  if (cell.flagged) {
    return;
  }

  // 첫 좌클릭 때만 지뢰 배치
  if (firstClick) {
    placeMines(r, c);
    calculateNumbers();
    firstClick = false;

    messageElement.textContent = "게임 진행 중...";
  }

  startTimer();

  const currentCell = board[r][c];

  // 지뢰를 열면 패배
  if (currentCell.mine) {
    currentCell.opened = true;
    endGame(false);
    return;
  }

  // 빈 영역과 주변 숫자 칸 공개
  revealArea(r, c);

  checkWin();
}


// 빈 영역 자동 공개
function revealArea(startR, startC) {
  const stack = [[startR, startC]];

  while (stack.length > 0) {
    const [r, c] = stack.pop();

    if (!isInsideBoard(r, c)) {
      continue;
    }

    const cell = board[r][c];

    if (cell.opened || cell.flagged || cell.mine) {
      continue;
    }

    cell.opened = true;
    openedSafeCount++;

    renderCell(r, c);

    // 주변 지뢰가 없는 칸이면 인접한 칸도 확인
    if (cell.number === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) {
            continue;
          }

          stack.push([r + dr, c + dc]);
        }
      }
    }
  }
}


// 깃발 표시 및 해제
function toggleFlag(r, c) {
  if (gameOver) {
    return;
  }

  const cell = board[r][c];

  if (cell.opened) {
    return;
  }

  // 지뢰 개수 이상으로 깃발을 꽂지 않도록 제한
  if (!cell.flagged && flags >= settings.mines) {
    messageElement.textContent =
      "표시할 수 있는 깃발을 모두 사용했습니다.";
    return;
  }

  cell.flagged = !cell.flagged;

  if (cell.flagged) {
    flags++;
  } else {
    flags--;
  }

  renderCell(r, c);
  updateMineCounter();
}


// 남은 지뢰 수 갱신
function updateMineCounter() {
  mineCounterElement.textContent = settings.mines - flags;
}


// 열린 숫자 칸 주변의 빠른 열기
function openAroundNumber(r, c) {
  const number = board[r][c].number;
  let flagCount = 0;

  // 주변 깃발 수 계산
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) {
        continue;
      }

      const nr = r + dr;
      const nc = c + dc;

      if (
        isInsideBoard(nr, nc) &&
        board[nr][nc].flagged
      ) {
        flagCount++;
      }
    }
  }

  // 깃발 수가 숫자와 다르면 아무것도 하지 않음
  if (flagCount !== number) {
    return;
  }

  // 열 대상 칸을 먼저 모음
  const cellsToOpen = [];

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) {
        continue;
      }

      const nr = r + dr;
      const nc = c + dc;

      if (!isInsideBoard(nr, nc)) {
        continue;
      }

      const neighbor = board[nr][nc];

      if (!neighbor.opened && !neighbor.flagged) {
        cellsToOpen.push([nr, nc]);
      }
    }
  }

  // 주변의 미개봉 칸 열기
  for (const [nr, nc] of cellsToOpen) {
    openCell(nr, nc);

    // 지뢰를 열거나 승리해서 종료됐다면 중단
    if (gameOver) {
      return;
    }
  }

  checkWin();
}


// 승리 여부 확인
function checkWin() {
  if (gameOver) {
    return;
  }

  const totalSafeCells =
    settings.rows * settings.cols - settings.mines;

  if (openedSafeCount === totalSafeCells) {
    endGame(true);
  }
}


// 게임 종료
function endGame(won) {
  if (gameOver) {
    return;
  }

  gameOver = true;

  clearInterval(timerId);
  timerId = null;

  // 게임 종료 시 모든 지뢰 공개
  for (let r = 0; r < settings.rows; r++) {
    for (let c = 0; c < settings.cols; c++) {
      if (board[r][c].mine) {
        board[r][c].opened = true;
      }
    }
  }

  renderAllCells();

  if (won) {
    messageElement.textContent =
      `🎉 승리했습니다! 기록: ${formatTime(seconds)}`;
  } else {
    messageElement.textContent =
      "💥 지뢰를 밟았습니다! 새 게임으로 다시 도전하세요.";
  }
}


// 버튼 이벤트
restartButton.addEventListener("click", startGame);
difficultyElement.addEventListener("change", startGame);

// 최초 게임 실행
startGame();
