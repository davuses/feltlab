import type { PreflopCellStrategy } from '../poker/preflopRanges';
import { gridCellLabel } from '../poker/evaluator';

interface SolverMatrixProps {
  mode: 'solver';
  matrix: Record<string, PreflopCellStrategy>;
  heroHandKey?: string;
  inspectedHandKey?: string | null;
  onInspectHand?: (handKey: string) => void;
}

interface BuilderMatrixProps {
  mode: 'builder';
  selectedHands: Set<string>;
  targetHands?: Set<string>;
  showDiff?: boolean;
  viewMode?: 'mine' | 'solver' | 'diff';
  onToggleHand: (handKey: string) => void;
  disabled?: boolean;
}

type RangeMatrixProps = SolverMatrixProps | BuilderMatrixProps;

export function RangeMatrix13x13(props: RangeMatrixProps) {
  const cells: { row: number; col: number; hand: string }[] = [];
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      cells.push({ row: r, col: c, hand: gridCellLabel(r, c) });
    }
  }

  return (
    <div className="w-full select-none">
      <div
        className="grid grid-cols-13 gap-[2px] bg-[#0B1017] p-1.5 rounded-lg border border-[#222D3D]"
        role="grid"
        aria-label="13 by 13 Texas Hold'em Hand Range Matrix"
      >
        {cells.map(({ hand }) => {
          if (props.mode === 'solver') {
            const strat = props.matrix[hand];
            const isHero = props.heroHandKey === hand;
            const isInspected = props.inspectedHandKey === hand;
            const raisePct = strat?.raise ?? 0;
            const callPct = strat?.call ?? 0;

            // Stacked horizontal bar inside cell: Emerald (Raise), Sky (Call), Obsidian (Fold)
            const bgStyle =
              raisePct === 0 && callPct === 0
                ? { backgroundColor: '#131A26' }
                : {
                    backgroundImage: `linear-gradient(90deg, #10B981 0%, #10B981 ${raisePct}%, #38BDF8 ${raisePct}%, #38BDF8 ${
                      raisePct + callPct
                    }%, #131A26 ${raisePct + callPct}%, #131A26 100%)`,
                  };

            const isActive = raisePct + callPct >= 45;

            return (
              <button
                key={hand}
                type="button"
                onClick={() => props.onInspectHand?.(hand)}
                onMouseEnter={() => props.onInspectHand?.(hand)}
                style={bgStyle}
                aria-label={`${hand}: Raise ${raisePct}%, Call ${callPct}%, Fold ${
                  strat?.fold ?? 100
                }%`}
                className={`aspect-square w-full rounded-[3px] flex items-center justify-center text-[10px] sm:text-[11px] font-mono tabular-nums font-semibold transition-transform duration-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                  isHero
                    ? 'ring-2 ring-amber-300 z-10 scale-105 text-white shadow-md'
                    : isInspected
                      ? 'ring-1 ring-white/80 z-10 text-white'
                      : isActive
                        ? 'text-slate-950'
                        : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {hand}
              </button>
            );
          }

          // Builder / Hand Reading mode
          const isSelected = props.selectedHands.has(hand);
          const isTarget = props.targetHands?.has(hand) ?? false;
          const view = props.viewMode ?? 'mine';

          let cellClasses = 'bg-[#131A26] text-slate-400 hover:bg-[#1D283A] hover:text-slate-200';
          if (!props.showDiff) {
            if (isSelected) {
              cellClasses = 'bg-emerald-500 text-slate-950 font-bold';
            }
          } else if (view === 'solver') {
            if (isTarget) {
              cellClasses = 'bg-sky-400 text-slate-950 font-bold';
            }
          } else if (view === 'mine') {
            if (isSelected) {
              cellClasses = 'bg-emerald-500 text-slate-950 font-bold';
            }
          } else {
            // Diff overlay
            if (isSelected && isTarget) {
              cellClasses = 'bg-emerald-400 text-slate-950 font-bold';
            } else if (!isSelected && isTarget) {
              cellClasses = 'bg-sky-400 text-slate-950 font-bold ring-1 ring-sky-200';
            } else if (isSelected && !isTarget) {
              cellClasses = 'bg-rose-500 text-white font-bold';
            }
          }

          return (
            <button
              key={hand}
              type="button"
              disabled={props.disabled}
              onClick={() => props.onToggleHand(hand)}
              aria-pressed={isSelected}
              aria-label={`Toggle ${hand} in villain range`}
              className={`aspect-square w-full rounded-[3px] flex items-center justify-center text-[10px] sm:text-[11px] font-mono tabular-nums transition-colors duration-100 cursor-pointer disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${cellClasses}`}
            >
              {hand}
            </button>
          );
        })}
      </div>
    </div>
  );
}
