export type Suit = 's' | 'h' | 'd' | 'c';
export type Rank =
  | 'A'
  | 'K'
  | 'Q'
  | 'J'
  | 'T'
  | '9'
  | '8'
  | '7'
  | '6'
  | '5'
  | '4'
  | '3'
  | '2';

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type Position = 'UTG' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';

export type Street = 'preflop' | 'flop' | 'turn' | 'river';

export type DrillModule = 'preflop' | 'postflop' | 'math' | 'reading' | 'table';

export type DecisionGrade =
  | 'Optimal'
  | 'Acceptable'
  | 'Inaccuracy'
  | 'Mistake'
  | 'Blunder';

export interface SolverActionFreq {
  action: string;
  label: string;
  frequency: number; // 0-100
  evBb: number;
  kind: 'fold' | 'check' | 'call' | 'bet' | 'raise';
}

export interface DecisionEvaluation {
  chosenAction: string;
  bestAction: string;
  chosenFreq: number;
  evLossBb: number;
  grade: DecisionGrade;
  accuracyScore: number; // 0-100
  actions: SolverActionFreq[];
}

export interface DrillAttemptRecord {
  id: string;
  module: DrillModule;
  position: Position | 'ALL';
  street: Street | 'math';
  spotLabel: string;
  chosenAction: string;
  bestAction: string;
  evLossBb: number;
  grade: DecisionGrade;
  accuracyScore: number;
  timestamp: number;
}

export interface UserPreferences {
  fourColorDeck: boolean;
  soundEnabled: boolean;
}

export interface MasterySummary {
  totalDecisions: number;
  optimalCount: number;
  totalEvLossBb: number;
  currentStreak: number;
  bestStreak: number;
}

export function gradeFromEvLoss(evLossBb: number, chosenFreq = 0): DecisionGrade {
  if (evLossBb <= 0.03 || chosenFreq >= 35) return 'Optimal';
  if (evLossBb <= 0.14 || chosenFreq >= 12) return 'Acceptable';
  if (evLossBb <= 0.35) return 'Inaccuracy';
  if (evLossBb <= 0.85) return 'Mistake';
  return 'Blunder';
}

export function accuracyFromGrade(grade: DecisionGrade, evLossBb: number): number {
  if (grade === 'Optimal') return 100;
  if (grade === 'Acceptable') return Math.max(82, Math.round(95 - evLossBb * 40));
  if (grade === 'Inaccuracy') return Math.max(60, Math.round(80 - evLossBb * 35));
  if (grade === 'Mistake') return Math.max(30, Math.round(58 - evLossBb * 25));
  return Math.max(0, Math.round(28 - Math.min(evLossBb, 2.5) * 10));
}
