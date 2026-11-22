import { useEffect, useState } from 'react';
import { Bot, EyeOff, SlidersHorizontal, X, Zap } from 'lucide-react';
import {
  ALL_BOT_ARCHETYPES,
  buildPresetConfig,
  POSITIONS_BY_SIZE,
  resizeConfigArchetypes,
  type ArenaConfig,
  type ArenaSize,
  type BotArchetype,
  type HeroPositionLock,
  type PoolPresetId,
} from '../poker/tableEngine';
import { useLocale } from '../i18n/LocaleContext';
import { translateArchetype, type TranslationKey } from '../i18n/translations';

interface ArenaSetupModalProps {
  open: boolean;
  config: ArenaConfig;
  onClose: () => void;
  onApply: (next: ArenaConfig) => void;
}

const PRESET_LIST: Exclude<PoolPresetId, 'custom'>[] = [
  'mixed',
  'microstakes',
  'reg_wars',
  'lag_chaos',
  'heads_up',
];

const TABLE_SIZES: ArenaSize[] = [2, 3, 4, 6];
const STACK_OPTIONS: (50 | 100 | 200)[] = [50, 100, 200];

export function ArenaSetupModal({ open, config, onClose, onApply }: ArenaSetupModalProps) {
  const { locale, t } = useLocale();
  const [draft, setDraft] = useState<ArenaConfig>(config);

  useEffect(() => {
    if (open) {
      setDraft({
        ...config,
        botArchetypes: [...config.botArchetypes],
      });
    }
  }, [open, config]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const availableLocks: HeroPositionLock[] = ['ROTATE', 'BTN', 'BB', 'CO'].filter(
    (loc): loc is HeroPositionLock =>
      loc === 'ROTATE' || POSITIONS_BY_SIZE[draft.tableSize].includes(loc as 'BTN' | 'BB' | 'CO')
  );

  const handleSelectSize = (size: ArenaSize) => {
    const nextArchetypes = resizeConfigArchetypes(draft.botArchetypes, size);
    const validLock: HeroPositionLock =
      draft.heroPositionLock !== 'ROTATE' &&
      POSITIONS_BY_SIZE[size].includes(draft.heroPositionLock)
        ? draft.heroPositionLock
        : 'ROTATE';
    setDraft({
      ...draft,
      tableSize: size,
      poolPreset: 'custom',
      botArchetypes: nextArchetypes,
      heroPositionLock: validLock,
    });
  };

  const handleSelectPreset = (preset: Exclude<PoolPresetId, 'custom'>) => {
    setDraft(buildPresetConfig(preset, draft));
  };

  const handleChangeSeatArchetype = (botIdx: number, arch: BotArchetype) => {
    const next = [...draft.botArchetypes];
    next[botIdx] = arch;
    setDraft({
      ...draft,
      poolPreset: 'custom',
      botArchetypes: next,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="arena-setup-title"
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-[#0F1520] border border-[#263449] rounded-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[#1E2A3C] bg-[#0B1018]">
          <div className="flex items-start gap-2.5">
            <SlidersHorizontal className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <h2 id="arena-setup-title" className="text-base font-semibold text-white">
                {t('arena.modalTitle')}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">{t('arena.modalSubtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('arena.cancel')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1A2434] cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Config Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Pool Presets */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
              {t('arena.poolPreset')}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {PRESET_LIST.map((preset) => {
                const active = draft.poolPreset === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    data-testid={`preset-${preset}`}
                    onClick={() => handleSelectPreset(preset)}
                    className={`px-2.5 py-2 text-xs font-medium rounded-lg border text-center transition-colors cursor-pointer ${
                      active
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 font-semibold'
                        : 'bg-[#131B28] border-[#243247] text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {t(`arena.preset.${preset}` as TranslationKey)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table Size & Starting Stack */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                {t('arena.tableSize')}
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {TABLE_SIZES.map((sz) => {
                  const active = draft.tableSize === sz;
                  return (
                    <button
                      key={sz}
                      type="button"
                      data-testid={`table-size-${sz}`}
                      onClick={() => handleSelectSize(sz)}
                      className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                        active
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-semibold'
                          : 'bg-[#131B28] border-[#243247] text-slate-300 hover:text-white'
                      }`}
                    >
                      {t(`arena.size${sz}` as TranslationKey)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                  {t('arena.startingStack')}
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {STACK_OPTIONS.map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setDraft({ ...draft, startingStackBb: st })}
                      className={`px-2.5 py-2 text-xs font-mono tabular-nums rounded-lg border transition-colors cursor-pointer ${
                        draft.startingStackBb === st
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 font-semibold'
                          : 'bg-[#131B28] border-[#243247] text-slate-300 hover:text-white'
                      }`}
                    >
                      {st}bb
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="arena-hero-pos"
                    className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide"
                  >
                    {t('arena.heroPos')}
                  </label>
                  <select
                    id="arena-hero-pos"
                    value={draft.heroPositionLock}
                    onChange={(e) =>
                      setDraft({ ...draft, heroPositionLock: e.target.value as HeroPositionLock })
                    }
                    className="w-full bg-[#131B28] border border-[#243247] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 cursor-pointer"
                  >
                    {availableLocks.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc === 'ROTATE'
                          ? t('arena.posRotate')
                          : `${t('arena.posLockPrefix')} ${loc}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="arena-bot-speed"
                    className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide"
                  >
                    {t('arena.botSpeed')}
                  </label>
                  <select
                    id="arena-bot-speed"
                    value={draft.speed}
                    onChange={(e) =>
                      setDraft({ ...draft, speed: e.target.value as 'normal' | 'fast' })
                    }
                    className="w-full bg-[#131B28] border border-[#243247] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 cursor-pointer"
                  >
                    <option value="normal">{t('arena.speedNormal')}</option>
                    <option value="fast">{t('arena.speedFast')}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Per-Seat Custom Bot Roster */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide inline-flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                {t('arena.customRoster')}
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                {draft.botArchetypes.length} bots
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {draft.botArchetypes.map((arch, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-3 bg-[#131B28] border border-[#222F44] rounded-lg px-3 py-2"
                >
                  <label
                    htmlFor={`bot-seat-select-${idx}`}
                    className="text-xs font-mono text-slate-300 shrink-0"
                  >
                    {t('arena.seatLabel')} {idx + 2}
                  </label>
                  <select
                    id={`bot-seat-select-${idx}`}
                    value={arch}
                    onChange={(e) =>
                      handleChangeSeatArchetype(idx, e.target.value as BotArchetype)
                    }
                    className="bg-[#0B1018] border border-[#2A3950] rounded-md px-2.5 py-1 text-xs text-emerald-300 cursor-pointer max-w-[190px]"
                  >
                    {ALL_BOT_ARCHETYPES.map((opt) => (
                      <option key={opt} value={opt}>
                        {translateArchetype(locale, opt)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Deliberate Practice Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => setDraft({ ...draft, blindReadMode: !draft.blindReadMode })}
              className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                draft.blindReadMode
                  ? 'bg-amber-500/10 border-amber-400/50'
                  : 'bg-[#131B28] border-[#243247] hover:border-slate-500'
              }`}
            >
              <EyeOff
                className={`w-4 h-4 mt-0.5 shrink-0 ${
                  draft.blindReadMode ? 'text-amber-300' : 'text-slate-400'
                }`}
                aria-hidden="true"
              />
              <div>
                <p className="text-xs font-semibold text-white">{t('arena.blindRead')}</p>
                <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                  {t('arena.blindReadDesc')}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setDraft({ ...draft, fastFold: !draft.fastFold })}
              className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                draft.fastFold
                  ? 'bg-emerald-500/10 border-emerald-400/50'
                  : 'bg-[#131B28] border-[#243247] hover:border-slate-500'
              }`}
            >
              <Zap
                className={`w-4 h-4 mt-0.5 shrink-0 ${
                  draft.fastFold ? 'text-emerald-300' : 'text-slate-400'
                }`}
                aria-hidden="true"
              />
              <div>
                <p className="text-xs font-semibold text-white">{t('arena.fastFold')}</p>
                <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                  {t('arena.fastFoldDesc')}
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-[#1E2A3C] bg-[#0B1018]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-[#161F2E] hover:bg-[#222F44] border border-[#2B394F] text-slate-300 cursor-pointer"
          >
            {t('arena.cancel')}
          </button>
          <button
            type="button"
            data-testid="apply-arena-config"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
            className="px-5 py-2 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer"
          >
            {t('arena.applyDeal')}
          </button>
        </div>
      </div>
    </div>
  );
}
