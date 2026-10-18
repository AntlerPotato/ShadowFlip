'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, RED, BLACK, describeMove } = require('../js/engine.js');

// 固定随机序列，保证开局可复现
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

const key = (t) => `${t.r},${t.c}`;
const targets = (game, r, c) => game.legalTargets(r, c).map(key).sort();

test('开局：帅将明摆，其余三十子红黑混洗后扣置', () => {
  const game = new Game({ rng: seeded(7) });
  const pieces = game.board.flat().filter(Boolean);
  assert.equal(pieces.length, 32);

  assert.deepEqual(
    { char: game.at(0, 4).type, side: game.at(0, 4).side, revealed: game.at(0, 4).revealed },
    { char: 'K', side: BLACK, revealed: true }
  );
  assert.equal(game.at(9, 4).side, RED);

  const hidden = pieces.filter((p) => !p.revealed);
  assert.equal(hidden.length, 30);
  // 漆色看开局位置：红方位置为朱漆，黑方位置为黑漆
  assert.equal(hidden.filter((p) => p.side === RED).length, 15);
  // 真身红黑各 15 子，兵种齐全
  const realTypes = (side) => hidden.filter((p) => p.realSide === side).map((p) => p.type).sort().join('');
  assert.equal(realTypes(RED), 'AABBCCNNPPPPPRR');
  assert.equal(realTypes(BLACK), 'AABBCCNNPPPPPRR');
  assert.equal(game.turn, RED);
});

test('暗子按开局位置的兵种行棋', () => {
  const game = new Game({ rng: seeded(1) });
  // 马位：走「日」
  assert.deepEqual(targets(game, 9, 1), ['7,0', '7,2']);
  // 车位：相邻暗子身份未明，即便漆色相同也可以吃
  assert.deepEqual(targets(game, 9, 0), ['6,0', '7,0', '8,0', '9,1']);
  // 炮位：隔子打炮
  const cannon = targets(game, 7, 1);
  assert.equal(cannon.length, 12);
  assert.ok(cannon.includes('0,1'), '隔着黑方炮位可打到底线');
  assert.ok(!cannon.includes('2,1'), '紧邻的炮架不能直接吃');
  // 仕位暗子只在九宫内斜走
  assert.deepEqual(targets(game, 9, 3), ['8,4']);
});

test('暗子落定后翻面，按真身归属阵营', () => {
  const game = new Game({ rng: seeded(3) });
  const piece = game.at(9, 1);
  const record = game.move({ r: 9, c: 1 }, { r: 7, c: 2 });
  assert.equal(record.revealed, true);
  assert.equal(piece.revealed, true);
  assert.equal(piece.side, piece.realSide);
  assert.equal(game.turn, BLACK);
  assert.equal(game.ply, 1);
  assert.equal(game.undoable, null, '翻子之步，落子无悔');
  assert.equal(record.undoBlock, 'flipped');
});

test('吃下暗子：按真身记入阵亡', () => {
  const game = new Game();
  game.setup([
    { r: 9, c: 4, side: RED, type: 'K' },
    { r: 0, c: 3, side: BLACK, type: 'K' },
    { r: 5, c: 0, side: RED, type: 'R', moves: 2 },
    { r: 3, c: 0, side: RED, realSide: BLACK, type: 'P', origin: 'P', revealed: false },
  ]);
  const record = game.move({ r: 5, c: 0 }, { r: 3, c: 0 });
  assert.deepEqual(record.taken, { char: '卒', side: BLACK, type: 'P', wasHidden: true });
  assert.deepEqual(game.fallen.black.map((p) => p.char), ['卒']);
  assert.equal(record.undoBlock, 'took-hidden');
});

test('明子不能吃己方明子', () => {
  const game = new Game();
  game.setup([
    { r: 9, c: 4, side: RED, type: 'K' },
    { r: 0, c: 3, side: BLACK, type: 'K' },
    { r: 5, c: 0, side: RED, type: 'R' },
    { r: 5, c: 2, side: RED, type: 'P' },
  ]);
  assert.ok(!targets(game, 5, 0).includes('5,2'));
  assert.equal(game.check({ r: 5, c: 0 }, { r: 5, c: 2 }).reason, 'illegal');
});

test('对脸将：帅不可走到与将正面相对的位置', () => {
  const game = new Game();
  game.setup([
    { r: 9, c: 4, side: RED, type: 'K' },
    { r: 0, c: 3, side: BLACK, type: 'K' },
  ]);
  assert.equal(game.check({ r: 9, c: 4 }, { r: 9, c: 3 }).reason, 'facing');
  assert.ok(!targets(game, 9, 4).includes('9,3'));
  assert.ok(targets(game, 9, 4).includes('8,4'));
});

test('对脸将：挡在两将之间的唯一一子不能离开该列', () => {
  const game = new Game();
  game.setup([
    { r: 9, c: 4, side: RED, type: 'K' },
    { r: 0, c: 4, side: BLACK, type: 'K' },
    { r: 5, c: 4, side: RED, type: 'R' },
  ]);
  assert.equal(game.check({ r: 5, c: 4 }, { r: 5, c: 0 }).reason, 'facing');
  assert.ok(targets(game, 5, 4).includes('3,4'), '沿同列移动仍然挡着');
});

