/**
 * 影翻棋 · 对局页
 *
 * 规则全部在 engine.js；这里负责把局面画到棋盘上、处理点击与键盘、
 * 播放走子动画与音效，并在胜负已分时弹出结果。
 */
(function () {
  'use strict';

  const { Game, ROWS, COLS, RED, BLACK, CHARS, SIDE_NAMES, opponent, pieceChar, positionName, describeMove } =
    window.ShadowFlip;
  const UI = window.ShadowFlipUI;
  const Sound = window.ShadowFlipAudio;

  const MOVE_MS = 320;
  const TAKE_MS = 220;
  const FLIP_MS = 210;
  const RESULT_DELAY_MS = 360;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const ms = (value) => (reduceMotion.matches ? 0 : value);
  const wait = (value) => new Promise((resolve) => setTimeout(resolve, value));

  const UNDO_BLOCKED = {
    flipped: '翻子之步，落子无悔',
    'took-hidden': '吃下暗子，落子无悔',
    'first-move': '此子初次走动，不能悔',
    'game-over': '对局已结束',
  };

  const $ = (selector, root) => (root || document).querySelector(selector);

  const els = {
    pieces: $('#board-pieces'),
    under: $('#board-marks-under'),
    over: $('#board-marks-over'),
    points: $('#board-points'),
    moveNo: $('#move-no'),
    turn: $('#turn'),
    turnText: $('#turn-text'),
    lastPiece: $('#last-move-piece'),
    lastText: $('#last-move-text'),
    drawBtn: $('#draw-btn'),
    againBtn: $('#again-btn'),
    rulesBtn: $('#rules-btn'),
    rulesDialog: $('#rules-dialog'),
    musicBtn: $('#music-btn'),
    announcer: $('#announcer'),
    sides: { red: $('.side--red'), black: $('.side--black') },
  };

  let game = new Game();
  let selected = null; // 当前选中的交叉点 { r, c }
  let targets = []; // 选中棋子的合法落点 [{ r, c, capture }]
  let busy = false; // 动画进行中，暂停接收操作
  let focus = { r: 9, c: 4 }; // 键盘焦点所在交叉点
  const pieceEls = new Map(); // 棋子 id → 元素
  const pointEls = [];

  // ===== 小工具 =====
  function pieceClass(piece) {
    return piece.revealed ? `pc pc-face pc-${piece.side}` : `pc pc-lq pc-lq-${piece.side}`;
  }

  function pieceNode(piece, extraClass) {
    const node = document.createElement('div');
    node.className = `${pieceClass(piece)}${extraClass ? ` ${extraClass}` : ''}`;
    node.textContent = piece.char || pieceChar(piece);
    node.setAttribute('aria-hidden', 'true');
    return node;
  }

  function place(node, r, c) {
    node.style.setProperty('--r', r);
    node.style.setProperty('--c', c);
  }

  function mark(kind, r, c) {
    const node = document.createElement('span');
    node.className = `mark mark--${kind}`;
    place(node, r, c);
    return node;
  }

  function pieceName(piece) {
    return piece.revealed ? `${SIDE_NAMES[piece.side]}${pieceChar(piece)}` : `${SIDE_NAMES[piece.side]}方暗子`;
  }

  function announce(text) {
    els.announcer.textContent = '';
    // 下一帧再写入，确保读屏软件读到同样的文字
    requestAnimationFrame(() => {
      els.announcer.textContent = text;
    });
  }

  const isAt = (point, r, c) => !!point && point.r === r && point.c === c;
  const targetAt = (r, c) => targets.find((t) => t.r === r && t.c === c);

  // ===== 绘制 =====
  function render() {
    renderStatus();
    renderSide(RED);
    renderSide(BLACK);
    renderPieces();
    renderMarks();
    renderPoints();
    renderLastMove();
  }

  function renderStatus() {
    const result = game.result;
    let side = game.turn;
    let text = `${SIDE_NAMES[side]}方行棋`;
    if (result) {
      side = result.winner || 'none';
      text = result.winner ? `${SIDE_NAMES[result.winner]}方胜` : '和棋';
    }
    els.moveNo.textContent = result ? `共 ${game.ply} 手` : `第 ${game.ply + 1} 手`;
    els.turn.dataset.side = side;
    els.turnText.textContent = text;
    els.drawBtn.hidden = !!result;
    els.againBtn.hidden = !result;
  }

  function sideHint(side) {
    const result = game.result;
    if (result) {
      if (!result.winner) return '握手言和';
      if (result.winner === side) return '本局获胜';
      return result.reason === 'resign' ? '已认输' : `${side === RED ? '帅' : '将'}已被吃下`;
    }
    if (game.turn !== side) return `等待${SIDE_NAMES[game.turn]}方落子`;
    if (!selected) return '请落子';

    const piece = game.at(selected.r, selected.c);
    const caps = targets.filter((t) => t.capture).length;
    const steps = targets.length - caps;
    const reach = targets.length
      ? [steps && `可走 ${steps} 处`, caps && `可吃 ${caps} 子`].filter(Boolean).join('，')
      : '无处可走';
    return piece.revealed
      ? `已选「${pieceChar(piece)}」· ${reach}`
      : `已选暗子 · 依「${positionName(piece)}」位行棋，${reach}`;
  }

  function sideNote(side) {
    if (game.result) return '对局已结束，可点「再来一局」重新开始。';
    if (game.turn === side) return '对手落子之前，才能悔自己的上一手。';
    const last = game.lastMove;
    let undo = '尚未落子';
    if (game.canUndo(side)) undo = '可收回上一手';
    else if (last) undo = UNDO_BLOCKED[last.undoBlock] || '上一手已不能再悔';
    return `${undo}；轮到${SIDE_NAMES[side]}方时方可认输。`;
  }

  function setUsable(button, usable) {
    if (usable) button.removeAttribute('aria-disabled');
    else button.setAttribute('aria-disabled', 'true');
  }

  function renderSide(side) {
    const panel = els.sides[side];
    const stats = game.stats(side);
    const active = !game.result && game.turn === side;
    panel.classList.toggle('is-active', active);

    panel.querySelectorAll('[data-hidden]').forEach((node) => (node.textContent = stats.hidden));
    panel.querySelectorAll('[data-shown]').forEach((node) => (node.textContent = stats.shown));
    $('[data-fallen-count]', panel).textContent = `${stats.fallen.length} 子`;
    $('[data-fallen-list]', panel).replaceChildren(
      ...stats.fallen.map((p) => pieceNode({ side: p.side, revealed: true, char: p.char }))
    );
    $('[data-fallen-sr]', panel).textContent = stats.fallen.length
      ? `阵亡 ${stats.fallen.length} 子：${stats.fallen.map((p) => p.char).join('、')}`
      : '尚无阵亡';

    const hint = sideHint(side);
    $('[data-hint]', panel).textContent = hint;
    $('[data-status-text]', panel).textContent = hint;
    $('[data-note]', panel).textContent = sideNote(side);

    // 窄屏状态条：选中棋子时显示该子
    const statusPc = $('[data-status-pc]', panel);
    const chosen = active && selected ? game.at(selected.r, selected.c) : null;
    statusPc.hidden = !chosen;
    if (chosen) {
      statusPc.className = `${pieceClass(chosen)} side__status-pc`;
      statusPc.textContent = pieceChar(chosen);
    }

    setUsable($('[data-action="undo"]', panel), game.canUndo(side));
    setUsable($('[data-action="resign"]', panel), active);
  }

  function renderPieces() {
    const live = new Set();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const piece = game.at(r, c);
        if (!piece) continue;
        live.add(piece.id);
        let node = pieceEls.get(piece.id);
        const entering = !node || !node.isConnected;
        if (!node) {
          node = document.createElement('div');
          pieceEls.set(piece.id, node);
        }
        node.className = `${pieceClass(piece)} board__piece${isAt(selected, r, c) ? ' is-lifted' : ''}`;
        node.textContent = pieceChar(piece);
        place(node, r, c);
        if (entering) {
          node.classList.add('is-entering');
          els.pieces.append(node);
        }
      }
    }
    pieceEls.forEach((node, id) => {
      if (!live.has(id)) node.remove();
    });
  }

  function renderMarks() {
    const under = [];
    const over = [];
    const last = game.lastMove;
    if (last) {
      under.push(mark('from', last.from.r, last.from.c), mark('to', last.to.r, last.to.c));
    }
    targets.forEach((t) => {
      if (t.capture) over.push(mark('cap', t.r, t.c));
      else under.push(mark('hint', t.r, t.c));
    });
    if (selected) over.push(mark('sel', selected.r, selected.c));
    els.under.replaceChildren(...under);
    els.over.replaceChildren(...over);
  }

  function renderPoints() {
    const last = game.lastMove;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const piece = game.at(r, c);
        const target = targetAt(r, c);
        let label = `第${r + 1}行第${c + 1}列，${piece ? pieceName(piece) : '空'}`;
        if (isAt(selected, r, c)) label += '，已选中';
        else if (target) label += target.capture ? '，可吃' : '，可走';
        if (last && isAt(last.to, r, c)) label += '，上一手落点';

        const point = pointEls[r][c];
        point.setAttribute('aria-label', label);
        point.tabIndex = isAt(focus, r, c) ? 0 : -1;
        point.classList.toggle('is-actionable', !game.result && (!!target || (!!piece && piece.side === game.turn)));
      }
    }
  }

  function renderLastMove() {
    const last = game.lastMove;
    els.lastPiece.hidden = !last;
    if (!last) {
      els.lastText.textContent = '尚未落子 · 红方先行';
      return;
    }
    els.lastPiece.className = `${pieceClass(last.after)} lastmove__pc`;
    els.lastPiece.textContent = last.after.char;
    els.lastText.textContent = describeMove(last);
  }

  // ===== 走子 =====
  function select(point) {
    selected = point;
    targets = point ? game.legalTargets(point.r, point.c) : [];
  }

  function onPoint(r, c) {
    focus = { r, c };
    if (busy || game.result) {
      render();
      return;
    }
    const piece = game.at(r, c);

    if (selected) {
      if (isAt(selected, r, c)) {
        select(null);
        render();
        return;
      }
      const verdict = game.check(selected, { r, c });
      if (verdict.ok) {
        playMove(selected, { r, c });
        return;
      }
      if (verdict.reason === 'facing') {
        UI.toast('对脸将，不可移动。请换一步，或认输、求和。', { seal: '禁', tone: 'cinnabar', urgent: true });
        render();
        return;
      }
    }

    if (piece && piece.side === game.turn) {
      select({ r, c });
      Sound.play('choose');
    } else {
      if (piece && !selected) UI.toast(`现在轮到${SIDE_NAMES[game.turn]}方行棋。`);
      select(null);
    }
    render();
  }

  async function flip(node, piece) {
    const paint = () => {
      node.className = `${pieceClass(piece)} board__piece`;
      node.textContent = pieceChar(piece);
    };
    if (reduceMotion.matches || typeof node.animate !== 'function') {
      paint();
      return;
    }
    const half = { duration: FLIP_MS, fill: 'forwards' };
    const first = node.animate(
      [{ transform: 'perspective(400px) rotateY(0deg)' }, { transform: 'perspective(400px) rotateY(90deg)' }],
      Object.assign({ easing: 'ease-in' }, half)
    );
    await first.finished;
    paint();
    const second = node.animate(
      [{ transform: 'perspective(400px) rotateY(-90deg)' }, { transform: 'perspective(400px) rotateY(0deg)' }],
      Object.assign({ easing: 'ease-out' }, half)
    );
    first.cancel();
    await second.finished;
    second.cancel();
  }

  async function playMove(from, to) {
    busy = true;
    const mover = game.at(from.r, from.c);
    const target = game.at(to.r, to.c);
    const node = pieceEls.get(mover.id);

    select(null);
    els.over.replaceChildren();
    node.classList.remove('is-lifted');
    node.classList.add('is-flying');
    place(node, to.r, to.c);
    await wait(ms(MOVE_MS));

    const record = game.move(from, to);
    node.classList.remove('is-flying');
    Sound.play('clack');

    const jobs = [];
    if (target) {
      Sound.play('eat');
      const taken = pieceEls.get(target.id);
      if (taken) {
        taken.classList.add('is-taken');
        jobs.push(wait(ms(TAKE_MS)));
      }
    }
    if (record.revealed) jobs.push(flip(node, mover));
    await Promise.all(jobs);

    busy = false;
    render();
    if (game.result) finish();
  }

  async function playUndo(side) {
    busy = true;
    const record = game.undoable;
    const node = pieceEls.get(record.pieceId);

    select(null);
    els.over.replaceChildren();
    Sound.play('clack');
    Sound.play('takeBack');
    node.classList.add('is-returning');
    place(node, record.from.r, record.from.c);
    await wait(ms(MOVE_MS));

    game.undo();
    node.classList.remove('is-returning');
    busy = false;
    render();
    announce(`${SIDE_NAMES[side]}方悔棋，收回上一手`);
  }

  // ===== 悔棋、认输、求和 =====
  function onUndo(side) {
    if (busy) return;
    if (game.canUndo(side)) {
      playUndo(side);
      return;
    }
    let text;
    if (game.result) text = '对局已结束。';
    else if (game.turn === side) text = '只有刚走完的一方，才能在对手落子前悔棋。';
    else if (!game.lastMove) text = `${SIDE_NAMES[side]}方还没有落子。`;
    else text = `${UNDO_BLOCKED[game.lastMove.undoBlock] || '上一手已不能再悔'}。`;
    UI.toast(text, { seal: '禁', tone: 'cinnabar' });
  }

  async function onResign(side) {
    if (busy) return;
    if (game.result) {
      UI.toast('对局已结束。');
      return;
    }
    if (game.turn !== side) {
      UI.toast(`还没轮到${SIDE_NAMES[side]}方，暂不能认输。`);
      return;
    }
    const sure = await UI.ask({
      mark: UI.icon('flag'),
      title: `${SIDE_NAMES[side]}方认输？`,
      text: `认输后${SIDE_NAMES[opponent(side)]}方获胜，本局结束。`,
      cancel: '再想想',
      confirm: '确认认输',
    });
    if (sure && game.resign(side)) {
      select(null);
      render();
      finish();
    }
  }

  async function onDraw() {
    if (busy || game.result) return;
    const proposer = game.turn;
    const answerer = opponent(proposer);
    const agreed = await UI.ask({
      mark: UI.seal('和', 'ink', 'seal--round'),
      title: `${SIDE_NAMES[proposer]}方提议和棋`,
      text: `请${SIDE_NAMES[answerer]}方作答：同意则本局以和棋收场。`,
      cancel: '拒绝',
      confirm: '同意和棋',
      confirmClass: 'btn--ink',
    });
    if (!agreed) {
      UI.toast(`${SIDE_NAMES[answerer]}方拒绝和棋，对局继续。`);
      return;
    }
    if (game.agreeDraw()) {
      select(null);
      render();
      finish();
    }
  }

  // ===== 终局 =====
  function resultOptions() {
    const result = game.result;
    if (!result.winner) {
      return { tone: 'draw', seal: '和棋', title: '和棋', text: '双方议和，对局结束。' };
    }
    const winner = result.winner;
    const loser = opponent(winner);
    const options = { tone: winner, seal: `${SIDE_NAMES[winner]}胜`, title: `${SIDE_NAMES[winner]}方胜` };
    if (result.reason === 'resign') {
      options.text = `${SIDE_NAMES[loser]}方认输，对局结束。`;
    } else {
      options.text = `${SIDE_NAMES[loser]}${loser === RED ? '帅' : '将'}已被吃下，对局结束。`;
      options.move = {
        from: pieceNode(result.move.after),
        to: pieceNode({ side: loser, revealed: true, char: CHARS[loser].K }),
      };
    }
    return options;
  }

  function finish() {
    Sound.play('clap', { from: 1, until: 6 });
    const options = Object.assign(resultOptions(), { onReplay: restart });
    setTimeout(() => UI.showResult(options), ms(RESULT_DELAY_MS));
  }

  function restart() {
    Sound.stop('clap');
    game = new Game();
    select(null);
    pieceEls.forEach((node) => node.remove());
    pieceEls.clear();
    render();
    Sound.play('start');
    announce('新的一局，红方先行');
  }

  // ===== 键盘 =====
  function onBoardKey(event) {
    const step = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[event.key];
    if (step) {
      event.preventDefault();
      focus = {
        r: Math.min(ROWS - 1, Math.max(0, focus.r + step[0])),
        c: Math.min(COLS - 1, Math.max(0, focus.c + step[1])),
      };
      renderPoints();
      pointEls[focus.r][focus.c].focus();
    } else if (event.key === 'Escape' && selected) {
      event.preventDefault();
      select(null);
      render();
    }
  }

  // ===== 初始化 =====
  function buildPoints() {
    for (let r = 0; r < ROWS; r++) {
      pointEls[r] = [];
      for (let c = 0; c < COLS; c++) {
        const point = document.createElement('button');
        point.type = 'button';
        point.className = 'point';
        point.dataset.r = r;
        point.dataset.c = c;
        place(point, r, c);
        els.points.append(point);
        pointEls[r][c] = point;
      }
    }
    els.points.addEventListener('click', (event) => {
      const point = event.target.closest('.point');
      if (point) onPoint(Number(point.dataset.r), Number(point.dataset.c));
    });
    els.points.addEventListener('keydown', onBoardKey);
  }

  function init() {
    buildPoints();
    Object.entries(els.sides).forEach(([side, panel]) => {
      $('[data-action="undo"]', panel).addEventListener('click', () => onUndo(side));
      $('[data-action="resign"]', panel).addEventListener('click', () => onResign(side));
    });
    els.drawBtn.addEventListener('click', onDraw);
    els.againBtn.addEventListener('click', restart);
    els.rulesBtn.addEventListener('click', () => UI.openModal(els.rulesDialog));
    UI.initTabs($('[role="tablist"]', els.rulesDialog));
    Sound.bindMusicToggle(els.musicBtn);

    render();
    Sound.play('start');
    Sound.startMusic();
  }

  init();
})();
