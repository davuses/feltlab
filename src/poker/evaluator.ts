import type { Card, Rank, Suit } from './types';

export const RANKS: readonly Rank[] = [
  'A',
  'K',
  'Q',
  'J',
  'T',
  '9',
  '8',
  '7',
  '6',
  '5',
  '4',
  '3',
  '2',
] as const;

export const SUITS: readonly Suit[] = ['s', 'h', 'd', 'c'] as const;

export const RANK_VALUE: Record<Rank, number> = {
  A: 14,
  K: 13,
  Q: 12,
  J: 11,
  T: 10,
  '9': 9,
  '8': 8,
  '7': 7,
  '6': 6,
  '5': 5,
  '4': 4,
  '3': 3,
  '2': 2,
};

export const VALUE_TO_RANK: Record<number, Rank> = {
  14: 'A',
  13: 'K',
  12: 'Q',
  11: 'J',
  10: 'T',
  9: '9',
  8: '8',
  7: '7',
  6: '6',
  5: '5',
  4: '4',
  3: '3',
  2: '2',
};

export const SUIT_SYMBOL: Record<Suit, string> = {
  s: '♠',
  h: '♥',
  d: '♦',
  c: '♣',
};

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

export function cardKey(card: Card): string {
  return `${card.rank}${card.suit}`;
}

export function parseCard(code: string): Card {
  const rank = code[0] as Rank;
  const suit = code[1] as Suit;
  if (!(rank in RANK_VALUE) || !SUITS.includes(suit)) {
    throw new Error(`Invalid card code: ${code}`);
  }
  return { rank, suit };
}

export function parseCards(codes: string[]): Card[] {
  return codes.map(parseCard);
}

