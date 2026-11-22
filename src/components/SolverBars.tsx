import type { SolverActionFreq } from '../poker/types';
import { useLocale } from '../i18n/LocaleContext';
import { translateActionText } from '../i18n/translations';

interface SolverBarsProps {
  actions: SolverActionFreq[];
  chosenLabel?: string;
}

function barColor(kind: SolverActionFreq['kind']): string {
  switch (kind) {
    case 'raise':
    case 'bet':
      return 'bg-emerald-500';
    case 'call':
      return 'bg-sky-400';
    case 'check':
      return 'bg-amber-400';
    case 'fold':
      return 'bg-slate-600';
  }
}

export function SolverBars({ actions, chosenLabel }: SolverBarsProps) {
  const { locale, t } = useLocale();
  const sorted = [...actions].sort((a, b) => b.frequency - a.frequency || b.evBb - a.evBb);

  return (
    <div className="space-y-3">
      {sorted.map((item) => {
        const isChosen = chosenLabel === item.label;
        return (
          <div key={item.action} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span
                className={`font-medium truncate ${
                  isChosen ? 'text-white' : 'text-slate-300'
                }`}
              >
                {translateActionText(locale, item.label)}
                {isChosen && (
                  <span className="ml-2 text-[11px] font-mono text-amber-300">
                    {t('common.yourPlay')}
                  </span>
                )}
              </span>
              <div className="flex items-center gap-3 font-mono tabular-nums shrink-0">
                <span className="text-slate-400">
                  EV {item.evBb >= 0 ? '+' : ''}
                  {item.evBb.toFixed(2)}bb
                </span>
                <span className="text-white font-semibold w-10 text-right">
                  {item.frequency}%
                </span>
              </div>
            </div>
            <div className="h-2 w-full rounded-full bg-[#192334] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-200 ${barColor(
                  item.kind
                )}`}
                style={{ width: `${Math.max(item.frequency, item.frequency > 0 ? 3 : 0)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
