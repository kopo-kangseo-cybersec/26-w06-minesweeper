
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

const boardElement = document.getElementById("board");
const difficultyElement = document.getElementById("difficulty");
const restartButton = document.getElementById("restart");
const mineCounterElement = document.getElementById("mine-counter");
const timerElement = document.getElementById("timer");
const messageElement = document.getElementById("message");

let settings;
let board = [];

let flags = 0;
let openedSafeCount = 0;

let seconds = 0;
let timerId = null;
let timerStarted = false;

let firstMove = true;
let gameOver = false;


// 게임 시작 또는 다시 시작
function startGame() {
  clearInterval(timerId);
  timerId = null;

  settings = DIFFICULTIES[difficultyElement.value];

  flags = 0;
  openedSafeCount = 0;
  seconds = 0;
  timerStarted = false;
  firstMove = true;
  gameOver = false;

  timerElement.textContent = "00:00";
  mineCounterElement.textContent = settings.mines;

  messageElement.textContent =
    "시작 영역이 공개되었습니다. 첫 번째 닫힌 칸은 안전하게 열립니다.";

  boardElement.innerHTML = "";
  boardElement.style.setProperty("--cols", settings.cols);

  // 보드의 모든 칸 초기화
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

  createBoardElements();

  // 시작 영역 주변에는 지뢰를 배치하지 않음
  const startR = Math.floor(settings.rows / 2);
  const startC = Math.floor(settings.cols / 2);

  placeMines(startR, startC);
  calculateNumbers();

  // 게임을 시작하면 중앙의 3×3 영역을 자동 공개
  revealStartingArea(startR, startC);

  updateMineCounter();
}


// 게임판 버튼 생성
function createBoardElements() {
  for (let r = 0; r < settings.rows; r++) {
    for (let c = 0; c < settings.cols; c++) {
      const cellElement = document.createElement("button");

      cellElement.type = "button";
      cellElement.className = "cell";
      cellElement.dataset.row = r;
      cellElement.dataset.col = c;

      cellElement.addEventListener("click", () => {
        openCell(r, c);
      });

      // 우클릭으로 깃발 표시
      cellElement.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        toggleFlag(r, c);
      });

      boardElement.appendChild(cellElement);
    }
  }
}


// 지뢰 무작위 배치
function placeMines(safeR, safeC) {
  let placed = 0;

  while (placed < settings.mines) {
    const r = Math.floor(Math.random() * settings.rows);
    const c = Math.floor(Math.random() * settings.cols);

    // 시작 지점과 주변 8칸은 안전하게 유지
    if (
      Math.abs(r - safeR) <= 1 &&
      Math.abs(c - safeC) <= 1
    ) {
      continue;
    }

    if (board[r][c].mine) {
      continue;
    }

    board[r][c].mine = true;
    placed++;
  }
}


// 각 칸 주변의 지뢰 수 계산
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

          if (isInsideBoard(nr, nc) && board[nr][nc].mine) {
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


// 게임판의 특정 버튼 가져오기
function getCellElement(r, c) {
  return boardElement.children[r * settings.cols + c];
}


// 특정 칸의 화면 갱신
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
    element.setAttribute("aria-label", `${position}, 깃발 표시`);
  } else {
    element.setAttribute("aria-label", `${position}, 닫힌 칸`);
  }
}


// 모든 칸의 화면 갱신
function renderAllCells() {
  for (let r = 0; r < settings.rows; r++) {
    for (let c = 0; c < settings.cols; c++) {
      renderCell(r, c);
    }
  }
}


// 게임 시작 시 중앙 영역 자동 공개
function revealStartingArea(centerR, centerC) {
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = centerR + dr;
      const c = centerC + dc;

      if (!isInsideBoard(r, c)) {
        continue;
      }

      const cell = board[r][c];

      if (!cell.opened && !cell.mine) {
        cell.opened = true;
        openedSafeCount++;
        renderCell(r, c);
      }
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


// 초를 분:초 형식으로 변환
function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  return (
    String(minutes).padStart(2, "0") +
    ":" +
    String(remainingSeconds).padStart(2, "0")
  );
}