export function shuffleDeck(deck: Card[], rng: () => number = Math.random): Card[] {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Returns the canonical 169-grid key for any two hole cards:
 * e.g. As Ah -> "AA", As Ks -> "AKs", As Kh -> "AKo"
 */
export function canonicalHandKey(c1: Card, c2: Card): string {
  const v1 = RANK_VALUE[c1.rank];
  const v2 = RANK_VALUE[c2.rank];
  const high = v1 >= v2 ? c1 : c2;
  const low = v1 >= v2 ? c2 : c1;
  if (high.rank === low.rank) {
    return `${high.rank}${low.rank}`;
  }
  return `${high.rank}${low.rank}${high.suit === low.suit ? 's' : 'o'}`;
}

export function gridCellLabel(row: number, col: number): string {
  const r1 = RANKS[row];
  const r2 = RANKS[col];
  if (row === col) return `${r1}${r2}`;
  if (row < col) return `${r1}${r2}s`;
  return `${r2}${r1}o`;
}

export function comboCountForHand(handKey: string): number {
  if (handKey.length === 2) return 6; // Pocket pair
  if (handKey.endsWith('s')) return 4; // Suited
  return 12; // Offsuit
}

/**
 * Generates concrete hole-card combos for a 169 hand key excluding dead cards.
 */
export function expandHandCombos(handKey: string, deadCards: Card[] = []): [Card, Card][] {
  const dead = new Set(deadCards.map(cardKey));
  const r1 = handKey[0] as Rank;
  const r2 = handKey[1] as Rank;
  const combos: [Card, Card][] = [];

  if (handKey.length === 2) {
    for (let i = 0; i < SUITS.length; i++) {
      for (let j = i + 1; j < SUITS.length; j++) {
        const c1: Card = { rank: r1, suit: SUITS[i] };
        const c2: Card = { rank: r2, suit: SUITS[j] };
        if (!dead.has(cardKey(c1)) && !dead.has(cardKey(c2))) {
          combos.push([c1, c2]);
        }
      }
    }
  } else if (handKey.endsWith('s')) {
    for (const s of SUITS) {
      const c1: Card = { rank: r1, suit: s };
      const c2: Card = { rank: r2, suit: s };
      if (!dead.has(cardKey(c1)) && !dead.has(cardKey(c2))) {
        combos.push([c1, c2]);
      }
    }
  } else {
    for (const s1 of SUITS) {
      for (const s2 of SUITS) {
        if (s1 === s2) continue;
        const c1: Card = { rank: r1, suit: s1 };
        const c2: Card = { rank: r2, suit: s2 };
        if (!dead.has(cardKey(c1)) && !dead.has(cardKey(c2))) {
          combos.push([c1, c2]);
        }
      }
    }
  }
  return combos;
}

/**
 * Creates a valid suit permutation (suit isomorphism) to deal visually fresh
 * spots while preserving exact flush/blocker geometry.
 */
export function createSuitRotation(rng: () => number = Math.random): Record<Suit, Suit> {
  const shuffled = [...SUITS];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return {
    s: shuffled[0],
    h: shuffled[1],
    d: shuffled[2],
    c: shuffled[3],
  };
}

export function rotateCards(cards: Card[], map: Record<Suit, Suit>): Card[] {
  return cards.map((c) => ({ rank: c.rank, suit: map[c.suit] }));
}

export enum HandCategory {
  HighCard = 0,
  OnePair = 1,
  TwoPair = 2,
  ThreeOfAKind = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  FourOfAKind = 7,
  StraightFlush = 8,
}

export interface EvaluatedHand {
  category: HandCategory;
  score: number;
  label: string;
  tiebreakers: number[];
}

function encodeScore(category: HandCategory, kickers: number[]): number {
  let score = category * 16 ** 5;
  for (let i = 0; i < 5; i++) {
    score += (kickers[i] ?? 0) * 16 ** (4 - i);
  }
  return score;
}

const RANK_NAME_PLURAL: Record<number, string> = {
  14: 'Aces',
  13: 'Kings',
  12: 'Queens',
  11: 'Jacks',
  10: 'Tens',
  9: 'Nines',
  8: 'Eights',
  7: 'Sevens',
  6: 'Sixes',
  5: 'Fives',
  4: 'Fours',
  3: 'Threes',
  2: 'Twos',
};

const RANK_NAME_SINGULAR: Record<number, string> = {
  14: 'Ace',
  13: 'King',
  12: 'Queen',
  11: 'Jack',
  10: 'Ten',
  9: 'Nine',
  8: 'Eight',
  7: 'Seven',
  6: 'Six',
  5: 'Five',
  4: 'Four',
  3: 'Three',
  2: 'Two',
};

function findStraightHigh(uniqueDescValues: number[]): number {
  if (uniqueDescValues.length < 5) return 0;
  for (let i = 0; i <= uniqueDescValues.length - 5; i++) {
    const high = uniqueDescValues[i];
    if (
      uniqueDescValues[i + 1] === high - 1 &&
      uniqueDescValues[i + 2] === high - 2 &&
      uniqueDescValues[i + 3] === high - 3 &&
      uniqueDescValues[i + 4] === high - 4
    ) {
      return high;
    }
  }
  // Wheel straight: A-5-4-3-2
  if (
    uniqueDescValues.includes(14) &&
    uniqueDescValues.includes(5) &&
    uniqueDescValues.includes(4) &&
    uniqueDescValues.includes(3) &&
    uniqueDescValues.includes(2)
  ) {
    return 5;
  }
  return 0;
}

/**
 * Exact 5-to-7 card Texas Hold'em hand evaluator.
 */
export function evaluateHand(cards: Card[]): EvaluatedHand {
  if (cards.length < 5) {
    throw new Error(`evaluateHand requires at least 5 cards, received ${cards.length}`);
  }

  const rankCounts = new Map<number, number>();
  const suitGroups: Record<Suit, number[]> = { s: [], h: [], d: [], c: [] };

  for (const card of cards) {
    const val = RANK_VALUE[card.rank];
    rankCounts.set(val, (rankCounts.get(val) ?? 0) + 1);
    suitGroups[card.suit].push(val);
  }

  // Check Flush & Straight Flush
  let flushValues: number[] | null = null;
  for (const suit of SUITS) {
    if (suitGroups[suit].length >= 5) {
      flushValues = [...suitGroups[suit]].sort((a, b) => b - a);
      break;
    }
  }

  if (flushValues) {
    const uniqueFlush = Array.from(new Set(flushValues));
    const sfHigh = findStraightHigh(uniqueFlush);
    if (sfHigh > 0) {
      return {
        category: HandCategory.StraightFlush,
        score: encodeScore(HandCategory.StraightFlush, [sfHigh]),
        label: sfHigh === 14 ? 'Royal Flush' : `Straight Flush, ${RANK_NAME_SINGULAR[sfHigh]}-high`,
        tiebreakers: [sfHigh],
      };
    }
  }

  // Group ranks by frequency (descending count, then descending rank)
  const groups = Array.from(rankCounts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  // Four of a Kind
  if (groups[0][1] === 4) {
    const quadRank = groups[0][0];
    const kicker = groups
      .filter(([r]) => r !== quadRank)
      .map(([r]) => r)
      .sort((a, b) => b - a)[0];
    return {
      category: HandCategory.FourOfAKind,
      score: encodeScore(HandCategory.FourOfAKind, [quadRank, kicker]),
      label: `Four of a Kind, ${RANK_NAME_PLURAL[quadRank]}`,
      tiebreakers: [quadRank, kicker],
    };
  }

  // Full House
  const trips = groups.filter(([, c]) => c === 3).map(([r]) => r);
  const pairs = groups.filter(([, c]) => c === 2).map(([r]) => r);
  if (trips.length >= 2 || (trips.length === 1 && pairs.length >= 1)) {
    const tripRank = trips[0];
    const pairRank = trips.length >= 2 ? trips[1] : pairs[0];
    return {
      category: HandCategory.FullHouse,
      score: encodeScore(HandCategory.FullHouse, [tripRank, pairRank]),
      label: `Full House, ${RANK_NAME_PLURAL[tripRank]} full of ${RANK_NAME_PLURAL[pairRank]}`,
      tiebreakers: [tripRank, pairRank],
    };
  }

  // Flush
  if (flushValues) {
    const top5 = flushValues.slice(0, 5);
    return {
      category: HandCategory.Flush,
      score: encodeScore(HandCategory.Flush, top5),
      label: `Flush, ${RANK_NAME_SINGULAR[top5[0]]}-high`,
      tiebreakers: top5,
    };
  }

  // Straight
  const uniqueRanks = Array.from(rankCounts.keys()).sort((a, b) => b - a);
  const straightHigh = findStraightHigh(uniqueRanks);
  if (straightHigh > 0) {
    return {
      category: HandCategory.Straight,
      score: encodeScore(HandCategory.Straight, [straightHigh]),
      label: `Straight, ${RANK_NAME_SINGULAR[straightHigh]}-high`,
      tiebreakers: [straightHigh],
    };
  }

  // Three of a Kind
  if (trips.length === 1) {
    const tripRank = trips[0];
    const kickers = uniqueRanks.filter((r) => r !== tripRank).slice(0, 2);
    return {
      category: HandCategory.ThreeOfAKind,
      score: encodeScore(HandCategory.ThreeOfAKind, [tripRank, ...kickers]),
      label: `Three of a Kind, ${RANK_NAME_PLURAL[tripRank]}`,
      tiebreakers: [tripRank, ...kickers],
    };
  }

  // Two Pair
  if (pairs.length >= 2) {
    const highPair = pairs[0];
    const lowPair = pairs[1];
    const kicker = uniqueRanks.filter((r) => r !== highPair && r !== lowPair)[0];
    return {
      category: HandCategory.TwoPair,
      score: encodeScore(HandCategory.TwoPair, [highPair, lowPair, kicker]),
      label: `Two Pair, ${RANK_NAME_PLURAL[highPair]} & ${RANK_NAME_PLURAL[lowPair]}`,
      tiebreakers: [highPair, lowPair, kicker],
    };
  }

  // One Pair
  if (pairs.length === 1) {
    const pairRank = pairs[0];
    const kickers = uniqueRanks.filter((r) => r !== pairRank).slice(0, 3);
    return {
      category: HandCategory.OnePair,
      score: encodeScore(HandCategory.OnePair, [pairRank, ...kickers]),
      label: `Pair of ${RANK_NAME_PLURAL[pairRank]}`,
      tiebreakers: [pairRank, ...kickers],
    };
  }

  // High Card
  const top5 = uniqueRanks.slice(0, 5);
  return {
    category: HandCategory.HighCard,
    score: encodeScore(HandCategory.HighCard, top5),
    label: `${RANK_NAME_SINGULAR[top5[0]]}-high`,
    tiebreakers: top5,
  };
}

/**
 * Evaluates preflop + postflop made-hand strength normalized 0..1 for bot AI & quick readouts.
 */
export function handStrengthScore(hole: [Card, Card], board: Card[]): number {
  if (board.length === 0) {
    const v1 = RANK_VALUE[hole[0].rank];
    const v2 = RANK_VALUE[hole[1].rank];
    const hi = Math.max(v1, v2);
    const lo = Math.min(v1, v2);
    const pairBonus = v1 === v2 ? 0.32 + (hi / 14) * 0.35 : 0;
    const suitedBonus = hole[0].suit === hole[1].suit ? 0.06 : 0;
    const gap = hi - lo;
    const connBonus = gap === 1 ? 0.05 : gap === 2 ? 0.025 : 0;
    const highCardScore = ((hi - 2) / 12) * 0.32 + ((lo - 2) / 12) * 0.16;
    return Math.min(1, Math.max(0.05, pairBonus + suitedBonus + connBonus + highCardScore));
  }

  const evalResult = evaluateHand([...hole, ...board]);
  const boardMax = Math.max(...board.map((c) => RANK_VALUE[c.rank]));
  switch (evalResult.category) {
    case HandCategory.StraightFlush:
      return 1.0;
    case HandCategory.FourOfAKind:
      return 0.99;
    case HandCategory.FullHouse:
      return 0.96;
    case HandCategory.Flush:
      return 0.89 + (evalResult.tiebreakers[0] / 14) * 0.05;
    case HandCategory.Straight:
      return 0.84 + (evalResult.tiebreakers[0] / 14) * 0.04;
    case HandCategory.ThreeOfAKind:
      return 0.78 + (evalResult.tiebreakers[0] / 14) * 0.05;
    case HandCategory.TwoPair:
      return 0.71 + (evalResult.tiebreakers[0] / 14) * 0.06;
    case HandCategory.OnePair: {
      const pairRank = evalResult.tiebreakers[0];
      const kicker = evalResult.tiebreakers[1] ?? 7;
      if (pairRank > boardMax) return 0.68 + (pairRank / 14) * 0.05; // Overpair
      if (pairRank === boardMax) return 0.56 + (kicker / 14) * 0.10; // Top pair
      return 0.34 + (pairRank / 14) * 0.16; // Middle / bottom pair
    }
    default: {
      const hi = Math.max(RANK_VALUE[hole[0].rank], RANK_VALUE[hole[1].rank]);
      return 0.12 + (hi / 14) * 0.16;
    }
  }
}
