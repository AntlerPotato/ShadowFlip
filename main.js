// 在文件最开始添加以下代码:

// 开始游戏的逻辑
document.getElementById('start-btn').addEventListener('click', function() {
  const startScreen = document.getElementById('start-screen');
  const gameScreen = document.getElementById('game-screen');
  
  // 播放开始游戏的音效
  gameStartSound.play();
  
  // 确保音乐状态保持一致
  updateMusicButtonState('music-btn-game');
  if (isMusicPlaying && !backgroundMusic) {
    playBackgroundMusic();
  }
  
  // 隐藏开始页面
  startScreen.style.display = 'none';
  
  // 显示游戏页面
  gameScreen.classList.remove('hidden');
  
  // 触发重排后再添加show类以实现动画
  setTimeout(() => {
    gameScreen.classList.add('show');
  }, 50);
  
  // 初始化游戏
  initGame();
  render();
});

/***************************************************
 *               ===== 修改后完整JS =====
 **************************************************/

// === 全局常量定义 ===
const ROWS = 10;
const COLS = 9;

// 红黑双方除"帅"/"将"外的棋子（各15个），用于随机"暗棋"分配
const redPieces = ["車", "馬", "馬", "相", "相", "仕", "仕", "炮", "炮", "兵", "兵", "兵", "兵", "兵", "車"];
const blackPieces = ["俥", "傌", "傌", "象", "象", "士", "士", "砲", "砲", "卒", "卒", "卒", "卒", "卒", "俥"];

// 标准布局
const standardLayout = {
  // 黑方
  "0,0": "俥",
  "0,1": "傌",
  "0,2": "象",
  "0,3": "士",
  "0,4": "將",
  "0,5": "士",
  "0,6": "象",
  "0,7": "傌",
  "0,8": "俥",
  "2,1": "砲",
  "2,7": "砲",
  "3,0": "卒",
  "3,2": "卒",
  "3,4": "卒",
  "3,6": "卒",
  "3,8": "卒",

  // 红方
  "9,0": "車",
  "9,1": "馬",
  "9,2": "相",
  "9,3": "仕",
  "9,4": "帥",
  "9,5": "仕",
  "9,6": "相",
  "9,7": "馬",
  "9,8": "車",
  "7,1": "炮",
  "7,7": "炮",
  "6,0": "兵",
  "6,2": "兵",
  "6,4": "兵",
  "6,6": "兵",
  "6,8": "兵",
};

// === 全局状态 ===
let board = [];
let currentPlayer = "red";
let selected = null;
let redEliminated = [];
let blackEliminated = [];
let lastCaptured = null;

// 新增全局变量：撤棋数据、双方步数、游戏结束标志
let lastUndoableMove = null;
let redMoveCount = 0;
let blackMoveCount = 0;
let gameOver = false;

// 在这里新增音效对象
let chessClack = new Audio("media/ChessClack.wav");
let eatSound = new Audio("media/eat.wav");
let takeBackSound = new Audio("media/TakeBackOneMove.wav");
let gameStartSound = new Audio("media/GameStart.wav");

// 修改音乐相关的变量定义部分
let backgroundMusic = null;
let isMusicPlaying = true;
const musicList = ["background1.wav", "background2.wav", "background3.wav"];
let currentMusicIndex = -1;

// 随机获取背景音乐
function getRandomMusic() {
  let newIndex;
  do {
    newIndex = Math.floor(Math.random() * musicList.length);
  } while (newIndex === currentMusicIndex && musicList.length > 1);
  currentMusicIndex = newIndex;
  return musicList[currentMusicIndex];
}

// 修改播放背景音乐的函数
function playBackgroundMusic() {
  if (backgroundMusic) {
    backgroundMusic.pause();
    backgroundMusic = null;
  }
  
  if (!isMusicPlaying) return;
  
  const musicFile = getRandomMusic();
  backgroundMusic = new Audio(`media/${musicFile}`);
  backgroundMusic.volume = 0.3; // 设置音量为30%
  
  // 重要：添加自动播放所需的属性
  backgroundMusic.autoplay = true;
  // 确保音频加载完成后立即播放
  backgroundMusic.load();
  
  const playPromise = backgroundMusic.play();
  if (playPromise !== undefined) {
    playPromise.then(() => {
      // 自动播放成功
      console.log("Music started playing automatically");
    }).catch(error => {
      // 自动播放被阻止，尝试用用户交互触发播放
      console.log("Auto-play was prevented, waiting for user interaction");
      
      // 添加一次性点击事件来启动音乐
      const startMusic = () => {
        backgroundMusic.play();
        document.removeEventListener('click', startMusic);
      };
      document.addEventListener('click', startMusic);
    });
  }
  
  // 监听音乐结束事件
  backgroundMusic.onended = () => {
    setTimeout(() => {
      if (isMusicPlaying) {
        playBackgroundMusic();
      }
    }, 2000); // 2秒后播放下一首
  };
}

