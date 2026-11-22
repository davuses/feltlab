import type {
  Card,
  DecisionEvaluation,
  Position,
  SolverActionFreq,
  Street,
} from './types';
import { accuracyFromGrade, gradeFromEvLoss } from './types';
import { createSuitRotation, parseCards, rotateCards } from './evaluator';

export type PotType = 'SRP' | '3BP';

export interface PostflopSpotBlueprint {
  id: string;
  title: string;
  street: Exclude<Street, 'preflop'>;
  potType: PotType;
  heroPos: Position;
  villainPos: Position;
  heroInPosition: boolean;
  potBb: number;
  effectiveStackBb: number;
  toCallBb: number;
  heroCards: [string, string];
  board: string[];
  actionLog: string[];
  actions: SolverActionFreq[];
  takeaways: {
    boardTexture: string;
    rangeAdvantage: string;
    blockerNote: string;
    coreRule: string;
  };
}

export interface PostflopDrillSpot {
  id: string;
  title: string;
  street: Exclude<Street, 'preflop'>;
  potType: PotType;
  heroPos: Position;
  villainPos: Position;
  heroInPosition: boolean;
  potBb: number;
  effectiveStackBb: number;
  toCallBb: number;
  heroCards: [Card, Card];
  board: Card[];
  actionLog: string[];
  actions: SolverActionFreq[];
  takeaways: PostflopSpotBlueprint['takeaways'];
}

