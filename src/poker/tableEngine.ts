import type { Card, DecisionGrade, Position, Street } from './types';
import { accuracyFromGrade, gradeFromEvLoss } from './types';
import {
  canonicalHandKey,
  createDeck,
  evaluateHand,
  handStrengthScore,
  RANK_VALUE,
  shuffleDeck,
} from './evaluator';
import { requiredEquityPct } from './math';

export type BotArchetype =
  | 'Balanced Reg'
  | 'Tight-Aggressive'
  | 'Loose-Aggressive'
  | 'Calling Station'
  | 'Tight Nit'
  | 'Maniac';

export const ALL_BOT_ARCHETYPES: BotArchetype[] = [
  'Balanced Reg',
  'Tight-Aggressive',
  'Loose-Aggressive',
  'Calling Station',
  'Tight Nit',
  'Maniac',
];

export type ArenaSize = 2 | 3 | 4 | 6;
export type PoolPresetId =
  | 'mixed'
  | 'microstakes'
  | 'reg_wars'
  | 'lag_chaos'
  | 'heads_up'
  | 'custom';

export type HeroPositionLock = 'ROTATE' | 'BTN' | 'BB' | 'CO';
export type BotSpeed = 'normal' | 'fast';

export interface ArenaConfig {
  tableSize: ArenaSize;
  startingStackBb: 50 | 100 | 200;
  poolPreset: PoolPresetId;
  botArchetypes: BotArchetype[]; // Length = tableSize - 1
  heroPositionLock: HeroPositionLock;
  blindReadMode: boolean;
  fastFold: boolean;
  speed: BotSpeed;
}

export interface SeatHudStats {
  handsDealt: number;
  vpipHands: number;
  pfrHands: number;
  threeBetHands: number;
  threeBetOpps: number;
  postflopAggActs: number;
  postflopCalls: number;
  handsWon: number;
}

export interface HudDisplayMetrics {
  vpipPct: number;
  pfrPct: number;
  threeBetPct: number;
  af: string;
}

export interface TableSeat {
  seatIndex: number; // 0 = Hero (bottom center), 1..(N-1) clockwise
  name: string;
  isHero: boolean;
  archetype: BotArchetype | 'Hero';
  position: Position;
  stackBb: number;
  streetBetBb: number;
  totalInvestedBb: number;
  cards: [Card, Card] | null;
  folded: boolean;
  allIn: boolean;
  actedThisStreet: boolean;
  lastActionText: string;
  // Per-hand HUD tracking flags
  didVpipThisHand: boolean;
  didPfrThisHand: boolean;
  didThreeBetThisHand: boolean;
  hadThreeBetOppThisHand: boolean;
  stats: SeatHudStats;
}

export interface HeroStreetAudit {
  street: Street;
  position: Position;
  chosenAction: string;
  recommendedAction: string;
  evLossBb: number;
  grade: DecisionGrade;
  accuracyScore: number;
  note: string;
  villainName?: string;
  villainArchetype?: BotArchetype;
}

export interface TableActionLogItem {
  street: Street;
  seatName: string;
  position: Position;
  text: string;
}

export type TablePhase = 'IDLE' | 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN';

export interface PokerTableState {
  config: ArenaConfig;
  handNumber: number;
  phase: TablePhase;
  buttonSeatIndex: number;
  actingSeatIndex: number | null;
  preflopAggressorSeatIndex: number | null;
  preflopRaiseCount: number;
  potBb: number;
  currentBetBb: number;
  minRaiseBb: number;
  board: Card[];
  deck: Card[];
  seats: TableSeat[];
  actionLog: TableActionLogItem[];
  heroAudits: HeroStreetAudit[];
  winnerSummary: string | null;
  winnerSeatIndices: number[];
}

export const POSITIONS_BY_SIZE: Record<ArenaSize, Position[]> = {
  2: ['BTN', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'SB', 'BB', 'CO'],
  6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
};

export const SEAT_POSITIONS_FROM_BTN: Position[] = POSITIONS_BY_SIZE[6];

const BOT_NAMES = ['V. Mercer', 'K. Sato', 'D. Novak', 'M. Vance', 'E. Lind'];

export const POOL_PRESET_SPECS: Record<
  Exclude<PoolPresetId, 'custom'>,
  {
    tableSize: ArenaSize;
    startingStackBb: 50 | 100 | 200;
    archetypes: BotArchetype[];
  }
> = {
  mixed: {
    tableSize: 6,
    startingStackBb: 100,
    archetypes: [
      'Balanced Reg',
      'Tight-Aggressive',
      'Loose-Aggressive',
      'Calling Station',
      'Tight Nit',
    ],
  },
  microstakes: {
    tableSize: 6,
    startingStackBb: 100,
    archetypes: [
      'Calling Station',
      'Tight Nit',
      'Calling Station',
      'Maniac',
      'Calling Station',
    ],
  },
  reg_wars: {
    tableSize: 6,
    startingStackBb: 100,
    archetypes: [
      'Balanced Reg',
      'Tight-Aggressive',
      'Balanced Reg',
      'Loose-Aggressive',
      'Tight-Aggressive',
    ],
  },
  lag_chaos: {
    tableSize: 4,
    startingStackBb: 100,
    archetypes: ['Loose-Aggressive', 'Maniac', 'Loose-Aggressive'],
  },
  heads_up: {
    tableSize: 2,
    startingStackBb: 100,
    archetypes: ['Balanced Reg'],
  },
};

