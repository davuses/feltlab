import { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import type { DrillAttemptRecord, UserPreferences } from '../poker/types';
import {
  evaluateMathAnswer,
  generateMathQuestion,
  type MathDrillCategory,
  type MathDrillQuestion,
  type MathDrillResult,
} from '../poker/mathDrills';
import { PlayingCard } from '../components/PlayingCard';
import { GradeBadge } from '../components/GradeBadge';
import { playPokerSound } from '../utils/sound';
import { useLocale } from '../i18n/LocaleContext';
import { translateMathCategory, type TranslationKey } from '../i18n/translations';

interface MathLabViewProps {
  prefs: UserPreferences;
  onRecordAttempt: (attempt: Omit<DrillAttemptRecord, 'id' | 'timestamp'>) => void;
}

const CATEGORIES: { value: MathDrillCategory | 'ALL'; labelKey: TranslationKey }[] = [
  { value: 'ALL', labelKey: 'math.catAll' },
  { value: 'POT_ODDS', labelKey: 'math.catPotOdds' },
  { value: 'OUTS_EQUITY', labelKey: 'math.catOuts' },
  { value: 'CALL_EV', labelKey: 'math.catEv' },
  { value: 'MDF_BLUFF', labelKey: 'math.catMdf' },
];

export function MathLabView({ prefs, onRecordAttempt }: MathLabViewProps) {
  const { locale, t } = useLocale();
  const [category, setCategory] = useState<MathDrillCategory | 'ALL'>('ALL');
  const [question, setQuestion] = useState<MathDrillQuestion>(() =>
    generateMathQuestion('ALL')
  );
  const [answerInput, setAnswerInput] = useState<string>(String(question.defaultVal));
  const [result, setResult] = useState<MathDrillResult | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);

  const loadNext = (nextCat = category) => {
    const nextQ = generateMathQuestion(nextCat);
    setQuestion(nextQ);
    setAnswerInput(String(nextQ.defaultVal));
    setResult(null);
    setInputError(null);
    playPokerSound('card', prefs.soundEnabled);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (result) return;
    const trimmed = answerInput.trim();
    if (trimmed === '') {
      setInputError(t('math.errEmpty'));
      return;
    }
    const parsed = Number(trimmed);
    if (Number.isNaN(parsed) || parsed < question.minVal - 20 || parsed > question.maxVal + 20) {
      setInputError(t('math.errRange'));
      return;
    }
    setInputError(null);
    const evaluated = evaluateMathAnswer(question, parsed);
    setResult(evaluated);
    playPokerSound(
      evaluated.grade === 'Optimal' || evaluated.grade === 'Acceptable' ? 'optimal' : 'mistake',
      prefs.soundEnabled
    );
    onRecordAttempt({
      module: 'math',
      position: 'ALL',
      street: 'math',
      spotLabel: `${question.categoryLabel} (${question.potBb}bb pot / ${question.betBb}bb bet)`,
      chosenAction: `${parsed}${question.unit}`,
      bestAction: `${evaluated.exactAnswer}${question.unit}`,
      evLossBb: evaluated.evLossBb,
      grade: evaluated.grade,
      accuracyScore: evaluated.accuracyScore,
    });
  };

  const numericVal = Number.isNaN(Number(answerInput))
    ? question.defaultVal
    : Math.max(question.minVal, Math.min(question.maxVal, Number(answerInput)));

  return (
    <div className="space-y-6 pb-10">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#222D3D] pb-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold text-white">{t('math.title')}</h1>
          <p className="text-xs text-slate-400">{t('math.subtitle')}</p>
        </div>

        <div
          role="group"
          aria-label="Math drill category filter"
          className="flex flex-wrap items-center gap-1 p-1 bg-[#111722] border border-[#222D3D] rounded-lg"
        >
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => {
                setCategory(cat.value);
                loadNext(cat.value);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                category === cat.value
                  ? 'bg-[#222E40] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t(cat.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Two-Zone Sandbox */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Interactive Math Stage */}
        <div className="xl:col-span-7 bg-[#111722] border border-[#222D3D] rounded-xl p-6 sm:p-7 space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-mono text-emerald-400">
              {translateMathCategory(locale, question.categoryLabel)}
            </p>
            <p className="text-xs text-slate-400">{question.contextLine}</p>
            <h2 className="text-lg sm:text-xl font-semibold text-white leading-snug pt-1">
              {question.prompt}
            </h2>
          </div>

          {/* Visual Pot / Bet Stage or Board Cards */}
          {question.board && question.heroCards ? (
            <div className="felt-surface rounded-xl border border-emerald-400/20 p-5 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <span className="text-xs text-emerald-200/80 font-mono">{t('math.heroHand')}</span>
                  <div className="flex items-center gap-2">
                    <PlayingCard card={question.heroCards[0]} fourColor={prefs.fourColorDeck} size="md" />
                    <PlayingCard card={question.heroCards[1]} fourColor={prefs.fourColorDeck} size="md" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs text-amber-200/80 font-mono">{t('math.communityBoard')}</span>
                  <div className="flex items-center gap-2">
                    {question.board.map((c, idx) => (
                      <PlayingCard
                        key={`${c.rank}${c.suit}-${idx}`}
                        card={c}
                        fourColor={prefs.fourColorDeck}
                        size="md"
                      />
                    ))}
                  </div>
                </div>

                {question.villainCards && (
                  <div className="space-y-1.5">
                    <span className="text-xs text-sky-200/80 font-mono">{t('math.villainHolding')}</span>
                    <div className="flex items-center gap-2">
                      <PlayingCard
                        card={question.villainCards[0]}
                        fourColor={prefs.fourColorDeck}
                        size="md"
                      />
                      <PlayingCard
                        card={question.villainCards[1]}
                        fourColor={prefs.fourColorDeck}
                        size="md"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-px bg-[#222D3D] border border-[#222D3D] rounded-lg overflow-hidden">
              <div className="bg-[#0B1017] p-4">
                <span className="text-xs text-slate-400 block">{t('math.startingPot')}</span>
                <span className="text-xl font-mono tabular-nums font-semibold text-white">
                  {question.potBb} bb
                </span>
              </div>
              <div className="bg-[#0B1017] p-4">
                <span className="text-xs text-slate-400 block">{t('math.betSize')}</span>
                <span className="text-xl font-mono tabular-nums font-semibold text-amber-300">
                  {question.betBb} bb
                </span>
              </div>
              <div className="bg-[#0B1017] p-4">
                <span className="text-xs text-slate-400 block">{t('math.betPotRatio')}</span>
                <span className="text-xl font-mono tabular-nums font-semibold text-emerald-400">
                  {Math.round((question.betBb / Math.max(0.1, question.potBb)) * 100)}%
                </span>
              </div>
            </div>
          )}

          {/* Answer Form */}
          <form onSubmit={handleSubmit} className="space-y-5 pt-2 border-t border-[#1F2A3A]">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="math-slider" className="font-medium text-slate-200">
                  {t('math.yourEstimate')} ({question.unit})
                </label>
                <span className="font-mono tabular-nums text-base font-semibold text-emerald-300">
                  {answerInput || '0'} {question.unit}
                </span>
              </div>

              <input
                id="math-slider"
                type="range"
                min={question.minVal}
                max={question.maxVal}
                step={question.step}
                value={numericVal}
                disabled={Boolean(result)}
                onChange={(e) => {
                  setAnswerInput(e.target.value);
                  setInputError(null);
                }}
                className="w-full accent-emerald-500 cursor-pointer disabled:opacity-50"
              />

              <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500">
                <span>
                  {question.minVal}
                  {question.unit}
                </span>
                <span>
                  {Math.round((question.minVal + question.maxVal) / 2)}
                  {question.unit}
                </span>
                <span>
                  {question.maxVal}
                  {question.unit}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[160px] space-y-1">
                <label htmlFor="math-numeric-input" className="text-xs text-slate-400 block">
                  {t('math.exactInput')} ({question.unit})
                </label>
                <input
                  id="math-numeric-input"
                  type="number"
                  step="any"
                  disabled={Boolean(result)}
                  value={answerInput}
                  onChange={(e) => {
                    setAnswerInput(e.target.value);
                    setInputError(null);
                  }}
                  className="w-full min-h-[44px] bg-[#0B1017] border border-[#2B394F] rounded-lg px-3.5 py-2 text-sm font-mono tabular-nums text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                />
              </div>

              {!result ? (
                <button
                  type="submit"
                  className="min-h-[44px] px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-sm font-semibold text-slate-950 inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Check className="w-4 h-4" aria-hidden="true" />
                  <span>{t('math.checkAnswer')}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => loadNext()}
                  className="min-h-[44px] px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-sm font-semibold text-slate-950 inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span>{t('math.nextProblem')}</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>

            {inputError && (
              <p role="alert" className="text-xs text-rose-400">
                {inputError}
              </p>
            )}
          </form>
        </div>

        {/* Right Formula & Solution Deck */}
        <div className="xl:col-span-5 bg-[#111722] border border-[#222D3D] rounded-xl p-5 sm:p-6 space-y-5">
          {!result ? (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-white">{t('math.quickFormulas')}</h2>
              <div className="space-y-3 text-xs font-mono bg-[#0B1017] border border-[#1E293B] rounded-lg p-4 text-slate-300">
                <div>
                  <span className="text-emerald-400 block font-sans font-semibold mb-0.5">
                    {t('math.potOddsTitle')}
                  </span>
                  Call / (PotBeforeCall + Call)
                </div>
                <div className="border-t border-[#1E293B] pt-2.5">
                  <span className="text-sky-400 block font-sans font-semibold mb-0.5">
                    {t('math.callEvTitle')}
                  </span>
                  EV = (Equity × PotWon) − ((1 − Equity) × Call)
                </div>
                <div className="border-t border-[#1E293B] pt-2.5">
                  <span className="text-amber-300 block font-sans font-semibold mb-0.5">
                    {t('math.mdfTitle')}
                  </span>
                  MDF = Pot / (Pot + Bet) · α = Bet / (Pot + Bet)
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-200">
                  {t('math.benchmarksTitle')}
                </h3>
                <table className="w-full text-xs font-mono tabular-nums">
                  <thead>
                    <tr className="text-slate-400 border-b border-[#1E293B]">
                      <th className="text-left py-1.5 font-normal">{t('math.colBetSize')}</th>
                      <th className="text-right py-1.5 font-normal">{t('math.colReqEq')}</th>
                      <th className="text-right py-1.5 font-normal">{t('math.colMdf')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1A2332] text-slate-300">
                    <tr>
                      <td className="py-1.5">33% {t('common.pot')}</td>
                      <td className="text-right">20.0%</td>
                      <td className="text-right">75.0%</td>
                    </tr>
                    <tr>
                      <td className="py-1.5">50% {t('common.pot')}</td>
                      <td className="text-right">25.0%</td>
                      <td className="text-right">66.7%</td>
                    </tr>
                    <tr>
                      <td className="py-1.5">75% {t('common.pot')}</td>
                      <td className="text-right">30.0%</td>
                      <td className="text-right">57.1%</td>
                    </tr>
                    <tr>
                      <td className="py-1.5">100% {t('common.pot')}</td>
                      <td className="text-right">33.3%</td>
                      <td className="text-right">50.0%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-white">{t('math.verificationTitle')}</h2>
                <GradeBadge grade={result.grade} evLossBb={result.evLossBb} size="sm" />
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs font-mono tabular-nums">
                <div className="bg-[#0B1017] border border-[#1E293B] rounded-lg p-3">
                  <span className="text-slate-400 block font-sans">{t('math.yourAnswer')}</span>
                  <span className="text-base font-semibold text-white">
                    {result.userAnswer}
                    {question.unit}
                  </span>
                </div>
                <div className="bg-[#0B1017] border border-[#1E293B] rounded-lg p-3">
                  <span className="text-slate-400 block font-sans">{t('math.exactAnswer')}</span>
                  <span className="text-base font-semibold text-emerald-400">
                    {result.exactAnswer}
                    {question.unit}
                  </span>
                </div>
                <div className="bg-[#0B1017] border border-[#1E293B] rounded-lg p-3">
                  <span className="text-slate-400 block font-sans">{t('math.errorDelta')}</span>
                  <span className="text-base font-semibold text-amber-300">
                    ±{result.delta}
                    {question.unit}
                  </span>
                </div>
              </div>

              {/* Equity vs Break-Even Visual Bar */}
              {typeof question.breakEvenPct === 'number' && (
                <div className="space-y-2 border-t border-[#1F2A3A] pt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">{t('math.thresholdGauge')}</span>
                    <span className="font-mono tabular-nums text-slate-400">
                      {t('math.threshold')} {question.breakEvenPct}%
                      {typeof question.heroEquityPct === 'number'
                        ? ` · ${t('math.equity')} ${question.heroEquityPct}%`
                        : ''}
                    </span>
                  </div>
                  <div className="relative h-3 w-full rounded-full bg-[#192334] overflow-hidden">
                    {typeof question.heroEquityPct === 'number' ? (
                      <div
                        className={`h-full rounded-full ${
                          question.heroEquityPct >= question.breakEvenPct
                            ? 'bg-emerald-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, question.heroEquityPct)}%` }}
                      />
                    ) : (
                      <div
                        className="h-full rounded-full bg-sky-400"
                        style={{ width: `${Math.min(100, question.breakEvenPct)}%` }}
                      />
                    )}
                    <div
                      aria-hidden="true"
                      className="absolute top-0 bottom-0 w-0.5 bg-amber-300"
                      style={{ left: `${Math.min(98, question.breakEvenPct)}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2 border-t border-[#1F2A3A] pt-4">
                <h3 className="text-xs font-semibold text-slate-200">{t('math.stepByStep')}</h3>
                <ol className="space-y-1.5 text-xs font-mono text-slate-300">
                  {question.formulaSteps.map((step, idx) => (
                    <li
                      key={idx}
                      className="bg-[#0B1017] border border-[#1E293B] rounded-md px-3 py-2"
                    >
                      {step}
                    </li>
                  ))}
                </ol>
              </div>

              <div className="bg-[#0C1814] border border-emerald-500/25 rounded-lg p-3 text-xs text-slate-200 leading-relaxed">
                {question.takeaway}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
