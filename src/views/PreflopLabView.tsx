import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Palette, Volume2, VolumeX } from 'lucide-react';
import type {
  DecisionEvaluation,
  DrillAttemptRecord,
  Position,
  UserPreferences,
} from '../poker/types';
import {
  evaluatePreflopDecision,
  generatePreflopSpot,
  type PreflopDrillSpot,
  type PreflopScenarioType,
} from '../poker/preflopRanges';
import { PokerTableOval, type TableSeatDisplay } from '../components/PokerTableOval';
import { RangeMatrix13x13 } from '../components/RangeMatrix13x13';
import { GradeBadge } from '../components/GradeBadge';
import { SolverBars } from '../components/SolverBars';
import { playPokerSound } from '../utils/sound';
import { useLocale } from '../i18n/LocaleContext';
import {
  translateActionText,
  translatePositionLabel,
  type TranslationKey,
} from '../i18n/translations';
import { localizePreflopTemplate } from '../i18n/drillContentZh';

interface PreflopLabViewProps {
  prefs: UserPreferences;
  onUpdatePrefs: (patch: Partial<UserPreferences>) => void;
  onRecordAttempt: (attempt: Omit<DrillAttemptRecord, 'id' | 'timestamp'>) => void;
}

const SCENARIO_OPTIONS: { value: PreflopScenarioType | 'ALL'; labelKey: TranslationKey }[] = [
  { value: 'ALL', labelKey: 'preflop.filterAll' },
  { value: 'RFI', labelKey: 'preflop.filterRfi' },
  { value: 'FACING_OPEN', labelKey: 'preflop.filterFacingOpen' },
  { value: 'FACING_3BET', labelKey: 'preflop.filterFacing3Bet' },
];

const POSITION_OPTIONS: (Position | 'ALL')[] = ['ALL', 'UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const SEAT_ORDER: Position[] = ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'];