export const DEFAULT_ARENA_CONFIG: ArenaConfig = {
  tableSize: 6,
  startingStackBb: 100,
  poolPreset: 'mixed',
  botArchetypes: [...POOL_PRESET_SPECS.mixed.archetypes],
  heroPositionLock: 'ROTATE',
  blindReadMode: false,
  fastFold: false,
  speed: 'normal',
};

export function buildPresetConfig(
  preset: Exclude<PoolPresetId, 'custom'>,
  base: ArenaConfig = DEFAULT_ARENA_CONFIG
): ArenaConfig {
  const spec = POOL_PRESET_SPECS[preset];
  const validLock: HeroPositionLock =
    base.heroPositionLock !== 'ROTATE' &&
    POSITIONS_BY_SIZE[spec.tableSize].includes(base.heroPositionLock)
      ? base.heroPositionLock
      : 'ROTATE';

  return {
    ...base,
    poolPreset: preset,
    tableSize: spec.tableSize,
    startingStackBb: spec.startingStackBb,
    botArchetypes: [...spec.archetypes],
    heroPositionLock: validLock,
  };
}

export function resizeConfigArchetypes(
  current: BotArchetype[],
  tableSize: ArenaSize
): BotArchetype[] {
  const needed = tableSize - 1;
  const fallback = POOL_PRESET_SPECS.mixed.archetypes;
  const out: BotArchetype[] = [];
  for (let i = 0; i < needed; i++) {
    out.push(current[i] ?? fallback[i % fallback.length]);
  }
  return out;
}

export function createEmptyHudStats(): SeatHudStats {
  return {
    handsDealt: 0,
    vpipHands: 0,
    pfrHands: 0,
    threeBetHands: 0,
    threeBetOpps: 0,
    postflopAggActs: 0,
    postflopCalls: 0,
    handsWon: 0,
  };
}

export function computeHudDisplay(stats: SeatHudStats): HudDisplayMetrics {
  const h = Math.max(1, stats.handsDealt);
  const vpipPct = stats.handsDealt > 0 ? Math.round((stats.vpipHands / h) * 100) : 0;
  const pfrPct = stats.handsDealt > 0 ? Math.round((stats.pfrHands / h) * 100) : 0;
  const threeBetPct =
    stats.threeBetOpps > 0
      ? Math.round((stats.threeBetHands / stats.threeBetOpps) * 100)
      : 0;
  const af =
    stats.postflopCalls === 0
      ? stats.postflopAggActs > 0
        ? `${stats.postflopAggActs.toFixed(1)}`
        : '—'
      : (stats.postflopAggActs / stats.postflopCalls).toFixed(1);

  return { vpipPct, pfrPct, threeBetPct, af };
}

export function roundBb(v: number): number {
  return Math.round(v * 10) / 10;
}

export function createTableFromConfig(config: ArenaConfig): PokerTableState {
  const normalizedArchetypes = resizeConfigArchetypes(config.botArchetypes, config.tableSize);
  const normalizedConfig: ArenaConfig = {
    ...config,
    botArchetypes: normalizedArchetypes,
  };
  const positions = POSITIONS_BY_SIZE[normalizedConfig.tableSize];

  const seats: TableSeat[] = [
    {
      seatIndex: 0,
      name: 'Hero (You)',
      isHero: true,
      archetype: 'Hero',
      position: positions[0],
      stackBb: normalizedConfig.startingStackBb,
      streetBetBb: 0,
      totalInvestedBb: 0,
      cards: null,
      folded: false,
      allIn: false,
      actedThisStreet: false,
      lastActionText: '',
      didVpipThisHand: false,
      didPfrThisHand: false,
      didThreeBetThisHand: false,
      hadThreeBetOppThisHand: false,
      stats: createEmptyHudStats(),
    },
    ...normalizedArchetypes.map((arch, i) => ({
      seatIndex: i + 1,
      name: BOT_NAMES[i % BOT_NAMES.length],
      isHero: false,
      archetype: arch,
      position: positions[i + 1],
      stackBb: normalizedConfig.startingStackBb,
      streetBetBb: 0,
      totalInvestedBb: 0,
      cards: null,
      folded: false,
      allIn: false,
      actedThisStreet: false,
      lastActionText: '',
      didVpipThisHand: false,
      didPfrThisHand: false,
      didThreeBetThisHand: false,
      hadThreeBetOppThisHand: false,
      stats: createEmptyHudStats(),
    })),
  ];

  return {
    config: normalizedConfig,
    handNumber: 0,
    phase: 'IDLE',
    // Set so the first deal rotates BTN cleanly onto seat 0 (Hero)
    buttonSeatIndex: normalizedConfig.tableSize - 1,
    actingSeatIndex: null,
    preflopAggressorSeatIndex: null,
    preflopRaiseCount: 0,
    potBb: 0,
    currentBetBb: 0,
    minRaiseBb: 1,
    board: [],
    deck: [],
    seats,
    actionLog: [],
    heroAudits: [],
    winnerSummary: null,
    winnerSeatIndices: [],
  };
}

export function createInitialTable(): PokerTableState {
  return createTableFromConfig(DEFAULT_ARENA_CONFIG);
}

