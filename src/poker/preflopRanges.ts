import type { Card, DecisionEvaluation, Position, SolverActionFreq } from './types';
import { accuracyFromGrade, gradeFromEvLoss } from './types';
import { canonicalHandKey, expandHandCombos, gridCellLabel, RANKS } from './evaluator';

export type PreflopScenarioType = 'RFI' | 'FACING_OPEN' | 'FACING_3BET';

export interface PreflopCellStrategy {
  hand: string;
  raise: number; // 0-100 (Open / 3-Bet / 4-Bet)
  call: number;  // 0-100
  fold: number;  // 0-100
  evRaise: number;
  evCall: number;
  evFold: number;
}

export interface PreflopSpotTemplate {
  id: string;
  scenarioType: PreflopScenarioType;
  title: string;
  subtitle: string;
  heroPos: Position;
  villainPos?: Position;
  potBb: number;
  toCallBb: number;
  raiseToBb: number;
  raiseLabel: string;
  callLabel?: string;
  actionSummary: string;
  strategyNote: string;
  matrix: Record<string, PreflopCellStrategy>;
}

export interface PreflopDrillSpot {
  template: PreflopSpotTemplate;
  heroCards: [Card, Card];
  handKey: string;
}

type RangeSpec = {
  pureRaise?: string[];
  mixedRaiseFold?: [string, number][]; // [hand, raisePct]
  pureCall?: string[];
  mixedRaiseCall?: [string, number][]; // [hand, raisePct], rest call
  mixedCallFold?: [string, number][];  // [hand, callPct], rest fold
  triMix?: [string, number, number][]; // [hand, raisePct, callPct]
};

function expandRangeToken(token: string): string[] {
  const results: string[] = [];
  if (token.endsWith('+')) {
    const base = token.slice(0, -1);
    if (base.length === 2) {
      // Pair+ e.g. 77+
      const idx = RANKS.indexOf(base[0] as (typeof RANKS)[number]);
      for (let i = 0; i <= idx; i++) {
        results.push(`${RANKS[i]}${RANKS[i]}`);
      }
    } else if (base.length === 3) {
      // Suited or offsuit+ e.g. A9s+, KTo+
      const r1 = base[0] as (typeof RANKS)[number];
      const r2 = base[1] as (typeof RANKS)[number];
      const kind = base[2];
      const i1 = RANKS.indexOf(r1);
      const i2 = RANKS.indexOf(r2);
      for (let i = i1 + 1; i <= i2; i++) {
        results.push(`${r1}${RANKS[i]}${kind}`);
      }
    }
  } else if (token.includes('-')) {
    // Range like 99-66 or A5s-A2s
    const [start, end] = token.split('-');
    if (start.length === 2 && end.length === 2) {
      const i1 = RANKS.indexOf(start[0] as (typeof RANKS)[number]);
      const i2 = RANKS.indexOf(end[0] as (typeof RANKS)[number]);
      const lo = Math.min(i1, i2);
      const hi = Math.max(i1, i2);
      for (let i = lo; i <= hi; i++) {
        results.push(`${RANKS[i]}${RANKS[i]}`);
      }
    } else if (start.length === 3 && end.length === 3) {
      const r1 = start[0];
      const kind = start[2];
      const i1 = RANKS.indexOf(start[1] as (typeof RANKS)[number]);
      const i2 = RANKS.indexOf(end[1] as (typeof RANKS)[number]);
      const lo = Math.min(i1, i2);
      const hi = Math.max(i1, i2);
      for (let i = lo; i <= hi; i++) {
        results.push(`${r1}${RANKS[i]}${kind}`);
      }
    }
  } else {
    results.push(token);
  }
  return results;
}

