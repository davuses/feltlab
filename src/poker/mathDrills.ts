import type { Card, DecisionGrade } from './types';
import {
  analyzeDrawsAndOuts,
  bluffBreakEvenPct,
  callEvBb,
  computeHandVsHandEquity,
  minimumDefenseFrequencyPct,
  requiredEquityPct,
} from './math';
import { createSuitRotation, parseCards, rotateCards } from './evaluator';

export type MathDrillCategory = 'POT_ODDS' | 'OUTS_EQUITY' | 'CALL_EV' | 'MDF_BLUFF';

export interface MathDrillQuestion {
  id: string;
  category: MathDrillCategory;
  categoryLabel: string;
  prompt: string;
  contextLine: string;
  unit: '%' | 'bb';
  minVal: number;
  maxVal: number;
  step: number;
  defaultVal: number;
  exactAnswer: number;
  toleranceExact: number;
  toleranceClose: number;
  heroCards?: [Card, Card];
  villainCards?: [Card, Card];
  board?: Card[];
  potBb: number;
  betBb: number;
  heroEquityPct?: number;
  breakEvenPct?: number;
  formulaSteps: string[];
  takeaway: string;
}

export interface MathDrillResult {
  userAnswer: number;
  exactAnswer: number;
  delta: number;
  grade: DecisionGrade;
  evLossBb: number;
  accuracyScore: number;
}

const DRAW_SCENARIOS = [
  {
    name: 'Nut Flush Draw on Flop',
    hero: ['As', 'Qs'] as [string, string],
    villain: ['Kd', 'Qc'] as [string, string],
    board: ['Ks', '7s', '2d'],
    potBb: 12,
    betBb: 8,
  },
  {
    name: 'Open-Ended Straight Draw on Turn',
    hero: ['Jh', 'Th'] as [string, string],
    villain: ['Ad', '9c'] as [string, string],
    board: ['9d', '8s', '2c', '4h'],
    potBb: 18,
    betBb: 9,
  },
  {
    name: 'Monster Combo Draw (OESD + Flush) on Flop',
    hero: ['9d', '8d'] as [string, string],
    villain: ['As', 'Kc'] as [string, string],
    board: ['Kd', '7d', '6c'],
    potBb: 14,
    betBb: 10.5,
  },
  {
    name: 'Flush Draw + Overcard on Turn',
    hero: ['Ah', '5h'] as [string, string],
    villain: ['Qs', 'Js'] as [string, string],
    board: ['Qh', '9h', '4c', '2d'],
    potBb: 20,
    betBb: 15,
  },
];

