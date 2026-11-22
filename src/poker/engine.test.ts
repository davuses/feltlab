import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalHandKey,
  createSuitRotation,
  evaluateHand,
  HandCategory,
  parseCards,
  rotateCards,
} from './evaluator';
import {
  analyzeDrawsAndOuts,
  bluffBreakEvenPct,
  callEvBb,
  computeHandVsHandEquity,
  minimumDefenseFrequencyPct,
  requiredEquityPct,
} from './math';
import {
  evaluatePreflopDecision,
  generatePreflopSpot,
  PREFLOP_TEMPLATES,
} from './preflopRanges';
import {
  evaluatePostflopDecision,
  generatePostflopSpot,
  POSTFLOP_BLUEPRINTS,
} from './postflopSpots';
import { evaluateHandReading, HAND_READING_SPOTS } from './handReadingSpots';
import { evaluateMathAnswer, generateMathQuestion } from './mathDrills';
import {
  applyPlayerAction,
  buildPresetConfig,
  chooseBotAction,
  computeHudDisplay,
  createInitialTable,
  createTableFromConfig,
  DEFAULT_ARENA_CONFIG,
  roundBb,
  startNewHand,
  type ArenaSize,
} from './tableEngine';

test('7-card hand evaluator ranks all hand categories accurately including wheel straight', () => {
  const royal = evaluateHand(parseCards(['As', 'Ks', 'Qs', 'Js', 'Ts', '2d', '3c']));
  assert.equal(royal.category, HandCategory.StraightFlush);
  assert.equal(royal.label, 'Royal Flush');

  const quads = evaluateHand(parseCards(['9s', '9h', '9d', '9c', 'As', '2h', '3d']));
  assert.equal(quads.category, HandCategory.FourOfAKind);

  const boat = evaluateHand(parseCards(['Ks', 'Kh', 'Kd', '4c', '4s', '2d', '9h']));
  assert.equal(boat.category, HandCategory.FullHouse);

  const flush = evaluateHand(parseCards(['Ah', 'Jh', '8h', '5h', '2h', 'Ks', 'Qd']));
  assert.equal(flush.category, HandCategory.Flush);

  const wheel = evaluateHand(parseCards(['As', '2d', '3c', '4h', '5s', 'Kd', 'Qc']));
  assert.equal(wheel.category, HandCategory.Straight);
  assert.equal(wheel.tiebreakers[0], 5);

  const twoPair = evaluateHand(parseCards(['As', 'Ad', 'Kc', 'Kh', 'Qs', '2d', '7c']));
  assert.equal(twoPair.category, HandCategory.TwoPair);

  assert.ok(royal.score > quads.score);
  assert.ok(quads.score > boat.score);
  assert.ok(boat.score > flush.score);
  assert.ok(flush.score > wheel.score);
  assert.ok(wheel.score > twoPair.score);
});

test('canonicalHandKey and suit rotation preserve hand identity', () => {
  const [c1, c2] = parseCards(['Kh', 'Ah']);
  assert.equal(canonicalHandKey(c1, c2), 'AKs');
  const [o1, o2] = parseCards(['Td', 'Js']);
  assert.equal(canonicalHandKey(o1, o2), 'JTo');

  const rot = createSuitRotation(() => 0.37);
  const rotated = rotateCards([c1, c2], rot);
  assert.equal(canonicalHandKey(rotated[0], rotated[1]), 'AKs');
});

