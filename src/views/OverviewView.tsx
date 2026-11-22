import { useState } from 'react';
import { ArrowRight, Box, Calculator, Grid3x3, Layers, PlayCircle, SearchCheck } from 'lucide-react';
import type { DrillAttemptRecord, DrillModule, MasterySummary } from '../poker/types';
import { useLocale } from '../i18n/LocaleContext';
import type { TranslationKey } from '../i18n/translations';
import heroStudioImg from '../assets/images/hero_studio_table_1795300932030.jpg';

interface OverviewViewProps {
  summary: MasterySummary;
  attempts: DrillAttemptRecord[];
  onNavigate: (view: DrillModule | 'studio3d' | 'leaks') => void;
}

const HERO_IMAGE = heroStudioImg;

const DRILL_MODULES: {
  id: DrillModule | 'studio3d';
  index: string;
  titleKey: TranslationKey;
  metaKey: TranslationKey;
  descKey: TranslationKey;
  ctaKey: TranslationKey;
  Icon: typeof Grid3x3;
}[] = [
  {
    id: 'preflop',
    index: '01',
    titleKey: 'overview.mod.preflop.title',
    metaKey: 'overview.mod.preflop.meta',
    descKey: 'overview.mod.preflop.desc',
    ctaKey: 'overview.mod.preflop.cta',
    Icon: Grid3x3,
  },
  {
    id: 'postflop',
    index: '02',
    titleKey: 'overview.mod.postflop.title',
    metaKey: 'overview.mod.postflop.meta',
    descKey: 'overview.mod.postflop.desc',
    ctaKey: 'overview.mod.postflop.cta',
    Icon: Layers,
  },
  {
    id: 'math',
    index: '03',
    titleKey: 'overview.mod.math.title',
    metaKey: 'overview.mod.math.meta',
    descKey: 'overview.mod.math.desc',
    ctaKey: 'overview.mod.math.cta',
    Icon: Calculator,
  },
  {
    id: 'reading',
    index: '04',
    titleKey: 'overview.mod.reading.title',
    metaKey: 'overview.mod.reading.meta',
    descKey: 'overview.mod.reading.desc',
    ctaKey: 'overview.mod.reading.cta',
    Icon: SearchCheck,
  },
  {
    id: 'table',
    index: '05',
    titleKey: 'overview.mod.table.title',
    metaKey: 'overview.mod.table.meta',
    descKey: 'overview.mod.table.desc',
    ctaKey: 'overview.mod.table.cta',
    Icon: PlayCircle,
  },
  {
    id: 'studio3d',
    index: '06',
    titleKey: 'overview.mod.studio3d.title',
    metaKey: 'overview.mod.studio3d.meta',
    descKey: 'overview.mod.studio3d.desc',
    ctaKey: 'overview.mod.studio3d.cta',
    Icon: Box,
  },
];

