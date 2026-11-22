import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Card } from '../poker/types';
import {
  createAmbientPropsGroup,
  createCasinoSalonBackdropGroup,
  createChipStacksGroup,
  createDealerPuckGroup,
  createPlayingCardGroup,
  createPokerTableGroup,
  createSeatPlaqueMesh,
  DEALER_DECK_POS,
  FELT_Y,
  getAnchorsForSeatCount,
  type ChipStackSpec,
  type PokerTableAssembly,
  type Seat3DSpec,
} from './models';
import {
  createCardBackTexture,
  createChipSideTexture,
  createChipTopTexture,
  createContactShadowTexture,
  createStudioFloorTexture,
  type FeltThemeId,
} from './textures';

export type CameraPresetId = 'hero' | 'broadcast' | 'topdown' | 'closeup';
export type LightingPresetId = 'studio' | 'daylight' | 'lounge';

export interface Scene3DHandData {
  board: Card[];
  potBb: number;
  seats: Seat3DSpec[];
  fourColorDeck: boolean;
  feltTheme: FeltThemeId;
  lighting: LightingPresetId;
  showProps?: boolean;
}

interface ActiveTween {
  obj: THREE.Object3D;
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  arcHeight: number;
  fromRot: THREE.Euler;
  toRot: THREE.Euler;
  delay: number;
  elapsed: number;
  duration: number;
  disposeOnEnd?: boolean;
}

const CAMERA_PRESETS: Record<
  CameraPresetId,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  hero: { pos: [0, 3.05, 4.95], target: [0, FELT_Y + 0.05, 0.15] },
  broadcast: { pos: [3.95, 3.85, 4.45], target: [0, FELT_Y, 0] },
  topdown: { pos: [0, 6.25, 0.95], target: [0, FELT_Y, 0] },
  closeup: { pos: [0.45, 2.05, 2.25], target: [0, FELT_Y + 0.04, -0.05] },
};

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
    fogDensity: 0.056,
    keyColor: 0xffe4bd,
    keyIntensity: 1.35,
    spotColor: 0xffd596,
    spotIntensity: 26,
    hemiSky: 0x7aa2d4,
    hemiGround: 0x1e130c,
    hemiIntensity: 0.56,
    rimColor: 0xd99b43,
    rimIntensity: 0.65,
    exposure: 1.0,
  },
  daylight: {
    bg: 0x10151f,
    fogDensity: 0.036,
    keyColor: 0xfff8ee,
    keyIntensity: 2.05,
    spotColor: 0xfff4e0,
    spotIntensity: 22,
    hemiSky: 0xcbe3ff,
    hemiGround: 0x26211d,
    hemiIntensity: 0.96,
    rimColor: 0x93c5fd,
    rimIntensity: 0.48,
    exposure: 1.06,
  },
  lounge: {
    bg: 0x050406,
    fogDensity: 0.074,
    keyColor: 0xffc985,
    keyIntensity: 1.0,
    spotColor: 0xffbe6b,
    spotIntensity: 32,
    hemiSky: 0x45587a,
    hemiGround: 0x1a0c09,
    hemiIntensity: 0.36,
    rimColor: 0xf59e0b,
    rimIntensity: 0.82,
    exposure: 0.96,
  },
};

function detectSoftwareWebGL(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return false;
    const rendererStr = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? '');
    return /SwiftShader|llvmpipe|Software|Microsoft Basic/i.test(rendererStr);
  } catch {
    return false;
  }
}

