import { useMemo, useState } from 'react';
import { Cloud, LogOut, Trash2 } from 'lucide-react';
import type { User } from 'firebase/auth';
import type {
  DrillAttemptRecord,
  DrillModule,
  MasterySummary,
  Position,
} from '../poker/types';
import { GradeBadge } from '../components/GradeBadge';
import { useLocale } from '../i18n/LocaleContext';
import { translateActionText, translateModuleLabel } from '../i18n/translations';
import { localizeSpotLabel } from '../i18n/drillContentZh';

interface LeakTrackerViewProps {
  user: User | null;
  syncing: boolean;
  syncError: string | null;
  summary: MasterySummary;
  attempts: DrillAttemptRecord[];
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onResetProgress: () => Promise<void>;
  onNavigateDrill: (mod: DrillModule) => void;
}

const POSITIONS: Position[] = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

export function LeakTrackerView({
  user,
  syncing,
  syncError,
  summary,
  attempts,
  onSignIn,
  onSignOut,
  onResetProgress,
  onNavigateDrill,
}: LeakTrackerViewProps) {
  const { locale, t } = useLocale();
  const [gradeFilter, setGradeFilter] = useState<'all' | 'leaks'>('all');
  const [moduleFilter, setModuleFilter] = useState<DrillModule | 'all'>('all');
  const [confirmReset, setConfirmReset] = useState(false);

  const optimalRate =
    summary.totalDecisions > 0
      ? Math.round((summary.optimalCount / summary.totalDecisions) * 100)
      : 0;
  const evLossPer100 =
    summary.totalDecisions > 0
      ? ((summary.totalEvLossBb / summary.totalDecisions) * 100).toFixed(1)
      : '0.0';

  const moduleBreakdown = useMemo(() => {
    const mods: DrillModule[] = ['preflop', 'postflop', 'math', 'reading', 'table'];
    return mods.map((m) => {
      const rows = attempts.filter((a) => a.module === m);
      const count = rows.length;
      const good = rows.filter((r) => r.grade === 'Optimal' || r.grade === 'Acceptable').length;
      const evLoss = rows.reduce((acc, r) => acc + r.evLossBb, 0);
      return {
        module: m,
        label: translateModuleLabel(locale, m),
        count,
        accuracyPct: count > 0 ? Math.round((good / count) * 100) : null,
        avgEvLoss: count > 0 ? (evLoss / count).toFixed(2) : null,
      };
    });
  }, [attempts, locale]);

  const positionBreakdown = useMemo(() => {
    return POSITIONS.map((pos) => {
      const rows = attempts.filter((a) => a.position === pos);
      const count = rows.length;
      const good = rows.filter((r) => r.grade === 'Optimal' || r.grade === 'Acceptable').length;
      const evLoss = rows.reduce((acc, r) => acc + r.evLossBb, 0);
      return {
        pos,
        count,
        accuracyPct: count > 0 ? Math.round((good / count) * 100) : null,
        avgEvLoss: count > 0 ? (evLoss / count).toFixed(2) : null,
      };
    });
  }, [attempts]);

  const filteredAttempts = useMemo(() => {
    return attempts.filter((a) => {
      if (moduleFilter !== 'all' && a.module !== moduleFilter) return false;
      if (
        gradeFilter === 'leaks' &&
        (a.grade === 'Optimal' || a.grade === 'Acceptable')
      ) {
        return false;
      }
      return true;
    });
  }, [attempts, gradeFilter, moduleFilter]);

  return (
    <div className="space-y-8 pb-12">
      {/* Header & Cloud Sync Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#222D3D] pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-white">{t('leaks.title')}</h1>
          <p className="text-xs text-slate-400">{t('leaks.subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3 bg-[#111722] border border-[#222D3D] rounded-lg px-3.5 py-2">
              <Cloud className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
              <div className="text-xs">
                <p className="font-medium text-white">
                  {user.displayName || t('leaks.signedIn')}
                </p>
                <p className="text-slate-400">
                  {syncing ? t('leaks.syncing') : t('leaks.syncActive')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void onSignOut()}
                className="ml-2 px-2.5 py-1.5 text-xs font-medium rounded-md bg-[#192334] hover:bg-[#233148] text-slate-200 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t('leaks.signOut')}</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void onSignIn()}
              className="min-h-[40px] px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Cloud className="w-4 h-4" aria-hidden="true" />
              <span>{t('leaks.signIn')}</span>
            </button>
          )}

          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              disabled={summary.totalDecisions === 0}
              className="min-h-[40px] px-3.5 py-2 text-xs font-medium rounded-lg bg-[#111722] border border-[#222D3D] text-slate-300 hover:text-rose-300 hover:border-rose-500/40 disabled:opacity-40 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t('leaks.resetStats')}</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-[#1B1318] border border-rose-500/40 rounded-lg px-3 py-1.5 text-xs">
              <span className="text-rose-200">{t('leaks.confirmClear')}</span>
              <button
                type="button"
                onClick={async () => {
                  await onResetProgress();
                  setConfirmReset(false);
                }}
                className="px-2.5 py-1 rounded bg-rose-500 text-white font-semibold hover:bg-rose-400 cursor-pointer"
              >
                {t('common.confirm')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-2 py-1 rounded text-slate-300 hover:text-white cursor-pointer"
              >
                {t('common.cancel')}
              </button>
            </div>
          )}
        </div>
      </div>

      {syncError && (
        <div
          role="status"
          className="text-xs text-amber-200 bg-[#1B1810] border border-amber-500/35 rounded-lg px-4 py-3"
        >
          {syncError}
        </div>
      )}

      {/* Headline Metrics */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[#222D3D] border border-[#222D3D] rounded-xl overflow-hidden">
        <div className="bg-[#111722] p-5 space-y-1">
          <span className="text-xs text-slate-400 block">{t('leaks.totalDecisions')}</span>
          <span className="text-2xl font-mono tabular-nums font-semibold text-white">
            {summary.totalDecisions}
          </span>
        </div>
        <div className="bg-[#111722] p-5 space-y-1">
          <span className="text-xs text-slate-400 block">{t('leaks.optAcceptable')}</span>
          <span className="text-2xl font-mono tabular-nums font-semibold text-emerald-400">
            {optimalRate}%
          </span>
        </div>
        <div className="bg-[#111722] p-5 space-y-1">
          <span className="text-xs text-slate-400 block">{t('leaks.cumEvLoss')}</span>
          <span className="text-2xl font-mono tabular-nums font-semibold text-amber-300">
            -{summary.totalEvLossBb.toFixed(2)} bb
          </span>
        </div>
        <div className="bg-[#111722] p-5 space-y-1">
          <span className="text-xs text-slate-400 block">{t('leaks.leakRate')}</span>
          <span className="text-2xl font-mono tabular-nums font-semibold text-rose-400">
            -{evLossPer100} bb
          </span>
        </div>
      </section>

      {/* Module + Positional Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-6 bg-[#111722] border border-[#222D3D] rounded-xl p-5 sm:p-6 space-y-4">
          <h2 className="text-base font-semibold text-white">{t('leaks.byModule')}</h2>
          <div className="divide-y divide-[#1E293B]">
            {moduleBreakdown.map((row) => (
              <div
                key={row.module}
                className="py-3 flex items-center justify-between gap-4 text-sm"
              >
                <div>
                  <button
                    type="button"
                    onClick={() => onNavigateDrill(row.module)}
                    className="font-medium text-slate-100 hover:text-emerald-400 transition-colors cursor-pointer"
                  >
                    {row.label}
                  </button>
                  <p className="text-xs font-mono tabular-nums text-slate-400">
                    {row.count} {row.count === 1 ? t('leaks.spotSingular') : t('leaks.spotPlural')}
                  </p>
                </div>
                <div className="text-right font-mono tabular-nums text-xs">
                  {row.accuracyPct !== null ? (
                    <>
                      <span className="text-emerald-400 font-semibold block">
                        {row.accuracyPct}% {t('leaks.accurate')}
                      </span>
                      <span className="text-slate-400">
                        -{row.avgEvLoss} {t('leaks.bbPerSpot')}
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-500">{t('leaks.notDrilled')}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="lg:col-span-6 bg-[#111722] border border-[#222D3D] rounded-xl p-5 sm:p-6 space-y-4">
          <h2 className="text-base font-semibold text-white">{t('leaks.heatmapTitle')}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {positionBreakdown.map((seat) => {
              const tone =
                seat.accuracyPct === null
                  ? 'border-[#222D3D] bg-[#0B1017]'
                  : seat.accuracyPct >= 75
                    ? 'border-emerald-500/40 bg-[#0D1E18]'
                    : seat.accuracyPct >= 50
                      ? 'border-amber-400/40 bg-[#1B1910]'
                      : 'border-rose-500/40 bg-[#1D1216]';
              return (
                <div key={seat.pos} className={`rounded-lg border p-3.5 space-y-1 ${tone}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sm text-white">{seat.pos}</span>
                    <span className="text-[11px] font-mono tabular-nums text-slate-400">
                      {seat.count} {seat.count === 1 ? t('leaks.spotSingular') : t('leaks.spotPlural')}
                    </span>
                  </div>
                  <p className="font-mono tabular-nums text-lg font-semibold text-slate-100">
                    {seat.accuracyPct !== null ? `${seat.accuracyPct}%` : '—'}
                  </p>
                  <p className="text-[11px] font-mono tabular-nums text-slate-400">
                    {seat.avgEvLoss !== null
                      ? `-${seat.avgEvLoss} ${t('leaks.bbAvg')}`
                      : t('leaks.noData')}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Filterable Decision Log */}
      <section className="bg-[#111722] border border-[#222D3D] rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-white">{t('leaks.recentTitle')}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Filter decisions by grade"
              className="flex items-center gap-1 p-1 bg-[#0B1017] border border-[#222D3D] rounded-lg"
            >
              <button
                type="button"
                onClick={() => setGradeFilter('all')}
                className={`px-3 py-1 text-xs font-medium rounded cursor-pointer whitespace-nowrap ${
                  gradeFilter === 'all' ? 'bg-[#222E40] text-white' : 'text-slate-400'
                }`}
              >
                {t('leaks.filterAll')} ({attempts.length})
              </button>
              <button
                type="button"
                onClick={() => setGradeFilter('leaks')}
                className={`px-3 py-1 text-xs font-medium rounded cursor-pointer whitespace-nowrap ${
                  gradeFilter === 'leaks' ? 'bg-[#222E40] text-white' : 'text-slate-400'
                }`}
              >
                {t('leaks.filterLeaks')}
              </button>
            </div>

            <select
              aria-label="Filter decision log by module"
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value as DrillModule | 'all')}
              className="bg-[#0B1017] border border-[#222D3D] rounded-lg px-3 py-1.5 text-xs text-slate-200 cursor-pointer"
            >
              <option value="all">{t('leaks.allDrills')}</option>
              <option value="preflop">{t('nav.preflop')}</option>
              <option value="postflop">{t('nav.postflop')}</option>
              <option value="math">{t('nav.math')}</option>
              <option value="reading">{t('nav.reading')}</option>
              <option value="table">{t('nav.table')}</option>
            </select>
          </div>
        </div>

        {filteredAttempts.length === 0 ? (
          <div className="text-center py-10 space-y-3 border border-dashed border-[#263245] rounded-lg">
            <p className="text-sm font-medium text-slate-200">
              {attempts.length === 0 ? t('leaks.emptyNone') : t('leaks.emptyFilter')}
            </p>
            <p className="text-xs text-slate-400">{t('leaks.emptyHint')}</p>
            {attempts.length === 0 && (
              <button
                type="button"
                onClick={() => onNavigateDrill('preflop')}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer"
              >
                {t('leaks.startFirst')}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[#222D3D] text-slate-400">
                  <th className="py-2.5 pr-4 font-medium">{t('leaks.colSpot')}</th>
                  <th className="py-2.5 px-3 font-medium">{t('leaks.colModule')}</th>
                  <th className="py-2.5 px-3 font-medium">{t('leaks.colSeat')}</th>
                  <th className="py-2.5 px-3 font-medium">{t('leaks.colYourPlay')}</th>
                  <th className="py-2.5 px-3 font-medium">{t('leaks.colBestPlay')}</th>
                  <th className="py-2.5 pl-3 font-medium text-right">{t('leaks.colGrade')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A2332]">
                {filteredAttempts.slice(0, 40).map((att) => (
                  <tr key={att.id} className="hover:bg-[#151D2B]/60 transition-colors">
                    <td className="py-3 pr-4 font-medium text-slate-200 max-w-[240px] truncate">
                      {localizeSpotLabel(locale, att.spotLabel)}
                    </td>
                    <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                      {translateModuleLabel(locale, att.module)}
                    </td>
                    <td className="py-3 px-3 font-mono text-emerald-400 whitespace-nowrap">
                      {att.position}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300 whitespace-nowrap">
                      {translateActionText(locale, att.chosenAction)}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-400 whitespace-nowrap">
                      {translateActionText(locale, att.bestAction)}
                    </td>
                    <td className="py-3 pl-3 text-right whitespace-nowrap">
                      <GradeBadge grade={att.grade} evLossBb={att.evLossBb} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