test('悔棋：已翻开且走过的子可收回，吃子一并还原', () => {
  const game = new Game();
  game.setup([
    { r: 9, c: 4, side: RED, type: 'K' },
    { r: 0, c: 3, side: BLACK, type: 'K' },
    { r: 7, c: 0, side: RED, type: 'R', moves: 1 },
    { r: 3, c: 0, side: BLACK, type: 'P', moves: 1 },
  ]);
  game.move({ r: 7, c: 0 }, { r: 3, c: 0 });
  assert.ok(game.canUndo(RED));
  assert.ok(!game.canUndo(BLACK));
  assert.equal(game.fallen.black.length, 1);

  game.undo();
  assert.equal(game.at(7, 0).type, 'R');
  assert.equal(game.at(3, 0).type, 'P');
  assert.equal(game.at(7, 0).moves, 1);
  assert.equal(game.fallen.black.length, 0);
  assert.equal(game.turn, RED);
  assert.equal(game.ply, 0);
  assert.equal(game.undoable, null, '只能悔一步');
});

test('悔棋：该子初次走动不可悔', () => {
  const game = new Game();
  game.setup([
    { r: 9, c: 4, side: RED, type: 'K' },
    { r: 0, c: 3, side: BLACK, type: 'K' },
  ]);
  const record = game.move({ r: 9, c: 4 }, { r: 8, c: 4 });
  assert.equal(record.undoBlock, 'first-move');
  assert.ok(!game.canUndo(RED));
});

test('吃下帅/将即告胜负，且不可悔', () => {
  const game = new Game();
  game.setup([
    { r: 9, c: 4, side: RED, type: 'K' },
    { r: 0, c: 3, side: BLACK, type: 'K' },
    { r: 5, c: 3, side: RED, type: 'R', moves: 3 },
  ]);
  game.move({ r: 5, c: 3 }, { r: 0, c: 3 });
  assert.deepEqual(
    { winner: game.result.winner, reason: game.result.reason },
    { winner: RED, reason: 'king' }
  );
  assert.ok(!game.canUndo(RED));
  assert.equal(game.check({ r: 9, c: 4 }, { r: 8, c: 4 }).reason, 'over');
});

test('暗子吃将后翻成对方棋子，仍判吃将一方获胜', () => {
  const game = new Game();
  game.setup([
    { r: 9, c: 4, side: RED, type: 'K' },
    { r: 0, c: 3, side: BLACK, type: 'K' },
    { r: 5, c: 3, side: RED, realSide: BLACK, type: 'C', origin: 'R', revealed: false },
  ]);
  const record = game.move({ r: 5, c: 3 }, { r: 0, c: 3 });
  assert.equal(record.after.side, BLACK);
  assert.equal(game.result.winner, RED);
});

test('仕/士：翻开后全盘斜走一格', () => {
  const game = new Game();
  game.setup([
    { r: 9, c: 4, side: RED, type: 'K' },
    { r: 0, c: 3, side: BLACK, type: 'K' },
    { r: 5, c: 0, side: RED, type: 'A' },
  ]);
  assert.deepEqual(targets(game, 5, 0), ['4,1', '6,1']);
});

test('相/象：象眼被堵不能飞，可以过河', () => {
  const game = new Game();
  game.setup([
    { r: 9, c: 4, side: RED, type: 'K' },
    { r: 0, c: 3, side: BLACK, type: 'K' },
    { r: 5, c: 2, side: RED, type: 'B' },
    { r: 6, c: 3, side: RED, type: 'P' },
  ]);
  assert.deepEqual(targets(game, 5, 2), ['3,0', '3,4', '7,0']);
});

test('兵/卒：过河前只能前进，过河后可左右平移', () => {
  const game = new Game();
  game.setup([
    { r: 9, c: 4, side: RED, type: 'K' },
    { r: 0, c: 3, side: BLACK, type: 'K' },
    { r: 6, c: 0, side: RED, type: 'P' },
    { r: 4, c: 6, side: RED, type: 'P' },
    { r: 5, c: 8, side: BLACK, type: 'P' },
  ]);
  assert.deepEqual(targets(game, 6, 0), ['5,0']);
  assert.deepEqual(targets(game, 4, 6), ['3,6', '4,5', '4,7']);
  game.turn = BLACK;
  assert.deepEqual(targets(game, 5, 8), ['5,7', '6,8']);
});

test('认输只能在己方回合；求和后对局结束', () => {
  const game = new Game({ rng: seeded(5) });
  assert.equal(game.resign(BLACK), null);
  assert.deepEqual(game.resign(RED), { winner: BLACK, reason: 'resign', loser: RED });

  const other = new Game({ rng: seeded(5) });
  assert.equal(other.agreeDraw().winner, null);
  assert.equal(other.resign(RED), null);
});

test('统计：暗子、明子与阵亡', () => {
  const game = new Game({ rng: seeded(9) });
  assert.deepEqual(game.stats(RED), { hidden: 15, shown: 1, fallen: [] });
  assert.deepEqual(game.stats(BLACK), { hidden: 15, shown: 1, fallen: [] });
});

test('棋步描述', () => {
  const game = new Game();
  game.setup(
    [
      { r: 9, c: 4, side: RED, type: 'K' },
      { r: 0, c: 3, side: BLACK, type: 'K' },
      { r: 4, c: 0, side: BLACK, type: 'R' },
      { r: 7, c: 4, side: RED, type: 'R' },
      { r: 4, c: 4, side: BLACK, type: 'A' },
      { r: 2, c: 1, side: BLACK, realSide: RED, type: 'C', origin: 'C', revealed: false },
    ],
    BLACK
  );
  assert.equal(describeMove(game.move({ r: 4, c: 0 }, { r: 4, c: 2 })), '黑俥 平移两步 · 无吃子');
  assert.equal(describeMove(game.move({ r: 7, c: 4 }, { r: 4, c: 4 })), '红車 前进三步 · 吃黑士');
  assert.equal(describeMove(game.move({ r: 2, c: 1 }, { r: 5, c: 1 })), '黑方暗子 前进三步 · 翻出红炮');
});
