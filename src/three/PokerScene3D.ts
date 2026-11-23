import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Card } from '../poker/types';
import {
  createAmbientPropsGroup,
  createCasinoChairsGroup,
  createCasinoSalonBackdropGroup,
  createChandelierDustMotes,
  createChipStacksGroup,
  createDealerPuckGroup,
  createPlayingCardGroup,
  createPokerTableGroup,
  createSeatPlaqueMesh,
  createTurnHaloMesh,
  DEALER_DECK_POS,
  FELT_Y,
  getAnchorsForSeatCount,
  type ChipStackSpec,
  type PokerTableAssembly,
  type Seat3DSpec,
} from './models';
import { CasinoSoundEngine } from './soundEngine';
import {
  createCardBackTexture,
  createChipSideTexture,
  createChipTopTexture,
  createContactShadowTexture,
  createStudioFloorTexture,
  type FeltThemeId,
} from './textures';

export type CameraPresetId = 'hero' | 'broadcast' | 'topdown' | 'closeup' | 'rail';
export type LightingPresetId = 'studio' | 'daylight' | 'lounge';

export interface Scene3DHandData {
  board: Card[];
  potBb: number;
  seats: Seat3DSpec[];
  fourColorDeck: boolean;
  feltTheme: FeltThemeId;
  lighting: LightingPresetId;
  showProps?: boolean;
  soundEnabled?: boolean;
}

interface ActiveTween {
  obj: THREE.Object3D;
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  curveOffset: THREE.Vector3;
  arcHeight: number;
  bounceHeight: number;
  fromRot: THREE.Euler;
  toRot: THREE.Euler;
  flipCard?: boolean;
  delay: number;
  elapsed: number;
  duration: number;
  disposeOnEnd?: boolean;
  initialHidden?: boolean;
}

interface HeroCardPeekTarget {
  group: THREE.Group;
  basePos: THREE.Vector3;
  baseRot: THREE.Euler;
  peekAmount: number;
  sideOffset: number;
}

const CAMERA_PRESETS: Record<
  CameraPresetId,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  hero: { pos: [0, 3.02, 4.92], target: [0, FELT_Y + 0.05, 0.14] },
  broadcast: { pos: [3.95, 3.85, 4.45], target: [0, FELT_Y, 0] },
  topdown: { pos: [0, 6.25, 0.95], target: [0, FELT_Y, 0] },
  closeup: { pos: [0.45, 2.02, 2.24], target: [0, FELT_Y + 0.04, -0.06] },
  rail: { pos: [-2.42, 1.84, 3.42], target: [0.12, FELT_Y + 0.12, -0.06] },
};

// Carefully balanced studio lighting so matte cards read richly with zero over-exposure
const LIGHTING_PRESETS: Record<
  LightingPresetId,
  {
    bg: number;
    fogDensity: number;
    keyColor: number;
    keyIntensity: number;
    spotColor: number;
    spotIntensity: number;
    hemiSky: number;
    hemiGround: number;
    hemiIntensity: number;
    rimColor: number;
    rimIntensity: number;
    exposure: number;
  }
> = {
  studio: {
    bg: 0x09070a,
    fogDensity: 0.052,
    keyColor: 0xffe4bd,
    keyIntensity: 1.08,
    spotColor: 0xffd596,
    spotIntensity: 14,
    hemiSky: 0x7aa2d4,
    hemiGround: 0x1e130c,
    hemiIntensity: 0.44,
    rimColor: 0xd99b43,
    rimIntensity: 0.62,
    exposure: 0.92,
  },
  daylight: {
    bg: 0x10151f,
    fogDensity: 0.034,
    keyColor: 0xfff8ee,
    keyIntensity: 1.48,
    spotColor: 0xfff4e0,
    spotIntensity: 11,
    hemiSky: 0xcbe3ff,
    hemiGround: 0x26211d,
    hemiIntensity: 0.72,
    rimColor: 0x93c5fd,
    rimIntensity: 0.44,
    exposure: 0.96,
  },
  lounge: {
    bg: 0x050406,
    fogDensity: 0.068,
    keyColor: 0xffc985,
    keyIntensity: 0.82,
    spotColor: 0xffbe6b,
    spotIntensity: 17,
    hemiSky: 0x45587a,
    hemiGround: 0x1a0c09,
    hemiIntensity: 0.32,
    rimColor: 0xf59e0b,
    rimIntensity: 0.74,
    exposure: 0.9,
  },
};

// Reusable scratch objects outside animation loop (zero per-frame GC)
const _raycaster = new THREE.Raycaster();
const _pointerNdc = new THREE.Vector2();
const _tmpVec = new THREE.Vector3();

function detectSoftwareWebGL(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const rendererStr = String(gl.getParameter(param) ?? '');
    return /SwiftShader|llvmpipe|softpipe|Software|Microsoft Basic|Basic Render/i.test(rendererStr);
  } catch {
    return false;
  }
}