function assignPositions(seats: TableSeat[], buttonSeatIndex: number, size: ArenaSize): TableSeat[] {
  const posOrder = POSITIONS_BY_SIZE[size];
  return seats.map((s) => {
    const offset = (s.seatIndex - buttonSeatIndex + size) % size;
    return {
      ...s,
      position: posOrder[offset],
    };
  });
}

function computeNextButtonIndex(prev: PokerTableState): number {
  const size = prev.config.tableSize;
  const lock = prev.config.heroPositionLock;
  if (lock !== 'ROTATE') {
    const posOrder = POSITIONS_BY_SIZE[size];
    const desiredOffset = posOrder.indexOf(lock);
    if (desiredOffset >= 0) {
      // Hero is seatIndex 0 -> (0 - btn + size) % size === desiredOffset => btn = (size - desiredOffset) % size
      return (size - desiredOffset) % size;
    }
  }
  return (prev.buttonSeatIndex + 1) % size;
}

export function startNewHand(
  prev: PokerTableState,
  rng: () => number = Math.random
): PokerTableState {
  const size = prev.config.tableSize;
  const defaultStack = prev.config.startingStackBb;
  const nextBtn = computeNextButtonIndex(prev);
  const deck = shuffleDeck(createDeck(), rng);
  let cursor = 0;

  // Auto top-up short stacks below 20% of starting stack for seamless practice
  const minThreshold = Math.max(15, defaultStack * 0.2);
  let seats: TableSeat[] = prev.seats.map((s) => {
    const toppedStack = s.stackBb < minThreshold ? defaultStack : roundBb(s.stackBb);
    const c1 = deck[cursor++];
    const c2 = deck[cursor++];
    return {
      ...s,
      stackBb: toppedStack,
      streetBetBb: 0,
      totalInvestedBb: 0,
      cards: [c1, c2],
      folded: false,
      allIn: false,
      actedThisStreet: false,
      lastActionText: '',
      didVpipThisHand: false,
      didPfrThisHand: false,
      didThreeBetThisHand: false,
      hadThreeBetOppThisHand: false,
      stats: {
        ...s.stats,
        handsDealt: s.stats.handsDealt + 1,
      },
    };
  });

  seats = assignPositions(seats, nextBtn, size);

  // Heads-Up rule: BTN posts SB (0.5bb) and acts FIRST preflop; BB posts 1bb and acts first postflop
  const sbSeat =
    size === 2
      ? seats.find((s) => s.position === 'BTN')!
      : seats.find((s) => s.position === 'SB')!;
  const bbSeat = seats.find((s) => s.position === 'BB')!;

  const postBlind = (seat: TableSeat, amount: number) => {
    const posted = Math.min(seat.stackBb, amount);
    seat.stackBb = roundBb(seat.stackBb - posted);
    seat.streetBetBb = roundBb(posted);
    seat.totalInvestedBb = roundBb(posted);
    if (seat.stackBb <= 0) seat.allIn = true;
    seat.lastActionText = `Blind ${posted}bb`;
    return posted;
  };

  const sbAmt = postBlind(sbSeat, 0.5);
  const bbAmt = postBlind(bbSeat, 1.0);

  // First preflop actor: seat immediately left of BB (in 2-max that wraps to BTN/SB!)
  const firstPreflopIndex = (bbSeat.seatIndex + 1) % size;

  return {
    ...prev,
    handNumber: prev.handNumber + 1,
    phase: 'PREFLOP',
    buttonSeatIndex: nextBtn,
    actingSeatIndex: firstPreflopIndex,
    preflopAggressorSeatIndex: null,
    preflopRaiseCount: 0,
    potBb: roundBb(sbAmt + bbAmt),
    currentBetBb: 1.0,
    minRaiseBb: 2.0,
    board: [],
    deck: deck.slice(cursor),
    seats,
    actionLog: [
      {
        street: 'preflop',
        seatName: sbSeat.name,
        position: sbSeat.position,
        text: `Posts SB ${sbAmt}bb`,
      },
      {
        street: 'preflop',
        seatName: bbSeat.name,
        position: bbSeat.position,
        text: `Posts BB ${bbAmt}bb`,
      },
    ],
    heroAudits: [],
    winnerSummary: null,
    winnerSeatIndices: [],
  };
}

export function rebuyHeroTo100(state: PokerTableState): PokerTableState {
  const target = state.config.startingStackBb;
  return {
    ...state,
    seats: state.seats.map((s) => (s.isHero ? { ...s, stackBb: target } : s)),
  };
}

export interface LegalActions {
  canFold: boolean;
  canCheck: boolean;
  callAmountBb: number;
  canBetOrRaise: boolean;
  isBet: boolean;
  minTotalBetBb: number;
  maxTotalBetBb: number;
}

export function getLegalActions(state: PokerTableState, seatIndex: number): LegalActions {
  const seat = state.seats[seatIndex];
  const toCall = Math.max(0, roundBb(state.currentBetBb - seat.streetBetBb));
  const callAmountBb = Math.min(seat.stackBb, toCall);
  const canCheck = toCall === 0;
  const maxTotalBetBb = roundBb(seat.streetBetBb + seat.stackBb);
  const isBet = state.currentBetBb === 0;
  const minTotalBetBb = isBet
    ? Math.min(maxTotalBetBb, 1.0)
    : Math.min(maxTotalBetBb, roundBb(Math.max(state.currentBetBb + 1.0, state.minRaiseBb)));
  const canBetOrRaise = seat.stackBb > callAmountBb && maxTotalBetBb > state.currentBetBb;

  return {
    canFold: toCall > 0,
    canCheck,
    callAmountBb,
    canBetOrRaise,
    isBet,
    minTotalBetBb,
    maxTotalBetBb,
  };
}

