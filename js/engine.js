/**
 * 影翻棋规则引擎（不依赖 DOM）
 *
 * 浏览器中挂到 window.ShadowFlip；在 Node 中通过 module.exports 导出，便于测试。
 *
 * 坐标：r 为行（0 = 黑方底线，9 = 红方底线），c 为列（0–8）。
 * 兵种代号：K 帅/将  A 仕/士  B 相/象  N 马  R 车  C 炮  P 兵/卒
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.ShadowFlip = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ROWS = 10;
  const COLS = 9;
  const RED = 'red';
  const BLACK = 'black';

  const CHARS = {
    red: { K: '帥', A: '仕', B: '相', N: '馬', R: '車', C: '炮', P: '兵' },
    black: { K: '將', A: '士', B: '象', N: '傌', R: '俥', C: '砲', P: '卒' },
  };

  // 开局位置的兵种简称，用于「依开局『炮』位行棋」这类提示
  const POSITION_NAMES = {
    red: { K: '帅', A: '仕', B: '相', N: '马', R: '车', C: '炮', P: '兵' },
    black: { K: '将', A: '士', B: '象', N: '马', R: '车', C: '炮', P: '卒' },
  };

  const SIDE_NAMES = { red: '红', black: '黑' };

  const HIDDEN_CHAR = '影';

  const BACK_ROW = ['R', 'N', 'B', 'A', 'K', 'A', 'B', 'N', 'R'];

  // 每方除帅/将外的 15 子，开局时红黑混洗后随机扣置
  const POOL = ['R', 'R', 'N', 'N', 'B', 'B', 'A', 'A', 'C', 'C', 'P', 'P', 'P', 'P', 'P'];

  const NUMERALS = ['零', '一', '两', '三', '四', '五', '六', '七', '八', '九'];

  function opponent(side) {
    return side === RED ? BLACK : RED;
  }

  function inBounds(r, c) {
    return r >= 0 && r < ROWS && c >= 0 && c < COLS;
  }

  // 九宫：黑方 0–2 行，红方 7–9 行，3–5 列
  function inPalace(side, r, c) {
    if (c < 3 || c > 5) return false;
    return side === BLACK ? r >= 0 && r <= 2 : r >= 7 && r <= 9;
  }

  // 标准开局布局：[{ r, c, side, type }]
  function standardLayout() {
    const cells = [];
    BACK_ROW.forEach((type, c) => {
      cells.push({ r: 0, c, side: BLACK, type });
      cells.push({ r: 9, c, side: RED, type });
    });
    [1, 7].forEach((c) => {
      cells.push({ r: 2, c, side: BLACK, type: 'C' });
      cells.push({ r: 7, c, side: RED, type: 'C' });
    });
    [0, 2, 4, 6, 8].forEach((c) => {
      cells.push({ r: 3, c, side: BLACK, type: 'P' });
      cells.push({ r: 6, c, side: RED, type: 'P' });
    });
    return cells;
  }

  function shuffle(list, rng) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // 棋面上显示的字：暗子一律为「影」
  function pieceChar(piece) {
    return piece.revealed ? CHARS[piece.side][piece.type] : HIDDEN_CHAR;
  }

  // 暗子所在开局位置的兵种名，如「炮」「马」
  function positionName(piece) {
    return POSITION_NAMES[piece.side][piece.origin];
  }

  function snapshot(piece) {
    return {
      id: piece.id,
      side: piece.side,
      revealed: piece.revealed,
      char: pieceChar(piece),
      type: piece.revealed ? piece.type : null,
      movement: piece.revealed ? piece.type : piece.origin,
    };
  }

  /**
   * 生成一手棋的中文描述，例如「黑俥 平移两步 · 无吃子」
   */
  function describeMove(record) {
    const dr = record.to.r - record.from.r;
    const dc = record.to.c - record.from.c;
    const ahead = record.side === RED ? dr < 0 : dr > 0;
    let motion;
    if (dr === 0) {
      motion = `平移${NUMERALS[Math.abs(dc)]}步`;
    } else if (dc === 0) {
      motion = `${ahead ? '前进' : '后退'}${NUMERALS[Math.abs(dr)]}步`;
    } else if (record.before.movement === 'N') {
      motion = ahead ? '跳进' : '跳退';
    } else if (record.before.movement === 'B') {
      motion = ahead ? '飞进' : '飞退';
    } else {
      motion = ahead ? '斜进一步' : '斜退一步';
    }

    const who = record.revealed
      ? `${SIDE_NAMES[record.side]}方暗子`
      : `${SIDE_NAMES[record.side]}${record.before.char}`;
    const parts = [`${who} ${motion}`];
    if (record.revealed) {
      parts.push(`翻出${SIDE_NAMES[record.after.side]}${record.after.char}`);
    }
    if (record.taken) {
      const name = `${SIDE_NAMES[record.taken.side]}${record.taken.char}`;
      parts.push(record.taken.wasHidden ? `吃下暗子（${name}）` : `吃${name}`);
    } else if (!record.revealed) {
      parts.push('无吃子');
    }
    return parts.join(' · ');
  }

  class Game {
    /**
     * @param {{ rng?: () => number }} [options] rng 用于洗混暗子，测试时可传入固定序列
     */
    constructor(options) {
      this.rng = (options && options.rng) || Math.random;
      this.reset();
    }

    // 开新局：帅、将明摆，其余三十子红黑混洗后随机扣置
    reset() {
      const layout = standardLayout();
      const pool = shuffle(
        [
          ...POOL.map((type) => ({ side: RED, type })),
          ...POOL.map((type) => ({ side: BLACK, type })),
        ],
        this.rng
      );
      let next = 0;
      this.clear();
      layout.forEach((cell) => {
        if (cell.type === 'K') {
          this.place(cell.r, cell.c, { side: cell.side, type: 'K' });
        } else {
          const real = pool[next++];
          this.place(cell.r, cell.c, {
            side: cell.side,
            realSide: real.side,
            type: real.type,
            origin: cell.type,
            revealed: false,
          });
        }
      });
    }

    clear() {
      this.board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
      this.seq = 0;
      this.turn = RED;
      this.history = [];
      this.fallen = { red: [], black: [] };
      this.undoable = null;
      this.result = null;
    }

    /**
     * 自定义摆子（用于测试或残局）
     * @param {Array<{r:number,c:number,side:string,type:string,revealed?:boolean,realSide?:string,origin?:string,moves?:number}>} pieces
     * @param {string} [turn]
     */
    setup(pieces, turn) {
      this.clear();
      pieces.forEach((p) => this.place(p.r, p.c, p));
      this.turn = turn || RED;
    }

    place(r, c, spec) {
      const revealed = spec.revealed !== false;
      const piece = {
        id: `p${++this.seq}`,
        // 当前由哪一方调遣：暗子看漆色，翻开后为真实阵营
        side: spec.side,
        realSide: spec.realSide || spec.side,
        type: spec.type,
        origin: spec.origin || spec.type,
        revealed,
        moves: spec.moves || 0,
      };
      if (revealed) piece.side = piece.realSide;
      this.board[r][c] = piece;
      return piece;
    }

    at(r, c) {
      return inBounds(r, c) ? this.board[r][c] : null;
    }

    get ply() {
      return this.history.length;
    }

    get lastMove() {
      return this.history.length ? this.history[this.history.length - 1] : null;
    }

    // 暗子按开局位置的兵种行棋，明子按真身行棋
    movementOf(piece) {
      return piece.revealed ? piece.type : piece.origin;
    }

    // 落点能否落子：空位、暗子（身份未明，谁都可以吃）、对方明子
    canLandOn(piece, r, c) {
      const target = this.at(r, c);
      if (!target || !target.revealed) return true;
      return target.side !== piece.side;
    }

    // 几何上可达的落点（尚未检查对脸将）
    reachable(r, c) {
      const piece = this.at(r, c);
      if (!piece) return [];
      const out = [];
      const add = (tr, tc) => {
        if (inBounds(tr, tc) && this.canLandOn(piece, tr, tc)) out.push({ r: tr, c: tc });
      };
      const empty = (tr, tc) => !this.at(tr, tc);

      switch (this.movementOf(piece)) {
        case 'R':
          this.slide(r, c, piece, out, false);
          break;
        case 'C':
          this.slide(r, c, piece, out, true);
          break;
        case 'N':
          [[-2, -1], [-2, 1], [2, -1], [2, 1], [-1, -2], [1, -2], [-1, 2], [1, 2]].forEach(([dr, dc]) => {
            // 马脚：沿长边方向紧挨的一格
            const legR = Math.abs(dr) === 2 ? r + dr / 2 : r;
            const legC = Math.abs(dc) === 2 ? c + dc / 2 : c;
            if (inBounds(r + dr, c + dc) && empty(legR, legC)) add(r + dr, c + dc);
          });
          break;
        case 'B':
          // 走「田」字，象眼被堵不能飞；影翻棋中可以过河
          [[-2, -2], [-2, 2], [2, -2], [2, 2]].forEach(([dr, dc]) => {
            if (inBounds(r + dr, c + dc) && empty(r + dr / 2, c + dc / 2)) add(r + dr, c + dc);
          });
          break;
        case 'A':
          // 仕位暗子只在己方九宫内斜走；翻开后的仕/士全盘斜走一格
          [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([dr, dc]) => {
            if (piece.revealed || inPalace(piece.side, r + dr, c + dc)) add(r + dr, c + dc);
          });
          break;
        case 'K':
          [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => {
            if (inPalace(piece.side, r + dr, c + dc)) add(r + dr, c + dc);
          });
          break;
        case 'P': {
          const forward = piece.side === RED ? -1 : 1;
          const crossed = piece.side === RED ? r <= 4 : r >= 5;
          add(r + forward, c);
          if (crossed) {
            add(r, c - 1);
            add(r, c + 1);
          }
          break;
        }
        default:
          break;
      }
      return out;
    }

    // 车、炮的直线走法；炮吃子须隔一子作炮架
    slide(r, c, piece, out, cannon) {
      [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => {
        let screen = false;
        for (let tr = r + dr, tc = c + dc; inBounds(tr, tc); tr += dr, tc += dc) {
          const target = this.at(tr, tc);
          if (!screen) {
            if (!target) {
              out.push({ r: tr, c: tc });
              continue;
            }
            if (!cannon) {
              if (this.canLandOn(piece, tr, tc)) out.push({ r: tr, c: tc });
              break;
            }
            screen = true;
          } else if (target) {
            if (this.canLandOn(piece, tr, tc)) out.push({ r: tr, c: tc });
            break;
          }
        }
      });
    }

    // 帅与将同列且中间无子：对脸
    kingsFace() {
      let red = null;
      let black = null;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const p = this.board[r][c];
          if (p && p.revealed && p.type === 'K') {
            if (p.side === RED) red = { r, c };
            else black = { r, c };
          }
        }
      }
      if (!red || !black || red.c !== black.c) return false;
      for (let r = Math.min(red.r, black.r) + 1; r < Math.max(red.r, black.r); r++) {
        if (this.board[r][red.c]) return false;
      }
      return true;
    }

    wouldFace(from, to) {
      const moving = this.board[from.r][from.c];
      const target = this.board[to.r][to.c];
      this.board[to.r][to.c] = moving;
      this.board[from.r][from.c] = null;
      const face = this.kingsFace();
      this.board[from.r][from.c] = moving;
      this.board[to.r][to.c] = target;
      return face;
    }

    // 合法落点：[{ r, c, capture }]
    legalTargets(r, c) {
      return this.reachable(r, c)
        .filter((t) => !this.wouldFace({ r, c }, t))
        .map((t) => ({ r: t.r, c: t.c, capture: !!this.at(t.r, t.c) }));
    }

    /**
     * 检查一步是否可走
     * @returns {{ ok: true } | { ok: false, reason: 'over' | 'not-yours' | 'illegal' | 'facing' }}
     */
    check(from, to) {
      if (this.result) return { ok: false, reason: 'over' };
      const piece = this.at(from.r, from.c);
      if (!piece || piece.side !== this.turn) return { ok: false, reason: 'not-yours' };
      if (!this.reachable(from.r, from.c).some((t) => t.r === to.r && t.c === to.c)) {
        return { ok: false, reason: 'illegal' };
      }
      if (this.wouldFace(from, to)) return { ok: false, reason: 'facing' };
      return { ok: true };
    }

    /**
     * 走一步：落定后暗子翻面；吃下帅/将即告胜负
     * @returns {object} 本手记录
     */
    move(from, to) {
      const verdict = this.check(from, to);
      if (!verdict.ok) throw new Error(`illegal move: ${verdict.reason}`);

      const piece = this.board[from.r][from.c];
      const target = this.board[to.r][to.c];
      const side = piece.side;
      const before = snapshot(piece);

      // 悔棋条件：该子与被吃之子都已翻开，且该子此前至少走过一步
      let undoBlock = null;
      if (!piece.revealed) undoBlock = 'flipped';
      else if (target && !target.revealed) undoBlock = 'took-hidden';
      else if (piece.moves === 0) undoBlock = 'first-move';

      let taken = null;
      if (target) {
        taken = {
          char: CHARS[target.realSide][target.type],
          side: target.realSide,
          type: target.type,
          wasHidden: !target.revealed,
        };
        this.fallen[target.realSide].push(taken);
      }

      const revealed = !piece.revealed;
      if (revealed) {
        piece.revealed = true;
        piece.side = piece.realSide;
      }
      piece.moves += 1;
      this.board[to.r][to.c] = piece;
      this.board[from.r][from.c] = null;

      const record = {
        ply: this.history.length + 1,
        side,
        pieceId: piece.id,
        from: { r: from.r, c: from.c },
        to: { r: to.r, c: to.c },
        before,
        after: snapshot(piece),
        revealed,
        taken,
        target,
        undoBlock,
      };
      this.history.push(record);
      this.turn = opponent(side);

      if (target && target.type === 'K') {
        record.undoBlock = 'game-over';
        this.result = { winner: opponent(target.realSide), reason: 'king', move: record };
      }
      this.undoable = record.undoBlock ? null : record;
      return record;
    }

    // 刚走完的一方，可在对手落子前收回这一步
    canUndo(side) {
      return !this.result && !!this.undoable && this.undoable.side === side;
    }

    undo() {
      const record = this.undoable;
      if (!record || this.result) return null;
      const piece = this.board[record.to.r][record.to.c];
      this.board[record.from.r][record.from.c] = piece;
      this.board[record.to.r][record.to.c] = record.target;
      if (record.target) this.fallen[record.target.realSide].pop();
      piece.moves -= 1;
      this.history.pop();
      this.turn = record.side;
      this.undoable = null;
      return record;
    }

    // 只能在己方回合认输
    resign(side) {
      if (this.result || side !== this.turn) return null;
      this.undoable = null;
      this.result = { winner: opponent(side), reason: 'resign', loser: side };
      return this.result;
    }

    // 一方提议、另一方同意后和棋
    agreeDraw() {
      if (this.result) return null;
      this.undoable = null;
      this.result = { winner: null, reason: 'draw', proposer: this.turn };
      return this.result;
    }

    // 某方在盘上的暗子、明子数，以及阵亡之子
    stats(side) {
      let hidden = 0;
      let shown = 0;
      this.board.forEach((row) =>
        row.forEach((p) => {
          if (!p || p.side !== side) return;
          if (p.revealed) shown++;
          else hidden++;
        })
      );
      return { hidden, shown, fallen: this.fallen[side].slice() };
    }
  }

  return {
    ROWS,
    COLS,
    RED,
    BLACK,
    CHARS,
    SIDE_NAMES,
    HIDDEN_CHAR,
    Game,
    opponent,
    pieceChar,
    positionName,
    describeMove,
  };
});
