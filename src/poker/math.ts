import type { Card } from './types';
import {
  cardKey,
  createDeck,
  evaluateHand,
  HandCategory,
  RANK_VALUE,
  SUITS,
} from './evaluator';

/**
 * Required equity (%) to break even on a call: Call / (PotBeforeCall + Call) * 100
 * Note: potBeforeHeroCall already includes Villain's bet.
 */
export function requiredEquityPct(potBeforeHeroCallBb: number, callAmountBb: number): number {
  const totalPot = potBeforeHeroCallBb + callAmountBb;
  if (totalPot <= 0) return 0;
  return Number(((callAmountBb / totalPot) * 100).toFixed(1));
}

/**
 * Bluff break-even fold frequency alpha (%): Bet / (PotBeforeBet + Bet) * 100
 */
export function bluffBreakEvenPct(potBeforeBetBb: number, betSizeBb: number): number {
  const denom = potBeforeBetBb + betSizeBb;
  if (denom <= 0) return 0;
  return Number(((betSizeBb / denom) * 100).toFixed(1));
}

/**
 * Minimum Defense Frequency (MDF %): PotBeforeBet / (PotBeforeBet + Bet) * 100
 */
export function minimumDefenseFrequencyPct(potBeforeBetBb: number, betSizeBb: number): number {
  const denom = potBeforeBetBb + betSizeBb;
  if (denom <= 0) return 100;
  return Number(((potBeforeBetBb / denom) * 100).toFixed(1));
}

/**
 * Expected Value of calling in big blinds:
 * EV = equity * (potBeforeHeroCall + call) - (1 - equity) * call
 *    = equity * potBeforeHeroCall - (1 - equity) * call? Wait:
 * Careful! Standard EV relative to folding (0 bb):
 * If Hero wins (prob p): Hero wins potBeforeHeroCall (net profit = +potBeforeHeroCall)
 * If Hero loses (prob 1-p): Hero loses callAmount (net profit = -callAmount)
 * Therefore EV(call) = p * potBeforeHeroCall - (1 - p) * callAmount
 * Check break-even: EV = 0 => p * (potBeforeHeroCall + callAmount) = callAmount => p = call / (pot + call). Exact!
 */
export function callEvBb(
  potBeforeHeroCallBb: number,
  callAmountBb: number,
  equityPct: number
): number {
  const p = equityPct / 100;
  const ev = p * potBeforeHeroCallBb - (1 - p) * callAmountBb;
  return Number(ev.toFixed(2));
}

export interface EquityResult {
  heroEquityPct: number;
  villainEquityPct: number;
  tiePct: number;
  samples: number;
}

/**
 * Computes exact equity on the turn (44 river cards) or fast deterministic/Monte Carlo
 * equity on flop/preflop against a specific villain holding.
 */
export function computeHandVsHandEquity(
  hero: [Card, Card],
  villain: [Card, Card],
  board: Card[],
  iterations = 1200,
  rng: () => number = Math.random
): EquityResult {
  const dead = new Set([...hero, ...villain, ...board].map(cardKey));
  const remaining = createDeck().filter((c) => !dead.has(cardKey(c)));
  const cardsNeeded = 5 - board.length;

  let wins = 0;
  let ties = 0;
  let total = 0;

  if (cardsNeeded === 0) {
    const h = evaluateHand([...hero, ...board]).score;
    const v = evaluateHand([...villain, ...board]).score;
    return {
      heroEquityPct: h > v ? 100 : h === v ? 50 : 0,
      villainEquityPct: v > h ? 100 : h === v ? 50 : 0,
      tiePct: h === v ? 100 : 0,
      samples: 1,
    };
  }

  // Exact enumeration on Turn (only 44 remaining river cards)
  if (cardsNeeded === 1) {
    for (const river of remaining) {
      const fullBoard = [...board, river];
      const h = evaluateHand([...hero, ...fullBoard]).score;
      const v = evaluateHand([...villain, ...fullBoard]).score;
      if (h > v) wins++;
      else if (h === v) ties++;
      total++;
    }
  } else {
    // Fast Monte Carlo sampling for Flop / Preflop
    const n = remaining.length;
    for (let iter = 0; iter < iterations; iter++) {
      const picked: Card[] = [];
      const usedIdx = new Set<number>();
      while (picked.length < cardsNeeded) {
        const idx = Math.floor(rng() * n);
        if (!usedIdx.has(idx)) {
          usedIdx.add(idx);
          picked.push(remaining[idx]);
        }
      }
      const fullBoard = [...board, ...picked];
      const h = evaluateHand([...hero, ...fullBoard]).score;
      const v = evaluateHand([...villain, ...fullBoard]).score;
      if (h > v) wins++;
      else if (h === v) ties++;
      total++;
    }
  }

  const heroEquity = ((wins + ties * 0.5) / total) * 100;
  const tiePct = (ties / total) * 100;
  return {
    heroEquityPct: Number(heroEquity.toFixed(1)),
    villainEquityPct: Number((100 - heroEquity).toFixed(1)),
    tiePct: Number(tiePct.toFixed(1)),
    samples: total,
  };
}