/**
 * Fast draw & board-texture detector for smarter postflop bot strategy & EV audits.
 */
function detectDrawBonus(hole: [Card, Card], board: Card[]): {
  flushDraw: boolean;
  straightDraw: boolean;
  bonus: number;
} {
  if (board.length < 3 || board.length >= 5) {
    return { flushDraw: false, straightDraw: false, bonus: 0 };
  }
  const all = [...hole, ...board];
  const suitCounts: Record<string, number> = { s: 0, h: 0, d: 0, c: 0 };
  for (const c of all) suitCounts[c.suit]++;
  const flushDraw =
    (suitCounts[hole[0].suit] === 4 || suitCounts[hole[1].suit] === 4) &&
    (board.filter((b) => b.suit === hole[0].suit).length >= 2 ||
      board.filter((b) => b.suit === hole[1].suit).length >= 2);

  // Open-ended or strong straight draw check (4 distinct ranks within a 5-card span)
  const vals = Array.from(new Set(all.map((c) => RANK_VALUE[c.rank]))).sort((a, b) => a - b);
  if (vals.includes(14)) vals.unshift(1); // Ace low
  let straightDraw = false;
  for (let i = 0; i <= vals.length - 4; i++) {
    if (vals[i + 3] - vals[i] <= 4) {
      straightDraw = true;
      break;
    }
  }

  let bonus = 0;
  if (flushDraw) bonus += 0.14;
  if (straightDraw) bonus += 0.1;
  return { flushDraw, straightDraw, bonus };
}

function isBoardWet(board: Card[]): boolean {
  if (board.length < 3) return false;
  const suitCounts: Record<string, number> = { s: 0, h: 0, d: 0, c: 0 };
  for (const c of board) suitCounts[c.suit]++;
  const twoToneOrMonotone = Object.values(suitCounts).some((n) => n >= 2);
  const vals = Array.from(new Set(board.map((c) => RANK_VALUE[c.rank]))).sort((a, b) => a - b);
  let connected = false;
  for (let i = 0; i < vals.length - 1; i++) {
    if (vals[i + 1] - vals[i] <= 2) {
      connected = true;
      break;
    }
  }
  return twoToneOrMonotone && connected;
}

function getPrimaryVillain(state: PokerTableState): TableSeat | null {
  if (
    state.preflopAggressorSeatIndex !== null &&
    state.preflopAggressorSeatIndex !== 0 &&
    !state.seats[state.preflopAggressorSeatIndex]?.folded
  ) {
    return state.seats[state.preflopAggressorSeatIndex];
  }
  const activeBots = state.seats.filter((s) => !s.isHero && !s.folded);
  if (activeBots.length === 0) return null;
  return activeBots.sort((a, b) => b.totalInvestedBb - a.totalInvestedBb)[0];
}

function buildExploitativeTip(
  villain: TableSeat | null,
  recommended: 'fold' | 'check' | 'call' | 'raise',
  strength: number
): string {
  if (!villain || villain.archetype === 'Hero') return '';
  const name = villain.name;
  switch (villain.archetype) {
    case 'Calling Station':
      if (recommended === 'raise' && strength >= 0.6) {
        return ` Exploit vs ${name} (Calling Station): size up value bets—they call too wide.`;
      }
      if (recommended === 'check' && strength < 0.35) {
        return ` Exploit vs ${name} (Calling Station): avoid low-equity bluffs that rarely fold them out.`;
      }
      return '';
    case 'Tight Nit':
      if (recommended === 'fold') {
        return ` Exploit vs ${name} (Tight Nit): respect heavy aggression—their continuing range is value-heavy.`;
      }
      if (recommended === 'raise' && strength < 0.55) {
        return ` Exploit vs ${name} (Tight Nit): steady pressure steals pots when they miss.`;
      }
      return '';
    case 'Loose-Aggressive':
    case 'Maniac':
      if (recommended === 'call') {
        return ` Exploit vs ${name} (${villain.archetype}): widen bluff-catching calls against over-aggression.`;
      }
      return '';
    case 'Tight-Aggressive':
      return ` Note vs ${name} (TAG): keep ranges disciplined and watch blockers on wet boards.`;
    case 'Balanced Reg':
      return ` Note vs ${name} (Balanced Reg): mix value and draw semi-bluffs to stay unexploitable.`;
  }
}