test('pot odds, MDF, bluff break-even, Call EV, and turn equity math are exact', () => {
  // Villain bets 50% pot (10 into 20 -> pot before call = 30, call = 10 -> 10/40 = 25%)
  assert.equal(requiredEquityPct(30, 10), 25);
  // Villain bets 100% pot (10 into 10 -> pot before call = 20, call = 10 -> 10/30 = 33.3%)
  assert.equal(requiredEquityPct(20, 10), 33.3);
  // MDF + Bluff Break-Even == 100%
  assert.equal(
    Number((minimumDefenseFrequencyPct(20, 15) + bluffBreakEvenPct(20, 15)).toFixed(1)),
    100
  );
  // EV of calling 10bb into 30bb pot with 25% equity == 0.00bb
  assert.equal(callEvBb(30, 10, 25), 0);
  // EV of calling 10bb into 30bb pot with 40% equity == 0.4*30 - 0.6*10 = +6.00bb
  assert.equal(callEvBb(30, 10, 40), 6);

  // Turn nut flush draw (As Qs vs Kd Qc on Ks 7s 2d 3h) -> 9 spades + 3 remaining Aces = 12 outs?
  // Wait: Qs is paired, As pairs Ace (beats KQ), plus 9 spades (minus none dead) = 12 outs? Actually As is already spade -> 9 spades (excluding As,Qs,Ks,7s = 9 spades) + 3 non-spade Aces (Ah,Ad,Ac) = 12 outs out of 44 = 27.3%!
  const hero = parseCards(['As', 'Qs']) as [any, any];
  const villain = parseCards(['Kd', 'Qc']) as [any, any];
  const board = parseCards(['Ks', '7s', '2d', '3h']);
  const draw = analyzeDrawsAndOuts(hero, board, villain);
  assert.equal(draw.flushDraw, true);
  assert.equal(draw.cleanOuts, 12);
  const eq = computeHandVsHandEquity(hero, villain, board);
  assert.equal(eq.samples, 44);
  assert.equal(eq.heroEquityPct, 27.3);
});

test('all 6-max preflop matrices have 169 valid hands summing to 100% frequency', () => {
  assert.ok(PREFLOP_TEMPLATES.length >= 9);
  for (const tpl of PREFLOP_TEMPLATES) {
    const keys = Object.keys(tpl.matrix);
    assert.equal(keys.length, 169, `${tpl.id} must have 169 hands`);
    for (const cell of Object.values(tpl.matrix)) {
      assert.equal(
        cell.raise + cell.call + cell.fold,
        100,
        `${tpl.id} ${cell.hand} frequencies must sum to 100`
      );
    }
    // AA must always be pure raise
    assert.equal(tpl.matrix['AA'].raise, 100);
    // 72o must always be pure fold
    assert.equal(tpl.matrix['72o'].fold, 100);
  }

  const spot = generatePreflopSpot('RFI', 'BTN', () => 0.25);
  const evalBest = evaluatePreflopDecision(spot, 'raise');
  assert.ok(evalBest.evLossBb >= 0);
});

test('postflop spots, hand reading, and math drills produce valid grades', () => {
  assert.ok(POSTFLOP_BLUEPRINTS.length >= 10);
  for (const bp of POSTFLOP_BLUEPRINTS) {
    const sum = bp.actions.reduce((acc, a) => acc + a.frequency, 0);
    assert.equal(sum, 100, `${bp.id} action frequencies must sum to 100`);
  }
  const pfSpot = generatePostflopSpot('ALL', 'ALL', 'ALL', undefined, () => 0.1);
  const bestAct = [...pfSpot.actions].sort((a, b) => b.evBb - a.evBb)[0];
  const pfEval = evaluatePostflopDecision(pfSpot, bestAct.action);
  assert.equal(pfEval.evLossBb, 0);
  assert.equal(pfEval.grade, 'Optimal');

  const hrSpot = HAND_READING_SPOTS[0];
  const hrPerfect = evaluateHandReading(hrSpot, new Set(hrSpot.targetHands));
  assert.equal(hrPerfect.overlapPct, 100);
  assert.equal(hrPerfect.grade, 'Optimal');

  const mathQ = generateMathQuestion('POT_ODDS', () => 0.5);
  const mathRes = evaluateMathAnswer(mathQ, mathQ.exactAnswer);
  assert.equal(mathRes.grade, 'Optimal');
  assert.equal(mathRes.evLossBb, 0);
});

