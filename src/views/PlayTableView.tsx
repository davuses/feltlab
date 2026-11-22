import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Expand,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Palette,
  PanelRightClose,
  PanelRightOpen,
  Play,
  RefreshCw,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import type { DrillAttemptRecord, UserPreferences } from '../poker/types';
import {
  applyPlayerAction,
  chooseBotAction,
  computeHudDisplay,
  createTableFromConfig,
  DEFAULT_ARENA_CONFIG,
  getLegalActions,
  rebuyHeroTo100,
  roundBb,
  startNewHand,
  type ArenaConfig,
  type PokerTableState,
} from '../poker/tableEngine';
import { PokerTableOval, type TableSeatDisplay } from '../components/PokerTableOval';
import { Studio3DTable } from '../components/Studio3DTable';
import { ArenaSetupModal } from '../components/ArenaSetupModal';
import { GradeBadge } from '../components/GradeBadge';
import { playPokerSound } from '../utils/sound';
import { useLocale } from '../i18n/LocaleContext';
import {
  translateActionText,
  translateArchetype,
  translateStreetLabel,
  type TranslationKey,
} from '../i18n/translations';
import type { Seat3DSpec } from '../three/models';

interface PlayTableViewProps {
  prefs: UserPreferences;
  onUpdatePrefs: (patch: Partial<UserPreferences>) => void;
  onRecordAttempt: (attempt: Omit<DrillAttemptRecord, 'id' | 'timestamp'>) => void;
}

const ARCHETYPE_SHORT: Record<string, string> = {
  'Balanced Reg': 'REG',
  'Tight-Aggressive': 'TAG',
  'Loose-Aggressive': 'LAG',
  'Calling Station': 'CS',
  'Tight Nit': 'NIT',
  Maniac: 'MANIAC',
};