function evaluateHeroActionForAudit(
  state: PokerTableState,
  seat: TableSeat,
  actionType: 'fold' | 'check' | 'call' | 'raise',
  raiseToBb?: number
): HeroStreetAudit {
  const street: Street =
    state.phase === 'PREFLOP'
      ? 'preflop'
      : state.phase === 'FLOP'
        ? 'flop'
        : state.phase === 'TURN'
          ? 'turn'
          : 'river';
  const cards = seat.cards!;
  const baseStrength = handStrengthScore(cards, state.board);
  const drawInfo = detectDrawBonus(cards, state.board);
  const strength = Math.min(1, baseStrength + drawInfo.bonus * 0.65);
  const toCall = Math.max(0, roundBb(state.currentBetBb - seat.streetBetBb));
  const reqEq = toCall > 0 ? requiredEquityPct(state.potBb, toCall) / 100 : 0;
  const villain = getPrimaryVillain(state);

  // Subtle exploitative threshold shifts vs extreme bot archetypes
  let villainCallAdjust = 0;
  if (villain?.archetype === 'Tight Nit' && toCall > 2) villainCallAdjust = 0.08;
  if (villain?.archetype === 'Maniac' || villain?.archetype === 'Loose-Aggressive') {
    villainCallAdjust = -0.05;
  }

  let recommended: 'fold' | 'check' | 'call' | 'raise' = 'check';
  let note = '';

  if (toCall === 0) {
    if (strength >= 0.62) {
      recommended = 'raise';
      note = `Strong holding (${canonicalHandKey(cards[0], cards[1])}) builds value by betting/raising on ${street}.`;
    } else if (drawInfo.flushDraw && state.preflopAggressorSeatIndex === 0 && street !== 'river') {
      recommended = 'raise';
      note = `High-equity draw with preflop initiative makes a strong semi-bluff c-bet on ${street}.`;
    } else if (strength <= 0.28 && street !== 'preflop') {
      recommended = 'check';
      note = `Weak showdown value prefers checking or selective bluffing rather than thin betting.`;
    } else {
      recommended = 'check';
      note = `Medium strength hand plays cleanly as a check for pot control on ${street}.`;
    }
  } else {
    if (strength >= Math.max(0.72, reqEq + 0.32)) {
      recommended = 'raise';
      note = `High equity vs current bet supports raising for value and protection.`;
    } else if (strength >= reqEq - 0.04 + villainCallAdjust) {
      recommended = 'call';
      note = `Hand strength clears required pot odds (${Math.round(reqEq * 100)}%)—calling is +EV.`;
    } else {
      recommended = 'fold';
      note = `Facing ${toCall}bb requires ${Math.round(reqEq * 100)}% equity; folding preserves stack.`;
    }
  }

  if (!state.config.blindReadMode) {
    note += buildExploitativeTip(villain, recommended, strength);
  }

  let evLossBb = 0;
  if (actionType !== recommended) {
    if (actionType === 'fold' && strength > reqEq + 0.22) {
      evLossBb = roundBb(Math.min(3.5, state.potBb * 0.25));
    } else if (actionType === 'call' && strength < reqEq - 0.14) {
      evLossBb = roundBb(Math.min(4.0, toCall * 0.45));
    } else if (actionType === 'raise' && strength < 0.35 && toCall > 2) {
      evLossBb = roundBb(Math.min(3.0, (raiseToBb ?? toCall) * 0.2));
    } else {
      evLossBb = 0.12;
    }
  }

  const chosenLabel =
    actionType === 'fold'
      ? 'Fold'
      : actionType === 'check'
        ? 'Check'
        : actionType === 'call'
          ? `Call ${toCall}bb`
          : `${state.currentBetBb === 0 ? 'Bet' : 'Raise'} ${roundBb(raiseToBb ?? state.minRaiseBb)}bb`;

  const recLabel =
    recommended === 'fold'
      ? 'Fold'
      : recommended === 'check'
        ? 'Check'
        : recommended === 'call'
          ? `Call ${toCall}bb`
          : state.currentBetBb === 0
            ? 'Bet'
            : 'Raise';

  const grade = gradeFromEvLoss(evLossBb, actionType === recommended ? 80 : 10);
  return {
    street,
    position: seat.position,
    chosenAction: chosenLabel,
    recommendedAction: recLabel,
    evLossBb,
    grade,
    accuracyScore: accuracyFromGrade(grade, evLossBb),
    note,
    villainName: villain?.name,
    villainArchetype: villain && villain.archetype !== 'Hero' ? villain.archetype : undefined,
  };
}

function activeSeats(seats: TableSeat[]): TableSeat[] {
  return seats.filter((s) => !s.folded);
}

function canActSeats(seats: TableSeat[]): TableSeat[] {
  return seats.filter((s) => !s.folded && !s.allIn);
}

function nextSeatToAct(seats: TableSeat[], fromIndex: number): number | null {
  const n = seats.length;
  for (let step = 1; step <= n; step++) {
    const idx = (fromIndex + step) % n;
    const s = seats[idx];
    if (!s.folded && !s.allIn && !s.actedThisStreet) {
      return idx;
    }
  }
  return null;
}