export function PreflopLabView({
  prefs,
  onUpdatePrefs,
  onRecordAttempt,
}: PreflopLabViewProps) {
  const { locale, t } = useLocale();
  const [scenarioFilter, setScenarioFilter] = useState<PreflopScenarioType | 'ALL'>('ALL');
  const [positionFilter, setPositionFilter] = useState<Position | 'ALL'>('ALL');
  const [spot, setSpot] = useState<PreflopDrillSpot>(() =>
    generatePreflopSpot('ALL', 'ALL')
  );
  const [evaluation, setEvaluation] = useState<DecisionEvaluation | null>(null);
  const [inspectedHand, setInspectedHand] = useState<string | null>(null);

  const dealNext = useCallback(
    (nextScenario = scenarioFilter, nextPos = positionFilter) => {
      const next = generatePreflopSpot(nextScenario, nextPos);
      setSpot(next);
      setEvaluation(null);
      setInspectedHand(null);
      playPokerSound('card', prefs.soundEnabled);
    },
    [scenarioFilter, positionFilter, prefs.soundEnabled]
  );

  const handleAction = useCallback(
    (actionKey: 'raise' | 'call' | 'fold') => {
      if (evaluation) return;
      const result = evaluatePreflopDecision(spot, actionKey);
      setEvaluation(result);
      setInspectedHand(spot.handKey);
      playPokerSound(
        result.grade === 'Optimal' || result.grade === 'Acceptable' ? 'optimal' : 'mistake',
        prefs.soundEnabled
      );
      onRecordAttempt({
        module: 'preflop',
        position: spot.template.heroPos,
        street: 'preflop',
        spotLabel: `${spot.template.title} (${spot.handKey})`,
        chosenAction: result.chosenAction,
        bestAction: result.bestAction,
        evLossBb: result.evLossBb,
        grade: result.grade,
        accuracyScore: result.accuracyScore,
      });
    },
    [evaluation, spot, prefs.soundEnabled, onRecordAttempt]
  );

  // Keyboard shortcuts: F = Fold, C = Call, R = Raise, Enter = Next Spot
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (!evaluation) {
        if (k === 'f') handleAction('fold');
        if (k === 'c' && spot.template.scenarioType !== 'RFI') handleAction('call');
        if (k === 'r') handleAction('raise');
      } else if (e.key === 'Enter') {
        dealNext();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [evaluation, spot.template.scenarioType, handleAction, dealNext]);

  // Build 6-max table seats rotated so Hero is seat 0
  const heroPosIdx = SEAT_ORDER.indexOf(spot.template.heroPos);
  const tableSeats: TableSeatDisplay[] = Array.from({ length: 6 }, (_, i) => {
    const pos = SEAT_ORDER[(heroPosIdx + i) % 6];
    const isHero = i === 0;
    const isVillain = spot.template.villainPos === pos;
    let actionText = '';
    if (isVillain) {
      actionText =
        spot.template.scenarioType === 'FACING_OPEN'
          ? 'Opens 2.5bb'
          : '3-Bets';
    } else if (!isHero && pos === 'SB') {
      actionText = 'SB 0.5bb';
    } else if (!isHero && pos === 'BB') {
      actionText = 'BB 1.0bb';
    }
    return {
      seatIndex: i,
      position: pos,
      label: isHero ? t('common.hero') : isVillain ? t('common.villain') : `${t('common.seat')} ${i + 1}`,
      stackBb: isVillain ? 97.5 : 100,
      isHero,
      isVillain,
      isDealer: pos === 'BTN',
      isActiveTurn: isHero && !evaluation,
      folded: !isHero && !isVillain && pos !== 'SB' && pos !== 'BB',
      actionText,
      cards: isHero ? spot.heroCards : null,
    };
  });

  const activeInspectedCell =
    inspectedHand && spot.template.matrix[inspectedHand]
      ? spot.template.matrix[inspectedHand]
      : spot.template.matrix[spot.handKey];

  const localizedTemplate = localizePreflopTemplate(locale, spot.template);

  return (
    <div className="space-y-6 pb-10">
      {/* Workspace Filter & Utility Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#222D3D] pb-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold text-white">
            {t('preflop.title')}
          </h1>
          <p className="text-xs text-slate-400">
            {localizedTemplate.subtitle} · {t('preflop.shortcuts')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Scenario Filter */}
          <div
            role="group"
            aria-label="Preflop scenario filter"
            className="flex flex-wrap items-center gap-1 p-1 bg-[#111722] border border-[#222D3D] rounded-lg max-w-full"
          >
            {SCENARIO_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setScenarioFilter(opt.value);
                  dealNext(opt.value, positionFilter);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  scenarioFilter === opt.value
                    ? 'bg-[#222E40] text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t(opt.labelKey)}
              </button>
            ))}
          </div>

          {/* Position Filter */}
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <span className="sr-only">Seat Position</span>
            <select
              aria-label="Filter by seat position"
              value={positionFilter}
              onChange={(e) => {
                const nextPos = e.target.value as Position | 'ALL';
                setPositionFilter(nextPos);
                dealNext(scenarioFilter, nextPos);
              }}
              className="bg-[#111722] border border-[#222D3D] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              {POSITION_OPTIONS.map((pos) => (
                <option key={pos} value={pos}>
                  {pos === 'ALL'
                    ? t('preflop.allSeats')
                    : `${t('preflop.heroPosPrefix')} ${translatePositionLabel(locale, pos)}`}
                </option>
              ))}
            </select>
          </label>

          {/* Deck & Audio Controls */}
          <button
            type="button"
            onClick={() => onUpdatePrefs({ fourColorDeck: !prefs.fourColorDeck })}
            aria-pressed={prefs.fourColorDeck}
            className={`px-3 py-2 text-xs font-medium rounded-lg border inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              prefs.fourColorDeck
                ? 'bg-[#172634] border-sky-500/40 text-sky-300'
                : 'bg-[#111722] border-[#222D3D] text-slate-400 hover:text-slate-200'
            }`}
          >
            <Palette className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{prefs.fourColorDeck ? t('common.fourColor') : t('common.twoColor')}</span>
          </button>

          <button
            type="button"
            onClick={() => onUpdatePrefs({ soundEnabled: !prefs.soundEnabled })}
            aria-label={prefs.soundEnabled ? t('common.muteSound') : t('common.enableSound')}
            className="p-2 rounded-lg bg-[#111722] border border-[#222D3D] text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            {prefs.soundEnabled ? (
              <Volume2 className="w-4 h-4" aria-hidden="true" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Two-Zone Studio Sandbox (65% Stage / 35% Analytics Deck) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Interactive Felt Stage */}
        <div className="xl:col-span-7 bg-[#111722] border border-[#222D3D] rounded-xl p-4 sm:p-6 flex flex-col justify-between gap-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span className="font-semibold text-white text-sm">{localizedTemplate.title}</span>
            <span className="font-mono tabular-nums">
              {t('preflop.handLabel')} {spot.handKey} · {localizedTemplate.actionSummary}
            </span>
          </div>

          <PokerTableOval
            seats={tableSeats}
            board={[]}
            potBb={spot.template.potBb}
            streetLabel={t('street.preflop')}
            fourColor={prefs.fourColorDeck}
            compact
          />

          {/* Action Control Strip */}
          <div className="pt-4 border-t border-[#1E293B] flex flex-wrap items-center justify-between gap-3">
            {!evaluation ? (
              <div className="flex flex-wrap items-center gap-3 w-full">
                <button
                  type="button"
                  onClick={() => handleAction('fold')}
                  className="flex-1 min-w-[110px] min-h-[44px] px-4 py-2.5 rounded-lg bg-[#1A2230] hover:bg-[#232F42] border border-[#2E3C52] text-sm font-semibold text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {t('common.fold')} <span className="text-xs font-mono text-slate-400 ml-1">[F]</span>
                </button>
                {spot.template.scenarioType !== 'RFI' && (
                  <button
                    type="button"
                    onClick={() => handleAction('call')}
                    className="flex-1 min-w-[120px] min-h-[44px] px-4 py-2.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/50 text-sm font-semibold text-sky-200 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {translateActionText(locale, spot.template.callLabel ?? `Call ${spot.template.toCallBb}bb`)}{' '}
                    <span className="text-xs font-mono text-sky-300/80 ml-1">[C]</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleAction('raise')}
                  className="flex-1 min-w-[130px] min-h-[44px] px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-sm font-semibold text-slate-950 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {translateActionText(locale, spot.template.raiseLabel)}{' '}
                  <span className="text-xs font-mono text-slate-900/75 ml-1">[R]</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 w-full">
                <GradeBadge grade={evaluation.grade} evLossBb={evaluation.evLossBb} />
                <button
                  type="button"
                  onClick={() => dealNext()}
                  className="min-h-[44px] px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-sm font-semibold text-slate-950 inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span>{t('preflop.nextSpot')}</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Analytics & 13x13 GTO Matrix Deck */}
        <div className="xl:col-span-5 bg-[#111722] border border-[#222D3D] rounded-xl p-5 sm:p-6 space-y-5">
          {!evaluation ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-white">{t('preflop.preActionTitle')}</h2>
                <p className="text-xs text-slate-400">{t('preflop.preActionDesc')}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs border-y border-[#1F2A3A] py-4">
                <div>
                  <span className="text-slate-400 block">{t('preflop.heroSeat')}</span>
                  <span className="font-mono font-semibold text-white text-sm">
                    {translatePositionLabel(locale, spot.template.heroPos)} (100bb)
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">{t('preflop.startingPot')}</span>
                  <span className="font-mono tabular-nums font-semibold text-amber-300 text-sm">
                    {spot.template.potBb.toFixed(1)} bb
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">{t('preflop.scenario')}</span>
                  <span className="font-medium text-slate-200">
                    {spot.template.scenarioType === 'RFI'
                      ? t('preflop.unopenedRfi')
                      : spot.template.scenarioType === 'FACING_OPEN'
                        ? `${t('preflop.facingOpen')} (${spot.template.villainPos})`
                        : `${t('preflop.facing3Bet')} (${spot.template.villainPos})`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">{t('preflop.handClass')}</span>
                  <span className="font-mono font-semibold text-emerald-300 text-sm">
                    {spot.handKey}
                  </span>
                </div>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed">
                {t('preflop.preActionTip')}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-white">
                  {t('preflop.solverSolution')} · {spot.handKey}
                </h2>
                <GradeBadge grade={evaluation.grade} evLossBb={evaluation.evLossBb} size="sm" />
              </div>

              <SolverBars actions={evaluation.actions} chosenLabel={evaluation.chosenAction} />

              <div className="space-y-2.5 pt-2 border-t border-[#1F2A3A]">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-200">
                    {t('preflop.fullMatrix')} ({localizedTemplate.title})
                  </span>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
                      {t('common.raise')}
                    </span>
                    {spot.template.scenarioType !== 'RFI' && (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-xs bg-sky-400 inline-block" />
                        {t('common.call')}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#1D2636] inline-block" />
                      {t('common.fold')}
                    </span>
                  </div>
                </div>

                <RangeMatrix13x13
                  mode="solver"
                  matrix={spot.template.matrix}
                  heroHandKey={spot.handKey}
                  inspectedHandKey={inspectedHand}
                  onInspectHand={setInspectedHand}
                />

                {/* Inspected Cell Micro-Readout */}
                {activeInspectedCell && (
                  <div className="flex items-center justify-between text-xs font-mono tabular-nums bg-[#0B1017] border border-[#1E293B] rounded-lg px-3 py-2">
                    <span className="font-semibold text-amber-300">
                      {t('preflop.inspecting')} {activeInspectedCell.hand}
                    </span>
                    <span className="text-slate-300">
                      {t('common.raise')} {activeInspectedCell.raise}% · {t('common.call')}{' '}
                      {activeInspectedCell.call}% · {t('common.fold')} {activeInspectedCell.fold}%
                    </span>
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-300 leading-relaxed border-t border-[#1F2A3A] pt-3">
                {localizedTemplate.strategyNote}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