// 更新切换音乐状态的函数
function toggleMusic(buttonId) {
  const musicBtn = document.getElementById(buttonId);
  isMusicPlaying = !isMusicPlaying;
  
  // 同步更新两个按钮的状态
  updateMusicButtonState('music-btn-start');
  updateMusicButtonState('music-btn-game');
  
  if (isMusicPlaying) {
    // 如果之前没有创建过音乐实例，确保创建新的
    if (!backgroundMusic) {
      playBackgroundMusic();
    } else {
      backgroundMusic.play();
    }
  } else {
    if (backgroundMusic) {
      backgroundMusic.pause();
    }
  }
}

// 新增：更新音乐按钮状态的函数
function updateMusicButtonState(buttonId) {
  const btn = document.getElementById(buttonId);
  if (btn) {
    if (isMusicPlaying) {
      btn.className = 'w-12 h-12 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center text-white shadow-lg transition-colors';
    } else {
      btn.className = 'w-12 h-12 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center text-green-500 shadow-lg transition-colors border border-green-500';
    }
  }
}

// 修改初始化音乐的时机
document.addEventListener('DOMContentLoaded', () => {
  // 设置两个音乐按钮的点击事件
  const musicBtnStart = document.getElementById('music-btn-start');
  const musicBtnGame = document.getElementById('music-btn-game');
  
  if (musicBtnStart) {
    musicBtnStart.addEventListener('click', () => toggleMusic('music-btn-start'));
  }
  
  if (musicBtnGame) {
    musicBtnGame.addEventListener('click', () => toggleMusic('music-btn-game'));
  }
  
  // 确保所有音频对象都预加载
  [chessClack, eatSound, takeBackSound, gameStartSound].forEach(sound => {
    sound.load();
  });
  
  // 页面加载完成后立即尝试播放音乐
  setTimeout(playBackgroundMusic, 1000);
  
  // 初始化按钮状态
  updateMusicButtonState('music-btn-start');
  updateMusicButtonState('music-btn-game');

  document.getElementById('surrender-red').addEventListener('click', () => {
    if (gameOver) return;
    if (currentPlayer !== 'red') {
      new NoticeJs({
        text: '不是你的回合，不能认输！',
        position: 'topCenter',
        animation: {
          open: 'animate__animated animate__bounceInRight',
          close: 'animate__animated animate__bounceOutLeft'
        }
      }).show();
      return;
    }
    
    handleSurrender('red');
  });
  
  document.getElementById('surrender-black').addEventListener('click', () => {
    if (gameOver) return;
    if (currentPlayer !== 'black') {
      new NoticeJs({
        text: '不是你的回合，不能认输！',
        position: 'topCenter',
        animation: {
          open: 'animate__animated animate__bounceInRight',
          close: 'animate__animated animate__bounceOutLeft'
        }
      }).show();
      return;
    }
    
    handleSurrender('black');
  });

  const drawBtn = document.getElementById('draw-button');
  if (drawBtn) {
    drawBtn.addEventListener('click', handleDraw);
  }

  const rulesBtn = document.getElementById('rules-btn');
  const rulesModal = document.getElementById('rules-modal');
  const rulesModalClose = document.getElementById('rules-modal-close');
  const rulesContent = document.getElementById('rules-content');

  if (rulesBtn && rulesModal && rulesModalClose && rulesContent) {
    rulesBtn.addEventListener('click', () => {
      rulesModal.classList.remove('hidden');
      // 直接在这里添加规则内容，而不是通过fetch加载
      rulesContent.innerHTML = marked.parse(`
**一、开局与“?”棋子：**

1、除“帅/将”以外的所有棋子最初都以“?”的形式出现，并且根据它在初始布局对应的棋子类型来移动（例如对应“车”则按车的走法、对应“马”则按马的走法等）。

2、若“?”移动到空位，或“?”主动吃掉了任何已翻开的棋子或另一个“?”，在这一步操作完成后，“?”都会立刻翻面，显露其真正的兵种与阵营（红/黑），之后该“?”将按自己真实身份的规则来继续走子或吃子。

**二、已翻面棋子的移动与进攻规则：**

1、**车** (車/俥)：沿横或竖方向走，中途不许有其他棋子阻挡。

2、**马** (馬/傌)：走“日”字形，移动前需要检查“马脚”位置是否被其他棋子占用，若被占用则无法跳过去。

3、**兵/卒：**

3.1 自己阵营内时，只能向前走一格；

3.2 过了“楚河 - 汉界”后，可以选择向前或向左右各走一格。

4、**象 (相/象)：**

4.1 基本规则：只能“一飞”走两步对角（总共走 2 格直、2 格横组成的对角），中途若有棋子阻挡则不能飞。

4.2 扩展规则：在暗棋中，象可以过河，但仍须遵守“飞象”步法和“象眼”不可被堵的限制。

5、**士 (仕/士)：**

5.1 基本规则：只能在己方九宫(3×3 区域)内斜着走一步，对角移动；

5.2 扩展规则：由于暗棋中可能将士/仕随机出现于更广区域，现在士/仕可在全地图走，但每次移动仍必须是“一步对角”，不能纵横直走。

**三、“悔棋”功能与可点击条件：**

1、每次走子或吃子后，若满足以下条件，才会记录本次动作为“可撤销”的一步：

1.1 移动/攻击一方的棋子已经翻面（revealed），且目标格的棋子（如果有）也已经翻面。

1.2 该棋子此前至少已进行过一次移动（即不是第一步就想悔）。

1.3 游戏尚未结束（没有任何一方的“帅/将”被吃掉）。

2、在界面上，“红方悔棋”或“黑方悔棋”按钮只有在“对手刚刚走了一步且该步满足上面记录条件”并且“当前对局未结束”时才会变为可点状态；否则按钮会置灰不可点。

3、当符合条件时，点击“悔棋”会将对手的上一步完全还原，包括棋盘状态、被吃掉的棋子、双方的步数统计等，随后切换回由被悔棋方继续下子。
    `);
    });

    rulesModalClose.addEventListener('click', () => {
      rulesModal.classList.add('hidden');
    });
  }
});