function resolveShowdown(state: PokerTableState): PokerTableState {
  const contenders = activeSeats(state.seats);
  const seats = state.seats.map((s) => ({ ...s, stats: { ...s.stats } }));
  const deck = [...state.deck];
  const board = [...state.board];

  while (board.length < 5 && deck.length > 0) {
    board.push(deck.shift()!);
  }

  if (contenders.length === 1) {
    const winner = seats[contenders[0].seatIndex];
    winner.stackBb = roundBb(winner.stackBb + state.potBb);
    winner.stats.handsWon += 1;
    return {
      ...state,
      phase: 'SHOWDOWN',
      actingSeatIndex: null,
      board,
      deck,
      seats,
      winnerSeatIndices: [winner.seatIndex],
      winnerSummary: `${winner.name} (${winner.position}) wins ${state.potBb}bb uncontested.`,
    };
  }

  const evaluated = contenders.map((c) => ({
    seatIndex: c.seatIndex,
    eval: evaluateHand([...c.cards!, ...board]),
  }));
  const bestScore = Math.max(...evaluated.map((e) => e.eval.score));
  const winners = evaluated.filter((e) => e.eval.score === bestScore);
  const splitShare = roundBb(state.potBb / winners.length);
  let distributed = 0;

  winners.forEach((w, i) => {
    const share = i === winners.length - 1 ? roundBb(state.potBb - distributed) : splitShare;
    distributed = roundBb(distributed + share);
    seats[w.seatIndex].stackBb = roundBb(seats[w.seatIndex].stackBb + share);
    seats[w.seatIndex].stats.handsWon += 1;
  });

  const winnerNames = winners
    .map((w) => `${seats[w.seatIndex].name} (${seats[w.seatIndex].position})`)
    .join(' & ');

  return {
    ...state,
    phase: 'SHOWDOWN',
    actingSeatIndex: null,
    board,
    deck,
    seats,
    winnerSeatIndices: winners.map((w) => w.seatIndex),
    winnerSummary: `${winnerNames} wins ${state.potBb}bb with ${winners[0].eval.label}.`,
  };
}

function advanceStreet(state: PokerTableState): PokerTableState {
  const deck = [...state.deck];
  const board = [...state.board];
  let nextPhase: TablePhase = state.phase;

  if (state.phase === 'PREFLOP') {
    board.push(deck.shift()!, deck.shift()!, deck.shift()!);
    nextPhase = 'FLOP';
  } else if (state.phase === 'FLOP') {
    board.push(deck.shift()!);
    nextPhase = 'TURN';
  } else if (state.phase === 'TURN') {
    board.push(deck.shift()!);
    nextPhase = 'RIVER';
  } else {
    return resolveShowdown(state);
  }

  const seats = state.seats.map((s) => ({
    ...s,
    streetBetBb: 0,
    actedThisStreet: s.folded || s.allIn,
    lastActionText: s.folded ? 'Folded' : s.allIn ? 'All-In' : '',
  }));

  if (canActSeats(seats).length <= 1) {
    return resolveShowdown({
      ...state,
      phase: nextPhase,
      board,
      deck,
      seats,
      currentBetBb: 0,
      minRaiseBb: 1.0,
    });
  }

  // Postflop starts with first active player left of Button (in 2-max that's BB!)
  const firstActor = nextSeatToAct(seats, state.buttonSeatIndex);

  return {
    ...state,
    phase: nextPhase,
    board,
    deck,
    seats,
    currentBetBb: 0,
    minRaiseBb: 1.0,
    actingSeatIndex: firstActor,
  };
}