export const POSTFLOP_BLUEPRINTS: PostflopSpotBlueprint[] = [
  {
    id: 'pf-srp-btn-bb-a72r',
    title: 'BTN C-Bet on Dry Ace-High Rainbow',
    street: 'flop',
    potType: 'SRP',
    heroPos: 'BTN',
    villainPos: 'BB',
    heroInPosition: true,
    potBb: 5.5,
    effectiveStackBb: 97.5,
    toCallBb: 0,
    heroCards: ['Ks', 'Qd'],
    board: ['Ac', '7h', '2d'],
    actionLog: ['BTN opens 2.5bb', 'BB calls', 'Flop: BB checks'],
    actions: [
      { action: 'bet_33', label: 'Bet 33% (1.8bb)', frequency: 82, evBb: 2.94, kind: 'bet' },
      { action: 'check', label: 'Check', frequency: 16, evBb: 2.86, kind: 'check' },
      { action: 'bet_75', label: 'Bet 75% (4.1bb)', frequency: 2, evBb: 2.41, kind: 'bet' },
    ],
    takeaways: {
      boardTexture: 'Dry, disconnected A-high rainbow texture with almost no straight or flush draws.',
      rangeAdvantage: 'BTN holds massive range & nut advantage (AA, AK, AQ, AJ) over BB’s capped flatting range.',
      blockerNote: 'KQo blocks BB’s strong broadway backdoors while benefiting enormously from folding out 6x–5x equity.',
      coreRule: 'When you hold huge range advantage on a dry board, range-bet small (25–33%) at high frequency.',
    },
  },
  {
    id: 'pf-srp-co-bb-765tt',
    title: 'CO C-Bet Check-Back on Low Connected Board',
    street: 'flop',
    potType: 'SRP',
    heroPos: 'CO',
    villainPos: 'BB',
    heroInPosition: true,
    potBb: 5.5,
    effectiveStackBb: 97.5,
    toCallBb: 0,
    heroCards: ['As', 'Kc'],
    board: ['7s', '6s', '5d'],
    actionLog: ['CO opens 2.5bb', 'BB calls', 'Flop: BB checks'],
    actions: [
      { action: 'check', label: 'Check', frequency: 78, evBb: 2.52, kind: 'check' },
      { action: 'bet_33', label: 'Bet 33% (1.8bb)', frequency: 18, evBb: 2.38, kind: 'bet' },
      { action: 'bet_75', label: 'Bet 75% (4.1bb)', frequency: 4, evBb: 1.94, kind: 'bet' },
    ],
    takeaways: {
      boardTexture: 'Hyper-connected low two-tone board favoring two-pairs, sets, and straights.',
      rangeAdvantage: 'BB smashes 7-6-5 with 98s, 84s, 76s, 75s, 65s, and 55–77; CO has zero nut advantage.',
      blockerNote: 'As gives backdoor nut flush equity, making AKo a clear check-back to realize equity safely.',
      coreRule: 'Avoid autopilot c-betting low connected textures where BB holds the nut advantage.',
    },
  },
  {
    id: 'pf-srp-bb-btn-xr-984',
    title: 'BB Check-Raise Semi-Bluff vs Small C-Bet',
    street: 'flop',
    potType: 'SRP',
    heroPos: 'BB',
    villainPos: 'BTN',
    heroInPosition: false,
    potBb: 7.3,
    effectiveStackBb: 95.7,
    toCallBb: 1.8,
    heroCards: ['Jh', 'Th'],
    board: ['9s', '8d', '4h'],
    actionLog: ['BTN opens 2.5bb', 'BB calls', 'Flop: BB checks, BTN bets 1.8bb (33%)'],
    actions: [
      { action: 'raise_xr', label: 'Check-Raise 6.5bb', frequency: 66, evBb: 4.18, kind: 'raise' },
      { action: 'call', label: 'Call 1.8bb', frequency: 34, evBb: 4.02, kind: 'call' },
      { action: 'fold', label: 'Fold', frequency: 0, evBb: 0.0, kind: 'fold' },
    ],
    takeaways: {
      boardTexture: 'Dynamic nine-high rainbow board where BTN’s small range-bet is vulnerable to pressure.',
      rangeAdvantage: 'BB retains 98s, 94s, 84s, 44, and 88, allowing aggressive polarized check-raises.',
      blockerNote: 'JTh has 8 clean straight outs plus two overcards and backdoor hearts—ideal semi-bluff.',
      coreRule: 'Check-raise high-equity open-enders with overcards to build pots and fold out BTN’s air.',
    },
  },
  {
    id: 'pf-3bp-btn-co-k94r',
    title: '3-Bet Pot Range Bet IP on K-High Dry',
    street: 'flop',
    potType: '3BP',
    heroPos: 'BTN',
    villainPos: 'CO',
    heroInPosition: true,
    potBb: 16.5,
    effectiveStackBb: 92.5,
    toCallBb: 0,
    heroCards: ['Qh', 'Jh'],
    board: ['Kd', '9c', '4s'],
    actionLog: ['CO opens 2.5bb', 'BTN 3-bets 7.5bb', 'CO calls', 'Flop: CO checks'],
    actions: [
      { action: 'bet_33', label: 'Bet 33% (5.5bb)', frequency: 88, evBb: 7.95, kind: 'bet' },
      { action: 'check', label: 'Check', frequency: 12, evBb: 7.72, kind: 'check' },
      { action: 'bet_75', label: 'Bet 75% (12.4bb)', frequency: 0, evBb: 6.84, kind: 'bet' },
    ],
    takeaways: {
      boardTexture: 'Static K-high rainbow in a low-SPR (5.6) 3-bet pot.',
      rangeAdvantage: 'BTN has AA, KK, AK, and KQs at full weight while CO rarely holds KK or AK.',
      blockerNote: 'QJh holds a gutshot + backdoor hearts and forces folds from AQo/AJo/66–88.',
      coreRule: 'In 3-bet pots IP on dry K/A-high flops, small 25–33% bets print EV with your entire range.',
    },
  },
  {
    id: 'pf-3bp-sb-btn-qjt-oop',
    title: '3-Bet Pot OOP Polarized Check on Wet Broadway',
    street: 'flop',
    potType: '3BP',
    heroPos: 'SB',
    villainPos: 'BTN',
    heroInPosition: false,
    potBb: 21.0,
    effectiveStackBb: 90.0,
    toCallBb: 0,
    heroCards: ['Ah', 'Ad'],
    board: ['Qs', 'Js', 'Ts'],
    actionLog: ['BTN opens 2.5bb', 'SB 3-bets 10bb', 'BTN calls', 'Flop: Action on SB'],
    actions: [
      { action: 'check', label: 'Check', frequency: 74, evBb: 11.4, kind: 'check' },
      { action: 'bet_33', label: 'Bet 33% (7.0bb)', frequency: 24, evBb: 11.12, kind: 'bet' },
      { action: 'bet_75', label: 'Bet 75% (15.8bb)', frequency: 2, evBb: 9.85, kind: 'bet' },
    ],
    takeaways: {
      boardTexture: 'Monotone Q-J-T broadway board—maximum nut density on both sides.',
      rangeAdvantage: 'Without the As, AA is a vulnerable bluff-catcher facing flushes, straights, and two pairs.',
      blockerNote: 'Holding AhAd removes neither flush combos nor K9s/98s; checking protects your OOP range.',
      coreRule: 'Check vulnerable overpairs without a flush blocker on monotone coordinated flops.',
    },
  },
  {
    id: 'pf-srp-utg-bb-turn-overcard',
    title: 'Turn Overbet Barrel on Clean Overcard',
    street: 'turn',
    potType: 'SRP',
    heroPos: 'UTG',
    villainPos: 'BB',
    heroInPosition: true,
    potBb: 10.5,
    effectiveStackBb: 95.0,
    toCallBb: 0,
    heroCards: ['As', 'Ks'],
    board: ['Td', '6c', '2s', 'Kh'],
    actionLog: [
      'UTG opens 2.5bb, BB calls',
      'Flop Td 6c 2s: BB checks, UTG bets 2.5bb, BB calls',
      'Turn Kh: BB checks',
    ],
    actions: [
      { action: 'bet_75', label: 'Bet 75% (7.9bb)', frequency: 62, evBb: 10.45, kind: 'bet' },
      { action: 'bet_125', label: 'Overbet 125% (13.1bb)', frequency: 34, evBb: 10.38, kind: 'bet' },
      { action: 'check', label: 'Check', frequency: 4, evBb: 8.92, kind: 'check' },
    ],
    takeaways: {
      boardTexture: 'The turn Kh dramatically shifts equity to UTG while leaving flush draws incomplete.',
      rangeAdvantage: 'UTG owns KK, AK, KQ, KT while BB’s flop calling range is heavy on Tx and 6x bluff-catchers.',
      blockerNote: 'Top pair top kicker wants to polarize and charge Tx, 6x, and gutshots heavily.',
      coreRule: 'Size up (75%–125%) on high-card turns that heavily favor the preflop aggressor’s range.',
    },
  },
  {
    id: 'pf-srp-bb-co-turn-call-fd',
    title: 'BB Turn Defense with Combo Draw vs 75% Barrel',
    street: 'turn',
    potType: 'SRP',
    heroPos: 'BB',
    villainPos: 'CO',
    heroInPosition: false,
    potBb: 19.2,
    effectiveStackBb: 86.0,
    toCallBb: 8.2,
    heroCards: ['9d', '8d'],
    board: ['Kd', '7d', '3c', '6h'],
    actionLog: [
      'CO opens 2.5bb, BB calls',
      'Flop Kd 7d 3c: BB checks, CO bets 2.8bb, BB calls',
      'Turn 6h: BB checks, CO bets 8.2bb (75%)',
    ],
    actions: [
      { action: 'call', label: 'Call 8.2bb', frequency: 74, evBb: 4.86, kind: 'call' },
      { action: 'raise_allin', label: 'Check-Raise 24bb', frequency: 26, evBb: 4.68, kind: 'raise' },
      { action: 'fold', label: 'Fold', frequency: 0, evBb: 0.0, kind: 'fold' },
    ],
    takeaways: {
      boardTexture: 'Turn 6h gives Hero an open-ended straight + flush combo draw (15 live outs ≈ 34% river equity).',
      rangeAdvantage: 'CO’s 75% turn barrel is polarized around Kx+ and bluffs; pot odds require only 29.9% equity.',
      blockerNote: 'Pure mathematical call with strong implied odds when hitting hidden straights on non-diamond rivers.',
      coreRule: 'Compare raw draw equity + implied odds directly against required pot odds before folding turns.',
    },
  },
  {
    id: 'pf-3bp-btn-bb-turn-checkback',
    title: 'BTN Turn Pot Control IP with Medium Showdown Value',
    street: 'turn',
    potType: '3BP',
    heroPos: 'BTN',
    villainPos: 'BB',
    heroInPosition: true,
    potBb: 34.0,
    effectiveStackBb: 76.0,
    toCallBb: 0,
    heroCards: ['Jc', 'Jd'],
    board: ['Qh', '8s', '3d', '2c'],
    actionLog: [
      'BTN opens 2.5bb, BB 3-bets 10bb, BTN calls',
      'Flop Qh 8s 3d: BB bets 7bb, BTN calls',
      'Turn 2c: BB checks',
    ],
    actions: [
      { action: 'check', label: 'Check', frequency: 84, evBb: 18.6, kind: 'check' },
      { action: 'bet_33', label: 'Bet 33% (11.2bb)', frequency: 14, evBb: 17.95, kind: 'bet' },
      { action: 'bet_75', label: 'Bet 75% (25.5bb)', frequency: 2, evBb: 16.4, kind: 'bet' },
    ],
    takeaways: {
      boardTexture: 'Blank 2c turn after BB checks following a flop c-bet.',
      rangeAdvantage: 'JJ sits cleanly in the middle of BTN’s range—crushing BB’s air/TT/99 while behind Qx and AA/KK traps.',
      blockerNote: 'Betting folds out hands you beat and bloats the pot against slowplayed Qx or check-raise traps.',
      coreRule: 'Medium-strength showdown hands IP prefer checking back turns to bluff-catch or value-bet rivers.',
    },
  },
  {
    id: 'pf-srp-btn-bb-river-thin-value',
    title: 'River Thin Value Sizing IP on Brick Runout',
    street: 'river',
    potType: 'SRP',
    heroPos: 'BTN',
    villainPos: 'BB',
    heroInPosition: true,
    potBb: 22.0,
    effectiveStackBb: 86.0,
    toCallBb: 0,
    heroCards: ['Ac', 'Jc'],
    board: ['Js', '8h', '4d', '2s', '5c'],
    actionLog: [
      'BTN opens 2.5bb, BB calls',
      'Flop Js 8h 4d: BB checks, BTN bets 3.5bb, BB calls',
      'Turn 2s: BB checks, BTN bets 5.0bb, BB calls',
      'River 5c: BB checks',
    ],
    actions: [
      { action: 'bet_50', label: 'Bet 50% (11.0bb)', frequency: 68, evBb: 16.42, kind: 'bet' },
      { action: 'bet_75', label: 'Bet 75% (16.5bb)', frequency: 24, evBb: 16.18, kind: 'bet' },
      { action: 'check', label: 'Check', frequency: 8, evBb: 14.3, kind: 'check' },
    ],
    takeaways: {
      boardTexture: 'Clean low brick runout where missed draws bricked and BB’s range is full of weaker Jx and 8x.',
      rangeAdvantage: 'BTN still uncapped with sets and overpairs; AJ is comfortably ahead of BB’s bluff-catching range.',
      blockerNote: 'Top pair top kicker misses massive EV by checking back; a medium 50% size targets worse Jx and 8x.',
      coreRule: 'Value bet thinner when the opponent’s line is capped and missed draws brick the river.',
    },
  },
  {
    id: 'pf-srp-bb-btn-river-bluffcatch-blockers',
    title: 'River Bluff-Catch with Nut Flush Blocker',
    street: 'river',
    potType: 'SRP',
    heroPos: 'BB',
    villainPos: 'BTN',
    heroInPosition: false,
    potBb: 51.0,
    effectiveStackBb: 62.0,
    toCallBb: 21.0,
    heroCards: ['As', 'Qh'],
    board: ['Qd', '9s', '5s', '2c', '4s'],
    actionLog: [
      'BTN opens 2.5bb, BB calls',
      'Flop Qd 9s 5s: BB checks, BTN bets 3.0bb, BB calls',
      'Turn 2c: BB checks, BTN bets 9.0bb, BB calls',
      'River 4s: BB checks, BTN bets 21.0bb (70% pot)',
    ],
    actions: [
      { action: 'call', label: 'Call 21.0bb', frequency: 82, evBb: 4.92, kind: 'call' },
      { action: 'fold', label: 'Fold', frequency: 18, evBb: 0.0, kind: 'fold' },
      { action: 'raise_allin', label: 'Raise All-In 62bb', frequency: 0, evBb: -9.4, kind: 'raise' },
    ],
    takeaways: {
      boardTexture: 'Front-door spade flush completes on the river; BTN fires a polarized 70% pot bet.',
      rangeAdvantage: 'You need 29.2% equity to call; BB must defend top-of-range bluff-catchers with key blockers.',
      blockerNote: 'Holding the As blocks BTN’s highest-frequency value flushes (AsKs, AsJs, AsTs, As8s) while unblocking missed red straight draws.',
      coreRule: 'Prioritize calling river bets with hands that block Villain’s value nut combos and unblock their bluffs.',
    },
  },
  {
    id: 'pf-srp-co-bb-river-bluff-blockers',
    title: 'River Polarized Bluff with Straight Blocker',
    street: 'river',
    potType: 'SRP',
    heroPos: 'CO',
    villainPos: 'BB',
    heroInPosition: true,
    potBb: 24.0,
    effectiveStackBb: 85.0,
    toCallBb: 0,
    heroCards: ['Kh', 'Jc'],
    board: ['Ts', '9d', '4c', 'Qh', '2d'],
    actionLog: [
      'CO opens 2.5bb, BB calls',
      'Flop Ts 9d 4c: BB checks, CO bets 3.5bb, BB calls',
      'Turn Qh: BB checks, CO bets 6.0bb, BB calls',
      'River 2d: BB checks',
    ],
    actions: [
      { action: 'bet_100', label: 'Bet 100% (24.0bb)', frequency: 71, evBb: 6.85, kind: 'bet' },
      { action: 'bet_50', label: 'Bet 50% (12.0bb)', frequency: 15, evBb: 5.9, kind: 'bet' },
      { action: 'check', label: 'Check', frequency: 14, evBb: 4.15, kind: 'check' },
    ],
    takeaways: {
      boardTexture: 'Missed gutshot + overcard on a Q-T-9 board where KJ has zero showdown value.',
      rangeAdvantage: 'CO represents KJ/J8 straights, QQ, TT, and QT; BB is capped largely to one-pair Qx/Tx.',
      blockerNote: 'Holding K and J blocks BB’s exact nut straights (KJ, J8) while unblocking weak missed flush/low pairs that fold.',
      coreRule: 'Choose river bluffs with zero showdown value that block the opponent’s strongest calling combos.',
    },
  },
  {
    id: 'pf-3bp-bb-btn-river-fold-overbet',
    title: 'Disciplined River Fold vs Polarized Overbet',
    street: 'river',
    potType: '3BP',
    heroPos: 'BB',
    villainPos: 'BTN',
    heroInPosition: false,
    potBb: 88.0,
    effectiveStackBb: 46.0,
    toCallBb: 46.0,
    heroCards: ['Td', 'Tc'],
    board: ['Ks', '8d', '5s', '3h', 'As'],
    actionLog: [
      'BTN opens 2.5bb, BB 3-bets 10bb, BTN calls',
      'Flop Ks 8d 5s: BB bets 7bb, BTN calls',
      'Turn 3h: BB checks, BTN bets 14bb, BB calls',
      'River As: BB checks, BTN shoves 46bb (110% pot)',
    ],
    actions: [
      { action: 'fold', label: 'Fold', frequency: 94, evBb: 0.0, kind: 'fold' },
      { action: 'call', label: 'Call 46.0bb', frequency: 6, evBb: -7.65, kind: 'call' },
    ],
    takeaways: {
      boardTexture: 'Worst possible river card—the Ace of spades completes both flushes and improves Ax floats.',
      rangeAdvantage: 'BTN’s turn bet + river jam polarizes heavily around flushes, AK, A8, and sets.',
      blockerNote: 'TT holds no spade and beats zero value hands while blocking BTN’s missed JT/T9 bluffs.',
      coreRule: 'Do not pay off river jams with bluff-catchers that block opponent bluffs and miss value blockers.',
    },
  },
];