// ================== 主要逻辑 ===================

// 初始化游戏
function initGame() {
  redMoveCount = 0;
  blackMoveCount = 0;
  gameOver = false;
  lastUndoableMove = null;

  const combinedHiddenPieces = shuffleArray([...redPieces, ...blackPieces]);
  let combinedIndex = 0;

  const initialBoard = Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => {
      if (r === 0 && c === 4) {
        return { piece: "將", color: "black", revealed: true };
      }
      if (r === 9 && c === 4) {
        return { piece: "帥", color: "red", revealed: true };
      }

      const key = `${r},${c}`;
      if (standardLayout[key]) {
        const stdPiece = standardLayout[key];
        if (isBlackPiece(stdPiece) && stdPiece !== "將") {
          const actualHiddenPiece = combinedHiddenPieces[combinedIndex++];
          return {
            piece: "?",
            color: "black",
            revealed: false,
            hiddenPiece: actualHiddenPiece,
            originalPiece: stdPiece,
          };
        }
        if (isRedPiece(stdPiece) && stdPiece !== "帥") {
          const actualHiddenPiece = combinedHiddenPieces[combinedIndex++];
          return {
            piece: "?",
            color: "red",
            revealed: false,
            hiddenPiece: actualHiddenPiece,
            originalPiece: stdPiece,
          };
        }
      }
      return null;
    })
  );

  board = initialBoard;
  currentPlayer = "red";
  selected = null;
  redEliminated = [];
  blackEliminated = [];
  lastCaptured = null;
}