export function applyPlayerAction(
  state: PokerTableState,
  seatIndex: number,
  actionType: 'fold' | 'check' | 'call' | 'raise',
  raiseToBb?: number
): PokerTableState {
  if (state.phase === 'IDLE' || state.phase === 'SHOWDOWN') return state;
  if (state.actingSeatIndex !== seatIndex) return state;

  const seats = state.seats.map((s) => ({ ...s, stats: { ...s.stats } }));
  const actor = seats[seatIndex];
  const legal = getLegalActions(state, seatIndex);
  const currentStreet: Street =
    state.phase === 'PREFLOP'
      ? 'preflop'
      : state.phase === 'FLOP'
        ? 'flop'
        : state.phase === 'TURN'
          ? 'turn'
          : 'river';

  const heroAudits = [...state.heroAudits];
  if (actor.isHero && actor.cards) {
    heroAudits.push(evaluateHeroActionForAudit(state, actor, actionType, raiseToBb));
  }

  let potBb = state.potBb;
  let currentBetBb = state.currentBetBb;
  let minRaiseBb = state.minRaiseBb;
  let preflopAggressorSeatIndex = state.preflopAggressorSeatIndex;
  let preflopRaiseCount = state.preflopRaiseCount;
  let actionText = '';

  // Record 3-bet opportunity when facing a single open raise preflop
  if (currentStreet === 'preflop' && preflopRaiseCount === 1 && !actor.hadThreeBetOppThisHand) {
    actor.hadThreeBetOppThisHand = true;
    actor.stats.threeBetOpps += 1;
  }

  if (actionType === 'fold') {
    actor.folded = true;
    actor.actedThisStreet = true;
    actor.lastActionText = 'Fold';
    actionText = 'Folds';
  } else if (actionType === 'check') {
    actor.actedThisStreet = true;
    actor.lastActionText = 'Check';
    actionText = 'Checks';
  } else if (actionType === 'call') {
    const putIn = legal.callAmountBb;
    actor.stackBb = roundBb(actor.stackBb - putIn);
    actor.streetBetBb = roundBb(actor.streetBetBb + putIn);
    actor.totalInvestedBb = roundBb(actor.totalInvestedBb + putIn);
    potBb = roundBb(potBb + putIn);
    actor.actedThisStreet = true;

    if (currentStreet === 'preflop' && !actor.didVpipThisHand) {
      actor.didVpipThisHand = true;
      actor.stats.vpipHands += 1;
    } else if (currentStreet !== 'preflop') {
      actor.stats.postflopCalls += 1;
    }

    if (actor.stackBb <= 0) {
      actor.allIn = true;
      actor.lastActionText = `All-In ${actor.streetBetBb}bb`;
      actionText = `Calls All-In (${putIn}bb)`;
    } else {
      actor.lastActionText = `Call ${putIn}bb`;
      actionText = `Calls ${putIn}bb`;
    }
  } else {
    const clampedTarget = roundBb(
      Math.max(legal.minTotalBetBb, Math.min(legal.maxTotalBetBb, raiseToBb ?? legal.minTotalBetBb))
    );
    const putIn = roundBb(clampedTarget - actor.streetBetBb);
    const raiseDelta = roundBb(clampedTarget - currentBetBb);

    actor.stackBb = roundBb(actor.stackBb - putIn);
    actor.streetBetBb = clampedTarget;
    actor.totalInvestedBb = roundBb(actor.totalInvestedBb + putIn);
    potBb = roundBb(potBb + putIn);
    minRaiseBb = roundBb(clampedTarget + Math.max(1.0, raiseDelta));
    const wasBet = currentBetBb === 0;
    currentBetBb = clampedTarget;

    if (currentStreet === 'preflop') {
      preflopRaiseCount += 1;
      preflopAggressorSeatIndex = seatIndex;
      if (!actor.didVpipThisHand) {
        actor.didVpipThisHand = true;
        actor.stats.vpipHands += 1;
      }
      if (!actor.didPfrThisHand) {
        actor.didPfrThisHand = true;
        actor.stats.pfrHands += 1;
      }
      if (preflopRaiseCount === 2 && !actor.didThreeBetThisHand) {
        actor.didThreeBetThisHand = true;
        actor.stats.threeBetHands += 1;
      }
    } else {
      actor.stats.postflopAggActs += 1;
    }

    for (const s of seats) {
      if (s.seatIndex === seatIndex) {
        s.actedThisStreet = true;
      } else if (!s.folded && !s.allIn) {
        s.actedThisStreet = false;
      }
    }

    if (actor.stackBb <= 0) {
      actor.allIn = true;
      actor.lastActionText = `All-In ${clampedTarget}bb`;
      actionText = `Goes All-In to ${clampedTarget}bb`;
    } else {
      const verb =
        currentStreet === 'preflop' && preflopRaiseCount === 2
          ? '3-Bet'
          : currentStreet === 'preflop' && preflopRaiseCount >= 3
            ? '4-Bet'
            : wasBet
              ? 'Bet'
              : 'Raise';
      actor.lastActionText = `${verb} ${clampedTarget}bb`;
      actionText =
        verb === '3-Bet' || verb === '4-Bet'
          ? `${verb}s to ${clampedTarget}bb`
          : `${wasBet ? 'Bets' : 'Raises to'} ${clampedTarget}bb`;
    }
  }

  const nextState: PokerTableState = {
    ...state,
    potBb,
    currentBetBb,
    minRaiseBb,
    preflopAggressorSeatIndex,
    preflopRaiseCount,
    seats,
    heroAudits,
    actionLog: [
      ...state.actionLog,
      {
        street: currentStreet,
        seatName: actor.name,
        position: actor.position,
        text: actionText,
      },
    ],
  };

  if (activeSeats(seats).length === 1) {
    return resolveShowdown(nextState);
  }

  const nextActor = nextSeatToAct(seats, seatIndex);
  if (nextActor === null) {
    return advanceStreet(nextState);
  }

  return {
    ...nextState,
    actingSeatIndex: nextActor,
  };
}

/**
 * Position-looseness adjustment for preflop play:
 * UTG plays tightest (-0.09); BTN & HU BTN play widest (+0.07 to +0.14).
 */
function preflopPositionShift(pos: Position, tableSize: ArenaSize): number {
  if (tableSize === 2) {
    return pos === 'BTN' ? 0.14 : 0.08;
  }
  switch (pos) {
    case 'UTG':
      return -0.09;
    case 'HJ':
      return -0.04;
    case 'CO':
      return 0.02;
    case 'BTN':
      return 0.08;
    case 'SB':
      return 0.03;
    case 'BB':
      return 0.05;
  }
}

/**
 * Smarter position-, initiative-, texture-, and draw-aware strategic bot policy
 * across all 6 distinct poker archetypes.
 */