export function OverviewView({ summary, attempts, onNavigate }: OverviewViewProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const { t } = useLocale();

  const optimalRate =
    summary.totalDecisions > 0
      ? Math.round((summary.optimalCount / summary.totalDecisions) * 100)
      : 0;
  const avgEvLoss =
    summary.totalDecisions > 0
      ? (summary.totalEvLossBb / summary.totalDecisions).toFixed(2)
      : '0.00';

  const countByModule = (mod: DrillModule | 'studio3d') =>
    mod === 'studio3d' ? null : attempts.filter((a) => a.module === mod).length;

  return (
    <div className="space-y-10 pb-12">
      {/* Hero Split Section (2-column items-stretch) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-6 flex flex-col justify-between bg-[#111722] border border-[#222D3D] rounded-xl p-7 sm:p-9">
          <div className="space-y-5">
            <p className="text-xs font-medium text-emerald-400 tracking-wide">
              {t('overview.eyebrow')}
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-semibold tracking-tight text-white leading-[1.15]">
              {t('overview.heroTitle')}
            </h1>
            <p className="text-[15px] text-slate-300 leading-relaxed max-w-[54ch]">
              {t('overview.heroDesc')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-8">
            <button
              type="button"
              onClick={() => onNavigate('preflop')}
              className="px-5 py-3 text-sm font-semibold rounded-lg bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <span>{t('overview.ctaPreflop')}</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('table')}
              className="px-5 py-3 text-sm font-medium rounded-lg bg-[#17202E] text-slate-100 border border-[#2A374C] hover:bg-[#1E2A3D] transition-colors cursor-pointer whitespace-nowrap"
            >
              {t('overview.ctaTable')}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('studio3d')}
              className="px-4 py-3 text-sm font-medium rounded-lg bg-[#111A26] text-emerald-300 border border-emerald-500/35 hover:bg-[#172535] transition-colors cursor-pointer whitespace-nowrap"
            >
              {t('overview.cta3D')}
            </button>
          </div>
        </div>

        <div className="lg:col-span-6 relative rounded-xl overflow-hidden border border-[#222D3D] bg-[#0B1612] min-h-[280px]">
          {!imgFailed ? (
            <img
              src={HERO_IMAGE}
              alt={t('overview.heroImgAlt')}
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="w-full h-full object-cover lg:h-full"
            />
          ) : (
            <div className="w-full h-full felt-surface flex items-center justify-center p-8">
              <div className="text-center space-y-2">
                <p className="text-2xl font-display font-semibold text-white">6-Max 100bb Studio</p>
                <p className="text-xs font-mono text-emerald-300">
                  RFI · 3-Bet · C-Bet · Turn Barrel · River Polarity
                </p>
              </div>
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#090D12]/90 via-[#090D12]/25 to-transparent" />
          <div className="absolute bottom-5 left-6 right-6 flex items-end justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs text-slate-300">{t('overview.curriculumLabel')}</p>
              <p className="text-base font-display font-semibold text-white">
                {t('overview.curriculumValue')}
              </p>
            </div>
            <span className="font-mono tabular-nums text-xs text-emerald-300 whitespace-nowrap shrink-0">
              {t('overview.depthBadge')}
            </span>
          </div>
        </div>
      </section>

      {/* Full-Width 4-Column Session Readiness KPI Strip */}
      <section
        aria-label="Session readiness metrics"
        className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[#222D3D] border border-[#222D3D] rounded-xl overflow-hidden"
      >
        <div className="bg-[#111722] p-5 space-y-1">
          <p className="text-xs text-slate-400">{t('overview.kpiDecisions')}</p>
          <p className="text-2xl font-mono tabular-nums font-semibold text-white">
            {summary.totalDecisions}
          </p>
          <p className="text-xs text-slate-400">{t('overview.kpiDecisionsSub')}</p>
        </div>
        <div className="bg-[#111722] p-5 space-y-1">
          <p className="text-xs text-slate-400">{t('overview.kpiOptimal')}</p>
          <p className="text-2xl font-mono tabular-nums font-semibold text-emerald-400">
            {optimalRate}%
          </p>
          <p className="text-xs text-slate-400">{t('overview.kpiOptimalSub')}</p>
        </div>
        <div className="bg-[#111722] p-5 space-y-1">
          <p className="text-xs text-slate-400">{t('overview.kpiEvLoss')}</p>
          <p className="text-2xl font-mono tabular-nums font-semibold text-amber-300">
            -{avgEvLoss} bb
          </p>
          <p className="text-xs text-slate-400">{t('overview.kpiEvLossSub')}</p>
        </div>
        <div className="bg-[#111722] p-5 space-y-1 flex flex-col justify-between">
          <div>
            <p className="text-xs text-slate-400">{t('overview.kpiStreak')}</p>
            <p className="text-2xl font-mono tabular-nums font-semibold text-white">
              {summary.currentStreak}{' '}
              <span className="text-sm text-slate-400">/ {summary.bestStreak}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('leaks')}
            className="text-left text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
          >
            {t('overview.inspectLeaks')}
          </button>
        </div>
      </section>

      {/* Core Gameplay Drills Directory (Balanced 6-card 3x2 grid) */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold text-white">{t('overview.drillsHeading')}</h2>
            <p className="text-sm text-slate-400">{t('overview.drillsSub')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {DRILL_MODULES.map((mod) => {
            const completed = countByModule(mod.id);
            const Icon = mod.Icon;
            const metaText = t(mod.metaKey);
            return (
              <div
                key={mod.id}
                className="bg-[#111722] border border-[#222D3D] rounded-xl p-6 flex flex-col justify-between gap-5 hover:border-[#32435C] transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-mono tabular-nums text-emerald-400">
                      {mod.index}. {metaText.split('·')[0].trim()}
                    </span>
                    <Icon className="w-4 h-4 text-slate-400" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">{t(mod.titleKey)}</h3>
                  <p className="text-xs text-slate-400">{metaText}</p>
                  <p className="text-sm text-slate-300 leading-relaxed">{t(mod.descKey)}</p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-[#1E293B]">
                  <span className="text-xs font-mono tabular-nums text-slate-400">
                    {completed !== null
                      ? `${completed} ${completed === 1 ? t('overview.repSingular') : t('overview.repPlural')}`
                      : 'WebGL PBR'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigate(mod.id)}
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#17202E] text-white border border-[#2B394F] hover:bg-emerald-500 hover:text-slate-950 hover:border-emerald-500 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {t(mod.ctaKey)}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
