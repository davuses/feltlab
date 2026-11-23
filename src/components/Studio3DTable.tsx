import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Palette,
  RefreshCw,
  Sun,
  Volume2,
  VolumeX,
  Wine,
} from 'lucide-react';
import type { Card } from '../poker/types';
import {
  PokerScene3D,
  type CameraPresetId,
  type LightingPresetId,
} from '../three/PokerScene3D';
import type { Seat3DSpec } from '../three/models';
import type { FeltThemeId } from '../three/textures';
import { useLocale } from '../i18n/LocaleContext';

interface Studio3DTableProps {
  board: Card[];
  potBb: number;
  streetLabel: string;
  seats: Seat3DSpec[];
  fourColorDeck: boolean;
  onToggleFourColor?: () => void;
  onDealSample?: () => void;
  fullViewport?: boolean;
  fillParent?: boolean;
  isTheater?: boolean;
  onToggleTheater?: () => void;
}

export function Studio3DTable({
  board,
  potBb,
  streetLabel,
  seats,
  fourColorDeck,
  onToggleFourColor,
  onDealSample,
  fullViewport = false,
  fillParent = false,
  isTheater = false,
  onToggleTheater,
}: Studio3DTableProps) {
  const { t } = useLocale();
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<PokerScene3D | null>(null);

  const [cameraPreset, setCameraPreset] = useState<CameraPresetId>('hero');
  const [feltTheme, setFeltTheme] = useState<FeltThemeId>('emerald');
  const [lighting, setLighting] = useState<LightingPresetId>('studio');
  const [showProps, setShowProps] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [dockVisible, setDockVisible] = useState(true);
  const [webglError, setWebglError] = useState<string | null>(null);

  // Mount Three.js controller once
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    try {
      const controller = new PokerScene3D(el, {
        board,
        potBb,
        seats,
        fourColorDeck,
        feltTheme,
        lighting,
        showProps,
        soundEnabled,
      });
      sceneRef.current = controller;
      setWebglError(null);
    } catch (err) {
      setWebglError(err instanceof Error ? err.message : 'Unable to initialize WebGL 3D scene.');
    }

    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
    // Intentionally mount/dispose once per component lifecycle; updates flow through updateSceneData below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push live hand / theme / lighting / props / audio updates cleanly
  useEffect(() => {
    sceneRef.current?.updateSceneData({
      board,
      potBb,
      seats,
      fourColorDeck,
      feltTheme,
      lighting,
      showProps,
      soundEnabled,
    });
  }, [board, potBb, seats, fourColorDeck, feltTheme, lighting, showProps, soundEnabled]);

  // Keyboard shortcuts: 1-5 camera presets, H toggle dock, P toggle ambient props, M toggle SFX
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '1') {
        setCameraPreset('hero');
        sceneRef.current?.setCameraPreset('hero');
      } else if (e.key === '2') {
        setCameraPreset('broadcast');
        sceneRef.current?.setCameraPreset('broadcast');
      } else if (e.key === '3') {
        setCameraPreset('topdown');
        sceneRef.current?.setCameraPreset('topdown');
      } else if (e.key === '4') {
        setCameraPreset('closeup');
        sceneRef.current?.setCameraPreset('closeup');
      } else if (e.key === '5') {
        setCameraPreset('rail');
        sceneRef.current?.setCameraPreset('rail');
      } else if (e.key.toLowerCase() === 'h') {
        setDockVisible((v) => !v);
      } else if (e.key.toLowerCase() === 'p') {
        setShowProps((v) => !v);
      } else if (e.key.toLowerCase() === 'm') {
        setSoundEnabled((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSelectCamera = (preset: CameraPresetId) => {
    setCameraPreset(preset);
    sceneRef.current?.setCameraPreset(preset);
  };

  const containerHeightClass = fillParent
    ? 'h-full min-h-[420px]'
    : fullViewport
      ? 'h-[calc(100vh-116px)] min-h-[520px]'
      : 'h-[430px] sm:h-[480px]';

  const frameClass = fillParent
    ? 'relative w-full h-full bg-[#090D14] select-none overflow-hidden'
    : `relative w-full ${containerHeightClass} rounded-xl overflow-hidden border border-[#222D3D] bg-[#090D14] select-none`;

  return (
    <div className={frameClass}>
      {/* Full-bleed Three.js WebGL Canvas Mount */}
      <div
        ref={mountRef}
        data-testid="threejs-poker-canvas"
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {webglError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#090D14] p-6 text-center">
          <div className="max-w-md space-y-2">
            <p className="text-sm font-semibold text-rose-400">3D WebGL Unavailable</p>
            <p className="text-xs text-slate-400">{webglError}</p>
          </div>
        </div>
      )}

      {/* Minimal Top-Left Pot & Street Telemetry (solid opaque backing, NO backdrop-filter over WebGL) */}
      <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-2.5 bg-[#0B1017]/92 border border-[#243144] rounded-lg px-3 py-1.5 text-xs font-mono tabular-nums">
        <span className="text-emerald-400 font-semibold">{streetLabel}</span>
        <span className="text-slate-600">·</span>
        <span className="text-amber-300 font-semibold">
          {t('studio3d.potLabel')} {potBb.toFixed(1)} bb
        </span>
      </div>

      {/* Top-Right Compact Theater + Hide/Show Dock Toggles */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        {onToggleTheater && (
          <button
            type="button"
            data-testid="studio3d-theater-toggle"
            onClick={onToggleTheater}
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-[#0B1017]/92 border border-[#243144] text-emerald-300 hover:text-white hover:border-emerald-500/60 inline-flex items-center gap-1.5 cursor-pointer"
          >
            {isTheater ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{t('studio3d.exitTheater')}</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{t('studio3d.theater')}</span>
              </>
            )}
          </button>
        )}
        <button
          type="button"
          onClick={() => setDockVisible((v) => !v)}
          className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-[#0B1017]/92 border border-[#243144] text-slate-200 hover:text-white hover:border-emerald-500/50 inline-flex items-center gap-1.5 cursor-pointer"
        >
          {dockVisible ? (
            <>
              <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{t('studio3d.hideDock')}</span>
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{t('studio3d.showDock')}</span>
            </>
          )}
        </button>
      </div>

      {/* Viewport-First Collapsible Bottom Dock (compact <= 14% viewport height, NO backdrop-filter) */}
      {dockVisible && (
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2.5 bg-[#0B1017]/94 border border-[#243144] rounded-xl px-3.5 py-2.5">
          {/* Camera Angle Selector */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-slate-400 inline-flex items-center gap-1 mr-1">
              <Camera className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              <span className="hidden md:inline">{t('studio3d.cameraLabel')}</span>
            </span>
            {(
              [
                { id: 'hero', label: t('studio3d.camHero') },
                { id: 'broadcast', label: t('studio3d.camBroadcast') },
                { id: 'topdown', label: t('studio3d.camTopDown') },
                { id: 'closeup', label: t('studio3d.camCloseUp') },
                { id: 'rail', label: t('studio3d.camRail') },
              ] as const
            ).map((cam) => (
              <button
                key={cam.id}
                type="button"
                onClick={() => handleSelectCamera(cam.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  cameraPreset === cam.id
                    ? 'bg-emerald-500 text-slate-950 font-semibold'
                    : 'bg-[#151E2C] text-slate-300 hover:text-white border border-[#253349]'
                }`}
              >
                {cam.label}
              </button>
            ))}
          </div>

          {/* Right Controls: Felt Finish, Studio Light, Props, SFX, Deck & Deal Runout */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label={t('studio3d.feltLabel')}
              value={feltTheme}
              onChange={(e) => setFeltTheme(e.target.value as FeltThemeId)}
              className="bg-[#151E2C] border border-[#253349] rounded-md px-2.5 py-1 text-xs text-slate-200 cursor-pointer"
            >
              <option value="emerald">{t('studio3d.feltEmerald')}</option>
              <option value="navy">{t('studio3d.feltNavy')}</option>
              <option value="crimson">{t('studio3d.feltCrimson')}</option>
            </select>

            <div className="inline-flex items-center gap-1">
              <Sun className="w-3.5 h-3.5 text-amber-300 hidden sm:inline" aria-hidden="true" />
              <select
                aria-label={t('studio3d.lightingLabel')}
                value={lighting}
                onChange={(e) => setLighting(e.target.value as LightingPresetId)}
                className="bg-[#151E2C] border border-[#253349] rounded-md px-2.5 py-1 text-xs text-slate-200 cursor-pointer"
              >
                <option value="studio">{t('studio3d.lightStudio')}</option>
                <option value="daylight">{t('studio3d.lightDaylight')}</option>
                <option value="lounge">{t('studio3d.lightLounge')}</option>
              </select>
            </div>

            <button
              type="button"
              data-testid="toggle-table-props"
              aria-pressed={showProps}
              onClick={() => setShowProps((v) => !v)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md border inline-flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                showProps
                  ? 'bg-amber-500/15 border-amber-400/45 text-amber-200'
                  : 'bg-[#151E2C] border-[#253349] text-slate-400 hover:text-slate-200'
              }`}
            >
              <Wine className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{showProps ? t('studio3d.propsOn') : t('studio3d.propsOff')}</span>
            </button>

            <button
              type="button"
              data-testid="toggle-table-sfx"
              aria-pressed={soundEnabled}
              onClick={() => setSoundEnabled((v) => !v)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md border inline-flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                soundEnabled
                  ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                  : 'bg-[#151E2C] border-[#253349] text-slate-400 hover:text-slate-200'
              }`}
            >
              {soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <VolumeX className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>{soundEnabled ? t('studio3d.soundOn') : t('studio3d.soundOff')}</span>
            </button>

            {onToggleFourColor && (
              <button
                type="button"
                onClick={onToggleFourColor}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border inline-flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                  fourColorDeck
                    ? 'bg-[#162736] border-sky-500/40 text-sky-300'
                    : 'bg-[#151E2C] border-[#253349] text-slate-300'
                }`}
              >
                <Palette className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{fourColorDeck ? t('common.fourColorShort') : t('common.twoColorShort')}</span>
              </button>
            )}

            {onDealSample && (
              <button
                type="button"
                onClick={onDealSample}
                className="px-3 py-1 text-xs font-semibold rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t('studio3d.dealNew')}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