function disposeObject3D(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
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

export class PokerScene3D {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private isSoftwareGl: boolean;
  private pmrem: THREE.PMREMGenerator;
  private envRenderTarget: THREE.WebGLRenderTarget;

  private keyLight: THREE.DirectionalLight;
  private casinoSpotLight: THREE.SpotLight;
  private hemiLight: THREE.HemisphereLight;
  private rimLight: THREE.DirectionalLight;

  private tableAssembly: PokerTableAssembly;
  private ambientPropsGroup: THREE.Group;
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
  private lastTickMs = 0;
  private dirty = true;
  private disposed = false;

  // Animation & state-delta trackers for smooth dealing & chip-tossing physics
  private activeTweens: ActiveTween[] = [];
  private prevBoardKeys: string[] = [];
  private prevHeroCardsSig = '';
  private prevStreetBets = new Map<number, { bet: number; x: number; z: number }>();
  private prevPotBb = 0;
  private initializedHandOnce = false;

  // Smooth camera transition scratch vectors (zero per-frame allocation)
  private camAnimActive = false;
  private camTargetPos = new THREE.Vector3();
  private camTargetLook = new THREE.Vector3();

  constructor(container: HTMLElement, initialData: Scene3DHandData) {
    this.container = container;
    this.currentFeltTheme = initialData.feltTheme;

    // Create a probe context on a temporary canvas to detect software WebGL cleanly
    const probeCanvas = document.createElement('canvas');
    const probeGl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    this.isSoftwareGl = probeGl ? detectSoftwareWebGL(probeGl) : false;

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 260);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
      preserveDrawingBuffer: false,
    });
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = this.renderer.domElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    container.appendChild(canvas);

    this.scene = new THREE.Scene();

    // Studio IBL via RoomEnvironment (no external HDR network URLs)
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
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 2.0;
    this.controls.maxDistance = 9.5;
    this.controls.minPolarAngle = 0.14;
    this.controls.maxPolarAngle = Math.PI * 0.455;
    this.controls.addEventListener('change', () => {
      this.requestRender();
    });
    this.controls.update();

    // Warm Casino Overhead Pendant Pool + 3-Point Studio Rig
    this.hemiLight = new THREE.HemisphereLight(0x7aa2d4, 0x1e130c, 0.62);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xffe4bd, 1.55);
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

    // Focused overhead casino chandelier spotlight creating a balanced warm pool across the felt
    this.casinoSpotLight = new THREE.SpotLight(0xffd596, 26, 16, Math.PI * 0.36, 0.92, 1.6);
    this.casinoSpotLight.position.set(0, 5.1, 0.25);
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

    // Luxury Axminster casino salon carpet floor (fades smoothly into warm room fog)
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.floorTex,
      roughness: 0.94,
      metalness: 0.02,
      envMapIntensity: 0.14,
    });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(42, 64), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Intimate private casino salon architectural backdrop (mahogany pilasters, warm sconces, overhead hood)
    const salonBackdrop = createCasinoSalonBackdropGroup();
    this.scene.add(salonBackdrop);

    // Composite Bellagio/Monte-Carlo casino poker table
    this.tableAssembly = createPokerTableGroup(
      initialData.feltTheme,
      this.contactShadowTex,
      maxAniso,
      !this.isSoftwareGl
    );
    this.scene.add(this.tableAssembly.group);

    // Toggleable high-roller lounge props (crystal whiskey tumbler + gold card protector)
    this.ambientPropsGroup = createAmbientPropsGroup(this.contactShadowTex);
    this.ambientPropsGroup.visible = initialData.showProps ?? true;
    this.scene.add(this.ambientPropsGroup);

    // Dynamic hand layer (board cards, hole cards, instanced chips, dealer button, seat plaques)
    this.dynamicGroup = new THREE.Group();
    this.dynamicGroup.name = 'DynamicHandLayer';
    this.scene.add(this.dynamicGroup);

    // Transient animation FX layer (tossed bet chips & pot-sweep chips)
    this.fxGroup = new THREE.Group();
    this.fxGroup.name = 'AnimationFxLayer';
    this.scene.add(this.fxGroup);

    this.applyLighting(initialData.lighting);
    this.rebuildHandLayer(initialData);

    // WebGL context loss safety
    canvas.addEventListener('webglcontextlost', this.handleContextLost, false);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored, false);

    // ResizeObserver for crisp layout transitions
    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });
    this.resizeObserver.observe(container);

    this.requestRender();
  }

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  };

  private handleContextRestored = () => {
    this.requestRender();
  };

  private handleResize() {
    if (this.disposed) return;
    const width = Math.max(this.container.clientWidth, 280);
    const height = Math.max(this.container.clientHeight, 220);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.requestRender();
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
      // Snap cleanly on software WebGL so frame pacing stays responsive
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
    this.requestRender();
  }

  private spawnFlyingChipCluster(
    fromPos: THREE.Vector3,
    toPos: THREE.Vector3,
    colorHex: number,
    chipCount: number,
    arcHeight: number,
    duration: number,
    delay = 0
  ) {
    const cluster = new THREE.Group();
    const chipRadius = 0.095;
    const chipHeight = 0.023;
    const bodyGeo = new THREE.CylinderGeometry(chipRadius, chipRadius, chipHeight, 18, 1, true);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      map: this.chipSideTex,
      roughness: 0.56,
      metalness: 0.06,
      envMapIntensity: 0.28,
    });
    const capGeo = new THREE.CylinderGeometry(chipRadius * 0.99, chipRadius * 0.99, 0.004, 18);
    const capColor = new THREE.Color(colorHex).lerp(new THREE.Color(0xffffff), 0.22);
    const capMat = new THREE.MeshStandardMaterial({
      color: capColor,
      map: this.chipTopTex,
      roughness: 0.54,
      metalness: 0.06,
      envMapIntensity: 0.26,
    });

    const count = Math.max(1, Math.min(3, chipCount));
    for (let c = 0; c < count; c++) {
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = c * chipHeight + chipHeight / 2;
      cluster.add(body);
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.y = (c + 1) * chipHeight + 0.001;
      cluster.add(cap);
    }

    cluster.position.copy(fromPos);
    this.fxGroup.add(cluster);

    this.activeTweens.push({
      obj: cluster,
      fromPos: fromPos.clone(),
      toPos: toPos.clone(),
      arcHeight,
      fromRot: new THREE.Euler(0.28, 0, -0.22),
      toRot: new THREE.Euler(0, Math.PI * 0.6, 0),
      delay,
      elapsed: 0,
      duration,
      disposeOnEnd: true,
    });
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
          // Preserve shared chip textures
          m.dispose();
        }
      }
    });
  }

  private rebuildHandLayer(data: Scene3DHandData) {
    // Drop non-FX card tweens belonging to the previous dynamic layer (keep flying chip FX running!)
    this.activeTweens = this.activeTweens.filter((tw) => tw.disposeOnEnd);

    // Cleanly dispose previous dynamic meshes & per-card textures (without touching shared cardBackTex/contactShadowTex)
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
      DEALER_DECK_POS[1] + 0.05,
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

    // 1. Community Board Cards in center of felt (animated smoothly from dealer deck when newly dealt)
    const boardCount = data.board.length;
    const cardSpacing = 0.44;
    const startX = -((Math.max(boardCount, 1) - 1) * cardSpacing) / 2;
    let boardAnimOrder = 0;
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

      const isNewlyDealt = this.initializedHandOnce && (isFreshBoard || i >= this.prevBoardKeys.length);
      if (isNewlyDealt) {
        cardGrp.position.copy(deckOrigin);
        cardGrp.rotation.set(0.05, 0.56 + Math.PI * 0.35, 0);
        this.activeTweens.push({
          obj: cardGrp,
          fromPos: deckOrigin.clone(),
          toPos: targetPos,
          arcHeight: 0.22,
          fromRot: new THREE.Euler(0.05, 0.56 + Math.PI * 0.35, 0),
          toRot: targetRot,
          delay: boardAnimOrder * (this.isSoftwareGl ? 0.025 : 0.08),
          elapsed: 0,
          duration: this.isSoftwareGl ? 0.22 : 0.38,
        });
        boardAnimOrder++;
      }
    }

    // 2. Center Pot Clay Chip Stacks (authentic Paulson denominations: $25 emerald, $100 charcoal, $500 purple, $1000 gold)
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

    // 3. Seats: Hole Cards, Player Chip Stacks, Street Bets, Dealer Button, and Seat Plaques
    const activeSeatsCount = Math.min(6, data.seats.length);
    const anchors = getAnchorsForSeatCount(activeSeatsCount);
    const nextStreetBets = new Map<number, { bet: number; x: number; z: number }>();
    let totalCurrentStreetBets = 0;

    for (let i = 0; i < activeSeatsCount; i++) {
      const seat = data.seats[i];
      const anchor = anchors[i];
      const inwardScale = 0.65;

      // Seat plaque mounted flush atop the padded leather bolster crown
      const plaque = createSeatPlaqueMesh(seat);
      plaque.position.set(anchor.x * 1.1, FELT_Y + 0.212, anchor.z * 1.1);
      plaque.lookAt(0, FELT_Y + 0.212, 0);
      // Tuck Hero plaque along the front-right leather crown so it never obstructs hole cards from Hero or Broadcast POV
      if (seat.isHero) {
        plaque.position.set(1.42, FELT_Y + 0.212, 2.02);
        plaque.rotation.set(0, -0.34, 0);
      }
      this.dynamicGroup.add(plaque);

      const isTopCenter = Math.abs(anchor.x) < 0.1 && anchor.z < 0;
      const chipBaseX = anchor.x * inwardScale + (seat.isHero ? -0.68 : isTopCenter ? 0.56 : 0);
      const chipBaseZ = anchor.z * inwardScale + (seat.isHero ? -0.06 : 0);

      // Player chip stacks on felt near seat (emerald $25 + crimson $5 / charcoal $100 + gold $1000)
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

        // Animate tossed chip arc whenever this seat adds chips to the betting line
        const prevSeatBet = this.prevStreetBets.get(seat.seatIndex)?.bet ?? 0;
        if (this.initializedHandOnce && streetBet > prevSeatBet + 0.05) {
          this.spawnFlyingChipCluster(
            new THREE.Vector3(chipBaseX, FELT_Y + 0.08, chipBaseZ),
            new THREE.Vector3(betX, FELT_Y + 0.02, betZ),
            betColor,
            Math.min(3, Math.max(1, Math.ceil((streetBet - prevSeatBet) / 2.5))),
            0.28,
            this.isSoftwareGl ? 0.22 : 0.34
          );
        }
      }

      // Dealer button puck near BTN seat
      if (seat.isDealer) {
        const puck = createDealerPuckGroup(this.contactShadowTex);
        puck.position.set(anchor.x * 0.54 + 0.34, FELT_Y + 0.002, anchor.z * 0.52);
        this.dynamicGroup.add(puck);
      }

      // Hole cards (smoothly dealt from dealer deck on fresh hand)
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
          pos1 = new THREE.Vector3(-0.24, FELT_Y + 0.08, 1.24);
          rot1 = new THREE.Euler(0.32, 0.09, 0);
          pos2 = new THREE.Vector3(0.24, FELT_Y + 0.08, 1.24);
          rot2 = new THREE.Euler(0.32, -0.09, 0);
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

        if (isNewHoleDeal) {
          const dealDur = this.isSoftwareGl ? 0.24 : 0.36;
          c1.position.copy(deckOrigin);
          c2.position.copy(deckOrigin);
          this.activeTweens.push(
            {
              obj: c1,
              fromPos: deckOrigin.clone(),
              toPos: pos1,
              arcHeight: 0.2,
              fromRot: new THREE.Euler(0, 0.56, 0),
              toRot: rot1,
              delay: i * 0.045,
              elapsed: 0,
              duration: dealDur,
            },
            {
              obj: c2,
              fromPos: deckOrigin.clone(),
              toPos: pos2,
              arcHeight: 0.2,
              fromRot: new THREE.Euler(0, 0.56, 0),
              toRot: rot2,
              delay: i * 0.045 + 0.055,
              elapsed: 0,
              duration: dealDur,
            }
          );
        }
      }
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
        this.spawnFlyingChipCluster(
          new THREE.Vector3(prev.x, FELT_Y + 0.03, prev.z),
          new THREE.Vector3(0, FELT_Y + 0.05, -0.64),
          prev.bet >= 8 ? 0xd97706 : 0x0d7a55,
          2,
          0.14,
          this.isSoftwareGl ? 0.24 : 0.36,
          sweepIdx * 0.04
        );
        sweepIdx++;
      }
    }

    // Neat stacked casino dealer stub deck (filigree card back + ivory edges) near far-left dealer bay
    const stubMatEdge = new THREE.MeshStandardMaterial({
      color: 0xe2ddd0,
      roughness: 0.78,
      metalness: 0.0,
      envMapIntensity: 0.1,
    });
    const stubMatTop = new THREE.MeshStandardMaterial({
      map: this.cardBackTex,
      roughness: 0.68,
      metalness: 0.0,
      envMapIntensity: 0.14,
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
    this.initializedHandOnce = true;
  }

  public requestRender() {
    if (this.disposed) return;
    this.dirty = true;
    if (this.rafId === null) {
      this.lastTickMs = performance.now();
      this.rafId = requestAnimationFrame(this.tick);
    }
  }

  private afterDraw(fn: () => void) {
    if (!this.isSoftwareGl) {
      requestAnimationFrame(fn);
      return;
    }
    // Yield briefly on software WebGL (SwiftShader) so the main thread stays responsive without risking fenceSync stalls
    window.setTimeout(() => {
      if (!this.disposed) {
        requestAnimationFrame(fn);
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

    let keepGoing = false;

    // Step active card-dealing & chip-tossing physics tweens
    if (this.activeTweens.length > 0) {
      const remaining: ActiveTween[] = [];
      for (const tw of this.activeTweens) {
        tw.elapsed += dt;
        const activeTime = tw.elapsed - tw.delay;
        if (activeTime <= 0) {
          remaining.push(tw);
          continue;
        }
        const rawT = Math.min(1, activeTime / tw.duration);
        if (rawT >= 1) {
          tw.obj.position.copy(tw.toPos);
          tw.obj.rotation.copy(tw.toRot);
          if (tw.disposeOnEnd) {
            this.disposeSingleFxObj(tw.obj);
          }
          continue;
        }

        const eased = 1 - Math.pow(1 - rawT, 3); // crisp cubic ease-out
        tw.obj.position.lerpVectors(tw.fromPos, tw.toPos, eased);
        tw.obj.position.y += Math.sin(rawT * Math.PI) * tw.arcHeight;
        tw.obj.rotation.set(
          THREE.MathUtils.lerp(tw.fromRot.x, tw.toRot.x, eased),
          THREE.MathUtils.lerp(tw.fromRot.y, tw.toRot.y, eased),
          THREE.MathUtils.lerp(tw.fromRot.z, tw.toRot.z, eased)
        );
        remaining.push(tw);
      }
      this.activeTweens = remaining;
      this.dirty = true;
      if (this.activeTweens.length > 0) keepGoing = true;
    }

    if (this.camAnimActive) {
      this.camera.position.lerp(this.camTargetPos, 0.14);
      this.controls.target.lerp(this.camTargetLook, 0.14);
      this.controls.update();
      if (
        this.camera.position.distanceToSquared(this.camTargetPos) < 0.0008 &&
        this.controls.target.distanceToSquared(this.camTargetLook) < 0.0008
      ) {
        this.camera.position.copy(this.camTargetPos);
        this.controls.target.copy(this.camTargetLook);
        this.controls.update();
        this.camAnimActive = false;
      } else {
        keepGoing = true;
      }
    } else if (this.controls.enableDamping) {
      const moved = this.controls.update();
      if (moved) keepGoing = true;
    }

    if (this.dirty || keepGoing) {
      this.dirty = false;
      this.renderer.render(this.scene, this.camera);
    }

    if (keepGoing) {
      this.afterDraw(() => {
        if (!this.disposed && this.rafId === null) {
          this.rafId = requestAnimationFrame(this.tick);
        }
      });
    }
  };

  public dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.activeTweens = [];
    this.resizeObserver.disconnect();
    this.controls.dispose();
    const canvas = this.renderer.domElement;
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
