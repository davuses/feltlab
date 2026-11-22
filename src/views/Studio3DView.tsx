import { useState } from 'react';
import type { Card, UserPreferences } from '../poker/types';
import type { Seat3DSpec } from '../three/models';
import { Studio3DTable } from '../components/Studio3DTable';
import { useLocale } from '../i18n/LocaleContext';
import { translateStreetLabel } from '../i18n/translations';
import { playPokerSound } from '../utils/sound';

interface Studio3DViewProps {
  prefs: UserPreferences;
  onUpdatePrefs: (patch: Partial<UserPreferences>) => void;
}

interface Curated3DSpot {
  id: string;
  street: 'flop' | 'turn' | 'river' | 'showdown';
  potBb: number;
  board: Card[];
  seats: Seat3DSpec[];
}

const CURATED_3D_SPOTS: Curated3DSpot[] = [
  {
    id: 'btn-vs-bb-turn',
    street: 'turn',
    potBb: 24.5,
    board: [
      { rank: 'A', suit: 's' },
      { rank: '9', suit: 'd' },
      { rank: '4', suit: 's' },
      { rank: 'K', suit: 'h' },
    ],
    seats: [
      {
        seatIndex: 0,
        position: 'BTN',
        label: 'Hero',
        stackBb: 87.5,
        isHero: true,
        isDealer: true,
        isActiveTurn: true,
        folded: false,
        cards: [
          { rank: 'Q', suit: 's' },
          { rank: 'J', suit: 's' },
        ],
        revealCards: true,
      },
      { seatIndex: 1, position: 'SB', label: 'M. Vance', stackBb: 99.5, isHero: false, isDealer: false, isActiveTurn: false, folded: true },
      {
        seatIndex: 2,
        position: 'BB',
        label: 'K. Sato',
        stackBb: 88.0,
        isHero: false,
        isDealer: false,
        isActiveTurn: false,
        folded: false,
        cards: [
          { rank: 'A', suit: 'd' },
          { rank: 'T', suit: 'c' },
        ],
        revealCards: false,
      },
      { seatIndex: 3, position: 'UTG', label: 'A. Novak', stackBb: 100.0, isHero: false, isDealer: false, isActiveTurn: false, folded: true },
      { seatIndex: 4, position: 'HJ', label: 'R. Chen', stackBb: 100.0, isHero: false, isDealer: false, isActiveTurn: false, folded: true },
      { seatIndex: 5, position: 'CO', label: 'E. Lind', stackBb: 100.0, isHero: false, isDealer: false, isActiveTurn: false, folded: true },
    ],
  },
  {
    id: '3bp-river-showdown',
    street: 'showdown',
    potBb: 64.0,
    board: [
      { rank: 'J', suit: 'h' },
      { rank: '8', suit: 'h' },
      { rank: '3', suit: 'c' },
      { rank: '5', suit: 'd' },
      { rank: '2', suit: 'h' },
    ],
    seats: [
      {
        seatIndex: 0,
        position: 'CO',
        label: 'Hero',
        stackBb: 68.0,
        isHero: true,
        isDealer: false,
        isActiveTurn: true,
        folded: false,
        cards: [
          { rank: 'A', suit: 'h' },
          { rank: 'K', suit: 'd' },
        ],
        revealCards: true,
      },
      {
        seatIndex: 1,
        position: 'BTN',
        label: 'R. Chen',
        stackBb: 68.0,
        isHero: false,
        isDealer: true,
        isActiveTurn: false,
        folded: false,
        cards: [
          { rank: 'Q', suit: 'h' },
          { rank: 'T', suit: 'h' },
        ],
        revealCards: true,
      },
      { seatIndex: 2, position: 'SB', label: 'E. Lind', stackBb: 99.5, isHero: false, isDealer: false, isActiveTurn: false, folded: true },
      { seatIndex: 3, position: 'BB', label: 'M. Vance', stackBb: 99.0, isHero: false, isDealer: false, isActiveTurn: false, folded: true },
      { seatIndex: 4, position: 'UTG', label: 'K. Sato', stackBb: 100.0, isHero: false, isDealer: false, isActiveTurn: false, folded: true },
      { seatIndex: 5, position: 'HJ', label: 'A. Novak', stackBb: 100.0, isHero: false, isDealer: false, isActiveTurn: false, folded: true },
    ],
  },
  {
    id: 'utg-vs-co-flop',
    street: 'flop',
    potBb: 11.5,
    board: [
      { rank: 'K', suit: 'c' },
      { rank: '7', suit: 'd' },
      { rank: '2', suit: 's' },
    ],
    seats: [
      {
        seatIndex: 0,
        position: 'UTG',
        label: 'Hero',
        stackBb: 94.5,
        isHero: true,
        isDealer: false,
        isActiveTurn: true,
        folded: false,
        cards: [
          { rank: 'A', suit: 'c' },
          { rank: 'K', suit: 's' },
        ],
        revealCards: true,
      },
      { seatIndex: 1, position: 'HJ', label: 'A. Novak', stackBb: 100.0, isHero: false, isDealer: false, isActiveTurn: false, folded: true },
      {
        seatIndex: 2,
        position: 'CO',
        label: 'E. Lind',
        stackBb: 94.5,
        isHero: false,
        isDealer: false,
        isActiveTurn: false,
        folded: false,
        cards: [
          { rank: 'Q', suit: 'c' },
          { rank: 'J', suit: 'c' },
        ],
        revealCards: false,
      },
      { seatIndex: 3, position: 'BTN', label: 'R. Chen', stackBb: 100.0, isHero: false, isDealer: true, isActiveTurn: false, folded: true },
      { seatIndex: 4, position: 'SB', label: 'M. Vance', stackBb: 99.5, isHero: false, isDealer: false, isActiveTurn: false, folded: true },
      { seatIndex: 5, position: 'BB', label: 'K. Sato', stackBb: 99.0, isHero: false, isDealer: false, isActiveTurn: false, folded: true },
    ],
  },
];

export function Studio3DView({ prefs, onUpdatePrefs }: Studio3DViewProps) {
  const { locale, t } = useLocale();
  const [spotIdx, setSpotIdx] = useState(0);
  const spot = CURATED_3D_SPOTS[spotIdx];

  const handleDealNext = () => {
    setSpotIdx((i) => (i + 1) % CURATED_3D_SPOTS.length);
    playPokerSound('card', prefs.soundEnabled);
  };

  return (
    <div className="space-y-3 pb-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-lg sm:text-xl font-semibold text-white">{t('studio3d.title')}</h1>
        <p className="text-xs text-slate-400">{t('studio3d.subtitle')}</p>
      </div>

      <Studio3DTable
        board={spot.board}
        potBb={spot.potBb}
        streetLabel={translateStreetLabel(locale, spot.street)}
        seats={spot.seats}
        fourColorDeck={prefs.fourColorDeck}
        onToggleFourColor={() => onUpdatePrefs({ fourColorDeck: !prefs.fourColorDeck })}
        onDealSample={handleDealNext}
        fullViewport
      />
    </div>
  );
}
