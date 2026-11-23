import { useCallback, useState } from 'react';
import { ArrowRight, Palette, Volume2, VolumeX } from 'lucide-react';
import type {
  DecisionEvaluation,
  DrillAttemptRecord,
  Position,
  Street,
  UserPreferences,
} from '../poker/types';
import {
  evaluatePostflopDecision,
  generatePostflopSpot,
  type PostflopDrillSpot,
  type PotType,
} from '../poker/postflopSpots';
import { PokerTableOval, type TableSeatDisplay } from '../components/PokerTableOval';
import { GradeBadge } from '../components/GradeBadge';
import { SolverBars } from '../components/SolverBars';
import { playPokerSound } from '../utils/sound';
import { useLocale } from '../i18n/LocaleContext';
import { translateActionText, translateStreetLabel } from '../i18n/translations';
import { localizePostflopSpot } from '../i18n/drillContentZh';

interface PostflopTrainerViewProps {
  prefs: UserPreferences;
  onUpdatePrefs: (patch: Partial<UserPreferences>) => void;
  onRecordAttempt: (attempt: Omit<DrillAttemptRecord, 'id' | 'timestamp'>) => void;
}

const SEAT_ORDER: Position[] = ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'];

export function PostflopTrainerView({
  prefs,
  onUpdatePrefs,
  onRecordAttempt,
}: PostflopTrainerViewProps) {
  const { locale, t } = useLocale();
  const [streetFilter, setStreetFilter] = useState<Exclude<Street, 'preflop'> | 'ALL'>('ALL');
  const [potFilter, setPotFilter] = useState<PotType | 'ALL'>('ALL');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'IP' | 'OOP'>('ALL');

  const [spot, setSpot] = useState<PostflopDrillSpot>(() =>
    generatePostflopSpot('ALL', 'ALL', 'ALL')
  );
  const [evaluation, setEvaluation] = useState<DecisionEvaluation | null>(null);

  const dealNext = useCallback(
    (
      nextStreet = streetFilter,
      nextPot = potFilter,
      nextRole = roleFilter,
      prevId = spot.id
    ) => {
      const next = generatePostflopSpot(nextStreet, nextPot, nextRole, prevId);
      setSpot(next);
      setEvaluation(null);
      playPokerSound('card', prefs.soundEnabled);
    },
    [streetFilter, potFilter, roleFilter, spot.id, prefs.soundEnabled]
  );

  const handleChoose = (actionKey: string) => {
    if (evaluation) return;
    const res = evaluatePostflopDecision(spot, actionKey);
    setEvaluation(res);
    playPokerSound(
      res.grade === 'Optimal' || res.grade === 'Acceptable' ? 'optimal' : 'mistake',
      prefs.soundEnabled
    );
    onRecordAttempt({
      module: 'postflop',
      position: spot.heroPos,
      street: spot.street,
      spotLabel: spot.title,
      chosenAction: res.chosenAction,
      bestAction: res.bestAction,
      evLossBb: res.evLossBb,
      grade: res.grade,
      accuracyScore: res.accuracyScore,
    });
  };

  const heroIdx = SEAT_ORDER.indexOf(spot.heroPos);
  const seats: TableSeatDisplay[] = Array.from({ length: 6 }, (_, i) => {
    const pos = SEAT_ORDER[(heroIdx + i) % 6];
    const isHero = i === 0;
    const isVillain = pos === spot.villainPos;
    return {
      seatIndex: i,
      position: pos,
      label: isHero ? t('common.hero') : isVillain ? t('common.villain') : `${t('common.seat')} ${i + 1}`,
      stackBb: isHero || isVillain ? spot.effectiveStackBb : 100,
      isHero,
      isVillain,
      isDealer: pos === 'BTN',
      isActiveTurn: isHero && !evaluation,
      folded: !isHero && !isVillain,
      actionText: isVillain && spot.toCallBb > 0 ? `Bets ${spot.toCallBb}bb` : isVillain ? 'Checks' : '',
      cards: isHero ? spot.heroCards : isVillain ? [spot.heroCards[0], spot.heroCards[1]] : null,
      revealCards: isHero,
    };
  });

  const spr = (spot.effectiveStackBb / Math.max(1, spot.potBb)).toFixed(1);
  const displaySpot = localizePostflopSpot(locale, spot);

  return (
    <div className="space-y-6 pb-10">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#222D3D] pb-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold text-white">
            {t('postflop.title')}
          </h1>
          <p className="text-xs text-slate-400">{t('postflop.subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Street Segmented Filter */}
          <div
            role="group"
            aria-label="Street filter"
            className="flex items-center gap-1 p-1 bg-[#111722] border border-[#222D3D] rounded-lg"
          >
            {(['ALL', 'flop', 'turn', 'river'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => {
                  setStreetFilter(st);
                  dealNext(st, potFilter, roleFilter);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  streetFilter === st
                    ? 'bg-[#222E40] text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st === 'ALL' ? t('postflop.allStreets') : translateStreetLabel(locale, st)}
              </button>
            ))}
          </div>

          <select
            aria-label="Filter by pot type"
            value={potFilter}
            onChange={(e) => {
              const v = e.target.value as PotType | 'ALL';
              setPotFilter(v);
              dealNext(streetFilter, v, roleFilter);
            }}
            className="bg-[#111722] border border-[#222D3D] rounded-lg px-3 py-2 text-xs text-slate-200 cursor-pointer"
          >
            <option value="ALL">{t('postflop.allPots')}</option>
            <option value="SRP">{t('postflop.srp')}</option>
            <option value="3BP">{t('postflop.3bp')}</option>
          </select>

          <select
            aria-label="Filter by Hero position role"
            value={roleFilter}
            onChange={(e) => {
              const v = e.target.value as 'ALL' | 'IP' | 'OOP';
              setRoleFilter(v);
              dealNext(streetFilter, potFilter, v);
            }}
            className="bg-[#111722] border border-[#222D3D] rounded-lg px-3 py-2 text-xs text-slate-200 cursor-pointer"
          >
            <option value="ALL">{t('postflop.allRoles')}</option>
            <option value="IP">{t('postflop.ip')}</option>
            <option value="OOP">{t('postflop.oop')}</option>
          </select>

          <button
            type="button"
            onClick={() => onUpdatePrefs({ fourColorDeck: !prefs.fourColorDeck })}
            className={`px-3 py-2 text-xs font-medium rounded-lg border inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              prefs.fourColorDeck
                ? 'bg-[#172634] border-sky-500/40 text-sky-300'
                : 'bg-[#111722] border-[#222D3D] text-slate-400'
            }`}
          >
            <Palette className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{prefs.fourColorDeck ? t('common.fourColorShort') : t('common.twoColorShort')}</span>
          </button>

          <button
            type="button"
            onClick={() => onUpdatePrefs({ soundEnabled: !prefs.soundEnabled })}
            aria-label={prefs.soundEnabled ? t('common.muteSound') : t('common.enableSound')}
            className="p-2 rounded-lg bg-[#111722] border border-[#222D3D] text-slate-300 hover:text-white cursor-pointer"
          >
            {prefs.soundEnabled ? (
              <Volume2 className="w-4 h-4" aria-hidden="true" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Two-Zone Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Live Felt Stage */}
        <div className="xl:col-span-7 bg-[#111722] border border-[#222D3D] rounded-xl p-4 sm:p-6 flex flex-col justify-between gap-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span className="text-sm font-semibold text-white">{displaySpot.title}</span>
            <span className="font-mono tabular-nums">
              {spot.potType} · {spot.heroPos} vs {spot.villainPos} ·{' '}
              {spot.heroInPosition ? 'IP' : 'OOP'}
            </span>
          </div>

          <PokerTableOval
            seats={seats}
            board={spot.board}
            potBb={spot.potBb}
            streetLabel={translateStreetLabel(locale, spot.street)}
            sprLabel={`SPR ${spr}`}
            fourColor={prefs.fourColorDeck}
          />

          {/* Decision Buttons */}
          <div className="pt-4 border-t border-[#1E293B]">
            {!evaluation ? (
              <div className="flex flex-wrap items-center gap-3">
                {spot.actions.map((act) => {
                  const style =
                    act.kind === 'bet' || act.kind === 'raise'
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                      : act.kind === 'call'
                        ? 'bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/50 text-sky-200'
                        : act.kind === 'check'
                          ? 'bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/45 text-amber-200'
                          : 'bg-[#1A2230] hover:bg-[#232F42] border border-[#2E3C52] text-slate-200';
                  return (
                    <button
                      key={act.action}
                      type="button"
                      onClick={() => handleChoose(act.action)}
                      className={`flex-1 min-w-[128px] min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${style}`}
                    >
                      {translateActionText(locale, act.label)}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <GradeBadge grade={evaluation.grade} evLossBb={evaluation.evLossBb} />
                <button
                  type="button"
                  onClick={() => dealNext()}
                  className="min-h-[44px] px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-sm font-semibold text-slate-950 inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span>{t('postflop.nextSpot')}</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Solver Analytics Deck */}
        <div className="xl:col-span-5 bg-[#111722] border border-[#222D3D] rounded-xl p-5 sm:p-6 space-y-5">
          {/* Action History Trail */}
          <div className="space-y-2.5">
            <h2 className="text-sm font-semibold text-white">{t('postflop.actionHistory')}</h2>
            <ol className="space-y-1.5 text-xs text-slate-300 font-mono">
              {displaySpot.actionLog.map((line, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2.5 bg-[#0B1017] border border-[#1E293B] rounded-md px-3 py-2"
                >
                  <span className="text-slate-500 tabular-nums">{idx + 1}.</span>
                  <span>{line}</span>
                </li>
              ))}
            </ol>
          </div>

          {!evaluation ? (
            <div className="border-t border-[#1F2A3A] pt-4 space-y-3">
              <h3 className="text-sm font-semibold text-white">{t('postflop.checklistTitle')}</h3>
              <ul className="space-y-2 text-xs text-slate-300 leading-relaxed">
                <li>{t('postflop.check1')}</li>
                <li>{t('postflop.check2')}</li>
                <li>
                  {t('postflop.check3Prefix')} ({spr}) {t('postflop.check3Suffix')}
                </li>
              </ul>
            </div>
          ) : (
            <div className="border-t border-[#1F2A3A] pt-5 space-y-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-white">{t('postflop.solverTitle')}</h3>
                <GradeBadge grade={evaluation.grade} evLossBb={evaluation.evLossBb} size="sm" />
              </div>

              <SolverBars actions={evaluation.actions} chosenLabel={evaluation.chosenAction} />

              <div className="border-t border-[#1F2A3A] pt-4 space-y-3 text-xs leading-relaxed">
                <div>
                  <span className="font-semibold text-slate-200 block">{t('postflop.boardTexture')}</span>
                  <span className="text-slate-400">{displaySpot.takeaways.boardTexture}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-200 block">{t('postflop.rangeAdvantage')}</span>
                  <span className="text-slate-400">{displaySpot.takeaways.rangeAdvantage}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-200 block">{t('postflop.blockerEffect')}</span>
                  <span className="text-slate-400">{displaySpot.takeaways.blockerNote}</span>
                </div>
                <div className="bg-[#0C1814] border border-emerald-500/25 rounded-lg p-3">
                  <span className="font-semibold text-emerald-300 block mb-0.5">
                    {t('postflop.coreRule')}
                  </span>
                  <span className="text-slate-200">{displaySpot.takeaways.coreRule}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