export interface DrawAnalysis {
  cleanOuts: number;
  flushDraw: boolean;
  openEndedStraightDraw: boolean;
  gutshotStraightDraw: boolean;
  overcards: number;
  nextCardEquityPct: number;
  toRiverEquityPct: number;
  outCards: Card[];
}

/**
 * Counts clean outs on Flop (3 cards) or Turn (4 cards) that improve Hero to
 * a Flush, Straight, or Top Pair+ (when Hero currently holds a draw/high card).
 */
export function analyzeDrawsAndOuts(
  hero: [Card, Card],
  board: Card[],
  villain?: [Card, Card]
): DrawAnalysis {
  const dead = new Set([...hero, ...board, ...(villain ?? [])].map(cardKey));
  const remaining = createDeck().filter((c) => !dead.has(cardKey(c)));
  const all = [...hero, ...board];

  // Flush draw check (4 to a flush)
  let flushDraw = false;
  for (const s of SUITS) {
    if (all.filter((c) => c.suit === s).length === 4) {
      flushDraw = true;
    }
  }

  // Exact card-by-card out check
  const currentEval = evaluateHand([...hero, ...board]);
  const villainEval = villain ? evaluateHand([...villain, ...board]) : null;
  const outCards: Card[] = [];

  for (const nextCard of remaining) {
    const nextEval = evaluateHand([...hero, ...board, nextCard]);
    if (villainEval && villain) {
      const nextVillain = evaluateHand([...villain, ...board, nextCard]);
      if (nextEval.score > nextVillain.score && currentEval.score <= villainEval.score) {
        outCards.push(nextCard);
      }
    } else if (
      nextEval.category >= HandCategory.Straight &&
      nextEval.category > currentEval.category
    ) {
      outCards.push(nextCard);
    }
  }

  // Detect OESD vs Gutshot by counting non-flush straight outs
  let straightOutRanks = new Set<number>();
  if (currentEval.category < HandCategory.Straight) {
    for (const nextCard of remaining) {
      const nextEval = evaluateHand([...hero, ...board, nextCard]);
      if (
        nextEval.category === HandCategory.Straight ||
        nextEval.category === HandCategory.StraightFlush
      ) {
        straightOutRanks.add(RANK_VALUE[nextCard.rank]);
      }
    }
  }

  const openEndedStraightDraw = straightOutRanks.size >= 2;
  const gutshotStraightDraw = straightOutRanks.size === 1;

  const maxBoardRank = Math.max(...board.map((c) => RANK_VALUE[c.rank]));
  const overcards = hero.filter((c) => RANK_VALUE[c.rank] > maxBoardRank).length;

  const cleanOuts = outCards.length;
  const deckLeft = remaining.length;
  const nextCardEquityPct = Number(((cleanOuts / deckLeft) * 100).toFixed(1));
  const toRiverEquityPct =
    board.length === 3
      ? Number(((1 - ((deckLeft - cleanOuts) / deckLeft) * ((deckLeft - 1 - cleanOuts) / (deckLeft - 1))) * 100).toFixed(1))
      : nextCardEquityPct;

  return {
    cleanOuts,
    flushDraw,
    openEndedStraightDraw,
    gutshotStraightDraw,
    overcards,
    nextCardEquityPct,
    toRiverEquityPct,
    outCards,
  };
}
