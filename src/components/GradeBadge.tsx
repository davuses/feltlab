import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { DecisionGrade } from '../poker/types';
import { useLocale } from '../i18n/LocaleContext';
import { translateGrade } from '../i18n/translations';

interface GradeBadgeProps {
  grade: DecisionGrade;
  evLossBb?: number;
  size?: 'sm' | 'md';
}

export function GradeBadge({ grade, evLossBb, size = 'md' }: GradeBadgeProps) {
  const { locale } = useLocale();
  const config: Record<
    DecisionGrade,
    { text: string; Icon: typeof CheckCircle2 }
  > = {
    Optimal: {
      text: 'text-emerald-400',
      Icon: CheckCircle2,
    },
    Acceptable: {
      text: 'text-sky-400',
      Icon: CheckCircle2,
    },
    Inaccuracy: {
      text: 'text-amber-400',
      Icon: Info,
    },
    Mistake: {
      text: 'text-orange-400',
      Icon: AlertTriangle,
    },
    Blunder: {
      text: 'text-rose-400',
      Icon: XCircle,
    },
  };

  const { text, Icon } = config[grade];
  const iconClass = size === 'sm' ? 'w-3.5 h-3.5 shrink-0' : 'w-4 h-4 shrink-0';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium whitespace-nowrap ${text} ${
        size === 'sm' ? 'text-xs' : 'text-sm'
      }`}
    >
      <Icon className={iconClass} aria-hidden="true" />
      <span>{translateGrade(locale, grade)}</span>
      {typeof evLossBb === 'number' && (
        <span className="font-mono tabular-nums text-slate-400 ml-1">
          {evLossBb === 0 ? '0.00 bb' : `-${evLossBb.toFixed(2)} bb`}
        </span>
      )}
    </span>
  );
}