// 打乱数组
function shuffleArray(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// 判断是否为红方棋子（单纯从字符看）
function isRedPiece(piece) {
  // 帅、仕、相、馬、車、炮、兵
  return ["帥", "仕", "相", "馬", "車", "炮", "兵"].includes(piece);
}

// 判断是否为黑方棋子（单纯从字符看）
function isBlackPiece(piece) {
  // 將、士、象、傌、俥、砲、卒
  return ["將", "士", "象", "傌", "俥", "砲", "卒"].includes(piece);
}

// 将红黑的汉字棋子映射成一个简写，用于后面统一走法判断
function getCommonType(ch) {
  if (ch === "車" || ch === "俥") return "R"; // 车/俥
  if (ch === "馬" || ch === "傌") return "N"; // 马/傌
  if (ch === "相" || ch === "象") return "B"; // 相/象
  if (ch === "仕" || ch === "士") return "A"; // 仕/士
  if (ch === "帥" || ch === "將") return "K"; // 帅/将
  if (ch === "炮" || ch === "砲") return "C"; // 炮/砲
  if (ch === "兵" || ch === "卒") return "P"; // 兵/卒
  return "?";
}

// 渲染页面
function render() {
  const currentPlayerEl = document.getElementById('current-player');
  currentPlayerEl.className = currentPlayer === "red" ? "text-red-600" : "text-black";
  currentPlayerEl.textContent = currentPlayer === "red" ? "红" : "黑";

  // 更新悔棋按钮状态
  let redUndoEnabled = false;
  let blackUndoEnabled = false;
  if (!gameOver) {
    if (currentPlayer === "red" && lastUndoableMove && lastUndoableMove.player !== "red") {
      redUndoEnabled = true;
    }
    if (currentPlayer === "black" && lastUndoableMove && lastUndoableMove.player !== "black") {
      blackUndoEnabled = true;
    }
  }
  const enabledClass = "bg-blue-500 hover:bg-blue-600 cursor-pointer";
  const disabledClass = "bg-gray-400 cursor-not-allowed";

  const undoBlackBtn = document.getElementById('undo-black');
  const undoRedBtn = document.getElementById('undo-red');
  
  undoBlackBtn.className = `text-white px-4 py-2 rounded ${blackUndoEnabled ? enabledClass : disabledClass}`;
  undoRedBtn.className = `text-white px-4 py-2 rounded ${redUndoEnabled ? enabledClass : disabledClass}`;
  
  if (blackUndoEnabled) {
    undoBlackBtn.onclick = () => {
      chessClack.play();  // 点击悔棋按钮时播放音效
      takeBackSound.play();
      handleUndo('black');
    };
    undoBlackBtn.removeAttribute('disabled');
  } else {
    undoBlackBtn.onclick = null;
    undoBlackBtn.setAttribute('disabled', '');
  }
  
  if (redUndoEnabled) {
    undoRedBtn.onclick = () => {
      chessClack.play();
      takeBackSound.play();
      handleUndo('red');
    };
    undoRedBtn.removeAttribute('disabled');
  } else {
    undoRedBtn.onclick = null;
    undoRedBtn.setAttribute('disabled', '');
  }

  // 渲染棋盘
  let boardHtml = '';
  const drawRows = COLS;  // 9
  const drawCols = ROWS;  // 10

  for (let newR = 0; newR < drawRows; newR++) {
    boardHtml += `<div class="flex">`;
    for (let newC = 0; newC < drawCols; newC++) {
      if (newC === 5) {
        boardHtml += `<div class="border-l-2 border-dotted border-gray-600 h-10 mx-1"></div>`;
      }

      const oldR = (ROWS - 1) - newC;
      const oldC = newR;

      const cell = board[oldR][oldC];
      const isSelected = selected && selected.r === oldR && selected.c === oldC;
      let pieceDisplay = "";
      let pieceColorClass = "";

      if (cell && cell.piece) {
        pieceDisplay = cell.piece;
        pieceColorClass = cell.color === "red" ? "text-red-600" : "text-black";
      }

      const bgClass = isSelected ? "bg-yellow-300" : "bg-white";

      // 给 <span> 加个唯一的 data 标识，用于动画时获取 DOM
      // 这里以 data-pos="r${oldR}-c${oldC}" 来标识
      boardHtml += `
        <div
          class="w-10 h-10 m-0.5 flex items-center justify-center border border-gray-400 text-xl cursor-pointer select-none ${bgClass}"
          onclick="handleCellClick(${oldR}, ${oldC})"
          style="position: relative;"
        >
          <span class="${pieceColorClass}" data-pos="r${oldR}-c${oldC}">${pieceDisplay || ""}</span>
        </div>
      `;
    }
    boardHtml += `</div>`;
  }
  document.getElementById('chess-board').innerHTML = boardHtml;

  // 更新最近被吃掉的棋子
  const lastCapturedEl = document.getElementById('last-captured');
  if (lastCaptured) {
    lastCapturedEl.className = lastCaptured.color === "red" ? "text-red-600" : "text-black";
    lastCapturedEl.textContent = `${lastCaptured.color === "red" ? "红" : "黑"}${lastCaptured.piece}`;
  } else {
    lastCapturedEl.textContent = "无";
  }

  // 更新淘汰的棋子
  document.getElementById('red-eliminated').innerHTML = redEliminated.map(p => 
    `<span class="mx-0.5 text-red-600">${p}</span>`
  ).join('');
  
  document.getElementById('black-eliminated').innerHTML = blackEliminated.map(p => 
    `<span class="mx-0.5">${p}</span>`
  ).join('');
}

// 点击棋盘时触发
function handleCellClick(r, c) {
  // 新增：若游戏结束，不允许走子
  if (gameOver) return;

  const cell = board[r][c];

  // 1. 如果没有选中任何棋子
  if (!selected) {
    // 无棋子或不是当前回合的颜色，则忽略
    if (!cell || cell.color !== currentPlayer) return;
    // 选中此格
    selected = { r, c };
    render();
    return;
  }

  // 2. 已选中的情况下，再点同一格 -> 取消选中
  if (selected.r === r && selected.c === c) {
    selected = null;
    render();
    return;
  }

  // 3. 判断能否移动/吃子
  if (canMove(selected, { r, c })) {
    // 在正式走子前检查是否造成“对脸将”
    const fromCell = board[selected.r][selected.c];
    if (getCommonType(fromCell.piece) === "K") {
      if (wouldKingsFaceIfMoved(selected, { r, c })) {
        new NoticeJs({
          text: '对脸将，不可移动！请进行其他移动或认输/求和',
          position: 'topCenter',
          animation: {
            open: 'animate__animated animate__bounceInRight',
            close: 'animate__animated animate__bounceOutLeft'
          },
          callbacks: {
            // 增加弹跳暂停效果
            onShow: [function() {
              setTimeout(() => {
                this.element.classList.remove('animate__bounceInRight');
                this.element.classList.add('animate__bounce');
                
                // 1秒后开始退出动画
                setTimeout(() => {
                  this.element.classList.remove('animate__bounce');
                  this.element.classList.add('animate__bounceOutLeft');
                  
                  // 确保动画完成后移除元素
                  setTimeout(() => {
                    if (this.element && this.element.parentNode) {
                      this.element.parentNode.removeChild(this.element);
                    }
                  }, 750);
                }, 1000);
              }, 750); // 等待入场动画完成
            }]
          }
        }).show();
        selected = null;
        render();
        return;
      }
    }
    movePiece(selected, { r, c });
  }

  // 无论是否能成功移动，都取消选中
  selected = null;
  render();
}

// 规则判断：是否能移动/吃子
function canMove(from, to) {
  const fromCell = board[from.r][from.c];
  const toCell = board[to.r][to.c];

  // 若目标位置有子，先判断是否同色
  if (toCell) {
    let targetRealColor = toCell.color;
    if (!toCell.revealed && toCell.piece === "?") {
      const fromRealColor = getRealColor(fromCell);
      targetRealColor = fromRealColor === "red" ? "black" : "red";
    }
    if (targetRealColor === getRealColor(fromCell)) {
      return false;
    }
  }

  if (toCell && toCell.color === fromCell.color && toCell.piece !== "?") {
    return false;
  }

  if (from.r === to.r && from.c === to.c) {
    return false;
  }

  const pieceType = fromCell.revealed
    ? fromCell.piece
    : fromCell.originalPiece;
  const color = getRealColor(fromCell);

  return isValidMove(from, to, pieceType, color);
}

// 获取真实的颜色（因为有些 "?" 是黑方位置但翻开后可能是红方）
function getRealColor(cell) {
  if (!cell.revealed && cell.piece === "?") {
    return cell.color;
  }
  return isRedPiece(cell.piece) ? "red" : "black";
}

// 判断是否符合该棋子走法
function isValidMove(from, to, pieceType, color) {
  const r1 = from.r, c1 = from.c;
  const r2 = to.r, c2 = to.c;
  const typeKey = getCommonType(pieceType); // R/N/B/A/K/C/P

  switch (typeKey) {
    case "R": return canMoveRook(r1, c1, r2, c2);
    case "N": return canMoveKnight(r1, c1, r2, c2);
    case "B": return canMoveElephant(r1, c1, r2, c2);
    case "A":
      return canMoveAdvisorOrHidden(r1, c1, r2, c2, pieceType, color);
    case "K": return canMoveKing(r1, c1, r2, c2, color);
    case "C": return canMoveCannon(r1, c1, r2, c2);
    case "P": return canMovePawn(r1, c1, r2, c2, color);
    default:  return false;
  }
}

// 车
function canMoveRook(r1, c1, r2, c2) {
  if (r1 !== r2 && c1 !== c2) return false;
  if (r1 === r2) {
    const start = Math.min(c1, c2) + 1;
    const end = Math.max(c1, c2) - 1;
    for (let cc = start; cc <= end; cc++) {
      if (board[r1][cc] !== null) return false;
    }
  } else {
    const start = Math.min(r1, r2) + 1;
    const end = Math.max(r1, r2) - 1;
    for (let rr = start; rr <= end; rr++) {
      if (board[rr][c1] !== null) return false;
    }
  }
  return true;
}

// 马
function canMoveKnight(r1, c1, r2, c2) {
  const dr = r2 - r1;
  const dc = c2 - c1;
  if (!((Math.abs(dr) === 2 && Math.abs(dc) === 1) || (Math.abs(dr) === 1 && Math.abs(dc) === 2))) {
    return false;
  }
  if (Math.abs(dr) === 2) {
    const blockR = r1 + dr / 2;
    if (board[blockR][c1]) return false;
  } else {
    const blockC = c1 + dc / 2;
    if (board[r1][blockC]) return false;
  }
  return true;
}

// 象/相
function canMoveElephant(r1, c1, r2, c2) {
  if (Math.abs(r2 - r1) !== 2 || Math.abs(c2 - c1) !== 2) return false;
  const mr = (r1 + r2) / 2;
  const mc = (c1 + c2) / 2;
  if (board[mr][mc]) return false;
  return true;
}

// 仕/士（含暗子未翻面的情况）
function canMoveAdvisorOrHidden(r1, c1, r2, c2, pieceType, color) {
  // 若已经翻面，暗棋规则：士/仕 可以全场走对角1步
  // 若还没翻面，但 originalPiece 是 "士"/"仕"，则只能在九宫斜着走
  const fromCell = board[r1][c1];
  if (!fromCell.revealed && (fromCell.originalPiece === "士" || fromCell.originalPiece === "仕")) {
    // 走传统九宫对角
    return canMoveHiddenAdvisor(r1, c1, r2, c2, color);
  } else {
    // 已翻面 or originalPiece不是士/仕 -> 全场对角走1格
    if (Math.abs(r1 - r2) === 1 && Math.abs(c1 - c2) === 1) {
      return true;
    }
    return false;
  }
}

// 未翻面的士/仕：只能在各自九宫内斜着走1步
function canMoveHiddenAdvisor(r1, c1, r2, c2, color) {
  if (!(Math.abs(r1 - r2) === 1 && Math.abs(c1 - c2) === 1)) {
    return false;
  }
  if (color === "black") {
    if (r2 < 0 || r2 > 2 || c2 < 3 || c2 > 5) return false;
  } else {
    if (r2 < 7 || r2 > 9 || c2 < 3 || c2 > 5) return false;
  }
  return true;
}

// 将/帅
function canMoveKing(r1, c1, r2, c2, color) {
  const dr = Math.abs(r2 - r1);
  const dc = Math.abs(c2 - c1);
  if (dr + dc !== 1) return false;

  if (color === "black") {
    if (r2 < 0 || r2 > 2 || c2 < 3 || c2 > 5) return false;
  } else {
    if (r2 < 7 || r2 > 9 || c2 < 3 || c2 > 5) return false;
  }
  return true;
}

// 炮
function canMoveCannon(r1, c1, r2, c2) {
  if (r1 !== r2 && c1 !== c2) return false;
  let countBlock = 0;
  if (r1 === r2) {
    const start = Math.min(c1, c2) + 1;
    const end = Math.max(c1, c2) - 1;
    for (let cc = start; cc <= end; cc++) {
      if (board[r1][cc] !== null) countBlock++;
    }
  } else {
    const start = Math.min(r1, r2) + 1;
    const end = Math.max(r1, r2) - 1;
    for (let rr = start; rr <= end; rr++) {
      if (board[rr][c1] !== null) countBlock++;
    }
  }
  const targetCell = board[r2][c2];
  if (!targetCell) {
    return countBlock === 0;
  } else {
    return countBlock === 1;
  }
}

// 兵/卒
function canMovePawn(r1, c1, r2, c2, color) {
  const dr = r2 - r1;
  const dc = c2 - c1;
  const blackHasCrossed = (r1 >= 5);
  const redHasCrossed = (r1 <= 4);

  if (color === "black") {
    if (!blackHasCrossed) {
      if (dr !== 1 || dc !== 0) return false;
    } else {
      if (!((dr === 1 && dc === 0) || (dr === 0 && Math.abs(dc) === 1))) {
        return false;
      }
    }
  } else {
    if (!redHasCrossed) {
      if (dr !== -1 || dc !== 0) return false;
    } else {
      if (!((dr === -1 && dc === 0) || (dr === 0 && Math.abs(dc) === 1))) {
        return false;
      }
    }
  }
  return true;
}

/**
 * =============== 动画 + 移动 相关 ===============
 * 说明：
 *   movePiece(from, to) 不再立即操作 board，
 *   而是先调用 animateMove 做0.5s动画，
 *   动画结束后再 completeMove(from, to) 真正修改数据和渲染。
 */

// 统一的移动接口：先做动画，再做最终走子
function movePiece(from, to) {
  // 判断是否是 "?" 棋子
  const movingCell = board[from.r][from.c];
  const isMystery = (!movingCell.revealed && movingCell.piece === "?");
  // 非悔棋走子 -> 动画带放大
  animateMove(from, to, false, isMystery, () => {
    completeMove(from, to);
    render(); // 最终刷新
  });
}

// 真正执行走子/吃子/翻面的逻辑
function completeMove(from, to) {
  const fromCell = board[from.r][from.c];
  const toCell = board[to.r][to.c];

  let undoPossible = true;
  if (!fromCell.revealed) undoPossible = false;
  if (toCell && !toCell.revealed) undoPossible = false;

  const redCountBefore = redMoveCount;
  const blackCountBefore = blackMoveCount;
  const moveCountBefore = (fromCell.color === "red" ? redCountBefore : blackCountBefore);
  if (moveCountBefore === 0) {
    undoPossible = false;
  }

  let captured = null;
  if (toCell) {
    let eatenPiece = toCell.piece;
    let eatenColor = toCell.color;
    if (!toCell.revealed && eatenPiece === "?") {
      eatenPiece = toCell.hiddenPiece;
      eatenColor = isRedPiece(eatenPiece) ? "red" : "black";
    }
    if (eatenColor === "red") {
      redEliminated.push(eatenPiece);
    } else {
      blackEliminated.push(eatenPiece);
    }
    captured = { color: eatenColor, piece: eatenPiece };

    // 检查是否吃掉了将/帅
    if (eatenPiece === "帥" || eatenPiece === "將") {
      gameOver = true;
      setTimeout(() => {
        let applause = new Audio("media/clap.wav");
        
        // 将音频从第1秒开始播放
        applause.currentTime = 1;
        applause.play();

        const confettiDuration = 7000;
        const end = Date.now() + confettiDuration;
        const confettiInterval = setInterval(() => {
          if (Date.now() > end) {
            clearInterval(confettiInterval);
          } else {
            confetti({
              particleCount: 40,
              startVelocity: 40,
              spread: 50,
              origin: {
                x: Math.random() < 0.5 ? 0 : 1,
                y: 0.6
              }
            });
          }
        }, 300);

        // 新增一个定时器，让音频在第7秒时停止
        setTimeout(() => {
          applause.pause();
          applause.currentTime = 0;
        }, 6000); // 从 currentTime=1 播到第7秒刚好 6 秒

        swal({
          title: `${eatenPiece === "帥" ? "黑" : "红"}方胜利！`,
          text: "游戏结束！",
          buttons: {
            confirm: {
              text: "确认",
              value: "confirm",
              className: "swal-button--confirm"
            },
            restart: {
              text: "再来一局",
              value: "restart",
              className: "swal-button--restart"
            }
          },
          closeOnClickOutside: false,
        }).then((value) => {
          if (value === "restart") {
            window.location.reload();
          }
        });
      }, 100);
    }
  }

  // 若移动的还是暗子，移动结束后才翻开
  if (!fromCell.revealed && fromCell.piece === "?") {
    const actualPiece = fromCell.hiddenPiece;
    fromCell.piece = actualPiece;
    fromCell.color = isRedPiece(actualPiece) ? "red" : "black";
    fromCell.revealed = true;
  }

  // 完成移动
  board[to.r][to.c] = { ...fromCell };
  board[from.r][from.c] = null;
  lastCaptured = captured;
  currentPlayer = (currentPlayer === "red" ? "black" : "red");
  if (fromCell.color === "red") {
    redMoveCount++;
  } else {
    blackMoveCount++;
  }

  if (undoPossible && !gameOver) {
    lastUndoableMove = {
      player: fromCell.color,
      from: { ...from },
      to: { ...to },
      movingPiece: { ...fromCell },
      targetPiece: toCell ? { ...toCell } : null,
      previousLastCaptured: lastCaptured,
      redMoveCountSnapshot: redCountBefore,
      blackMoveCountSnapshot: blackCountBefore,
    };
  } else {
    lastUndoableMove = null;
  }

  // 在棋子动画(0.5s)结束后播放音效，听到落子声，更显真实
  setTimeout(() => {
    chessClack.play();
  }, 0);

  if (captured) {
    eatSound.play();
  }
}

/**
 * =============== 动画核心 ===============
 * @param {Object} from 起点坐标 {r, c}
 * @param {Object} to   终点坐标 {r, c}
 * @param {Boolean} isUndo 是否是悔棋动画
 * @param {Boolean} isMystery 是否是 "?" 棋子
 * @param {Function} callback 动画结束后回调
 *
 * 逻辑：
 *   1. 找到页面上 data-pos="rX-cY" 的 <span> 元素
 *   2. 用 absolute + transform 做动画
 *   3. 动画时间 0.5s，若非悔棋则放大 1.2 倍；悔棋则不放大
 *   4. 动画结束后回调
 */
function animateMove(from, to, isUndo, isMystery, callback) {
  const fromSelector = `span[data-pos="r${from.r}-c${from.c}"]`;
  const spanElem = document.querySelector(fromSelector);
  if (!spanElem) {
    // 若找不到 DOM，直接执行回调
    callback && callback();
    return;
  }

  // 给 body 插入一段简易的动画样式(仅插入一次)
  if (!document.getElementById('chess-animation-style')) {
    const style = `
      <style id="chess-animation-style">
      .chess-anim {
        position: absolute;
        transition: transform 0.5s ease; 
        z-index: 9999; /* 保证在顶层 */
        pointer-events: none; 
      }
      </style>
    `;
    document.head.insertAdjacentHTML('beforeend', style);
  }

  // 计算起点格子与终点格子在屏幕上的位置
  // 因为 <span> 在一个 .w-10.h-10 的格子内部，需获取格子的 getBoundingClientRect
  const startRect = spanElem.getBoundingClientRect();

  // 先渲染一次，让 to 的 <div> 存在于 DOM
  //   但注意：此时 board[to.r][to.c] 里可能还没真正填入这个棋子（未 completeMove）
  //   不过该格子 <div> 肯定在，所以可以拿到它的中心位置
  const tmpRender = document.getElementById('chess-board');
  if (!tmpRender) {
    callback && callback();
    return;
  }

  // 找到目标格子的 <div> 
  //   悔棋时，起点是 to，终点是 from；所以这里要找到目标 newRect
  const toSelector = `div[onclick="handleCellClick(${to.r}, ${to.c})"]`;
  const toDiv = tmpRender.querySelector(toSelector);
  if (!toDiv) {
    // 若意外找不到目标格子，则直接回调
    callback && callback();
    return;
  }
  const endRect = toDiv.getBoundingClientRect();

  // 把 <span> 临时改成绝对定位，并放到 body 里
  const originalParent = spanElem.parentNode;
  const originalNextSibling = spanElem.nextSibling; // 记住原位置
  const pieceClone = spanElem; // 直接用同一个元素，不要复制
  const originalStyle = getComputedStyle(pieceClone);

  // 计算当前距离 body 左上角的偏移
  const bodyRect = document.body.getBoundingClientRect();
  const startX = startRect.left - bodyRect.left;
  const startY = startRect.top - bodyRect.top;

  pieceClone.classList.add('chess-anim');
  document.body.appendChild(pieceClone);
  pieceClone.style.left = startX + "px";
  pieceClone.style.top = startY + "px";

  // 若是"?"棋子，或普通棋子移动时，做 1.2 倍缩放；若是悔棋则不缩放
  const scaleFactor = (!isUndo ? 1.2 : 1.0);

  // 强制刷新一次位置(让浏览器识别到以上变更)
  pieceClone.getBoundingClientRect();

  // 计算目标位移
  const endX = endRect.left + endRect.width / 2 - (startRect.width / 2) - bodyRect.left;
  const endY = endRect.top + endRect.height / 2 - (startRect.height / 2) - bodyRect.top;

  // 设置 transform，从(0,0) -> (endX-startX, endY-startY)
  // 同时放大 scaleFactor
  pieceClone.style.transform = `translate(${endX - startX}px, ${endY - startY}px) scale(${scaleFactor})`;

  // 等待 0.5s 动画结束后，复位 DOM
  setTimeout(() => {
    // 把棋子还原到它原本父级（原本的 <div>）中，以便后续 render
    if (originalNextSibling) {
      originalParent.insertBefore(pieceClone, originalNextSibling);
    } else {
      originalParent.appendChild(pieceClone);
    }
    pieceClone.classList.remove('chess-anim');
    pieceClone.style.position = originalStyle.position;
    pieceClone.style.left = originalStyle.left;
    pieceClone.style.top = originalStyle.top;
    pieceClone.style.transform = originalStyle.transform;
    pieceClone.style.transition = originalStyle.transition;
    pieceClone.style.zIndex = originalStyle.zIndex;
    pieceClone.style.pointerEvents = originalStyle.pointerEvents;

    if (callback) callback();
  }, 500);
}

// 新增：判断若移动将/帅后，是否会造成“对脸将”
function wouldKingsFaceIfMoved(from, to) {
  const fromCell = board[from.r][from.c];
  const toCell = board[to.r][to.c];
  // 备份
  board[to.r][to.c] = fromCell;
  board[from.r][from.c] = null;
  const face = areGeneralsFaceToFace();
  // 还原
  board[from.r][from.c] = fromCell;
  board[to.r][to.c] = toCell;
  return face;
}

// 新增：检测棋盘上是否“面对面”
// 如果红帅和黑将同列且中间无棋子，则返回true
function areGeneralsFaceToFace() {
  let redPos = null, blackPos = null;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = board[r][c];
      if (cell && cell.piece === "帥") redPos = { r, c };
      if (cell && cell.piece === "將") blackPos = { r, c };
    }
  }
  if (!redPos || !blackPos) return false;
  if (redPos.c !== blackPos.c) return false;

  const c = redPos.c;
  const start = Math.min(redPos.r, blackPos.r) + 1;
  const end = Math.max(redPos.r, blackPos.r) - 1;
  for (let rr = start; rr <= end; rr++) {
    if (board[rr][c]) return false;
  }
  return true;
}