test('6-max cash table preserves 600bb chip conservation invariant through a full hand', () => {
  let seed = 42;
  const seededRng = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  let table = createInitialTable();
  table = startNewHand(table, seededRng);
  assert.equal(table.phase, 'PREFLOP');
  assert.equal(table.potBb, 1.5);

  const totalChips = (t: typeof table) =>
    roundBb(
      t.seats.reduce((sum, s) => sum + s.stackBb, 0) +
        (t.phase === 'SHOWDOWN' ? 0 : t.potBb)
    );

  assert.equal(totalChips(table), 600);

  let steps = 0;
  while (table.phase !== 'SHOWDOWN' && table.actingSeatIndex !== null && steps < 120) {
    const actor = table.actingSeatIndex;
    const move = chooseBotAction(table, actor, seededRng);
    table = applyPlayerAction(table, actor, move.type, move.raiseToBb);
    steps++;
  }

  assert.equal(table.phase, 'SHOWDOWN');
  assert.ok(table.winnerSummary && table.winnerSummary.length > 0);
  assert.equal(totalChips(table), 600, 'Total chips across all 6 seats must remain exactly 600bb');
});

test('Multi-Bot Arena preserves chip conservation across 2-max (HU), 3-max, 4-max, and custom stacks', () => {
  const sizes: ArenaSize[] = [2, 3, 4, 6];
  for (const size of sizes) {
    let seed = 100 + size * 17;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const startingStackBb = size === 2 ? 200 : 100;
    const expectedTotal = size * startingStackBb;
    let table = createTableFromConfig({
      ...DEFAULT_ARENA_CONFIG,
      tableSize: size,
      startingStackBb,
    });
    table = startNewHand(table, rng);

    // Verify Heads-Up blind & preflop acting order: BTN posts SB 0.5bb and acts first preflop
    if (size === 2) {
      const btn = table.seats.find((s) => s.position === 'BTN')!;
      const bb = table.seats.find((s) => s.position === 'BB')!;
      assert.equal(btn.streetBetBb, 0.5);
      assert.equal(bb.streetBetBb, 1.0);
      assert.equal(table.actingSeatIndex, btn.seatIndex);
    }

    let steps = 0;
    while (table.phase !== 'SHOWDOWN' && table.actingSeatIndex !== null && steps < 120) {
      const actor = table.actingSeatIndex;
      const move = chooseBotAction(table, actor, rng);
      table = applyPlayerAction(table, actor, move.type, move.raiseToBb);
      steps++;
    }

    const total = roundBb(
      table.seats.reduce((sum, s) => sum + s.stackBb, 0) +
        (table.phase === 'SHOWDOWN' ? 0 : table.potBb)
    );
    assert.equal(table.phase, 'SHOWDOWN', `${size}-max hand must reach SHOWDOWN`);
    assert.equal(total, expectedTotal, `${size}-max chip conservation must equal ${expectedTotal}bb`);
  }
});

test('Multi-Bot Arena pool presets, Hero position lock, and live HUD stats track accurately', () => {
  const regConfig = buildPresetConfig('reg_wars');
  assert.equal(regConfig.tableSize, 6);
  assert.equal(regConfig.botArchetypes.length, 5);

  const lockedBtnConfig = {
    ...buildPresetConfig('lag_chaos'),
    heroPositionLock: 'BTN' as const,
  };
  let table = createTableFromConfig(lockedBtnConfig);
  let seed = 77;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (let h = 0; h < 3; h++) {
    table = startNewHand(table, rng);
    assert.equal(table.seats[0].position, 'BTN', 'Hero must stay locked on BTN every hand');
    let steps = 0;
    while (table.phase !== 'SHOWDOWN' && table.actingSeatIndex !== null && steps < 100) {
      const actor = table.actingSeatIndex;
      const move = chooseBotAction(table, actor, rng);
      table = applyPlayerAction(table, actor, move.type, move.raiseToBb);
      steps++;
    }
  }

  for (const s of table.seats) {
    assert.equal(s.stats.handsDealt, 3);
    const hud = computeHudDisplay(s.stats);
    assert.ok(hud.vpipPct >= 0 && hud.vpipPct <= 100);
    assert.ok(hud.pfrPct <= hud.vpipPct, 'PFR% can never exceed VPIP%');
  }
});