function disposeObject3D(obj: THREE.Object3D) {
  obj.traverse((child) => {
    const renderable = child as THREE.Mesh | THREE.Points;
    if ((renderable as THREE.Mesh).isMesh || (renderable as THREE.Points).isPoints) {
      renderable.geometry?.dispose();
      const mats = Array.isArray(renderable.material)
        ? renderable.material
        : [renderable.material];
      for (const m of mats) {
        if (!m) continue;
        const std = m as THREE.MeshStandardMaterial;
        std.map?.dispose();
        std.bumpMap?.dispose();
        std.roughnessMap?.dispose();
        m.dispose();
      }
    }
  });
}

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class PokerScene3D {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private isSoftwareGl: boolean;
  private pmrem: THREE.PMREMGenerator;
  private envRenderTarget: THREE.WebGLRenderTarget;
  private soundEngine = new CasinoSoundEngine();

  private keyLight: THREE.DirectionalLight;
  private casinoSpotLight: THREE.SpotLight;
  private hemiLight: THREE.HemisphereLight;
  private rimLight: THREE.DirectionalLight;

  private tableAssembly: PokerTableAssembly;
  private chandelierGroup: THREE.Object3D | null = null;
  private ambientPropsGroup: THREE.Group;
  private dustMotes: THREE.Points;
  private dynamicGroup: THREE.Group;
  private fxGroup: THREE.Group;
  private contactShadowTex: THREE.CanvasTexture;
  private cardBackTex: THREE.CanvasTexture;
  private floorTex: THREE.CanvasTexture;
  private chipSideTex: THREE.CanvasTexture;
  private chipTopTex: THREE.CanvasTexture;

  private currentFeltTheme: FeltThemeId;
  private resizeObserver: ResizeObserver;
  private rafId: number | null = null;
  private timeoutId: number | null = null;
  private lastTickMs = 0;
  private elapsedSec = 0;
  private dirty = true;
  private disposed = false;

  // Animation, active felt halos & state-delta trackers
  private activeTweens: ActiveTween[] = [];
  private activeHaloMats: THREE.ShaderMaterial[] = [];
  private heroCardTargets: HeroCardPeekTarget[] = [];
  private hoveredHeroCardIdx = -1;
  private lastRaycastMs = 0;

  private prevBoardKeys: string[] = [];
  private prevHeroCardsSig = '';
  private prevStreetBets = new Map<number, { bet: number; x: number; z: number }>();
  private prevPotBb = 0;
  private prevHadWinner = false;
  private initializedHandOnce = false;

  // Smooth exponential-damped camera transition targets
  private camAnimActive = false;
  private camTargetPos = new THREE.Vector3();
  private camTargetLook = new THREE.Vector3();

  constructor(container: HTMLElement, initialData: Scene3DHandData) {
    this.container = container;
    this.currentFeltTheme = initialData.feltTheme;
    this.soundEngine.enabled = initialData.soundEnabled ?? true;

    // Detect software WebGL cleanly and release probe context immediately
    const probeCanvas = document.createElement('canvas');
    const probeGl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    this.isSoftwareGl = probeGl ? detectSoftwareWebGL(probeGl) : false;
    probeGl?.getExtension('WEBGL_lose_context')?.loseContext();

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 260);

    // Lightweight single-pass renderer capped at 1.5x DPR with on-demand shadow maps (low GPU footprint!)
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'default',
      alpha: false,
      preserveDrawingBuffer: false,
    });
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.5)
    );
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;

    const canvas = this.renderer.domElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    container.appendChild(canvas);

    this.scene = new THREE.Scene();

    // Studio IBL via RoomEnvironment (zero external HDR network URLs)
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envRenderTarget = this.pmrem.fromScene(roomEnv, 0.04);
    this.scene.environment = this.envRenderTarget.texture;
    roomEnv.dispose();

    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 45);
    const startPreset = CAMERA_PRESETS.hero;
    this.camera.position.set(...startPreset.pos);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(...startPreset.target);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.085;
    this.controls.enablePan = false;
    this.controls.minDistance = 2.0;
    this.controls.maxDistance = 9.5;
    this.controls.minPolarAngle = 0.14;
    this.controls.maxPolarAngle = Math.PI * 0.455;
    this.controls.addEventListener('start', () => {
      // Cancel scripted preset glide immediately so camera never fights manual user orbit
      this.camAnimActive = false;
    });
    this.controls.addEventListener('change', () => {
      this.requestRender();
    });
    this.controls.update();

    // Balanced Casino Chandelier Rig (no expensive RectAreaLight or multi-pass bloom overhead)
    this.hemiLight = new THREE.HemisphereLight(0x7aa2d4, 0x1e130c, 0.44);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xffe4bd, 1.08);
    this.keyLight.position.set(2.4, 7.2, 3.2);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 1;
    this.keyLight.shadow.camera.far = 16;
    this.keyLight.shadow.camera.left = -4.6;
    this.keyLight.shadow.camera.right = 4.6;
    this.keyLight.shadow.camera.top = 3.6;
    this.keyLight.shadow.camera.bottom = -3.6;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    // Focused overhead casino chandelier spotlight creating a warm velvet pool across the felt
    this.casinoSpotLight = new THREE.SpotLight(0xffd596, 14, 16, Math.PI * 0.36, 0.92, 1.5);
    this.casinoSpotLight.position.set(0, 4.85, 0.22);
    this.casinoSpotLight.target.position.set(0, FELT_Y, 0);
    this.scene.add(this.casinoSpotLight);
    this.scene.add(this.casinoSpotLight.target);

    this.rimLight = new THREE.DirectionalLight(0xd99b43, 0.62);
    this.rimLight.position.set(-4.2, 3.4, -3.8);
    this.scene.add(this.rimLight);

    // Shared procedural textures
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.contactShadowTex = createContactShadowTexture();
    this.cardBackTex = createCardBackTexture();
    this.floorTex = createStudioFloorTexture(maxAniso);
    this.chipSideTex = createChipSideTexture();
    this.chipTopTex = createChipTopTexture();

    // Luxury Axminster casino salon carpet floor
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.floorTex,
      roughness: 0.94,
      metalness: 0.02,
      envMapIntensity: 0.14,
    });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(42, 56), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Grand Monte-Carlo Salon Privé architecture + Art-Deco chandelier + volumetric light cone
    const salonBackdrop = createCasinoSalonBackdropGroup(maxAniso);
    this.chandelierGroup = salonBackdrop.getObjectByName('ArtDecoSalonChandelier') ?? null;
    this.scene.add(salonBackdrop);

    // 5 Sculpted Executive Espresso-Leather Poker Chairs framing opponent seats
    const chairsGroup = createCasinoChairsGroup(this.contactShadowTex, !this.isSoftwareGl);
    this.scene.add(chairsGroup);

    // Composite Bellagio/Monte-Carlo casino poker table (with contrast piping & warm LED cove)
    this.tableAssembly = createPokerTableGroup(
      initialData.feltTheme,
      this.contactShadowTex,
      maxAniso,
      !this.isSoftwareGl
    );
    this.scene.add(this.tableAssembly.group);

    // Toggleable high-roller lounge props (crystal tumbler + gold protector + cigar rest)
    this.ambientPropsGroup = createAmbientPropsGroup(this.contactShadowTex, this.isSoftwareGl);
    this.ambientPropsGroup.visible = initialData.showProps ?? true;
    this.scene.add(this.ambientPropsGroup);

    // Warm golden dust motes suspended in the chandelier spotlight beam
    this.dustMotes = createChandelierDustMotes();
    this.scene.add(this.dustMotes);

    // Dynamic hand layer (rounded beveled cards, instanced chips, felt turn halos, dealer button, plaques)
    this.dynamicGroup = new THREE.Group();
    this.dynamicGroup.name = 'DynamicHandLayer';
    this.scene.add(this.dynamicGroup);

    // Transient animation FX layer (individual staggered tossed bet chips & pot-sweep streams)
    this.fxGroup = new THREE.Group();
    this.fxGroup.name = 'AnimationFxLayer';
    this.scene.add(this.fxGroup);

    this.applyLighting(initialData.lighting);
    this.rebuildHandLayer(initialData);

    // Pre-compile shaders & render initial shadow map once so first deal has zero micro-stutter
    if (!this.isSoftwareGl) {
      this.renderer.shadowMap.needsUpdate = true;
      this.renderer.compile(this.scene, this.camera);
    }

    // Pointer listeners for Hero hole-card hover peek & WebGL context loss safety
    canvas.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointerleave', this.handlePointerLeave);
    canvas.addEventListener('webglcontextlost', this.handleContextLost, false);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored, false);

    // ResizeObserver for crisp layout transitions (standard <-> Theater / Fullscreen)
    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });
    this.resizeObserver.observe(container);

    this.requestRender();
  }

  private handlePointerMove = (e: PointerEvent) => {
    if (this.disposed || this.heroCardTargets.length === 0) return;
    const now = performance.now();
    if (now - this.lastRaycastMs < 40) return;
    this.lastRaycastMs = now;

    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    _pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    _raycaster.setFromCamera(_pointerNdc, this.camera);
    let hitIdx = -1;
    for (let i = 0; i < this.heroCardTargets.length; i++) {
      const hits = _raycaster.intersectObject(this.heroCardTargets[i].group, true);
      if (hits.length > 0) {
        hitIdx = i;
        break;
      }
    }

    if (hitIdx !== this.hoveredHeroCardIdx) {
      this.hoveredHeroCardIdx = hitIdx;
      this.renderer.domElement.style.cursor = hitIdx >= 0 ? 'pointer' : '';
      if (hitIdx >= 0) {
        this.soundEngine.playCardPeek();
      }
      this.requestRender();
    }
  };

  private handlePointerLeave = () => {
    if (this.hoveredHeroCardIdx !== -1) {
      this.hoveredHeroCardIdx = -1;
      this.renderer.domElement.style.cursor = '';
      this.requestRender();
    }
  };

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.cancelScheduledFrame();
  };

  private handleContextRestored = () => {
    this.renderer.shadowMap.needsUpdate = true;
    this.requestRender();
  };

  private cancelScheduledFrame() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.timeoutId !== null) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  private handleResize() {
    if (this.disposed) return;
    const width = Math.max(this.container.clientWidth, 280);
    const height = Math.max(this.container.clientHeight, 220);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.requestRender();
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEngine.enabled = enabled;
  }

  public applyLighting(preset: LightingPresetId) {
    const cfg = LIGHTING_PRESETS[preset];
    this.scene.background = new THREE.Color(cfg.bg);
    this.scene.fog = new THREE.FogExp2(cfg.bg, cfg.fogDensity);
    this.keyLight.color.setHex(cfg.keyColor);
    this.keyLight.intensity = cfg.keyIntensity;
    this.casinoSpotLight.color.setHex(cfg.spotColor);
    this.casinoSpotLight.intensity = cfg.spotIntensity;
    this.hemiLight.color.setHex(cfg.hemiSky);
    this.hemiLight.groundColor.setHex(cfg.hemiGround);
    this.hemiLight.intensity = cfg.hemiIntensity;
    this.rimLight.color.setHex(cfg.rimColor);
    this.rimLight.intensity = cfg.rimIntensity;
    this.renderer.toneMappingExposure = cfg.exposure;
    this.requestRender();
  }

  public setCameraPreset(preset: CameraPresetId) {
    const cfg = CAMERA_PRESETS[preset];
    if (this.isSoftwareGl) {
      this.camera.position.set(...cfg.pos);
      this.controls.target.set(...cfg.target);
      this.controls.update();
      this.camAnimActive = false;
      this.requestRender();
      return;
    }
    this.camTargetPos.set(...cfg.pos);
    this.camTargetLook.set(...cfg.target);
    this.camAnimActive = true;
    this.requestRender();
  }

  public updateSceneData(data: Scene3DHandData) {
    if (this.disposed) return;
    if (typeof data.soundEnabled === 'boolean') {
      this.soundEngine.enabled = data.soundEnabled;
    }
    if (data.feltTheme !== this.currentFeltTheme) {
      this.currentFeltTheme = data.feltTheme;
      this.tableAssembly.updateFeltTheme(
        data.feltTheme,
        this.renderer.capabilities.getMaxAnisotropy()
      );
    }
    this.ambientPropsGroup.visible = data.showProps ?? true;
    this.applyLighting(data.lighting);
    this.rebuildHandLayer(data);
    this.renderer.shadowMap.needsUpdate = true;
    this.requestRender();
  }

  /**
   * Spawns individually staggered clay poker chips with natural curved toss arcs,
   * playful mid-air tumble, and a crisp damped felt landing bounce.
   */
  private spawnFlyingChips(
    fromPos: THREE.Vector3,
    toPos: THREE.Vector3,
    colorHex: number,
    chipCount: number,
    arcHeight: number,
    duration: number,
    baseDelay = 0
  ) {
    const chipRadius = 0.095;
    const chipHeight = 0.023;
    const count = Math.max(1, Math.min(5, chipCount));

    // Direction perpendicular to toss vector for organic staggered lateral spread
    const dx = toPos.x - fromPos.x;
    const dz = toPos.z - fromPos.z;
    const len = Math.max(0.001, Math.hypot(dx, dz));
    const perpX = -dz / len;
    const perpZ = dx / len;

    for (let c = 0; c < count; c++) {
      const singleChip = new THREE.Group();
      const bodyGeo = new THREE.CylinderGeometry(chipRadius, chipRadius, chipHeight, 16, 1, true);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        map: this.chipSideTex,
        roughness: 0.56,
        metalness: 0.06,
        envMapIntensity: 0.24,
      });
      const capGeo = new THREE.CylinderGeometry(chipRadius * 0.99, chipRadius * 0.99, 0.004, 16);
      const capColor = new THREE.Color(colorHex).lerp(new THREE.Color(0xffffff), 0.2);
      const capMat = new THREE.MeshStandardMaterial({
        color: capColor,
        map: this.chipTopTex,
        roughness: 0.54,
        metalness: 0.06,
        envMapIntensity: 0.22,
      });

      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = chipHeight / 2;
      singleChip.add(body);
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.y = chipHeight + 0.001;
      singleChip.add(cap);

      const spread = (c - (count - 1) / 2) * 0.14;
      const start = fromPos.clone().add(new THREE.Vector3(perpX * spread * 0.25, c * 0.015, perpZ * spread * 0.25));
      const end = toPos.clone().add(new THREE.Vector3(perpX * spread * 0.45, c * chipHeight, perpZ * spread * 0.45));
      const curveOffset = new THREE.Vector3(perpX * spread * 1.15, 0, perpZ * spread * 1.15);

      singleChip.position.copy(start);
      singleChip.visible = false;
      this.fxGroup.add(singleChip);

      this.activeTweens.push({
        obj: singleChip,
        fromPos: start,
        toPos: end,
        curveOffset,
        arcHeight: arcHeight + (c % 2) * 0.05,
        bounceHeight: 0.055,
        fromRot: new THREE.Euler(0.45 * (c % 2 === 0 ? 1 : -1), c * 0.7, -0.35),
        toRot: new THREE.Euler(0, Math.PI * (0.8 + c * 0.35), 0),
        delay: baseDelay + c * (this.isSoftwareGl ? 0.02 : 0.048),
        elapsed: 0,
        duration: duration + c * 0.02,
        disposeOnEnd: true,
        initialHidden: true,
      });
    }
  }

  private disposeSingleFxObj(obj: THREE.Object3D) {
    this.fxGroup.remove(obj);
    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.geometry?.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          if (!m) continue;
          m.dispose();
        }
      }
    });
  }

  private rebuildHandLayer(data: Scene3DHandData) {
    // Drop non-FX card tweens belonging to the previous dynamic layer (keep flying chip FX running!)
    this.activeTweens = this.activeTweens.filter((tw) => tw.disposeOnEnd);
    this.activeHaloMats = [];
    this.heroCardTargets = [];
    this.hoveredHeroCardIdx = -1;

    // Cleanly dispose previous dynamic meshes & per-card textures (preserve shared textures)
    while (this.dynamicGroup.children.length > 0) {
      const child = this.dynamicGroup.children[0];
      this.dynamicGroup.remove(child);
      child.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry?.dispose();
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of mats) {
            if (!m) continue;
            const std = m as THREE.MeshStandardMaterial;
            if (std.map && std.map !== this.cardBackTex && std.map !== this.contactShadowTex) {
              std.map.dispose();
            }
            m.dispose();
          }
        }
      });
    }

    const deckOrigin = new THREE.Vector3(
      DEALER_DECK_POS[0],
      DEALER_DECK_POS[1] + 0.045,
      DEALER_DECK_POS[2]
    );
    const nextBoardKeys = data.board.map((c) => `${c.rank}${c.suit}`);
    const isFreshBoard =
      this.initializedHandOnce &&
      (nextBoardKeys.length < this.prevBoardKeys.length ||
        nextBoardKeys.some((k, idx) => idx < this.prevBoardKeys.length && k !== this.prevBoardKeys[idx]));

    const heroSeat = data.seats.find((s) => s.isHero);
    const nextHeroCardsSig = heroSeat?.cards
      ? `${heroSeat.cards[0].rank}${heroSeat.cards[0].suit}-${heroSeat.cards[1].rank}${heroSeat.cards[1].suit}`
      : '';
    const isNewHoleDeal =
      this.initializedHandOnce && nextHeroCardsSig !== '' && nextHeroCardsSig !== this.prevHeroCardsSig;

    // On real GPUs, animate the very first hand deal smoothly so the studio comes alive on open
    const animateInitialEntrance = !this.initializedHandOnce && !this.isSoftwareGl;

    // 1. Community Board Cards — face-down flight from dealer stub with crisp mid-air 180° flip & settle bounce!
    const boardCount = data.board.length;
    const cardSpacing = 0.44;
    const startX = -((Math.max(boardCount, 1) - 1) * cardSpacing) / 2;
    let boardAnimOrder = 0;
    const newlyDealtCount = data.board.filter(
      (_, i) => animateInitialEntrance || (this.initializedHandOnce && (isFreshBoard || i >= this.prevBoardKeys.length))
    ).length;
    const isSingleStreetPeel = newlyDealtCount === 1 && boardCount >= 4;

    for (let i = 0; i < boardCount; i++) {
      const cardGrp = createPlayingCardGroup(
        data.board[i],
        true,
        data.fourColorDeck,
        this.cardBackTex,
        this.contactShadowTex,
        1.05
      );
      const targetPos = new THREE.Vector3(startX + i * cardSpacing, FELT_Y + 0.002, -0.08);
      const targetRot = new THREE.Euler(0, (i - (boardCount - 1) / 2) * 0.018, 0);
      cardGrp.position.copy(targetPos);
      cardGrp.rotation.copy(targetRot);
      this.dynamicGroup.add(cardGrp);

      const isNewlyDealt =
        animateInitialEntrance ||
        (this.initializedHandOnce && (isFreshBoard || i >= this.prevBoardKeys.length));
      if (isNewlyDealt) {
        const baseBoardDelay = animateInitialEntrance ? 0.28 : isNewHoleDeal ? 0.34 : 0.02;
        const delay = baseBoardDelay + boardAnimOrder * (this.isSoftwareGl ? 0.025 : 0.095);
        const startRot = new THREE.Euler(-0.14, 0.56 + Math.PI * 0.25, Math.PI);
        cardGrp.position.copy(deckOrigin);
        cardGrp.rotation.copy(startRot);
        cardGrp.visible = false;

        this.activeTweens.push({
          obj: cardGrp,
          fromPos: deckOrigin.clone(),
          toPos: targetPos,
          curveOffset: new THREE.Vector3(0.14, 0, -0.22),
          arcHeight: isSingleStreetPeel ? 0.31 : 0.21,
          bounceHeight: 0.022,
          fromRot: startRot,
          toRot: targetRot,
          flipCard: true,
          delay,
          elapsed: 0,
          duration: this.isSoftwareGl ? 0.22 : isSingleStreetPeel ? 0.48 : 0.38,
          initialHidden: true,
        });
        if (!animateInitialEntrance) {
          this.soundEngine.playCardSlide(delay);
        }
        boardAnimOrder++;
      }
    }

    // 2. Center Pot Clay Chip Stacks ($25 emerald, $100 charcoal, $500 purple, $1000 gold)
    const chipSpecs: ChipStackSpec[] = [];
    const potChipsTotal = Math.max(4, Math.min(28, Math.round(data.potBb * 0.7)));
    const stackColors = [0x0d7a55, 0x1d2432, 0xd97706, 0x6d28d9];
    const potStackCount = Math.min(4, Math.max(2, Math.ceil(potChipsTotal / 7)));
    for (let p = 0; p < potStackCount; p++) {
      const chipsInStack = Math.max(2, Math.min(9, Math.round(potChipsTotal / potStackCount) + (p % 2)));
      const angle = (p / potStackCount) * Math.PI * 2 + 0.4;
      chipSpecs.push({
        x: Math.cos(angle) * 0.28,
        z: -0.64 + Math.sin(angle) * 0.15,
        chips: chipsInStack,
        colorHex: stackColors[p % stackColors.length],
      });
    }

    // 3. Seats: Round-Robin Hole Cards, Active/Winner Felt Halos, Stacks, Staggered Bet Tosses & Plaques
    const activeSeatsCount = Math.min(6, data.seats.length);
    const anchors = getAnchorsForSeatCount(activeSeatsCount);
    const nextStreetBets = new Map<number, { bet: number; x: number; z: number }>();
    let totalCurrentStreetBets = 0;
    let winnerPos: THREE.Vector3 | null = null;
    let hasWinnerNow = false;
    let tossedChipsCount = 0;

    for (let i = 0; i < activeSeatsCount; i++) {
      const seat = data.seats[i];
      const anchor = anchors[i];
      const inwardScale = 0.65;
      const isTopCenter = Math.abs(anchor.x) < 0.1 && anchor.z < 0;
      const chipBaseX = anchor.x * inwardScale + (seat.isHero ? -0.68 : isTopCenter ? 0.56 : 0);
      const chipBaseZ = anchor.z * inwardScale + (seat.isHero ? -0.06 : 0);

      if (seat.isWinner) {
        hasWinnerNow = true;
        winnerPos = new THREE.Vector3(chipBaseX, FELT_Y + 0.04, chipBaseZ);
      }

      // Seat plaque mounted flush atop the padded leather bolster crown
      const plaque = createSeatPlaqueMesh(seat);
      plaque.position.set(anchor.x * 1.1, FELT_Y + 0.212, anchor.z * 1.1);
      plaque.lookAt(0, FELT_Y + 0.212, 0);
      if (seat.isHero) {
        plaque.position.set(1.42, FELT_Y + 0.212, 2.02);
        plaque.rotation.set(0, -0.34, 0);
      }
      this.dynamicGroup.add(plaque);

      // Subtle glowing felt aura ring beneath active-turn seat (emerald) or showdown winner (gold)
      if (!seat.folded && (seat.isWinner || seat.isActiveTurn)) {
        const haloColor = seat.isWinner ? 0xfbbf24 : 0x34d399;
        const haloRadius = seat.isHero ? 0.72 : 0.58;
        const haloMesh = createTurnHaloMesh(haloColor, haloRadius);
        const hx = seat.isHero ? 0 : anchor.x * 0.72;
        const hz = seat.isHero ? 1.24 : anchor.z * 0.72;
        haloMesh.position.set(hx, FELT_Y + 0.004, hz);
        this.dynamicGroup.add(haloMesh);
        this.activeHaloMats.push(haloMesh.material as THREE.ShaderMaterial);
      }

      // Player chip stacks on felt near seat
      if (seat.stackBb > 0) {
        const stackA = Math.max(2, Math.min(10, Math.round(seat.stackBb / 12)));
        const stackB = Math.max(1, Math.min(8, Math.round(seat.stackBb / 18)));

        chipSpecs.push({
          x: chipBaseX,
          z: chipBaseZ,
          chips: stackA,
          colorHex: seat.isHero ? 0x0d7a55 : 0x1d2432,
        });
        chipSpecs.push({
          x: chipBaseX + 0.22,
          z: chipBaseZ + 0.08,
          chips: stackB,
          colorHex: seat.isHero ? 0xd97706 : 0x991b1b,
        });
      }

      // Forward street-bet chips pushed toward center betting line whenever seat has bet this street
      const betX = anchor.x * 0.45 + (seat.isHero ? 0.52 : 0);
      const betZ = anchor.z * 0.42 + (seat.isHero ? -0.05 : 0);
      const streetBet = seat.streetBetBb ?? 0;
      if (streetBet > 0) {
        totalCurrentStreetBets += streetBet;
        nextStreetBets.set(seat.seatIndex, { bet: streetBet, x: betX, z: betZ });
        const betChips = Math.max(1, Math.min(8, Math.ceil(streetBet / 1.8)));
        const betColor = streetBet >= 8 ? 0xd97706 : 0x6d28d9;
        chipSpecs.push({
          x: betX,
          z: betZ,
          chips: betChips,
          colorHex: betColor,
        });

        // Staggered curved chip-toss arcs whenever this seat adds chips to the betting line
        const prevSeatBet = this.prevStreetBets.get(seat.seatIndex)?.bet ?? 0;
        if (this.initializedHandOnce && streetBet > prevSeatBet + 0.05) {
          const flyCount = Math.min(4, Math.max(1, Math.ceil((streetBet - prevSeatBet) / 2.2)));
          this.spawnFlyingChips(
            new THREE.Vector3(chipBaseX, FELT_Y + 0.06, chipBaseZ),
            new THREE.Vector3(betX, FELT_Y + 0.015, betZ),
            betColor,
            flyCount,
            0.25,
            this.isSoftwareGl ? 0.22 : 0.34
          );
          tossedChipsCount += flyCount;
        }
      }

      // Dealer button puck near BTN seat
      if (seat.isDealer) {
        const puck = createDealerPuckGroup(this.contactShadowTex);
        puck.position.set(anchor.x * 0.54 + 0.34, FELT_Y + 0.002, anchor.z * 0.52);
        this.dynamicGroup.add(puck);
      }

      // Hole cards (round-robin casino deal: pass 1 then pass 2; Hero cards lift cleanly & support hover-peek!)
      if (seat.cards && !seat.folded) {
        const reveal = Boolean(seat.isHero || seat.revealCards);
        const cardScale = seat.isHero ? 1.16 : 0.88;
        const c1 = createPlayingCardGroup(
          seat.cards[0],
          reveal,
          data.fourColorDeck,
          this.cardBackTex,
          this.contactShadowTex,
          cardScale
        );
        const c2 = createPlayingCardGroup(
          seat.cards[1],
          reveal,
          data.fourColorDeck,
          this.cardBackTex,
          this.contactShadowTex,
          cardScale
        );

        let pos1: THREE.Vector3;
        let rot1: THREE.Euler;
        let pos2: THREE.Vector3;
        let rot2: THREE.Euler;

        if (seat.isHero) {
          pos1 = new THREE.Vector3(-0.24, FELT_Y + 0.115, 1.24);
          rot1 = new THREE.Euler(0.22, 0.09, 0);
          pos2 = new THREE.Vector3(0.24, FELT_Y + 0.115, 1.24);
          rot2 = new THREE.Euler(0.22, -0.09, 0);
          this.heroCardTargets.push(
            { group: c1, basePos: pos1.clone(), baseRot: rot1.clone(), peekAmount: 0, sideOffset: 0 },
            { group: c2, basePos: pos2.clone(), baseRot: rot2.clone(), peekAmount: 0, sideOffset: 0 }
          );
        } else {
          const cx = anchor.x * 0.72;
          const cz = anchor.z * 0.72;
          pos1 = new THREE.Vector3(cx - 0.14, FELT_Y + 0.004, cz);
          rot1 = new THREE.Euler(0, anchor.rotY + 0.12, 0);
          pos2 = new THREE.Vector3(cx + 0.14, FELT_Y + 0.006, cz + 0.02);
          rot2 = new THREE.Euler(0, anchor.rotY - 0.12, 0);
        }

        c1.position.copy(pos1);
        c1.rotation.copy(rot1);
        c2.position.copy(pos2);
        c2.rotation.copy(rot2);
        this.dynamicGroup.add(c1, c2);

        if (isNewHoleDeal || animateInitialEntrance) {
          const dealDur = this.isSoftwareGl ? 0.22 : 0.34;
          const stagger = this.isSoftwareGl ? 0.02 : 0.048;
          // Authentic round-robin order: pass 1 across seats, then pass 2
          const delay1 = i * stagger;
          const delay2 = (activeSeatsCount + i) * stagger;
          const startRot1 = new THREE.Euler(0, 0.56 + 0.45, seat.isHero ? Math.PI : 0);
          const startRot2 = new THREE.Euler(0, 0.56 - 0.35, seat.isHero ? Math.PI : 0);

          c1.position.copy(deckOrigin);
          c1.rotation.copy(startRot1);
          c1.visible = false;
          c2.position.copy(deckOrigin);
          c2.rotation.copy(startRot2);
          c2.visible = false;

          // Subtle curved dealer-flick offset toward table center
          const flickCurve = new THREE.Vector3(-pos1.x * 0.14, 0, -0.18);

          this.activeTweens.push(
            {
              obj: c1,
              fromPos: deckOrigin.clone(),
              toPos: pos1,
              curveOffset: flickCurve,
              arcHeight: seat.isHero ? 0.24 : 0.16,
              bounceHeight: seat.isHero ? 0.015 : 0.018,
              fromRot: startRot1,
              toRot: rot1,
              flipCard: seat.isHero,
              delay: delay1,
              elapsed: 0,
              duration: dealDur,
              initialHidden: true,
            },
            {
              obj: c2,
              fromPos: deckOrigin.clone(),
              toPos: pos2,
              curveOffset: flickCurve.clone().multiplyScalar(0.8),
              arcHeight: seat.isHero ? 0.26 : 0.18,
              bounceHeight: seat.isHero ? 0.015 : 0.018,
              fromRot: startRot2,
              toRot: rot2,
              flipCard: seat.isHero,
              delay: delay2,
              elapsed: 0,
              duration: dealDur,
              initialHidden: true,
            }
          );
          if (seat.isHero && !animateInitialEntrance) {
            this.soundEngine.playCardSlide(delay1);
            this.soundEngine.playCardSlide(delay2);
          }
        }
      }
    }

    if (tossedChipsCount > 0) {
      this.soundEngine.playChipClink(Math.min(3, tossedChipsCount), 0.16);
    }

    // Pot-sweep animation when prior street bets are collected into center pot on a street transition
    if (
      this.initializedHandOnce &&
      this.prevStreetBets.size > 0 &&
      totalCurrentStreetBets === 0 &&
      data.potBb >= this.prevPotBb
    ) {
      let sweepIdx = 0;
      for (const prev of this.prevStreetBets.values()) {
        this.spawnFlyingChips(
          new THREE.Vector3(prev.x, FELT_Y + 0.025, prev.z),
          new THREE.Vector3(0, FELT_Y + 0.04, -0.64),
          prev.bet >= 8 ? 0xd97706 : 0x0d7a55,
          2,
          0.14,
          this.isSoftwareGl ? 0.22 : 0.34,
          sweepIdx * 0.05
        );
        sweepIdx++;
      }
      this.soundEngine.playChipClink(3, 0.18);
    }

    // Celebratory winner payout stream sweeping chips from center pot straight to the showdown winner!
    if (this.initializedHandOnce && hasWinnerNow && !this.prevHadWinner) {
      if (winnerPos) {
        this.spawnFlyingChips(
          new THREE.Vector3(0, FELT_Y + 0.05, -0.64),
          winnerPos,
          0xd97706,
          4,
          0.22,
          this.isSoftwareGl ? 0.26 : 0.44,
          0.08
        );
      }
      this.soundEngine.playWinnerChime();
    }

    // Neat stacked casino dealer stub deck (filigree card back + warm matte edges) near far-left dealer bay
    const stubMatEdge = new THREE.MeshStandardMaterial({
      color: 0xbcb3a0,
      roughness: 0.86,
      metalness: 0.0,
      envMapIntensity: 0.05,
    });
    const stubMatTop = new THREE.MeshStandardMaterial({
      color: 0xe6dfd0,
      map: this.cardBackTex,
      roughness: 0.84,
      metalness: 0.0,
      envMapIntensity: 0.06,
    });
    const stubDeck = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.075, 0.45), [
      stubMatEdge,
      stubMatEdge,
      stubMatTop,
      stubMatEdge,
      stubMatEdge,
      stubMatEdge,
    ]);
    stubDeck.position.set(DEALER_DECK_POS[0], DEALER_DECK_POS[1], DEALER_DECK_POS[2]);
    stubDeck.rotation.y = 0.56;
    stubDeck.castShadow = !this.isSoftwareGl;
    stubDeck.receiveShadow = true;
    this.dynamicGroup.add(stubDeck);

    // Build all chips via single InstancedMesh group
    const chipsGroup = createChipStacksGroup(chipSpecs, this.contactShadowTex);
    this.dynamicGroup.add(chipsGroup);

    // Persist state snapshots for next animation diff
    this.prevBoardKeys = nextBoardKeys;
    this.prevHeroCardsSig = nextHeroCardsSig;
    this.prevStreetBets = nextStreetBets;
    this.prevPotBb = data.potBb;
    this.prevHadWinner = hasWinnerNow;
    this.initializedHandOnce = true;
  }

  public requestRender() {
    if (this.disposed) return;
    this.dirty = true;
    if (this.rafId === null && this.timeoutId === null) {
      this.lastTickMs = performance.now();
      this.rafId = requestAnimationFrame(this.tick);
    }
  }

  private scheduleNextFrame() {
    if (this.disposed || this.rafId !== null || this.timeoutId !== null) return;
    if (!this.isSoftwareGl) {
      this.rafId = requestAnimationFrame(this.tick);
      return;
    }
    // Software WebGL (SwiftShader): yield cleanly so main thread stays responsive without fenceSync deadlocks
    this.timeoutId = window.setTimeout(() => {
      this.timeoutId = null;
      if (!this.disposed && this.rafId === null) {
        this.rafId = requestAnimationFrame(this.tick);
      }
    }, 24);
  }

  private tick = () => {
    this.rafId = null;
    if (this.disposed) return;

    const now = performance.now();
    const maxStep = this.isSoftwareGl ? 1.0 : 0.05;
    const dt = Math.min(maxStep, Math.max(0.004, (now - (this.lastTickMs || now)) / 1000));
    this.lastTickMs = now;
    this.elapsedSec += dt;

    // Strictly on-demand rendering: 0% GPU usage when idle!
    let keepGoing = false;
    let shadowsDirty = false;

    // 1. Step active curved card-flip & staggered chip-bounce physics tweens
    if (this.activeTweens.length > 0) {
      const remaining: ActiveTween[] = [];
      for (const tw of this.activeTweens) {
        tw.elapsed += dt;
        const activeTime = tw.elapsed - tw.delay;
        if (activeTime <= 0) {
          remaining.push(tw);
          continue;
        }
        if (tw.initialHidden) {
          tw.obj.visible = true;
          tw.initialHidden = false;
        }

        const rawT = Math.min(1, activeTime / tw.duration);
        if (rawT >= 1) {
          tw.obj.position.copy(tw.toPos);
          tw.obj.rotation.copy(tw.toRot);
          if (tw.disposeOnEnd) {
            this.disposeSingleFxObj(tw.obj);
          }
          shadowsDirty = true;
          continue;
        }

        const posT = easeOutQuart(rawT);
        // Quadratic Bezier lateral curve + parabolic flight arc + crisp damped micro-bounce on arrival
        const arcSin = Math.sin(rawT * Math.PI);
        const curveWeight = 2 * (1 - posT) * posT;
        _tmpVec.lerpVectors(tw.fromPos, tw.toPos, posT);
        _tmpVec.addScaledVector(tw.curveOffset, curveWeight);

        let yLift = arcSin * tw.arcHeight;
        if (rawT > 0.78 && tw.bounceHeight > 0) {
          const bt = (rawT - 0.78) / 0.22;
          yLift += Math.sin(bt * Math.PI) * tw.bounceHeight * (1 - bt * 0.35);
        }
        tw.obj.position.set(_tmpVec.x, _tmpVec.y + yLift, _tmpVec.z);

        if (tw.flipCard) {
          // Stay face-down during initial glide, then execute a snappy mid-air 180° flip as the card arrives
          const flipT = rawT < 0.38 ? 0 : easeInOutCubic(Math.min(1, (rawT - 0.38) / 0.48));
          const rotZ = THREE.MathUtils.lerp(tw.fromRot.z, tw.toRot.z, flipT);
          const flipLift = Math.sin(flipT * Math.PI) * 0.14;
          tw.obj.position.y += flipLift;
          tw.obj.rotation.set(
            THREE.MathUtils.lerp(tw.fromRot.x, tw.toRot.x, posT),
            THREE.MathUtils.lerp(tw.fromRot.y, tw.toRot.y, posT),
            rotZ
          );
        } else {
          tw.obj.rotation.set(
            THREE.MathUtils.lerp(tw.fromRot.x, tw.toRot.x, posT),
            THREE.MathUtils.lerp(tw.fromRot.y, tw.toRot.y, posT),
            THREE.MathUtils.lerp(tw.fromRot.z, tw.toRot.z, posT)
          );
        }
        remaining.push(tw);
      }
      this.activeTweens = remaining;
      this.dirty = true;
      keepGoing = true;
    }

    // 2. Two-finger spring-damped Hero hole-card hover peek (lifts hovered card & fans neighbor slightly aside)
    if (this.activeTweens.length === 0 && this.heroCardTargets.length > 0) {
      for (let i = 0; i < this.heroCardTargets.length; i++) {
        const target = this.heroCardTargets[i];
        const desiredPeek = this.hoveredHeroCardIdx === i ? 1 : 0;
        const desiredSide =
          this.hoveredHeroCardIdx === -1 || this.hoveredHeroCardIdx === i
            ? 0
            : i < this.hoveredHeroCardIdx
              ? -1
              : 1;

        const nextPeek = THREE.MathUtils.damp(target.peekAmount, desiredPeek, 14, dt);
        const nextSide = THREE.MathUtils.damp(target.sideOffset, desiredSide, 12, dt);

        if (
          Math.abs(nextPeek - target.peekAmount) > 0.001 ||
          Math.abs(nextSide - target.sideOffset) > 0.001
        ) {
          target.peekAmount = Math.abs(nextPeek - desiredPeek) < 0.004 ? desiredPeek : nextPeek;
          target.sideOffset = Math.abs(nextSide - desiredSide) < 0.004 ? desiredSide : nextSide;

          target.group.position.set(
            target.basePos.x + target.sideOffset * 0.045,
            target.basePos.y + target.peekAmount * 0.125,
            target.basePos.z + target.peekAmount * 0.065
          );
          target.group.rotation.set(
            target.baseRot.x + target.peekAmount * 0.26,
            target.baseRot.y - target.sideOffset * 0.04,
            target.baseRot.z
          );
          this.dirty = true;
          keepGoing = true;
        }
      }
    }

    // 3. Frame-rate independent exponential-damped camera preset glide
    if (this.camAnimActive) {
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.camTargetPos.x, 7.5, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this.camTargetPos.y, 7.5, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, this.camTargetPos.z, 7.5, dt);
      this.controls.target.x = THREE.MathUtils.damp(this.controls.target.x, this.camTargetLook.x, 7.5, dt);
      this.controls.target.y = THREE.MathUtils.damp(this.controls.target.y, this.camTargetLook.y, 7.5, dt);
      this.controls.target.z = THREE.MathUtils.damp(this.controls.target.z, this.camTargetLook.z, 7.5, dt);
      this.controls.update();
      if (
        this.camera.position.distanceToSquared(this.camTargetPos) < 0.0006 &&
        this.controls.target.distanceToSquared(this.camTargetLook) < 0.0006
      ) {
        this.camera.position.copy(this.camTargetPos);
        this.controls.target.copy(this.camTargetLook);
        this.controls.update();
        this.camAnimActive = false;
      } else {
        this.dirty = true;
        keepGoing = true;
      }
    } else if (this.controls.enableDamping) {
      const moved = this.controls.update();
      if (moved) {
        this.dirty = true;
        keepGoing = true;
      }
    }

    // Subtle dust-mote & halo shimmer only while active frames are already being rendered (zero idle cost!)
    if (this.dirty || keepGoing) {
      if (this.activeHaloMats.length > 0) {
        for (let i = 0; i < this.activeHaloMats.length; i++) {
          this.activeHaloMats[i].uniforms.uTime.value = this.elapsedSec;
        }
      }
      if (!this.isSoftwareGl && this.dustMotes) {
        this.dustMotes.rotation.y = this.elapsedSec * 0.028;
      }
      if (shadowsDirty && !this.isSoftwareGl) {
        this.renderer.shadowMap.needsUpdate = true;
      }
      if (this.chandelierGroup) {
        this.chandelierGroup.visible = this.camera.position.y < 4.35;
      }
      this.dirty = false;
      this.renderer.render(this.scene, this.camera);
    }

    if (keepGoing) {
      this.scheduleNextFrame();
    }
  };

  public dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelScheduledFrame();
    this.activeTweens = [];
    this.activeHaloMats = [];
    this.heroCardTargets = [];
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.soundEngine.dispose();

    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointermove', this.handlePointerMove);
    canvas.removeEventListener('pointerleave', this.handlePointerLeave);
    canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);

    disposeObject3D(this.scene);
    this.contactShadowTex.dispose();
    this.cardBackTex.dispose();
    this.floorTex.dispose();
    this.chipSideTex.dispose();
    this.chipTopTex.dispose();
    this.envRenderTarget.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
    if (canvas.parentElement) {
      canvas.parentElement.removeChild(canvas);
    }
  }
}