// =============== 撤棋逻辑 =================
function handleUndo(player) {
  if (gameOver) return;
  if (currentPlayer !== player) return;
  if (!lastUndoableMove || lastUndoableMove.player === player) return;

  // 我们先用动画移动回去，再做数据还原
  const move = lastUndoableMove;
  // 在 board 中，当前是 move.to 位置有棋子
  // 要把它飞回 move.from
  animateMove(move.to, move.from, true, false, () => {
    // 动画结束后，再还原数据
    board[move.from.r][move.from.c] = move.movingPiece;
    board[move.to.r][move.to.c] = move.targetPiece;

    if (move.targetPiece) {
      if (move.targetPiece.color === "red") {
        redEliminated.pop();
      } else {
        blackEliminated.pop();
      }
    }
    redMoveCount = move.redMoveCountSnapshot;
    blackMoveCount = move.blackMoveCountSnapshot;
    lastCaptured = move.previousLastCaptured;
    currentPlayer = move.player;
    lastUndoableMove = null;
    render();
  });
}

// 处理认输的函数
function handleSurrender(player) {
  gameOver = true;
  let applause = new Audio("media/clap.wav");
  applause.currentTime = 1;
  applause.play();

  const confettiDuration = 7000;
  const end = Date.now() + confettiDuration;
  const confettiInterval = setInterval(() => {
    if (Date.now() > end) {
      clearInterval(confettiInterval);
    } else {
      confetti({
        particleCount: 40,
        startVelocity: 40,
        spread: 50,
        origin: {
          x: Math.random() < 0.5 ? 0 : 1,
          y: 0.6
        }
      });
    }
  }, 300);

  setTimeout(() => {
    applause.pause();
    applause.currentTime = 0;
  }, 6000);

  swal({
    title: `${player === 'red' ? '黑' : '红'}方胜利！`,
    text: `${player === 'red' ? '红' : '黑'}方认输`,
    buttons: {
      confirm: {
        text: "确认",
        value: "confirm",
        className: "swal-button--confirm"
      },
      restart: {
        text: "再来一局",
        value: "restart",
        className: "swal-button--restart"
      }
    },
    closeOnClickOutside: false,
  }).then((value) => {
    if (value === "restart") {
      window.location.reload();
    }
  });
}