function buildMatrix(spec: RangeSpec, scenarioType: PreflopScenarioType): Record<string, PreflopCellStrategy> {
  const matrix: Record<string, PreflopCellStrategy> = {};
  const allowCall = scenarioType !== 'RFI';

  // Initialize all 169 hands as pure fold
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      const hand = gridCellLabel(r, c);
      const strengthPenalty = (r + c) / 24; // 0 for AA, 1 for 32o
      matrix[hand] = {
        hand,
        raise: 0,
        call: 0,
        fold: 100,
        evRaise: Number((-0.42 - strengthPenalty * 0.95).toFixed(2)),
        evCall: allowCall ? Number((-0.38 - strengthPenalty * 0.85).toFixed(2)) : -1.5,
        evFold: 0,
      };
    }
  }

  const applyTokens = (
    tokens: string[] | undefined,
    updater: (hand: string) => void
  ) => {
    if (!tokens) return;
    for (const t of tokens) {
      for (const h of expandRangeToken(t)) {
        if (matrix[h]) updater(h);
      }
    }
  };

  applyTokens(spec.pureCall, (h) => {
    matrix[h] = {
      hand: h,
      raise: 0,
      call: 100,
      fold: 0,
      evRaise: 0.12,
      evCall: 0.55,
      evFold: 0,
    };
  });

  if (spec.mixedCallFold) {
    for (const [token, callPct] of spec.mixedCallFold) {
      for (const h of expandRangeToken(token)) {
        if (!matrix[h]) continue;
        const f = Math.max(0, 100 - callPct);
        matrix[h] = {
          hand: h,
          raise: 0,
          call: callPct,
          fold: f,
          evRaise: -0.28,
          evCall: Number(((callPct / 100) * 0.08).toFixed(2)),
          evFold: 0,
        };
      }
    }
  }

  applyTokens(spec.pureRaise, (h) => {
    const isPremium = ['AA', 'KK', 'QQ', 'JJ', 'AKs', 'AKo'].includes(h);
    const evR = isPremium ? 2.45 : 0.82;
    matrix[h] = {
      hand: h,
      raise: 100,
      call: 0,
      fold: 0,
      evRaise: evR,
      evCall: allowCall ? Number((evR - (isPremium ? 0.95 : 0.36)).toFixed(2)) : -1.5,
      evFold: 0,
    };
  });

  if (spec.mixedRaiseFold) {
    for (const [token, raisePct] of spec.mixedRaiseFold) {
      for (const h of expandRangeToken(token)) {
        if (!matrix[h]) continue;
        const f = Math.max(0, 100 - raisePct);
        matrix[h] = {
          hand: h,
          raise: raisePct,
          call: 0,
          fold: f,
          evRaise: Number(((raisePct / 100) * 0.07).toFixed(2)),
          evCall: allowCall ? -0.24 : -1.5,
          evFold: 0,
        };
      }
    }
  }

  if (spec.mixedRaiseCall) {
    for (const [token, raisePct] of spec.mixedRaiseCall) {
      for (const h of expandRangeToken(token)) {
        if (!matrix[h]) continue;
        const c = Math.max(0, 100 - raisePct);
        matrix[h] = {
          hand: h,
          raise: raisePct,
          call: c,
          fold: 0,
          evRaise: 0.64,
          evCall: Number((0.64 - (raisePct > 65 ? 0.04 : 0.01)).toFixed(2)),
          evFold: 0,
        };
      }
    }
  }

  if (spec.triMix) {
    for (const [token, raisePct, callPct] of spec.triMix) {
      for (const h of expandRangeToken(token)) {
        if (!matrix[h]) continue;
        const f = Math.max(0, 100 - raisePct - callPct);
        matrix[h] = {
          hand: h,
          raise: raisePct,
          call: callPct,
          fold: f,
          evRaise: 0.09,
          evCall: 0.08,
          evFold: 0,
        };
      }
    }
  }

  return matrix;
}