export function generatePostflopSpot(
  streetFilter: Exclude<Street, 'preflop'> | 'ALL',
  potTypeFilter: PotType | 'ALL',
  positionRoleFilter: 'ALL' | 'IP' | 'OOP',
  previousId?: string,
  rng: () => number = Math.random
): PostflopDrillSpot {
  let pool = POSTFLOP_BLUEPRINTS;
  if (streetFilter !== 'ALL') {
    pool = pool.filter((s) => s.street === streetFilter);
  }
  if (potTypeFilter !== 'ALL') {
    pool = pool.filter((s) => s.potType === potTypeFilter);
  }
  if (positionRoleFilter !== 'ALL') {
    pool = pool.filter((s) =>
      positionRoleFilter === 'IP' ? s.heroInPosition : !s.heroInPosition
    );
  }
  if (pool.length === 0) pool = POSTFLOP_BLUEPRINTS;
  if (pool.length > 1 && previousId) {
    pool = pool.filter((s) => s.id !== previousId);
  }

  const bp = pool[Math.floor(rng() * pool.length)];
  const suitMap = createSuitRotation(rng);
  const rotatedHero = rotateCards(parseCards(bp.heroCards), suitMap) as [Card, Card];
  const rotatedBoard = rotateCards(parseCards(bp.board), suitMap);
  const suitGlyph: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
  const rotatedLog = bp.actionLog.map((line) =>
    line.replace(/\b([AKQJT98765432])([shdc])\b/g, (_, r: string, s: 's' | 'h' | 'd' | 'c') => {
      const mapped = suitMap[s];
      return `${r}${suitGlyph[mapped]}`;
    })
  );

  return {
    id: bp.id,
    title: bp.title,
    street: bp.street,
    potType: bp.potType,
    heroPos: bp.heroPos,
    villainPos: bp.villainPos,
    heroInPosition: bp.heroInPosition,
    potBb: bp.potBb,
    effectiveStackBb: bp.effectiveStackBb,
    toCallBb: bp.toCallBb,
    heroCards: rotatedHero,
    board: rotatedBoard,
    actionLog: rotatedLog,
    actions: bp.actions,
    takeaways: bp.takeaways,
  };
}

export function evaluatePostflopDecision(
  spot: PostflopDrillSpot,
  chosenActionKey: string
): DecisionEvaluation {
  const bestEv = Math.max(...spot.actions.map((a) => a.evBb));
  const bestObj = [...spot.actions].sort(
    (a, b) => b.frequency - a.frequency || b.evBb - a.evBb
  )[0];
  const chosenObj =
    spot.actions.find((a) => a.action === chosenActionKey) ?? spot.actions[0];

  const evLossBb = Math.max(0, Number((bestEv - chosenObj.evBb).toFixed(2)));
  const grade = gradeFromEvLoss(evLossBb, chosenObj.frequency);
  const accuracyScore = accuracyFromGrade(grade, evLossBb);

  return {
    chosenAction: chosenObj.label,
    bestAction: bestObj.label,
    chosenFreq: chosenObj.frequency,
    evLossBb,
    grade,
    accuracyScore,
    actions: spot.actions,
  };
}