// 处理求和的函数
function handleDraw() {
  gameOver = true;
  let applause = new Audio("media/clap.wav");
  applause.currentTime = 1;
  applause.play();
  const confettiDuration = 7000;
  const end = Date.now() + confettiDuration;
  const confettiInterval = setInterval(() => {
    if (Date.now() > end) {
      clearInterval(confettiInterval);
    } else {
      confetti({
        particleCount: 40,
        startVelocity: 40,
        spread: 50,
        origin: { x: Math.random() < 0.5 ? 0 : 1, y: 0.6 }
      });
    }
  }, 300);
  setTimeout(() => {
    applause.pause();
    applause.currentTime = 0;
  }, 6000);

  swal({
    title: "平局！",
    text: "旗鼓相当",
    buttons: {
      confirm: {
        text: "确认",
        value: "confirm",
        className: "swal-button--confirm"
      },
      restart: {
        text: "再来一局",
        value: "restart",
        className: "swal-button--restart"
      }
    },
    closeOnClickOutside: false,
  }).then((value) => {
    if (value === "restart") {
      window.location.reload();
    }
  });
}

// =============== 启动 ================
initGame();
render();

// 以下仅用于在某些嵌入环境中与外界通信，可忽略
window.parent?.postMessage?.({ action: "ready" }, "*");
window.console = new Proxy(console, {
  get(target, prop) {
    if (["log", "warn", "error"].includes(prop)) {
      return new Proxy(target[prop], {
        apply(fn, thisArg, args) {
          fn.apply(thisArg, args);
          window.parent?.postMessage?.(
            {
              action: "console",
              type: prop,
              args: args.map((arg) => {
                try {
                  return JSON.stringify(arg).replace(/^["']|["']$/g, "");
                } catch (e) {
                  return arg;
                }
              }),
            },
            "*"
          );
        },
      });
    }
    return target[prop];
  },
});