export const PREFLOP_TEMPLATES: PreflopSpotTemplate[] = [
  {
    id: 'rfi-utg',
    scenarioType: 'RFI',
    title: 'UTG Open (RFI)',
    subtitle: '6-Max · 100bb · First In from Under the Gun',
    heroPos: 'UTG',
    potBb: 1.5,
    toCallBb: 0,
    raiseToBb: 2.5,
    raiseLabel: 'Raise 2.5bb',
    actionSummary: 'Action folds to you in UTG.',
    strategyNote:
      'With five players left to act behind you, UTG opens ~17% of combos—prioritizing strong pocket pairs, suited broadways, and high-card equity while folding dominated offsuit aces and weak suited connectors.',
    matrix: buildMatrix(
      {
        pureRaise: [
          '66+',
          'A9s+',
          'A5s-A4s',
          'KTs+',
          'QTs+',
          'JTs',
          'T9s',
          'AJo+',
          'KQo',
        ],
        mixedRaiseFold: [
          ['55', 65],
          ['A3s', 50],
          ['K9s', 45],
          ['98s', 55],
          ['87s', 40],
          ['ATo', 45],
          ['KJo', 30],
        ],
      },
      'RFI'
    ),
  },
  {
    id: 'rfi-hj',
    scenarioType: 'RFI',
    title: 'HJ Open (RFI)',
    subtitle: '6-Max · 100bb · First In from Hijack',
    heroPos: 'HJ',
    potBb: 1.5,
    toCallBb: 0,
    raiseToBb: 2.5,
    raiseLabel: 'Raise 2.5bb',
    actionSummary: 'UTG folds. Action is on you in HJ.',
    strategyNote:
      'From the Hijack (~22% RFI), you expand into all suited wheel aces, K9s, Q9s, J9s, and medium suited connectors while adding ATo and KJo for board coverage.',
    matrix: buildMatrix(
      {
        pureRaise: [
          '55+',
          'A2s+',
          'K9s+',
          'Q9s+',
          'J9s+',
          'T9s',
          '98s',
          '87s',
          'ATo+',
          'KJo+',
          'QJo',
        ],
        mixedRaiseFold: [
          ['44', 60],
          ['K8s', 40],
          ['T8s', 55],
          ['76s', 60],
          ['65s', 45],
          ['KTo', 40],
        ],
      },
      'RFI'
    ),
  },
  {
    id: 'rfi-co',
    scenarioType: 'RFI',
    title: 'CO Open (RFI)',
    subtitle: '6-Max · 100bb · First In from Cutoff',
    heroPos: 'CO',
    potBb: 1.5,
    toCallBb: 0,
    raiseToBb: 2.5,
    raiseLabel: 'Raise 2.5bb',
    actionSummary: 'UTG and HJ fold. Action is on you in CO.',
    strategyNote:
      'Cutoff opens ~29% of hands. Only BTN and blinds remain, so all pairs 22+, suited kings down to K6s, suited gappers (J8s, T8s, 97s), and A9o/KTo become profitable steals.',
    matrix: buildMatrix(
      {
        pureRaise: [
          '22+',
          'A2s+',
          'K6s+',
          'Q8s+',
          'J8s+',
          'T8s+',
          '97s+',
          '87s',
          '76s',
          '65s',
          '54s',
          'A9o+',
          'KTo+',
          'QTo+',
          'JTo',
        ],
        mixedRaiseFold: [
          ['K5s', 55],
          ['Q7s', 50],
          ['86s', 50],
          ['75s', 40],
          ['A8o', 45],
        ],
      },
      'RFI'
    ),
  },
  {
    id: 'rfi-btn',
    scenarioType: 'RFI',
    title: 'BTN Open (RFI)',
    subtitle: '6-Max · 100bb · First In from the Button',
    heroPos: 'BTN',
    potBb: 1.5,
    toCallBb: 0,
    raiseToBb: 2.5,
    raiseLabel: 'Raise 2.5bb',
    actionSummary: 'Folds around to you on the Button.',
    strategyNote:
      'Guaranteed postflop position lets the Button open ~45% of hands—every pocket pair, every suited ace and king, suited queens down to Q3s, connected suited cards, and offsuit aces down to A5o.',
    matrix: buildMatrix(
      {
        pureRaise: [
          '22+',
          'A2s+',
          'K2s+',
          'Q4s+',
          'J6s+',
          'T6s+',
          '96s+',
          '85s+',
          '75s+',
          '64s+',
          '54s',
          'A5o+',
          'K8o+',
          'Q9o+',
          'J9o+',
          'T9o',
        ],
        mixedRaiseFold: [
          ['Q3s', 55],
          ['Q2s', 40],
          ['J5s', 45],
          ['53s', 60],
          ['A4o', 60],
          ['A3o', 45],
          ['K7o', 40],
          ['98o', 55],
        ],
      },
      'RFI'
    ),
  },
  {
    id: 'rfi-sb',
    scenarioType: 'RFI',
    title: 'SB Open (RFI)',
    subtitle: '6-Max · 100bb · Blind vs Blind (Raise-or-Fold)',
    heroPos: 'SB',
    potBb: 1.5,
    toCallBb: 0,
    raiseToBb: 3.0,
    raiseLabel: 'Raise 3.0bb',
    actionSummary: 'Folds to you in Small Blind vs Big Blind.',
    strategyNote:
      'In a simplified 100bb raise-or-fold SB strategy, open to 3.0bb with ~42% of hands to deny BB free equity while keeping your out-of-position range resilient against 3-bets.',
    matrix: buildMatrix(
      {
        pureRaise: [
          '22+',
          'A2s+',
          'K2s+',
          'Q5s+',
          'J7s+',
          'T7s+',
          '96s+',
          '86s+',
          '75s+',
          '65s',
          '54s',
          'A7o+',
          'K9o+',
          'Q9o+',
          'J9o+',
          'T9o',
        ],
        mixedRaiseFold: [
          ['Q4s', 50],
          ['J6s', 55],
          ['T6s', 45],
          ['64s', 50],
          ['A6o', 50],
          ['A5o', 60],
          ['K8o', 45],
          ['98o', 45],
        ],
      },
      'RFI'
    ),
  },
  {
    id: 'vs-open-btn-co',
    scenarioType: 'FACING_OPEN',
    title: 'BTN vs CO Open',
    subtitle: '6-Max · 100bb · Facing 2.5bb Cutoff Open',
    heroPos: 'BTN',
    villainPos: 'CO',
    potBb: 4.0,
    toCallBb: 2.5,
    raiseToBb: 7.5,
    raiseLabel: '3-Bet 7.5bb',
    callLabel: 'Call 2.5bb',
    actionSummary: 'CO opens 2.5bb. Action is on you on the Button.',
    strategyNote:
      'In position vs a CO open, BTN builds a strong linear-plus-suited-blocker 3-betting range (QQ+, AK, AQs, A5s-A4s, KTs) while flatting medium pairs, suited connectors, and playable broadways.',
    matrix: buildMatrix(
      {
        pureRaise: ['QQ+', 'AKs', 'AQs', 'AKo', 'KQs', 'A5s', 'A4s'],
        mixedRaiseCall: [
          ['JJ', 75],
          ['TT', 40],
          ['AJs', 65],
          ['ATs', 45],
          ['KJs', 55],
          ['QJs', 45],
          ['AQo', 60],
          ['76s', 35],
          ['65s', 35],
        ],
        pureCall: ['99-55', 'KTs', 'QTs', 'JTs', 'T9s', '98s', '87s', 'AJo', 'KQo'],
        mixedRaiseFold: [
          ['A3s', 50],
          ['K9s', 40],
          ['KJo', 35],
          ['ATo', 35],
        ],
        mixedCallFold: [
          ['44', 60],
          ['33', 45],
          ['A9s', 60],
          ['J9s', 55],
          ['T8s', 45],
        ],
      },
      'FACING_OPEN'
    ),
  },
  {
    id: 'vs-open-bb-btn',
    scenarioType: 'FACING_OPEN',
    title: 'BB vs BTN Open',
    subtitle: '6-Max · 100bb · Big Blind Defense vs 2.5bb BTN Open',
    heroPos: 'BB',
    villainPos: 'BTN',
    potBb: 4.0,
    toCallBb: 1.5,
    raiseToBb: 10.0,
    raiseLabel: '3-Bet 10bb',
    callLabel: 'Call 1.5bb',
    actionSummary: 'BTN opens 2.5bb, SB folds. Action is on you in BB.',
    strategyNote:
      'Closing the action getting great pot odds (1.5bb to win 5.5bb = 27% raw equity), BB defends ~55% of hands—3-betting polarized value (TT+, AQs+, AKo, KQs) plus suited wheel/king blockers while calling a wide suited and connected range.',
    matrix: buildMatrix(
      {
        pureRaise: ['JJ+', 'AKs', 'AQs', 'AKo', 'KQs', 'A5s', 'A4s'],
        mixedRaiseCall: [
          ['TT', 65],
          ['99', 35],
          ['AJs', 55],
          ['KJs', 50],
          ['QJs', 40],
          ['AQo', 65],
          ['KQo', 45],
          ['K6s', 45],
          ['K5s', 45],
          ['75s', 40],
        ],
        pureCall: [
          '88-22',
          'ATs-A6s',
          'A3s-A2s',
          'KTs-K7s',
          'K4s-K2s',
          'QTs-Q6s',
          'JTs-J7s',
          'T9s-T7s',
          '98s-96s',
          '87s-86s',
          '76s',
          '65s',
          '54s',
          'AJo-A8o',
          'KJo-K9o',
          'QJo-Q9o',
          'JTo-J9o',
          'T9o',
        ],
        mixedCallFold: [
          ['Q5s', 60],
          ['J6s', 50],
          ['64s', 60],
          ['53s', 55],
          ['A7o', 65],
          ['K8o', 50],
          ['98o', 60],
        ],
      },
      'FACING_OPEN'
    ),
  },
  {
    id: 'vs-open-sb-btn',
    scenarioType: 'FACING_OPEN',
    title: 'SB vs BTN Open (3-Bet Heavy)',
    subtitle: '6-Max · 100bb · Small Blind Facing 2.5bb BTN Open',
    heroPos: 'SB',
    villainPos: 'BTN',
    potBb: 4.0,
    toCallBb: 2.0,
    raiseToBb: 10.0,
    raiseLabel: '3-Bet 10bb',
    callLabel: 'Call 2.0bb',
    actionSummary: 'BTN opens 2.5bb. Action is on you in SB with BB still behind.',
    strategyNote:
      'Out of position with BB still left to squeeze, SB plays a near-pure 3-bet-or-fold strategy (~16% 3-bet)—attacking BTN wide opens linearly with 88+, A9s+, KTs+, QTs+, JTs, AJo+, KQo, and A5s.',
    matrix: buildMatrix(
      {
        pureRaise: ['88+', 'ATs+', 'A5s', 'KTs+', 'QTs+', 'JTs', 'AQo+', 'KQo'],
        mixedRaiseFold: [
          ['77', 65],
          ['66', 40],
          ['A9s', 60],
          ['A4s', 55],
          ['K9s', 50],
          ['T9s', 55],
          ['98s', 45],
          ['AJo', 65],
          ['KJo', 40],
        ],
      },
      'FACING_OPEN'
    ),
  },
  {
    id: 'vs-3bet-btn-bb',
    scenarioType: 'FACING_3BET',
    title: 'BTN Facing BB 3-Bet',
    subtitle: '6-Max · 100bb · Opened 2.5bb, BB 3-Bets to 10bb',
    heroPos: 'BTN',
    villainPos: 'BB',
    potBb: 13.0,
    toCallBb: 7.5,
    raiseToBb: 23.0,
    raiseLabel: '4-Bet 23bb',
    callLabel: 'Call 7.5bb',
    actionSummary: 'You opened 2.5bb from BTN; BB 3-bet to 10bb.',
    strategyNote:
      'In position facing a 10bb BB 3-bet, BTN defends ~46% of its opening range—4-betting KK+, AK, and polarized blocker bluffs (A5s, A4s, KQo) while calling high-playability pairs, suited broadways, and suited connectors.',
    matrix: buildMatrix(
      {
        pureRaise: ['KK+', 'AKs', 'AKo'],
        mixedRaiseCall: [
          ['QQ', 75],
          ['JJ', 35],
          ['AQs', 40],
          ['A5s', 65],
          ['A4s', 55],
          ['KQs', 30],
        ],
        pureCall: [
          'TT-66',
          'AJs-A9s',
          'KJs-K9s',
          'QJs-Q9s',
          'JTs-J9s',
          'T9s',
          '98s',
          '87s',
          '76s',
          'AQo',
        ],
        mixedRaiseFold: [
          ['KQo', 45],
          ['AJo', 30],
          ['A3s', 35],
          ['K5s', 30],
        ],
        mixedCallFold: [
          ['55', 65],
          ['44', 45],
          ['A8s', 50],
          ['65s', 60],
          ['54s', 55],
        ],
      },
      'FACING_3BET'
    ),
  },
  {
    id: 'vs-3bet-co-btn',
    scenarioType: 'FACING_3BET',
    title: 'CO Facing BTN 3-Bet',
    subtitle: '6-Max · 100bb · Opened 2.5bb, BTN 3-Bets to 7.5bb',
    heroPos: 'CO',
    villainPos: 'BTN',
    potBb: 11.5,
    toCallBb: 5.0,
    raiseToBb: 21.0,
    raiseLabel: '4-Bet 21bb',
    callLabel: 'Call 5.0bb',
    actionSummary: 'You opened 2.5bb from CO; BTN 3-bet to 7.5bb.',
    strategyNote:
      'Out of position vs a tight IP BTN 3-bet, CO defends more selectively—4-betting QQ+, AK, and A5s/KJs bluffs to avoid playing capped OOP pots, while flatting TT-77 and strong suited broadways.',
    matrix: buildMatrix(
      {
        pureRaise: ['QQ+', 'AKs', 'AKo'],
        mixedRaiseCall: [
          ['JJ', 55],
          ['AQs', 50],
          ['A5s', 60],
          ['KQs', 35],
        ],
        pureCall: ['TT-77', 'AJs', 'ATs', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs', 'T9s', '98s'],
        mixedRaiseFold: [
          ['AQo', 55],
          ['A4s', 45],
          ['KQo', 35],
        ],
        mixedCallFold: [
          ['66', 55],
          ['87s', 50],
          ['76s', 45],
        ],
      },
      'FACING_3BET'
    ),
  },
];

/**
 * Draws a strategically informative preflop spot (weighting borderline / playable hands
 * slightly higher than pure trash 72o so the user gets meaningful training reps).
 */
export function generatePreflopSpot(
  scenarioFilter: PreflopScenarioType | 'ALL',
  positionFilter: Position | 'ALL',
  rng: () => number = Math.random
): PreflopDrillSpot {
  let pool = PREFLOP_TEMPLATES;
  if (scenarioFilter !== 'ALL') {
    pool = pool.filter((t) => t.scenarioType === scenarioFilter);
  }
  if (positionFilter !== 'ALL') {
    const posPool = pool.filter((t) => t.heroPos === positionFilter);
    if (posPool.length > 0) pool = posPool;
  }
  if (pool.length === 0) pool = PREFLOP_TEMPLATES;

  const template = pool[Math.floor(rng() * pool.length)];
  const allHands = Object.values(template.matrix);

  // Weight interesting hands (mixed, raises, calls, and borderline folds) higher
  // while still including ~20% clear folds to test discipline.
  const interesting = allHands.filter((h) => h.raise > 0 || h.call > 0);
  const borderlineFolds = allHands.filter(
    (h) => h.fold === 100 && h.evRaise > -0.82
  );
  const clearFolds = allHands.filter((h) => h.fold === 100 && h.evRaise <= -0.82);

  const roll = rng();
  let chosenCell: PreflopCellStrategy;
  if (roll < 0.62 && interesting.length > 0) {
    chosenCell = interesting[Math.floor(rng() * interesting.length)];
  } else if (roll < 0.86 && borderlineFolds.length > 0) {
    chosenCell = borderlineFolds[Math.floor(rng() * borderlineFolds.length)];
  } else {
    const fallback = clearFolds.length > 0 ? clearFolds : allHands;
    chosenCell = fallback[Math.floor(rng() * fallback.length)];
  }

  const combos = expandHandCombos(chosenCell.hand);
  const heroCards = combos[Math.floor(rng() * combos.length)];

  return {
    template,
    heroCards,
    handKey: canonicalHandKey(heroCards[0], heroCards[1]),
  };
}

export function evaluatePreflopDecision(
  spot: PreflopDrillSpot,
  chosenKey: 'raise' | 'call' | 'fold'
): DecisionEvaluation {
  const cell = spot.template.matrix[spot.handKey];
  const allowCall = spot.template.scenarioType !== 'RFI';

  const actions: SolverActionFreq[] = [
    {
      action: 'raise',
      label: spot.template.raiseLabel,
      frequency: cell.raise,
      evBb: cell.evRaise,
      kind: 'raise',
    },
  ];
  if (allowCall) {
    actions.push({
      action: 'call',
      label: spot.template.callLabel ?? `Call ${spot.template.toCallBb}bb`,
      frequency: cell.call,
      evBb: cell.evCall,
      kind: 'call',
    });
  }
  actions.push({
    action: 'fold',
    label: 'Fold',
    frequency: cell.fold,
    evBb: cell.evFold,
    kind: 'fold',
  });

  const bestEv = Math.max(...actions.map((a) => a.evBb));
  const bestObj = [...actions].sort((a, b) => b.frequency - a.frequency || b.evBb - a.evBb)[0];
  const chosenObj = actions.find((a) => a.action === chosenKey) ?? actions[actions.length - 1];

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
    actions,
  };
}