// 첫 번째 닫힌 칸 클릭을 빈 칸으로 보호
function protectFirstClick(r, c) {
  let movedMines = 0;

  // 클릭한 칸과 주변의 지뢰를 제거
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const nr = r + dr;
      const nc = c + dc;

      if (!isInsideBoard(nr, nc)) {
        continue;
      }

      if (board[nr][nc].mine) {
        board[nr][nc].mine = false;
        movedMines++;
      }
    }
  }

  // 주변에 지뢰가 없었다면 이동할 필요 없음
  if (movedMines === 0) {
    return;
  }

  // 새 지뢰를 놓을 수 있는 칸 찾기
  const candidates = [];

  for (let nr = 0; nr < settings.rows; nr++) {
    for (let nc = 0; nc < settings.cols; nc++) {
      // 클릭 지점 주변에는 지뢰를 놓지 않음
      if (
        Math.abs(nr - r) <= 1 &&
        Math.abs(nc - c) <= 1
      ) {
        continue;
      }

      const cell = board[nr][nc];

      // 이미 열려 있는 안전 칸에는 지뢰를 놓을 수 없음
      if (!cell.mine && !cell.opened) {
        candidates.push({ r: nr, c: nc });
      }
    }
  }

  // 후보 칸을 무작위 순서로 섞기
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  // 제거한 지뢰 수만큼 다른 위치에 배치
  for (let i = 0; i < movedMines; i++) {
    const position = candidates[i];

    if (position) {
      board[position.r][position.c].mine = true;
    }
  }

  // 변경된 지뢰 배치에 맞춰 숫자 다시 계산
  calculateNumbers();

  // 이미 공개된 시작 영역의 숫자도 갱신
  renderAllCells();
}


// 칸 열기
function openCell(r, c) {
  if (gameOver) {
    return;
  }

  let cell = board[r][c];

  // 열린 숫자 칸을 다시 클릭하면 주변 칸 빠르게 열기
  if (cell.opened) {
    if (!cell.mine && cell.number > 0) {
      startTimer();

      // 숫자 칸 빠른 열기는 첫 번째 일반 칸 열기와 구분
      firstMove = false;

      openAroundNumber(r, c);
    }

    return;
  }

  // 깃발이 꽂힌 칸은 열지 않음
  if (cell.flagged) {
    return;
  }

  startTimer();

  // 첫 번째 닫힌 칸은 반드시 빈 칸이 되도록 처리
  if (firstMove) {
    protectFirstClick(r, c);
    firstMove = false;

    cell = board[r][c];
  }

  // 지뢰를 열었다면 패배
  if (cell.mine) {
    cell.opened = true;
    renderCell(r, c);
    endGame(false);
    return;
  }

  // 빈 영역과 주변 숫자 칸 자동 공개
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

    // 주변 지뢰가 없는 칸이면 주변 칸들도 연쇄적으로 확인
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

  startTimer();

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


// 열린 숫자 칸 주변 자동 열기
function openAroundNumber(r, c) {
  const number = board[r][c].number;
  let flagCount = 0;

  // 주변 깃발 수 세기
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

  // 주변의 닫힌 칸 중 깃발이 없는 칸 열기
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
        openCell(nr, nc);

        // 지뢰를 열어 게임이 끝났으면 즉시 중단
        if (gameOver) {
          return;
        }
      }
    }
  }
}


// 승리 조건 확인
function checkWin() {
  const totalSafeCells =
    settings.rows * settings.cols - settings.mines;

  if (openedSafeCount === totalSafeCells) {
    endGame(true);
  }
}


// 게임 종료 처리
function endGame(won) {
  if (gameOver) {
    return;
  }

  gameOver = true;

  clearInterval(timerId);
  timerId = null;

  // 게임 종료 시 모든 지뢰 위치 공개
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
      "💥 지뢰를 밟았습니다. 새 게임 버튼을 눌러 다시 도전하세요!";
  }
}


// 버튼 및 난이도 변경 이벤트
restartButton.addEventListener("click", startGame);

difficultyElement.addEventListener("change", startGame);

// 최초 실행
startGame();