export function generateMathQuestion(
  categoryFilter: MathDrillCategory | 'ALL',
  rng: () => number = Math.random
): MathDrillQuestion {
  const categories: MathDrillCategory[] = ['POT_ODDS', 'OUTS_EQUITY', 'CALL_EV', 'MDF_BLUFF'];
  const category =
    categoryFilter === 'ALL'
      ? categories[Math.floor(rng() * categories.length)]
      : categoryFilter;

  if (category === 'POT_ODDS') {
    const potChoices = [6, 10, 12, 16, 20, 24, 30];
    const betMultipliers = [0.33, 0.5, 0.66, 0.75, 1.0, 1.25];
    const potBeforeBet = potChoices[Math.floor(rng() * potChoices.length)];
    const mult = betMultipliers[Math.floor(rng() * betMultipliers.length)];
    const betBb = Number((potBeforeBet * mult).toFixed(1));
    const potBeforeCall = Number((potBeforeBet + betBb).toFixed(1));
    const ans = requiredEquityPct(potBeforeCall, betBb);

    return {
      id: `po-${potBeforeBet}-${betBb}-${Math.floor(rng() * 10000)}`,
      category,
      categoryLabel: 'Pot Odds & Required Equity',
      prompt: `Villain bets ${betBb}bb into a ${potBeforeBet}bb pot (${Math.round(mult * 100)}% pot). What minimum equity (%) do you need to make a break-even call?`,
      contextLine: `6-Max · 100bb · Pot before bet: ${potBeforeBet}bb · Facing ${betBb}bb`,
      unit: '%',
      minVal: 5,
      maxVal: 55,
      step: 0.5,
      defaultVal: 25,
      exactAnswer: ans,
      toleranceExact: 1.5,
      toleranceClose: 3.5,
      potBb: potBeforeBet,
      betBb,
      breakEvenPct: ans,
      formulaSteps: [
        `Total final pot if you call = ${potBeforeBet} + ${betBb} + ${betBb} = ${(potBeforeCall + betBb).toFixed(1)}bb`,
        `Required Equity = Call / Final Pot = ${betBb} / ${(potBeforeCall + betBb).toFixed(1)} = ${ans}%`,
      ],
      takeaway: `Memorize key benchmarks: 33% pot needs 20%, 50% pot needs 25%, 75% pot needs 30%, 100% pot needs 33.3%.`,
    };
  }

  if (category === 'OUTS_EQUITY') {
    const base = DRAW_SCENARIOS[Math.floor(rng() * DRAW_SCENARIOS.length)];
    const rot = createSuitRotation(rng);
    const hero = rotateCards(parseCards(base.hero), rot) as [Card, Card];
    const villain = rotateCards(parseCards(base.villain), rot) as [Card, Card];
    const board = rotateCards(parseCards(base.board), rot);

    const draw = analyzeDrawsAndOuts(hero, board, villain);
    const eq = computeHandVsHandEquity(hero, villain, board, 1400, rng);
    const streetName = board.length === 3 ? 'Flop' : 'Turn';
    const potBeforeCall = base.potBb + base.betBb;
    const reqEq = requiredEquityPct(potBeforeCall, base.betBb);

    return {
      id: `oe-${base.name}-${Math.floor(rng() * 10000)}`,
      category,
      categoryLabel: 'Outs & Hand Equity',
      prompt: `On the ${streetName} (${base.name}), estimate your exact all-in equity (%) against Villain's revealed holding.`,
      contextLine: `6-Max · ${streetName} · ${draw.cleanOuts} direct outs detected · Required equity vs ${base.betBb}bb bet: ${reqEq}%`,
      unit: '%',
      minVal: 5,
      maxVal: 80,
      step: 1,
      defaultVal: 32,
      exactAnswer: eq.heroEquityPct,
      toleranceExact: 3.0,
      toleranceClose: 6.0,
      heroCards: hero,
      villainCards: villain,
      board,
      potBb: base.potBb,
      betBb: base.betBb,
      heroEquityPct: eq.heroEquityPct,
      breakEvenPct: reqEq,
      formulaSteps: [
        `Direct improving outs on next card: ${draw.cleanOuts} clean outs`,
        board.length === 3
          ? `Rule of 4 shortcut: ${draw.cleanOuts} × 4 ≈ ${Math.min(72, draw.cleanOuts * 4)}% (exact combinatorial / MC equity: ${eq.heroEquityPct}%)`
          : `Exact Turn-to-River math: ${draw.cleanOuts} / 44 = ${eq.heroEquityPct}%`,
        `Compare vs pot odds (${reqEq}%): ${eq.heroEquityPct >= reqEq ? 'Profitable continue (+EV)' : 'Needs implied odds to call'}`,
      ],
      takeaway: `Rule of 4 (flop) and Rule of 2 (turn) are rapid baselines—adjust slightly downward for 12+ outs due to double-counting.`,
    };
  }

  if (category === 'CALL_EV') {
    const potBeforeBet = [10, 14, 18, 24][Math.floor(rng() * 4)];
    const betBb = [6, 8, 12, 16][Math.floor(rng() * 4)];
    const equityPct = [22, 28, 34, 40, 45][Math.floor(rng() * 5)];
    const potBeforeCall = potBeforeBet + betBb;
    const ans = callEvBb(potBeforeCall, betBb, equityPct);
    const reqEq = requiredEquityPct(potBeforeCall, betBb);

    return {
      id: `ev-${potBeforeBet}-${betBb}-${equityPct}-${Math.floor(rng() * 10000)}`,
      category,
      categoryLabel: 'Expected Value (EV in bb)',
      prompt: `Pot is ${potBeforeBet}bb. Villain bets ${betBb}bb on the river. Your bluff-catcher has ${equityPct}% equity against Villain's range. What is the EV of calling (in bb)?`,
      contextLine: `6-Max · River · Pot before call: ${potBeforeCall}bb · Call: ${betBb}bb · Equity: ${equityPct}%`,
      unit: 'bb',
      minVal: -12,
      maxVal: 20,
      step: 0.2,
      defaultVal: 0,
      exactAnswer: ans,
      toleranceExact: 0.6,
      toleranceClose: 1.5,
      potBb: potBeforeBet,
      betBb,
      heroEquityPct: equityPct,
      breakEvenPct: reqEq,
      formulaSteps: [
        `EV(Call) = (Win% × PotWon) − (Lose% × CallCost)`,
        `EV(Call) = (${(equityPct / 100).toFixed(2)} × ${potBeforeCall}bb) − (${((100 - equityPct) / 100).toFixed(2)} × ${betBb}bb)`,
        `EV(Call) = ${( (equityPct / 100) * potBeforeCall ).toFixed(2)}bb − ${(((100 - equityPct) / 100) * betBb).toFixed(2)}bb = ${ans >= 0 ? '+' : ''}${ans}bb`,
      ],
      takeaway: `Whenever your equity exceeds required pot odds (${reqEq}%), calling is strictly +EV relative to folding (0.00bb).`,
    };
  }

  // MDF_BLUFF
  const potBeforeBet = [10, 15, 20, 30][Math.floor(rng() * 4)];
  const mults = [0.33, 0.5, 0.75, 1.0, 1.5];
  const mult = mults[Math.floor(rng() * mults.length)];
  const betBb = Number((potBeforeBet * mult).toFixed(1));
  const askMdf = rng() > 0.5;
  const ans = askMdf
    ? minimumDefenseFrequencyPct(potBeforeBet, betBb)
    : bluffBreakEvenPct(potBeforeBet, betBb);

  return {
    id: `mdf-${potBeforeBet}-${betBb}-${askMdf ? 'm' : 'b'}-${Math.floor(rng() * 10000)}`,
    category,
    categoryLabel: askMdf ? 'Minimum Defense Frequency (MDF)' : 'Bluff Break-Even Frequency',
    prompt: askMdf
      ? `Villain bets ${betBb}bb into a ${potBeforeBet}bb pot (${Math.round(mult * 100)}% pot) on the river. What Minimum Defense Frequency (%) prevents Villain from auto-profiting with any two bluffs?`
      : `You bluff ${betBb}bb into a ${potBeforeBet}bb pot (${Math.round(mult * 100)}% pot) on the river with 0% equity when called. How often (%) must Villain fold for your bluff to break even?`,
    contextLine: `6-Max · River Theory · Pot: ${potBeforeBet}bb · Bet: ${betBb}bb (${Math.round(mult * 100)}%)`,
    unit: '%',
    minVal: 15,
    maxVal: 85,
    step: 0.5,
    defaultVal: 50,
    exactAnswer: ans,
    toleranceExact: 1.5,
    toleranceClose: 3.5,
    potBb: potBeforeBet,
    betBb,
    breakEvenPct: ans,
    formulaSteps: askMdf
      ? [
          `MDF = Pot / (Pot + Bet)`,
          `MDF = ${potBeforeBet} / (${potBeforeBet} + ${betBb}) = ${ans}%`,
        ]
      : [
          `Break-Even Fold % (α) = Bet / (Pot + Bet)`,
          `α = ${betBb} / (${potBeforeBet} + ${betBb}) = ${ans}%`,
        ],
    takeaway: `MDF and bluff break-even α always sum to 100%. Larger bets lower your required defense frequency and raise the fold % a bluff needs.`,
  };
}

export function evaluateMathAnswer(
  q: MathDrillQuestion,
  userAnswer: number
): MathDrillResult {
  const delta = Number(Math.abs(userAnswer - q.exactAnswer).toFixed(2));
  let grade: DecisionGrade;
  let evLossBb: number;
  let accuracyScore: number;

  if (delta <= q.toleranceExact) {
    grade = 'Optimal';
    evLossBb = 0;
    accuracyScore = 100;
  } else if (delta <= q.toleranceClose) {
    grade = 'Acceptable';
    evLossBb = 0.08;
    accuracyScore = 88;
  } else if (delta <= q.toleranceClose * 2) {
    grade = 'Inaccuracy';
    evLossBb = 0.25;
    accuracyScore = 68;
  } else if (delta <= q.toleranceClose * 3.5) {
    grade = 'Mistake';
    evLossBb = 0.55;
    accuracyScore = 40;
  } else {
    grade = 'Blunder';
    evLossBb = 1.05;
    accuracyScore = 12;
  }

  return {
    userAnswer,
    exactAnswer: q.exactAnswer,
    delta,
    grade,
    evLossBb,
    accuracyScore,
  };
}