export function chooseBotAction(
  state: PokerTableState,
  seatIndex: number,
  rng: () => number = Math.random
): { type: 'fold' | 'check' | 'call' | 'raise'; raiseToBb?: number } {
  const seat = state.seats[seatIndex];
  const legal = getLegalActions(state, seatIndex);
  const rawStrength = seat.cards ? handStrengthScore(seat.cards, state.board) : 0.4;
  const draw = seat.cards
    ? detectDrawBonus(seat.cards, state.board)
    : { flushDraw: false, straightDraw: false, bonus: 0 };
  const wetBoard = isBoardWet(state.board);
  const contenders = activeSeats(state.seats).length;
  const isMultiway = contenders >= 3;
  const hasInitiative = state.preflopAggressorSeatIndex === seatIndex;
  const toCall = legal.callAmountBb;
  const potOdds = toCall > 0 ? requiredEquityPct(state.potBb, toCall) / 100 : 0;

  // Archetype parameters: [loosenessShift, aggressionBoost, bluffFreq, callStickiness]
  const profile: Record<BotArchetype, [number, number, number, number]> = {
    'Balanced Reg': [0.0, 0.05, 0.16, 0.0],
    'Tight-Aggressive': [-0.07, 0.1, 0.1, -0.03],
    'Loose-Aggressive': [0.09, 0.15, 0.27, 0.03],
    'Calling Station': [0.13, -0.15, 0.03, 0.16],
    'Tight Nit': [-0.15, -0.05, 0.03, -0.1],
    Maniac: [0.17, 0.24, 0.42, 0.08],
  };

  const [looseShift, aggBoost, bluffFreq, callStickiness] =
    seat.archetype === 'Hero' ? [0, 0, 0, 0] : profile[seat.archetype];

  const posShift =
    state.phase === 'PREFLOP' ? preflopPositionShift(seat.position, state.config.tableSize) : 0;
  const multiwayPenalty = isMultiway && state.phase !== 'PREFLOP' ? -0.05 : 0;
  const noise = (rng() - 0.5) * 0.07;

  const effStrength = Math.min(
    1,
    Math.max(0, rawStrength + draw.bonus * 0.7 + looseShift + posShift + multiwayPenalty + noise)
  );

  const pickSizing = () => {
    if (state.phase === 'PREFLOP') {
      if (state.currentBetBb <= 1.0) {
        const openSize = seat.position === 'SB' ? 3.0 : state.config.tableSize === 2 ? 2.2 : 2.5;
        return Math.max(legal.minTotalBetBb, Math.min(legal.maxTotalBetBb, openSize));
      }
      const mult = seat.archetype === 'Maniac' ? 3.5 : 3.0;
      const target = roundBb(Math.min(legal.maxTotalBetBb, state.currentBetBb * mult));
      return Math.max(legal.minTotalBetBb, Math.min(legal.maxTotalBetBb, target));
    }

    // Postflop texture-aware sizing: smaller c-bets on dry boards (33-50%), larger on wet boards (66-75%)
    const potFrac =
      seat.archetype === 'Maniac'
        ? 0.85
        : wetBoard || effStrength > 0.8
          ? 0.72
          : hasInitiative && state.phase === 'FLOP'
            ? 0.38
            : 0.52;
    const raw =
      state.currentBetBb === 0
        ? Math.max(1.0, state.potBb * potFrac)
        : state.currentBetBb * 2.6;
    return roundBb(Math.max(legal.minTotalBetBb, Math.min(legal.maxTotalBetBb, raw)));
  };

  // Preflop open / 3-bet / defense logic
  if (state.phase === 'PREFLOP') {
    if (legal.canCheck) {
      if (legal.canBetOrRaise && effStrength > 0.64 - aggBoost) {
        return { type: 'raise', raiseToBb: pickSizing() };
      }
      return { type: 'check' };
    }

    const facingOpen = state.preflopRaiseCount === 1;
    const facing3BetPlus = state.preflopRaiseCount >= 2;

    if (legal.canBetOrRaise && state.currentBetBb < state.config.startingStackBb * 0.35) {
      const raiseThresh = facing3BetPlus
        ? 0.84 - aggBoost * 0.4
        : facingOpen
          ? 0.74 - aggBoost
          : 0.56 - aggBoost * 0.7;
      const light3Bet = facingOpen && rng() < bluffFreq * 0.45 && rawStrength > 0.42;
      if (effStrength > raiseThresh || light3Bet) {
        return { type: 'raise', raiseToBb: pickSizing() };
      }
    }

    const callThreshold = facing3BetPlus
      ? potOdds + 0.24 - callStickiness
      : facingOpen
        ? potOdds + 0.14 - callStickiness
        : potOdds + 0.06 - callStickiness;

    if (effStrength >= callThreshold) {
      return { type: 'call' };
    }
    return { type: 'fold' };
  }

  // Postflop: checked to bot
  if (legal.canCheck) {
    const cbetBoost = hasInitiative && state.phase === 'FLOP' && !isMultiway ? 0.12 : 0;
    const semiBluff = (draw.flushDraw || draw.straightDraw) && rng() < 0.55 + aggBoost;
    const pureBluff = !isMultiway && rng() < bluffFreq * (wetBoard ? 0.75 : 1.0);

    if (
      legal.canBetOrRaise &&
      (effStrength > 0.62 - aggBoost - cbetBoost || semiBluff || pureBluff)
    ) {
      return { type: 'raise', raiseToBb: pickSizing() };
    }
    return { type: 'check' };
  }

  // Postflop: facing a bet or raise
  const semiBluffRaise =
    (draw.flushDraw || draw.straightDraw) &&
    state.phase !== 'RIVER' &&
    rng() < bluffFreq * 0.55;

  if (
    legal.canBetOrRaise &&
    state.currentBetBb < state.config.startingStackBb * 0.45 &&
    (effStrength > 0.78 - aggBoost || semiBluffRaise || (rng() < bluffFreq * 0.28 && state.phase !== 'RIVER'))
  ) {
    return { type: 'raise', raiseToBb: pickSizing() };
  }

  if (effStrength >= potOdds + 0.07 - callStickiness) {
    return { type: 'call' };
  }

  return { type: 'fold' };
}
