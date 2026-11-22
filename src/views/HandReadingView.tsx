import { useMemo, useState } from 'react';
import { ArrowRight, Check, RotateCcw } from 'lucide-react';
import type { DrillAttemptRecord, UserPreferences } from '../poker/types';
import {
  evaluateHandReading,
  HAND_READING_SPOTS,
  QUICK_RANGE_PRESETS,
  type HandReadingResult,
} from '../poker/handReadingSpots';
import { comboCountForHand } from '../poker/evaluator';
import { PlayingCard } from '../components/PlayingCard';
import { RangeMatrix13x13 } from '../components/RangeMatrix13x13';
import { GradeBadge } from '../components/GradeBadge';
import { playPokerSound } from '../utils/sound';
import { useLocale } from '../i18n/LocaleContext';
import { translateQuickPreset } from '../i18n/translations';

interface HandReadingViewProps {
  prefs: UserPreferences;
  onRecordAttempt: (attempt: Omit<DrillAttemptRecord, 'id' | 'timestamp'>) => void;
}

export function HandReadingView({ prefs, onRecordAttempt }: HandReadingViewProps) {
  const { locale, t } = useLocale();
  const [spotIndex, setSpotIndex] = useState(0);
  const [selectedHands, setSelectedHands] = useState<Set<string>>(() => new Set());
  const [result, setResult] = useState<HandReadingResult | null>(null);
  const [matrixViewMode, setMatrixViewMode] = useState<'diff' | 'solver' | 'mine'>('diff');
  const [validationMsg, setValidationMsg] = useState<string | null>(null);

  const spot = HAND_READING_SPOTS[spotIndex];
  const targetSet = useMemo(() => new Set(spot.targetHands), [spot]);

  const selectedComboCount = useMemo(() => {
    let total = 0;
    selectedHands.forEach((h) => {
      total += comboCountForHand(h);
    });
    return total;
  }, [selectedHands]);

  const selectSpot = (idx: number) => {
    setSpotIndex(idx);
    setSelectedHands(new Set());
    setResult(null);
    setValidationMsg(null);
    setMatrixViewMode('diff');
    playPokerSound('card', prefs.soundEnabled);
  };

  const toggleHand = (hand: string) => {
    if (result) return;
    setValidationMsg(null);
    setSelectedHands((prev) => {
      const next = new Set(prev);
      if (next.has(hand)) next.delete(hand);
      else next.add(hand);
      return next;
    });
  };

  const togglePreset = (hands: string[]) => {
    if (result) return;
    setValidationMsg(null);
    setSelectedHands((prev) => {
      const next = new Set(prev);
      const allPresent = hands.every((h) => next.has(h));
      for (const h of hands) {
        if (allPresent) next.delete(h);
        else next.add(h);
      }
      return next;
    });
  };

  const handleGrade = () => {
    if (selectedHands.size === 0) {
      setValidationMsg(t('reading.errEmpty'));
      return;
    }
    const evaluated = evaluateHandReading(spot, selectedHands);
    setResult(evaluated);
    setMatrixViewMode('diff');
    playPokerSound(
      evaluated.grade === 'Optimal' || evaluated.grade === 'Acceptable' ? 'optimal' : 'mistake',
      prefs.soundEnabled
    );
    onRecordAttempt({
      module: 'reading',
      position: spot.villainPos,
      street: spot.board.length === 3 ? 'flop' : spot.board.length === 4 ? 'turn' : 'river',
      spotLabel: spot.title,
      chosenAction: `${evaluated.selectedCombos} combos (${evaluated.overlapPct}% overlap)`,
      bestAction: `${evaluated.targetCombos} solver combos`,
      evLossBb: evaluated.evLossBb,
      grade: evaluated.grade,
      accuracyScore: evaluated.overlapPct,
    });
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header & Spot Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#222D3D] pb-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold text-white">
            {t('reading.title')}
          </h1>
          <p className="text-xs text-slate-400">{t('reading.subtitle')}</p>
        </div>

        <div
          role="group"
          aria-label="Hand reading scenarios"
          className="flex flex-wrap items-center gap-1 p-1 bg-[#111722] border border-[#222D3D] rounded-lg"
        >
          {HAND_READING_SPOTS.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => selectSpot(idx)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                idx === spotIndex
                  ? 'bg-[#222E40] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('reading.spotPrefix')} {idx + 1}: {s.villainPos}
            </button>
          ))}
        </div>
      </div>

      {/* Two-Zone Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Interactive 13x13 Range Builder */}
        <div className="xl:col-span-7 bg-[#111722] border border-[#222D3D] rounded-xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">{spot.promptQuestion}</h2>
              <p className="text-xs font-mono tabular-nums text-slate-400 mt-0.5">
                {spot.streetLabel} · {t('common.pot')} {spot.potBb.toFixed(1)}bb · {t('reading.selected')}:{' '}
                <span className="text-emerald-300 font-semibold">
                  {selectedComboCount} {t('reading.combos')}
                </span>
              </p>
            </div>

            {result ? (
              <div
                role="group"
                aria-label="Range overlay view mode"
                className="flex items-center gap-1 p-1 bg-[#0B1017] border border-[#222D3D] rounded-lg"
              >
                {(['diff', 'solver', 'mine'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMatrixViewMode(m)}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                      matrixViewMode === m
                        ? 'bg-[#222E40] text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {m === 'diff'
                      ? t('reading.diffOverlay')
                      : m === 'solver'
                        ? t('reading.solverRange')
                        : t('reading.myRange')}
                  </button>
                ))}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSelectedHands(new Set())}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#17202E] border border-[#2A374C] text-slate-300 hover:text-white inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t('reading.clearGrid')}</span>
              </button>
            )}
          </div>

          {/* Quick Category Selection Helpers */}
          {!result && (
            <div className="flex flex-wrap items-center gap-2">
              {Object.entries(QUICK_RANGE_PRESETS).map(([label, hands]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => togglePreset(hands)}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-md bg-[#161F2D] hover:bg-[#202C40] border border-[#273549] text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
                >
                  + {translateQuickPreset(locale, label)}
                </button>
              ))}
            </div>
          )}

          {/* 13x13 Matrix */}
          <RangeMatrix13x13
            mode="builder"
            selectedHands={selectedHands}
            targetHands={targetSet}
            showDiff={Boolean(result)}
            viewMode={matrixViewMode}
            onToggleHand={toggleHand}
            disabled={Boolean(result)}
          />

          {/* Legend & Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#1F2A3A]">
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
              {!result ? (
                <span>{t('reading.gridHint')}</span>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
                    {t('reading.matched')}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-sky-500 inline-block" />
                    {t('reading.missed')}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block" />
                    {t('reading.overIncluded')}
                  </span>
                </>
              )}
            </div>

            {!result ? (
              <button
                type="button"
                onClick={handleGrade}
                className="min-h-[44px] px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-sm font-semibold text-slate-950 inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Check className="w-4 h-4" aria-hidden="true" />
                <span>{t('reading.gradeRange')}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => selectSpot((spotIndex + 1) % HAND_READING_SPOTS.length)}
                className="min-h-[44px] px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-sm font-semibold text-slate-950 inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>{t('reading.nextSpot')}</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>

          {validationMsg && (
            <p role="alert" className="text-xs text-rose-400">
              {validationMsg}
            </p>
          )}
        </div>

        {/* Right Multi-Street Storyline & Range Audit */}
        <div className="xl:col-span-5 bg-[#111722] border border-[#222D3D] rounded-xl p-5 sm:p-6 space-y-5">
          {/* Board Strip */}
          <div className="felt-surface rounded-xl border border-emerald-400/20 p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-mono text-emerald-200/80">
              <span>{t('reading.boardRunout')}</span>
              <span>
                {t('common.villain')}: {spot.villainPos}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {spot.board.map((c, idx) => (
                <PlayingCard
                  key={`${c.rank}${c.suit}-${idx}`}
                  card={c}
                  fourColor={prefs.fourColorDeck}
                  size="sm"
                />
              ))}
            </div>
          </div>

          {/* Action Timeline */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white">{t('reading.timelineTitle')}</h3>
            <div className="space-y-2.5">
              {spot.timeline.map((step, i) => (
                <div
                  key={i}
                  className="bg-[#0B1017] border border-[#1E293B] rounded-lg p-3.5 space-y-1"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-semibold text-emerald-400">{step.street}</span>
                    <span className="text-slate-200 font-medium">{step.detail}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{step.narrowingHint}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Post-Submission Range Overlap Analysis */}
          {result && (
            <div className="border-t border-[#1F2A3A] pt-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-white">{t('reading.auditTitle')}</h3>
                <GradeBadge grade={result.grade} evLossBb={result.evLossBb} size="sm" />
              </div>

              <div className="grid grid-cols-3 gap-2 font-mono tabular-nums text-xs">
                <div className="bg-[#0B1017] border border-[#1E293B] rounded-lg p-3">
                  <span className="text-slate-400 font-sans block">{t('reading.overlap')}</span>
                  <span className="text-lg font-semibold text-emerald-400">
                    {result.overlapPct}%
                  </span>
                </div>
                <div className="bg-[#0B1017] border border-[#1E293B] rounded-lg p-3">
                  <span className="text-slate-400 font-sans block">{t('reading.precision')}</span>
                  <span className="text-lg font-semibold text-sky-400">
                    {result.precisionPct}%
                  </span>
                </div>
                <div className="bg-[#0B1017] border border-[#1E293B] rounded-lg p-3">
                  <span className="text-slate-400 font-sans block">{t('reading.recall')}</span>
                  <span className="text-lg font-semibold text-amber-300">
                    {result.recallPct}%
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">{spot.explanation}</p>

              <div className="bg-[#0C1814] border border-emerald-500/25 rounded-lg p-3 text-xs text-slate-200">
                {spot.keyCombosNote}
              </div>

              {result.missedHands.length > 0 && (
                <div className="text-xs text-slate-400">
                  <span className="text-sky-400 font-medium">{t('reading.missedCombos')} </span>
                  <span className="font-mono">{result.missedHands.slice(0, 12).join(', ')}</span>
                </div>
              )}
              {result.extraHands.length > 0 && (
                <div className="text-xs text-slate-400">
                  <span className="text-rose-400 font-medium">{t('reading.extraCombos')} </span>
                  <span className="font-mono">{result.extraHands.slice(0, 12).join(', ')}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