export function PlayTableView({
  prefs,
  onUpdatePrefs,
  onRecordAttempt,
}: PlayTableViewProps) {
  const { locale, t } = useLocale();
  const [table, setTable] = useState<PokerTableState>(() =>
    startNewHand(createTableFromConfig(DEFAULT_ARENA_CONFIG))
  );
  const [raiseAmount, setRaiseAmount] = useState<number>(2.5);
  // 3D Table is the primary default experience for the Multi-Bot Arena
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('3d');
  const [theaterMode, setTheaterMode] = useState<boolean>(false);
  const [theaterHudOpen, setTheaterHudOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [setupOpen, setSetupOpen] = useState<boolean>(false);
  const [rightTab, setRightTab] = useState<'hud' | 'feed'>('hud');
  const arenaRootRef = useRef<HTMLDivElement | null>(null);
  const loggedHandRef = useRef<number>(0);

  // Track native Fullscreen API state and allow Escape to exit Theater Mode cleanly
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && theaterMode && !setupOpen) {
        setTheaterMode(false);
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [theaterMode, setupOpen]);

  const handleToggleTheater = () => {
    setTheaterMode((prev) => {
      const next = !prev;
      if (next) setViewMode('3d');
      if (!next && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      return next;
    });
  };

  const handleToggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        setTheaterMode(true);
        setViewMode('3d');
        const targetEl = arenaRootRef.current ?? document.documentElement;
        if (targetEl.requestFullscreen) {
          await targetEl.requestFullscreen();
        }
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Iframe environments may block native Fullscreen API; Theater Mode still expands to 100% viewport cleanly
      setTheaterMode(true);
    }
  };

  const heroSeat = table.seats[0];
  const isHeroTurn =
    table.phase !== 'IDLE' &&
    table.phase !== 'SHOWDOWN' &&
    table.actingSeatIndex === 0;
  const legal = getLegalActions(table, 0);
  const botDelayMs = table.config.speed === 'fast' ? 220 : 480;

  // Sync default raise sizing whenever it becomes Hero's turn
  useEffect(() => {
    if (isHeroTurn && legal.canBetOrRaise) {
      const defaultTarget =
        table.phase === 'PREFLOP' && table.currentBetBb <= 1.0
          ? table.config.tableSize === 2
            ? 2.2
            : 2.5
          : table.currentBetBb === 0
            ? roundBb(Math.max(legal.minTotalBetBb, table.potBb * 0.5))
            : roundBb(Math.max(legal.minTotalBetBb, table.currentBetBb * 2.5));
      setRaiseAmount(
        Math.min(legal.maxTotalBetBb, Math.max(legal.minTotalBetBb, defaultTarget))
      );
    }
  }, [
    isHeroTurn,
    table.phase,
    table.currentBetBb,
    table.potBb,
    table.config.tableSize,
    legal.canBetOrRaise,
    legal.minTotalBetBb,
    legal.maxTotalBetBb,
  ]);

  // Automatic strategic bot turn loop with clean timeout teardown
  useEffect(() => {
    if (
      table.phase === 'IDLE' ||
      table.phase === 'SHOWDOWN' ||
      table.actingSeatIndex === null ||
      table.actingSeatIndex === 0
    ) {
      return;
    }

    // Fast-fold: if Hero folded and fastFold is enabled, immediately deal the next hand
    if (heroSeat.folded && table.config.fastFold) {
      const fastTimer = window.setTimeout(() => {
        setTable((curr) => startNewHand(curr));
      }, 360);
      return () => window.clearTimeout(fastTimer);
    }

    const botIndex = table.actingSeatIndex;
    const timer = window.setTimeout(() => {
      setTable((curr) => {
        if (curr.actingSeatIndex !== botIndex || curr.phase === 'SHOWDOWN') return curr;
        const move = chooseBotAction(curr, botIndex);
        if (move.type === 'raise' || move.type === 'call') {
          playPokerSound('chip', prefs.soundEnabled);
        }
        return applyPlayerAction(curr, botIndex, move.type, move.raiseToBb);
      });
    }, botDelayMs);

    return () => window.clearTimeout(timer);
  }, [
    table.actingSeatIndex,
    table.phase,
    table.actionLog.length,
    table.config.fastFold,
    heroSeat.folded,
    botDelayMs,
    prefs.soundEnabled,
  ]);

  // Record Hero's street decisions into Leak Tracker once per completed hand (or on fast-fold)
  useEffect(() => {
    const shouldLog =
      (table.phase === 'SHOWDOWN' || (heroSeat.folded && table.config.fastFold)) &&
      table.handNumber > loggedHandRef.current &&
      table.heroAudits.length > 0;

    if (shouldLog) {
      loggedHandRef.current = table.handNumber;
      for (const audit of table.heroAudits) {
        onRecordAttempt({
          module: 'table',
          position: audit.position,
          street: audit.street,
          spotLabel: `${table.config.tableSize}-Max Hand #${table.handNumber} (${audit.street})`,
          chosenAction: audit.chosenAction,
          bestAction: audit.recommendedAction,
          evLossBb: audit.evLossBb,
          grade: audit.grade,
          accuracyScore: audit.accuracyScore,
        });
      }
    }
  }, [
    table.phase,
    table.handNumber,
    table.heroAudits,
    table.config.tableSize,
    table.config.fastFold,
    heroSeat.folded,
    onRecordAttempt,
  ]);

  const handleHeroAction = (
    type: 'fold' | 'check' | 'call' | 'raise',
    customTarget?: number
  ) => {
    if (!isHeroTurn) return;
    playPokerSound(type === 'fold' ? 'card' : 'chip', prefs.soundEnabled);
    setTable((curr) => applyPlayerAction(curr, 0, type, customTarget ?? raiseAmount));
  };

  const handleDealNext = () => {
    playPokerSound('card', prefs.soundEnabled);
    setTable((curr) => startNewHand(curr));
  };

  const handleRebuy = () => {
    playPokerSound('chip', prefs.soundEnabled);
    setTable((curr) => rebuyHeroTo100(curr));
  };

  const handleApplyArenaConfig = (nextConfig: ArenaConfig) => {
    playPokerSound('card', prefs.soundEnabled);
    loggedHandRef.current = 0;
    setTable(startNewHand(createTableFromConfig(nextConfig)));
  };

  const toggleBlindRead = () => {
    setTable((curr) => ({
      ...curr,
      config: { ...curr.config, blindReadMode: !curr.config.blindReadMode },
    }));
  };

  const toggleFastFold = () => {
    setTable((curr) => ({
      ...curr,
      config: { ...curr.config, fastFold: !curr.config.fastFold },
    }));
  };

  const displaySeats: TableSeatDisplay[] = useMemo(
    () =>
      table.seats.map((s) => {
        const hud = computeHudDisplay(s.stats);
        const botStyleLabel = table.config.blindReadMode
          ? `${t('arena.hiddenTag')} · ${hud.vpipPct}/${hud.pfrPct}`
          : translateArchetype(locale, s.archetype);

        return {
          seatIndex: s.seatIndex,
          position: s.position,
          label: s.isHero ? t('common.hero') : s.name,
          sublabel: s.isHero ? undefined : botStyleLabel,
          stackBb: s.stackBb,
          isHero: s.isHero,
          isDealer: s.seatIndex === table.buttonSeatIndex,
          isActiveTurn: table.actingSeatIndex === s.seatIndex,
          isWinner: table.winnerSeatIndices.includes(s.seatIndex),
          folded: s.folded,
          streetBetBb: s.streetBetBb,
          actionText: s.lastActionText,
          cards: s.cards,
          revealCards:
            s.isHero ||
            (table.phase === 'SHOWDOWN' &&
              !s.folded &&
              table.seats.filter((x) => !x.folded).length > 1),
        };
      }),
    [table, locale, t]
  );

  const seats3D: Seat3DSpec[] = useMemo(
    () =>
      table.seats.map((s, idx) => {
        const d = displaySeats[idx];
        const hud = computeHudDisplay(s.stats);
        const styleTag = s.isHero
          ? undefined
          : table.config.blindReadMode
            ? `??? ${hud.vpipPct}/${hud.pfrPct}`
            : `${ARCHETYPE_SHORT[s.archetype] ?? s.archetype} ${hud.vpipPct}/${hud.pfrPct}`;

        return {
          seatIndex: s.seatIndex,
          position: s.position,
          label: s.isHero ? 'Hero' : s.name,
          stackBb: s.stackBb,
          isHero: s.isHero,
          isDealer: d.isDealer ?? false,
          isActiveTurn: d.isActiveTurn ?? false,
          folded: s.folded,
          isWinner: d.isWinner ?? false,
          streetBetBb: s.streetBetBb,
          actionText: s.lastActionText || undefined,
          styleTag,
          cards: s.cards,
          revealCards: d.revealCards,
        };
      }),
    [table.seats, table.config.blindReadMode, displaySeats]
  );

  const activeActorName =
    table.actingSeatIndex !== null ? table.seats[table.actingSeatIndex]?.name : null;

  const presetLabel = t(`arena.preset.${table.config.poolPreset}` as TranslationKey);

  const statusText =
    table.phase === 'SHOWDOWN'
      ? t('table.handComplete')
      : isHeroTurn
        ? `${t('table.yourTurn')} (${heroSeat.position})`
        : activeActorName
          ? `${activeActorName} ${t('table.acting')}`
          : t('table.ready');

  const actionConsoleNode =
    table.phase === 'SHOWDOWN' ? (
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0C1814] border border-emerald-500/30 rounded-lg p-3.5">
        <div className="space-y-0.5">
          <p className="text-xs font-mono text-emerald-400">{t('table.showdownResult')}</p>
          <p className="text-sm font-semibold text-white">{table.winnerSummary}</p>
        </div>
        <button
          type="button"
          onClick={handleDealNext}
          className="min-h-[42px] px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-sm font-semibold text-slate-950 inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
        >
          <Play className="w-4 h-4" aria-hidden="true" />
          <span>{t('table.dealNext')}</span>
        </button>
      </div>
    ) : isHeroTurn ? (
      <div className={theaterMode ? 'flex flex-wrap items-center gap-3' : 'space-y-3.5'}>
        <div className={`flex flex-wrap items-center gap-2.5 ${theaterMode ? 'flex-1 min-w-[320px]' : ''}`}>
          {legal.canFold && (
            <button
              type="button"
              onClick={() => handleHeroAction('fold')}
              className="flex-1 min-w-[96px] min-h-[42px] px-4 py-2 rounded-lg bg-[#1A2230] hover:bg-[#232F42] border border-[#2E3C52] text-sm font-semibold text-slate-200 cursor-pointer whitespace-nowrap"
            >
              {t('common.fold')}
            </button>
          )}
          {legal.canCheck ? (
            <button
              type="button"
              onClick={() => handleHeroAction('check')}
              className="flex-1 min-w-[106px] min-h-[42px] px-4 py-2 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/45 text-sm font-semibold text-amber-200 cursor-pointer whitespace-nowrap"
            >
              {t('common.check')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleHeroAction('call')}
              className="flex-1 min-w-[118px] min-h-[42px] px-4 py-2 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/50 text-sm font-semibold text-sky-200 font-mono tabular-nums cursor-pointer whitespace-nowrap"
            >
              {t('common.call')} {legal.callAmountBb.toFixed(1)}bb
            </button>
          )}
          {legal.canBetOrRaise && (
            <button
              type="button"
              onClick={() => handleHeroAction('raise', raiseAmount)}
              className="flex-1 min-w-[144px] min-h-[42px] px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-sm font-semibold text-slate-950 font-mono tabular-nums cursor-pointer whitespace-nowrap"
            >
              {legal.isBet ? t('common.bet') : t('common.raise')} {raiseAmount.toFixed(1)}bb
            </button>
          )}
        </div>

        {legal.canBetOrRaise && (
          <div
            className={`flex flex-wrap items-center gap-3 bg-[#0B1017] border border-[#1E293B] rounded-lg px-3.5 py-2 ${
              theaterMode ? 'flex-1 min-w-[340px]' : ''
            }`}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { label: '33%', val: roundBb(table.potBb * 0.33) },
                { label: '50%', val: roundBb(table.potBb * 0.5) },
                { label: '75%', val: roundBb(table.potBb * 0.75) },
                { label: t('common.pot'), val: roundBb(table.potBb) },
                { label: t('common.allIn'), val: legal.maxTotalBetBb },
              ].map((preset) => {
                const clamped = roundBb(
                  Math.max(legal.minTotalBetBb, Math.min(legal.maxTotalBetBb, preset.val))
                );
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setRaiseAmount(clamped)}
                    className="px-2.5 py-1 text-xs font-mono rounded bg-[#161F2E] hover:bg-[#222F44] border border-[#2A384F] text-slate-200 cursor-pointer whitespace-nowrap"
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 min-w-[140px] flex items-center gap-3">
              <label htmlFor="table-raise-slider" className="sr-only">
                Bet or raise amount in big blinds
              </label>
              <input
                id="table-raise-slider"
                type="range"
                min={legal.minTotalBetBb}
                max={legal.maxTotalBetBb}
                step={0.5}
                value={raiseAmount}
                onChange={(e) => setRaiseAmount(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <span className="font-mono tabular-nums text-xs text-emerald-300 w-14 text-right shrink-0">
                {raiseAmount.toFixed(1)}bb
              </span>
            </div>
          </div>
        )}
      </div>
    ) : (
      <div className="flex items-center justify-between text-xs text-slate-400 py-1.5">
        <span>
          {heroSeat.folded
            ? t('table.foldedWait')
            : `${t('table.waitingFor')} ${activeActorName ?? '...'}`}
        </span>
        <button
          type="button"
          onClick={handleDealNext}
          className="px-3.5 py-2 text-xs font-medium rounded-lg bg-[#17202E] hover:bg-[#222F44] border border-[#2B394F] text-slate-200 cursor-pointer whitespace-nowrap"
        >
          {t('table.skipNext')}
        </button>
      </div>
    );

  const analyticsPanelNode = (
    <div className="space-y-4">
      {/* Compact Tab Switcher */}
      <div
        role="tablist"
        aria-label="Arena analytics panels"
        className="grid grid-cols-2 gap-1 p-1 bg-[#0B1017] border border-[#1E293B] rounded-lg"
      >
        <button
          type="button"
          role="tab"
          aria-selected={rightTab === 'hud'}
          onClick={() => setRightTab('hud')}
          className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
            rightTab === 'hud' ? 'bg-[#1D283A] text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t('arena.tabHud')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={rightTab === 'feed'}
          onClick={() => setRightTab('feed')}
          className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
            rightTab === 'feed' ? 'bg-[#1D283A] text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t('arena.tabFeed')} ({table.actionLog.length})
        </button>
      </div>

      {rightTab === 'hud' ? (
        <div className="space-y-5">
          {/* Live Opponent HUD Table */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white">{t('arena.hudTitle')}</h2>
              {table.config.blindReadMode && (
                <span className="text-[11px] font-mono text-amber-300">{t('arena.hudHidden')}</span>
              )}
            </div>

            <div className="overflow-x-auto border border-[#1E293B] rounded-lg bg-[#0B1017]">
              <table className="w-full text-left text-[11px] font-mono tabular-nums">
                <thead>
                  <tr className="border-b border-[#1E293B] text-slate-400">
                    <th className="py-2 px-2.5 font-medium">{t('arena.hudColPlayer')}</th>
                    <th className="py-2 px-2 font-medium">{t('arena.hudColStyle')}</th>
                    <th className="py-2 px-1.5 text-right font-medium">{t('arena.hudColVpip')}</th>
                    <th className="py-2 px-1.5 text-right font-medium">{t('arena.hudColPfr')}</th>
                    <th className="py-2 px-1.5 text-right font-medium">{t('arena.hudCol3b')}</th>
                    <th className="py-2 px-2 text-right font-medium">{t('arena.hudColAf')}</th>
                  </tr>
                </thead>
                <tbody data-testid="opponent-hud-rows">
                  {table.seats
                    .filter((s) => !s.isHero)
                    .map((bot) => {
                      const hud = computeHudDisplay(bot.stats);
                      const isActing = table.actingSeatIndex === bot.seatIndex;
                      return (
                        <tr
                          key={bot.seatIndex}
                          className={`border-b border-[#161F2D] last:border-0 ${
                            isActing ? 'bg-emerald-500/10' : ''
                          } ${bot.folded ? 'opacity-50' : ''}`}
                        >
                          <td className="py-2 px-2.5 text-slate-200 whitespace-nowrap">
                            <span className="text-emerald-400 mr-1.5">{bot.position}</span>
                            <span>{bot.name.split(' ')[1] ?? bot.name}</span>
                          </td>
                          <td className="py-2 px-2 text-slate-300 truncate max-w-[92px]">
                            {table.config.blindReadMode ? (
                              <span className="text-amber-300">{t('arena.hiddenTag')}</span>
                            ) : (
                              translateArchetype(locale, bot.archetype)
                            )}
                          </td>
                          <td className="py-2 px-1.5 text-right text-slate-200">{hud.vpipPct}%</td>
                          <td className="py-2 px-1.5 text-right text-slate-300">{hud.pfrPct}%</td>
                          <td className="py-2 px-1.5 text-right text-sky-300">
                            {hud.threeBetPct}%
                          </td>
                          <td className="py-2 px-2 text-right text-amber-300">{hud.af}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Exploitative EV Audit */}
          <div className="border-t border-[#1F2A3A] pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">{t('table.auditTitle')}</h2>
              <span className="text-xs font-mono tabular-nums text-slate-400">
                {table.heroAudits.length}{' '}
                {table.heroAudits.length === 1
                  ? t('table.actionSingular')
                  : t('table.actionPlural')}
              </span>
            </div>

            {table.heroAudits.length === 0 ? (
              <p className="text-xs text-slate-400 bg-[#0B1017] border border-[#1E293B] rounded-lg p-3.5 leading-relaxed">
                {t('table.auditEmpty')}
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                {table.heroAudits.map((audit, idx) => (
                  <div
                    key={idx}
                    className="bg-[#0B1017] border border-[#1E293B] rounded-lg p-3 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-slate-300">
                        {translateStreetLabel(locale, audit.street)} ·{' '}
                        {translateActionText(locale, audit.chosenAction)}
                      </span>
                      <GradeBadge grade={audit.grade} evLossBb={audit.evLossBb} size="sm" />
                    </div>
                    <p className="text-slate-400 leading-relaxed">{audit.note}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Live Table Action Feed Tab */
        <div className="space-y-2.5">
          <h3 className="text-sm font-semibold text-white">{t('table.actionFeedTitle')}</h3>
          <ol className="space-y-1 max-h-[480px] overflow-y-auto text-xs font-mono pr-1">
            {table.actionLog.map((item, idx) => (
              <li
                key={idx}
                className="flex items-center justify-between gap-2 py-1.5 border-b border-[#182130] last:border-0"
              >
                <span className="text-slate-300 truncate">
                  <span className="text-emerald-400 mr-1.5">{item.position}</span>
                  {item.seatName}
                </span>
                <span className="text-slate-400 shrink-0">
                  {translateActionText(locale, item.text)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );

  return (
    <div
      ref={arenaRootRef}
      data-testid={theaterMode ? 'arena-theater-container' : 'arena-standard-container'}
      className={
        theaterMode
          ? 'fixed inset-0 z-40 bg-[#080B11] flex flex-col overflow-hidden'
          : 'space-y-5 pb-10'
      }
    >
      {/* Header Bar: Compact Cinema Bar in Theater Mode, Full Config Toolbar in Standard Mode */}
      {theaterMode ? (
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 border-b border-[#1E293B] bg-[#0B1017] shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            <span
              data-testid="arena-config-badge"
              className="px-2.5 py-0.5 text-xs font-mono rounded-md bg-[#152030] border border-[#273852] text-emerald-300"
            >
              {table.config.tableSize}-Max · {presetLabel} · {table.config.startingStackBb}bb
            </span>
            <span className="text-xs font-mono text-emerald-400 font-semibold">{statusText}</span>
            <span className="hidden md:inline text-xs font-mono tabular-nums text-slate-400">
              {t('table.heroStack')} {heroSeat.stackBb.toFixed(1)}bb · {t('table.currentBet')}{' '}
              {table.currentBetBb.toFixed(1)}bb
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="theater-toggle-hud"
              onClick={() => setTheaterHudOpen((v) => !v)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                theaterHudOpen
                  ? 'bg-[#1D283A] border-emerald-500/50 text-white'
                  : 'bg-[#111722] border-[#222D3D] text-slate-300 hover:text-white'
              }`}
            >
              {theaterHudOpen ? (
                <PanelRightClose className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <PanelRightOpen className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>{t('arena.toggleHudDrawer')}</span>
            </button>

            <button
              type="button"
              data-testid="open-arena-setup"
              onClick={() => setSetupOpen(true)}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{t('arena.configure')}</span>
            </button>

            <button
              type="button"
              data-testid="toggle-blind-read"
              onClick={toggleBlindRead}
              aria-pressed={table.config.blindReadMode}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                table.config.blindReadMode
                  ? 'bg-amber-500/15 border-amber-400/50 text-amber-200'
                  : 'bg-[#111722] border-[#222D3D] text-slate-300 hover:text-white'
              }`}
            >
              {table.config.blindReadMode ? (
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span className="hidden md:inline">
                {table.config.blindReadMode ? t('arena.revealStyles') : t('arena.hideStyles')}
              </span>
            </button>

            <button
              type="button"
              data-testid="toggle-fast-fold"
              onClick={toggleFastFold}
              aria-pressed={table.config.fastFold}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border inline-flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                table.config.fastFold
                  ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300'
                  : 'bg-[#111722] border-[#222D3D] text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden md:inline">{t('arena.fastFoldShort')}</span>
            </button>

            <button
              type="button"
              data-testid="toggle-fullscreen-btn"
              onClick={handleToggleFullscreen}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-[#111722] border border-[#222D3D] text-slate-200 hover:border-emerald-500/50 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Expand className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">
                {isFullscreen ? t('arena.exitFullscreen') : t('arena.fullscreen')}
              </span>
            </button>

            <button
              type="button"
              data-testid="exit-theater-btn"
              onClick={handleToggleTheater}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-[#192334] border border-[#2B3B54] text-slate-100 hover:bg-[#233148] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Minimize2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t('arena.exitTheater')}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#222D3D] pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-semibold text-white">{t('table.title')}</h1>
              <span
                data-testid="arena-config-badge"
                className="px-2.5 py-0.5 text-xs font-mono rounded-md bg-[#152030] border border-[#273852] text-emerald-300"
              >
                {table.config.tableSize}-Max · {presetLabel} · {table.config.startingStackBb}bb
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {locale === 'zh-CN'
                ? `${t('table.hand')} ${table.handNumber} 手`
                : `${t('table.hand')} #${table.handNumber}`}{' '}
              · {t('table.subtitleSuffix')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Open Configure Arena Modal */}
            <button
              type="button"
              data-testid="open-arena-setup"
              onClick={() => setSetupOpen(true)}
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t('arena.configure')}</span>
            </button>

            {/* Theater / Fullscreen Mode Button */}
            <button
              type="button"
              data-testid="enter-theater-btn"
              onClick={handleToggleTheater}
              className="px-3 py-2 text-xs font-medium rounded-lg bg-[#152030] hover:bg-[#1D2D44] border border-emerald-500/40 text-emerald-300 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t('arena.theaterMode')}</span>
            </button>

            {/* Blind Read Quick Toggle */}
            <button
              type="button"
              data-testid="toggle-blind-read"
              onClick={toggleBlindRead}
              aria-pressed={table.config.blindReadMode}
              className={`px-3 py-2 text-xs font-medium rounded-lg border inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                table.config.blindReadMode
                  ? 'bg-amber-500/15 border-amber-400/50 text-amber-200'
                  : 'bg-[#111722] border-[#222D3D] text-slate-300 hover:text-white'
              }`}
            >
              {table.config.blindReadMode ? (
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>
                {table.config.blindReadMode ? t('arena.revealStyles') : t('arena.hideStyles')}
              </span>
            </button>

            {/* Fast-Fold Quick Toggle */}
            <button
              type="button"
              data-testid="toggle-fast-fold"
              onClick={toggleFastFold}
              aria-pressed={table.config.fastFold}
              className={`px-2.5 py-2 text-xs font-medium rounded-lg border inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
                table.config.fastFold
                  ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300'
                  : 'bg-[#111722] border-[#222D3D] text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t('arena.fastFoldShort')}</span>
            </button>

            {/* 3D / 2D Switcher */}
            <div
              role="group"
              aria-label="Table visual mode"
              className="flex items-center gap-1 p-1 bg-[#111722] border border-[#222D3D] rounded-lg"
            >
              <button
                type="button"
                data-testid="play-view-3d"
                onClick={() => setViewMode('3d')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
                  viewMode === '3d'
                    ? 'bg-emerald-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Box className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t('table.view3D')}</span>
              </button>
              <button
                type="button"
                data-testid="play-view-2d"
                onClick={() => setViewMode('2d')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  viewMode === '2d'
                    ? 'bg-[#222E40] text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t('table.view2D')}
              </button>
            </div>

            <button
              type="button"
              onClick={handleRebuy}
              disabled={
                heroSeat.stackBb >= table.config.startingStackBb && table.phase !== 'SHOWDOWN'
              }
              className="px-2.5 py-2 text-xs font-medium rounded-lg bg-[#111722] border border-[#222D3D] text-slate-200 hover:bg-[#192334] disabled:opacity-45 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {t('table.topUp')} {table.config.startingStackBb}bb
              </span>
            </button>

            <button
              type="button"
              onClick={() => onUpdatePrefs({ fourColorDeck: !prefs.fourColorDeck })}
              aria-label={prefs.fourColorDeck ? t('common.fourColor') : t('common.twoColor')}
              className={`p-2 rounded-lg border cursor-pointer ${
                prefs.fourColorDeck
                  ? 'bg-[#172634] border-sky-500/40 text-sky-300'
                  : 'bg-[#111722] border-[#222D3D] text-slate-400'
              }`}
            >
              <Palette className="w-4 h-4" aria-hidden="true" />
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
      )}

      {/* Unified Stage Layout: preserves a single WebGL canvas seamlessly across Standard & Theater modes */}
      <div
        className={
          theaterMode
            ? 'flex-1 min-h-0 flex overflow-hidden'
            : 'grid grid-cols-1 xl:grid-cols-12 gap-5 items-start'
        }
      >
        <div
          className={
            theaterMode
              ? 'flex-1 min-w-0 h-full flex flex-col'
              : 'xl:col-span-8 bg-[#111722] border border-[#222D3D] rounded-xl p-4 sm:p-5 space-y-5'
          }
        >
          {/* Status Strip (standard mode; Theater shows status in its top bar) */}
          {!theaterMode && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-mono text-emerald-400 font-semibold">{statusText}</span>
              <span className="font-mono tabular-nums text-slate-400">
                {t('table.heroStack')} {heroSeat.stackBb.toFixed(1)}bb · {t('table.currentBet')}{' '}
                {table.currentBetBb.toFixed(1)}bb
              </span>
            </div>
          )}

          {/* Primary 3D Table (or optional 2D Classic) */}
          <div className={theaterMode ? 'flex-1 min-h-0' : ''}>
            {viewMode === '3d' || theaterMode ? (
              <Studio3DTable
                board={table.board}
                potBb={table.potBb}
                streetLabel={translateStreetLabel(locale, table.phase)}
                seats={seats3D}
                fourColorDeck={prefs.fourColorDeck}
                onToggleFourColor={() => onUpdatePrefs({ fourColorDeck: !prefs.fourColorDeck })}
                fillParent={theaterMode}
                isTheater={theaterMode}
                onToggleTheater={theaterMode ? undefined : handleToggleTheater}
              />
            ) : (
              <PokerTableOval
                seats={displaySeats}
                board={table.board}
                potBb={table.potBb}
                streetLabel={translateStreetLabel(locale, table.phase)}
                fourColor={prefs.fourColorDeck}
              />
            )}
          </div>

          {/* Showdown Banner or Live Action Console */}
          <div
            className={
              theaterMode
                ? 'px-4 py-3 border-t border-[#1E293B] bg-[#0B1017] shrink-0'
                : 'pt-4 border-t border-[#1E293B]'
            }
          >
            {actionConsoleNode}
          </div>
        </div>

        {/* Analytics Column (Always visible in Standard Mode; Collapsible Slide Drawer in Theater Mode) */}
        {(!theaterMode || theaterHudOpen) && (
          <aside
            data-testid={theaterMode ? 'theater-hud-drawer' : 'arena-analytics-panel'}
            className={
              theaterMode
                ? 'w-[340px] lg:w-[370px] shrink-0 border-l border-[#222D3D] bg-[#0D131D] p-4 overflow-y-auto'
                : 'xl:col-span-4 bg-[#111722] border border-[#222D3D] rounded-xl p-5'
            }
          >
            {analyticsPanelNode}
          </aside>
        )}
      </div>

      {/* Arena Configuration Modal */}
      <ArenaSetupModal
        open={setupOpen}
        config={table.config}
        onClose={() => setSetupOpen(false)}
        onApply={handleApplyArenaConfig}
      />
    </div>
  );
}
