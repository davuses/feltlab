import * as THREE from 'three';
import type { Card, Position } from '../poker/types';
import {
  createBokehParticleTexture,
  createCardFaceTexture,
  createCardProtectorTexture,
  createChipSideTexture,
  createChipTopTexture,
  createDealerPuckTexture,
  createFeltTextures,
  createLeatherRailTextures,
  createMahoganyWoodTextures,
  createSeatPlaqueTexture,
  createVelvetPanelTexture,
  type FeltThemeId,
} from './textures';

export const FELT_Y = 0.84;
export const TABLE_RX = 3.05;
export const TABLE_RZ = 1.66;
export const DEALER_DECK_POS: [number, number, number] = [-1.12, FELT_Y + 0.038, -1.02];

function createOvalShape(rx: number, rz: number, segments = 96): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const x = Math.cos(t) * rx;
    const y = Math.sin(t) * rz;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  return shape;
}

function createOvalRingShape(
  outerRx: number,
  outerRz: number,
  innerRx: number,
  innerRz: number,
  segments = 96
): THREE.Shape {
  const outer = createOvalShape(outerRx, outerRz, segments);
  const hole = new THREE.Path();
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const x = Math.cos(t) * innerRx;
    const y = Math.sin(t) * innerRz;
    if (i === 0) hole.moveTo(x, y);
    else hole.lineTo(x, y);
  }
  outer.holes.push(hole);
  return outer;
}

/**
 * Generates an oval ShapeGeometry with exact normalized [0..1] planar UVs
 * so our 1024x640 bespoke casino layout texture maps 1:1 with zero stretch or tiling seam.
 */
function createNormalizedOvalFeltGeometry(rx: number, rz: number, segments = 96): THREE.ShapeGeometry {
  const shape = createOvalShape(rx, rz, segments);
  const geo = new THREE.ShapeGeometry(shape, segments);
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    uv[i * 2] = (x + rx) / (2 * rx);
    // ShapeGeometry +Y rotates to -Z (far side); CanvasTexture flipY=true maps v=1 to canvas top
    uv[i * 2 + 1] = (y + rz) / (2 * rz);
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.rotateX(-Math.PI / 2);
  return geo;
}

export interface PokerTableAssembly {
  group: THREE.Group;
  feltMaterial: THREE.MeshStandardMaterial;
  feltTextures: { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture };
  updateFeltTheme: (theme: FeltThemeId, maxAnisotropy: number) => void;
}

/**
 * Composite 11-part Bellagio/Monte-Carlo high-stakes casino poker table:
 * 1. Plump padded dark-espresso stitched leather outer armrest rail
 * 2. Lacquered mahogany/walnut wood racetrack (MeshPhysicalMaterial with clearcoat)
 * 3. Brushed-brass inner beveled trim ring & outer accent bead
 * 4. Recessed 1:1 mapped speed-cloth casino baize playing surface
 * 5. 6 Recessed brushed-brass cup holders inlaid into the wood racetrack
 * 6. Recessed casino dealer chip bank tray stocked with $25/$100/$500/$1000 chip tubes + brass drop slot
 * 7. Dark mahogany architectural lower skirt
 * 8. Dual sculpted lathe pedestal columns with brass collars
 * 9. Brushed-brass footrest rail bar
 * 10. Structural floor plinth beam
 * 11. Soft radial floor contact shadow
 */
export function createPokerTableGroup(
  feltTheme: FeltThemeId,
  contactShadowTex: THREE.CanvasTexture,
  maxAnisotropy: number,
  castShadow: boolean
): PokerTableAssembly {
  const group = new THREE.Group();
  group.name = 'CasinoHighStakesPokerTable';

  const feltTextures = createFeltTextures(feltTheme, maxAnisotropy);
  const leatherTextures = createLeatherRailTextures(maxAnisotropy);
  const woodTextures = createMahoganyWoodTextures(maxAnisotropy);

  const feltMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: feltTextures.map,
    bumpMap: feltTextures.bumpMap,
    bumpScale: 0.014,
    roughness: 0.93,
    metalness: 0.0,
    envMapIntensity: 0.16,
  });

  const railMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: leatherTextures.map,
    bumpMap: leatherTextures.bumpMap,
    bumpScale: 0.022,
    roughness: 0.44,
    metalness: 0.05,
    clearcoat: 0.24,
    clearcoatRoughness: 0.42,
    envMapIntensity: 0.48,
  });

  // High-gloss lacquered mahogany wood racetrack
  const woodMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: woodTextures.map,
    bumpMap: woodTextures.bumpMap,
    bumpScale: 0.008,
    roughness: 0.24,
    metalness: 0.04,
    clearcoat: 0.92,
    clearcoatRoughness: 0.12,
    envMapIntensity: 0.72,
  });

  const brassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xd9b25a,
    roughness: 0.22,
    metalness: 0.92,
    anisotropy: 0.72,
    clearcoat: 0.25,
    clearcoatRoughness: 0.28,
    envMapIntensity: 0.95,
  });

  const darkRecessMaterial = new THREE.MeshStandardMaterial({
    color: 0x0a0a0d,
    roughness: 0.85,
    metalness: 0.15,
    envMapIntensity: 0.15,
  });

  const skirtMaterial = new THREE.MeshStandardMaterial({
    color: 0x1b110d,
    roughness: 0.48,
    metalness: 0.14,
    envMapIntensity: 0.32,
  });

  const stitchPipingMat = new THREE.MeshStandardMaterial({
    color: 0x9b7942,
    roughness: 0.58,
    metalness: 0.25,
    envMapIntensity: 0.4,
  });

  const ledCoveMat = new THREE.MeshStandardMaterial({
    color: 0xffe4b2,
    emissive: 0xffcc73,
    emissiveIntensity: 1.35,
    roughness: 0.3,
    metalness: 0.0,
  });

  // 1. Plump Padded Outer Leather Armrest Bolster (balanced 96-seg curve for smooth close-ups & fast GPU)
  const railShape = createOvalRingShape(
    TABLE_RX + 0.62,
    TABLE_RZ + 0.56,
    TABLE_RX + 0.2,
    TABLE_RZ + 0.18,
    96
  );
  const railGeo = new THREE.ExtrudeGeometry(railShape, {
    depth: 0.13,
    bevelEnabled: true,
    bevelThickness: 0.075,
    bevelSize: 0.068,
    bevelSegments: 4,
    curveSegments: 64,
  });
  railGeo.rotateX(-Math.PI / 2);
  const railMesh = new THREE.Mesh(railGeo, railMaterial);
  railMesh.position.y = FELT_Y + 0.005;
  railMesh.castShadow = castShadow;
  railMesh.receiveShadow = true;
  group.add(railMesh);

  // 1b. Handcrafted Contrast Leather Piping Seam tracing the outer bolster crown
  const pipingPoints: THREE.Vector3[] = [];
  const pipeSegs = 96;
  for (let i = 0; i <= pipeSegs; i++) {
    const t = (i / pipeSegs) * Math.PI * 2;
    pipingPoints.push(
      new THREE.Vector3(Math.cos(t) * (TABLE_RX + 0.41), FELT_Y + 0.214, Math.sin(t) * (TABLE_RZ + 0.37))
    );
  }
  const pipingCurve = new THREE.CatmullRomCurve3(pipingPoints, true);
  const pipingGeo = new THREE.TubeGeometry(pipingCurve, 108, 0.009, 6, true);
  const pipingMesh = new THREE.Mesh(pipingGeo, stitchPipingMat);
  group.add(pipingMesh);

  // 2. Lacquered Mahogany Wood Racetrack (between leather bolster & felt bed)
  const woodShape = createOvalRingShape(
    TABLE_RX + 0.25,
    TABLE_RZ + 0.23,
    TABLE_RX - 0.12,
    TABLE_RZ - 0.1,
    96
  );
  const woodGeo = new THREE.ExtrudeGeometry(woodShape, {
    depth: 0.055,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 2,
    curveSegments: 64,
  });
  woodGeo.rotateX(-Math.PI / 2);
  const woodMesh = new THREE.Mesh(woodGeo, woodMaterial);
  woodMesh.position.y = FELT_Y - 0.005;
  woodMesh.receiveShadow = true;
  group.add(woodMesh);

  // 3. Inner Brushed-Brass Beveled Trim Ring (frames the recessed felt)
  const brassShape = createOvalRingShape(
    TABLE_RX - 0.1,
    TABLE_RZ - 0.08,
    TABLE_RX - 0.155,
    TABLE_RZ - 0.135,
    96
  );
  const brassGeo = new THREE.ExtrudeGeometry(brassShape, {
    depth: 0.032,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
    curveSegments: 64,
  });
  brassGeo.rotateX(-Math.PI / 2);
  const brassMesh = new THREE.Mesh(brassGeo, brassMaterial);
  brassMesh.position.y = FELT_Y - 0.002;
  brassMesh.receiveShadow = true;
  group.add(brassMesh);

  // 3b. Recessed Warm Champagne LED Cove Diffuser Strip tucked under the inner brass lip
  const covePoints: THREE.Vector3[] = [];
  for (let i = 0; i <= pipeSegs; i++) {
    const t = (i / pipeSegs) * Math.PI * 2;
    covePoints.push(
      new THREE.Vector3(Math.cos(t) * (TABLE_RX - 0.162), FELT_Y + 0.012, Math.sin(t) * (TABLE_RZ - 0.142))
    );
  }
  const coveCurve = new THREE.CatmullRomCurve3(covePoints, true);
  const coveGeo = new THREE.TubeGeometry(coveCurve, 108, 0.007, 6, true);
  const coveMesh = new THREE.Mesh(coveGeo, ledCoveMat);
  coveMesh.name = 'UnderRailLedCove';
  group.add(coveMesh);

  // 4. Recessed Speed-Cloth Casino Baize Bed (exact 1:1 normalized UVs, cleanly above under-deck)
  const feltBaseShape = createOvalShape(TABLE_RX - 0.1, TABLE_RZ - 0.08, 96);
  const feltBaseGeo = new THREE.ExtrudeGeometry(feltBaseShape, {
    depth: 0.08,
    bevelEnabled: false,
  });
  feltBaseGeo.rotateX(-Math.PI / 2);
  const feltBaseMesh = new THREE.Mesh(feltBaseGeo, darkRecessMaterial);
  feltBaseMesh.position.y = FELT_Y - 0.095;
  group.add(feltBaseMesh);

  const feltTopGeo = createNormalizedOvalFeltGeometry(TABLE_RX - 0.12, TABLE_RZ - 0.1, 96);
  const feltTopMesh = new THREE.Mesh(feltTopGeo, feltMaterial);
  feltTopMesh.position.y = FELT_Y;
  feltTopMesh.receiveShadow = true;
  group.add(feltTopMesh);

  // 5. 6 Recessed Brushed-Brass Cup Holders inlaid into the mahogany wood racetrack (clear of dealer bay & plaques)
  const cupAngles = [
    Math.PI * 0.615, // Hero front-left (unobstructed from Hero POV)
    Math.PI * 0.78, // Seat 1
    Math.PI * 1.04, // Seat 2
    Math.PI * 1.63, // Seat 3
    Math.PI * 1.94, // Seat 4
    Math.PI * 0.22, // Seat 5
  ];
  const cupFlangeGeo = new THREE.TorusGeometry(0.098, 0.015, 10, 24);
  cupFlangeGeo.rotateX(Math.PI / 2);
  const cupWellGeo = new THREE.CylinderGeometry(0.086, 0.08, 0.036, 20);

  for (const ang of cupAngles) {
    const cx = Math.cos(ang) * (TABLE_RX + 0.055);
    const cz = Math.sin(ang) * (TABLE_RZ + 0.055);
    const holder = new THREE.Group();
    const flange = new THREE.Mesh(cupFlangeGeo, brassMaterial);
    flange.position.y = FELT_Y + 0.062;
    holder.add(flange);

    const well = new THREE.Mesh(cupWellGeo, darkRecessMaterial);
    well.position.y = FELT_Y + 0.048;
    holder.add(well);

    holder.position.set(cx, 0, cz);
    group.add(holder);
  }

  // 6. Casino Dealer Chip Bank Tray + Brass Drop Slot + Stacked Deck tucked in dedicated far-left dealer bay
  const trayGroup = new THREE.Group();
  trayGroup.name = 'DealerChipTray';
  const trayBody = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.044, 0.3), darkRecessMaterial);
  trayBody.position.y = FELT_Y + 0.044;
  trayGroup.add(trayBody);

  const trayRim = new THREE.Mesh(new THREE.BoxGeometry(0.99, 0.016, 0.34), brassMaterial);
  trayRim.position.y = FELT_Y + 0.062;
  trayGroup.add(trayRim);

  // 4 horizontal racked casino chip tubes inside the dealer bank tray
  const tubeColors = [0x0d7a55, 0x1d2432, 0x6d28d9, 0xd97706];
  const tubeGeo = new THREE.CylinderGeometry(0.048, 0.048, 0.22, 16);
  tubeGeo.rotateX(Math.PI / 2);
  for (let t = 0; t < 4; t++) {
    const tubeMat = new THREE.MeshStandardMaterial({
      color: tubeColors[t],
      roughness: 0.45,
      metalness: 0.12,
      envMapIntensity: 0.35,
    });
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    tube.position.set(-0.3 + t * 0.2, FELT_Y + 0.072, 0);
    trayGroup.add(tube);
  }
  // Brass cash drop-box slot beside the tray
  const dropSlot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.045), brassMaterial);
  dropSlot.position.set(0.62, FELT_Y + 0.064, 0.01);
  trayGroup.add(dropSlot);

  // Compute exact tangent angle along far-left oval racetrack (angle = 1.33 * PI, midway between BB and UTG)
  const trayAng = Math.PI * 1.33;
  const trayRx = TABLE_RX + 0.04;
  const trayRz = TABLE_RZ + 0.04;
  const tx = Math.cos(trayAng) * trayRx;
  const tz = Math.sin(trayAng) * trayRz;
  const dxdt = -Math.sin(trayAng) * trayRx;
  const dzdt = Math.cos(trayAng) * trayRz;
  trayGroup.position.set(tx, 0, tz);
  trayGroup.rotation.y = Math.atan2(-dzdt, dxdt);
  group.add(trayGroup);

  // 7. Architectural Lower Mahogany Skirt (top face at FELT_Y - 0.06 so zero Z-fighting with felt!)
  const skirtShape = createOvalShape(TABLE_RX + 0.4, TABLE_RZ + 0.36, 64);
  const skirtGeo = new THREE.ExtrudeGeometry(skirtShape, {
    depth: 0.16,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  skirtGeo.rotateX(-Math.PI / 2);
  const skirtMesh = new THREE.Mesh(skirtGeo, skirtMaterial);
  skirtMesh.position.y = FELT_Y - 0.24;
  skirtMesh.castShadow = castShadow;
  skirtMesh.receiveShadow = true;
  group.add(skirtMesh);

  // 8. Dual Sculpted Pedestal Columns (LatheGeometry) + Brass Foot Collars
  const lathePoints = [
    new THREE.Vector2(0.01, 0.0),
    new THREE.Vector2(0.6, 0.0),
    new THREE.Vector2(0.56, 0.09),
    new THREE.Vector2(0.34, 0.18),
    new THREE.Vector2(0.26, 0.46),
    new THREE.Vector2(0.38, 0.68),
    new THREE.Vector2(0.01, 0.68),
  ];
  const pedGeo = new THREE.LatheGeometry(lathePoints, 28);
  const collarGeo = new THREE.TorusGeometry(0.45, 0.028, 12, 32);
  collarGeo.rotateX(Math.PI / 2);

  for (const px of [-1.48, 1.48]) {
    const col = new THREE.Mesh(pedGeo, skirtMaterial);
    col.position.set(px, 0, 0);
    col.castShadow = castShadow;
    col.receiveShadow = true;
    group.add(col);

    const collar = new THREE.Mesh(collarGeo, brassMaterial);
    collar.position.set(px, 0.095, 0);
    group.add(collar);
  }

  // 9. Brushed-Brass Casino Footrest Rail & Floor Plinth Beam
  const beamGeo = new THREE.BoxGeometry(2.9, 0.09, 0.38);
  const beamMesh = new THREE.Mesh(beamGeo, skirtMaterial);
  beamMesh.position.set(0, 0.045, 0);
  beamMesh.receiveShadow = true;
  group.add(beamMesh);

  const footRailGeo = new THREE.CylinderGeometry(0.024, 0.024, 2.75, 14);
  footRailGeo.rotateZ(Math.PI / 2);
  const footRail = new THREE.Mesh(footRailGeo, brassMaterial);
  footRail.position.set(0, 0.14, 0.42);
  group.add(footRail);

  // 10. Soft Radial Floor Contact Shadow
  const shadowMat = new THREE.MeshBasicMaterial({
    map: contactShadowTex,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
  });
  const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(9.4, 5.8), shadowMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.004;
  group.add(shadowPlane);

  const currentTextures = { ...feltTextures };

  const updateFeltTheme = (theme: FeltThemeId, aniso: number) => {
    const next = createFeltTextures(theme, aniso);
    currentTextures.map.dispose();
    currentTextures.bumpMap.dispose();
    currentTextures.map = next.map;
    currentTextures.bumpMap = next.bumpMap;
    feltMaterial.map = next.map;
    feltMaterial.bumpMap = next.bumpMap;
    feltMaterial.needsUpdate = true;
  };

  return { group, feltMaterial, feltTextures: currentTextures, updateFeltTheme };
}

/**
 * Grand Monte-Carlo High-Roller Salon Privé architecture:
 * - 10 fluted dark-mahogany pilasters with Art-Deco gilded capitals & warm alabaster sconces
 * - Tufted emerald-obsidian velvet wall panels framed by brushed-brass moldings
 * - Sculptural multi-tiered Art-Deco brass & crystal chandelier overhead
 * - Subtle additive volumetric spotlight cone descending onto the poker felt
 */
export function createCasinoSalonBackdropGroup(maxAnisotropy = 4): THREE.Group {
  const group = new THREE.Group();
  group.name = 'CasinoSalonBackdrop';

  const velvetTex = createVelvetPanelTexture(maxAnisotropy);

  const pilasterMat = new THREE.MeshStandardMaterial({
    color: 0x1b110d,
    roughness: 0.56,
    metalness: 0.1,
    envMapIntensity: 0.24,
  });

  const sconceGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfff0cc,
    emissive: 0xffbe5c,
    emissiveIntensity: 1.55,
    roughness: 0.2,
    metalness: 0.0,
  });

  const brassTrimMat = new THREE.MeshPhysicalMaterial({
    color: 0xd4a94f,
    roughness: 0.26,
    metalness: 0.9,
    anisotropy: 0.65,
    envMapIntensity: 0.82,
  });

  const crystalDropMat = new THREE.MeshPhysicalMaterial({
    color: 0xfff6e0,
    emissive: 0xffcf7a,
    emissiveIntensity: 0.72,
    roughness: 0.08,
    metalness: 0.1,
    clearcoat: 1.0,
    envMapIntensity: 1.15,
  });

  const pilasterGeo = new THREE.BoxGeometry(0.68, 6.4, 0.42);
  const capitalGeo = new THREE.BoxGeometry(0.86, 0.22, 0.54);
  const plinthGeo = new THREE.BoxGeometry(0.84, 0.45, 0.52);
  const sconceTubeGeo = new THREE.CylinderGeometry(0.08, 0.06, 0.96, 12);
  const capGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.05, 12);

  // 10 architectural mahogany pilasters arranged around intimate salon perimeter (r = 12.2)
  const count = 10;
  const radius = 12.2;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.PI / 10;
    const colGroup = new THREE.Group();
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    const col = new THREE.Mesh(pilasterGeo, pilasterMat);
    col.position.y = 3.2;
    colGroup.add(col);

    // Architectural base plinth + gilded capital
    const plinth = new THREE.Mesh(plinthGeo, pilasterMat);
    plinth.position.y = 0.225;
    colGroup.add(plinth);

    const capital = new THREE.Mesh(capitalGeo, brassTrimMat);
    capital.position.y = 5.45;
    colGroup.add(capital);

    // Fluted brass accent strips along pilaster face
    const flute = new THREE.Mesh(new THREE.BoxGeometry(0.05, 4.6, 0.03), brassTrimMat);
    flute.position.set(-0.22, 2.9, 0.22);
    colGroup.add(flute);
    const fluteR = flute.clone();
    fluteR.position.x = 0.22;
    colGroup.add(fluteR);

    // Warm Art-Deco alabaster wall sconce framed in mid-background
    const sconce = new THREE.Mesh(sconceTubeGeo, sconceGlowMat);
    sconce.position.set(0, 2.15, 0.28);
    colGroup.add(sconce);

    const topCap = new THREE.Mesh(capGeo, brassTrimMat);
    topCap.position.set(0, 2.66, 0.28);
    colGroup.add(topCap);

    const botCap = new THREE.Mesh(capGeo, brassTrimMat);
    botCap.position.set(0, 1.64, 0.28);
    colGroup.add(botCap);

    colGroup.position.set(x, 0, z);
    colGroup.lookAt(0, 0, 0);
    group.add(colGroup);
  }

  // Tufted acoustic emerald-obsidian velvet wall cylinder wrapping the private salon
  const wallRing = new THREE.Mesh(
    new THREE.CylinderGeometry(12.6, 12.6, 6.6, 48, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: velvetTex,
      roughness: 0.9,
      metalness: 0.04,
      side: THREE.BackSide,
      envMapIntensity: 0.14,
    })
  );
  wallRing.position.y = 3.3;
  group.add(wallRing);

  // Double brushed-brass wainscot & frieze chair-rail moldings
  const molding = new THREE.Mesh(new THREE.TorusGeometry(12.42, 0.032, 8, 56), brassTrimMat);
  molding.rotation.x = Math.PI / 2;
  molding.position.y = 1.28;
  group.add(molding);

  const upperFrieze = new THREE.Mesh(new THREE.TorusGeometry(12.42, 0.042, 8, 56), brassTrimMat);
  upperFrieze.rotation.x = Math.PI / 2;
  upperFrieze.position.y = 4.55;
  group.add(upperFrieze);

  // Grand Suspended Art-Deco Monte-Carlo Brass & Crystal Chandelier (y = 4.65)
  const chandGroup = new THREE.Group();
  chandGroup.name = 'ArtDecoSalonChandelier';

  // Dual vertical brass suspension rods
  const rodGeo = new THREE.CylinderGeometry(0.025, 0.025, 2.2, 10);
  for (const rx of [-1.2, 1.2]) {
    const rod = new THREE.Mesh(rodGeo, brassTrimMat);
    rod.position.set(rx, 1.15, 0);
    chandGroup.add(rod);
  }

  // Outer sculpted oval bronze crown & brushed-brass beveled trim rings
  const outerHalo = new THREE.Mesh(
    new THREE.ExtrudeGeometry(createOvalRingShape(1.92, 0.68, 1.72, 0.52, 48), {
      depth: 0.16,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 2,
    }).rotateX(-Math.PI / 2),
    pilasterMat
  );
  chandGroup.add(outerHalo);

  const brassBand = new THREE.Mesh(
    new THREE.ExtrudeGeometry(createOvalRingShape(1.96, 0.72, 1.88, 0.64, 48), {
      depth: 0.045,
      bevelEnabled: false,
    }).rotateX(-Math.PI / 2),
    brassTrimMat
  );
  brassBand.position.y = 0.02;
  chandGroup.add(brassBand);

  // Glowing frosted warm-crystal light diffuser core
  const diffuser = new THREE.Mesh(
    new THREE.ShapeGeometry(createOvalShape(1.74, 0.54, 40)).rotateX(Math.PI / 2),
    sconceGlowMat
  );
  diffuser.position.y = -0.01;
  chandGroup.add(diffuser);

  // 16 suspended shimmering Art-Deco crystal prism drops around the chandelier perimeter
  const prismGeo = new THREE.OctahedronGeometry(0.055, 0);
  prismGeo.scale(0.65, 2.1, 0.65);
  for (let p = 0; p < 16; p++) {
    const a = (p / 16) * Math.PI * 2;
    const prism = new THREE.Mesh(prismGeo, crystalDropMat);
    prism.position.set(Math.cos(a) * 1.82, -0.14, Math.sin(a) * 0.6);
    chandGroup.add(prism);
  }

  // Subtle volumetric chandelier light cone cascading onto the poker table (soft radial Fresnel shader)
  const coneGeo = new THREE.CylinderGeometry(1.42, 3.45, 2.95, 40, 1, true);
  const coneMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(0xffd28a) },
      uOpacity: { value: 0.075 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPos = viewMatrix * worldPos;
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        float verticalFade = smoothstep(0.0, 0.42, vUv.y) * smoothstep(1.0, 0.82, vUv.y);
        float facing = abs(dot(normalize(vNormal), normalize(vViewDir)));
        float edgeSoft = pow(facing, 1.65);
        float alpha = verticalFade * edgeSoft * uOpacity;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });
  const volCone = new THREE.Mesh(coneGeo, coneMat);
  volCone.position.y = -1.52;
  volCone.scale.set(1.0, 1.0, 0.62); // Elliptical light shaft matching the oval table
  volCone.name = 'VolumetricChandelierCone';
  chandGroup.add(volCone);

  chandGroup.position.set(0, 3.85, 0);
  group.add(chandGroup);

  return group;
}

/**
 * 5 Sculpted Executive Espresso-Leather Casino Poker Chairs framing the opponent seats
 * (Hero seat stays open so Hero POV is 100% unobstructed, matching AAA first-person poker tables).
 */
export function createCasinoChairsGroup(
  contactShadowTex: THREE.CanvasTexture,
  castShadow: boolean
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'ExecutiveCasinoChairs';

  const leatherMat = new THREE.MeshPhysicalMaterial({
    color: 0x1a1312,
    roughness: 0.44,
    metalness: 0.04,
    clearcoat: 0.22,
    clearcoatRoughness: 0.48,
    envMapIntensity: 0.45,
  });

  const woodShellMat = new THREE.MeshPhysicalMaterial({
    color: 0x32170e,
    roughness: 0.28,
    metalness: 0.05,
    clearcoat: 0.72,
    clearcoatRoughness: 0.18,
    envMapIntensity: 0.55,
  });

  const brassMat = new THREE.MeshPhysicalMaterial({
    color: 0xcfa54f,
    roughness: 0.25,
    metalness: 0.9,
    anisotropy: 0.65,
    envMapIntensity: 0.82,
  });

  const shadowMat = new THREE.MeshBasicMaterial({
    map: contactShadowTex,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
  });

  const casterMat = new THREE.MeshStandardMaterial({
    color: 0x0d0d10,
    roughness: 0.72,
    metalness: 0.18,
  });

  // Sculpted curved-arch executive backrest profile (rounded top silhouette instead of boxy cube)
  const archShape = new THREE.Shape();
  archShape.moveTo(-0.27, -0.25);
  archShape.lineTo(0.27, -0.25);
  archShape.quadraticCurveTo(0.31, -0.25, 0.31, -0.18);
  archShape.lineTo(0.29, 0.16);
  archShape.quadraticCurveTo(0.27, 0.31, 0.0, 0.33);
  archShape.quadraticCurveTo(-0.27, 0.31, -0.29, 0.16);
  archShape.lineTo(-0.31, -0.18);
  archShape.quadraticCurveTo(-0.31, -0.25, -0.27, -0.25);

  const backrestGeo = new THREE.ExtrudeGeometry(archShape, {
    depth: 0.075,
    bevelEnabled: true,
    bevelThickness: 0.032,
    bevelSize: 0.026,
    bevelSegments: 4,
    curveSegments: 20,
  });
  backrestGeo.center();

  const backShellGeo = new THREE.ExtrudeGeometry(archShape, {
    depth: 0.028,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.016,
    bevelSegments: 3,
    curveSegments: 20,
  });
  backShellGeo.center();

  // Rounded swept armrest capsule geometry
  const armShape = createRoundedRectShape(0.068, 0.42, 0.032);
  const armGeo = new THREE.ExtrudeGeometry(armShape, {
    depth: 0.032,
    bevelEnabled: true,
    bevelThickness: 0.014,
    bevelSize: 0.012,
    bevelSegments: 3,
    curveSegments: 10,
  });
  armGeo.rotateX(-Math.PI / 2);
  armGeo.center();

  // Shared tapered swivel base & caster geometries
  const stemGeo = new THREE.CylinderGeometry(0.048, 0.068, 0.42, 16);
  const legGeo = new THREE.CylinderGeometry(0.018, 0.028, 0.36, 10);
  legGeo.rotateZ(Math.PI / 2);
  const casterGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.028, 12);
  casterGeo.rotateX(Math.PI / 2);
  const seatCushionGeo = new THREE.CylinderGeometry(0.34, 0.31, 0.1, 24);
  const topBrassArchGeo = new THREE.TorusGeometry(0.18, 0.012, 8, 20, Math.PI);
  const armPostGeo = new THREE.CylinderGeometry(0.018, 0.022, 0.22, 10);
  const shadowGeo = new THREE.PlaneGeometry(1.22, 1.22);

  // Place sculpted chairs behind opponent seats 1..5 facing the table center (cleanly behind plaques)
  for (let i = 1; i < SEAT_ANCHORS_3D.length; i++) {
    const anchor = SEAT_ANCHORS_3D[i];
    const chair = new THREE.Group();

    // Generous radial outward setback beyond the outer leather rail so plaques stay 100% clear
    const dist = Math.hypot(anchor.x, anchor.z);
    const nx = anchor.x / dist;
    const nz = anchor.z / dist;
    const cx = anchor.x + nx * 1.34;
    const cz = anchor.z + nz * 1.3;

    // 5-star tapered brass swivel base with dark casino caster wheels
    for (let s = 0; s < 5; s++) {
      const sa = (s / 5) * Math.PI * 2;
      const leg = new THREE.Mesh(legGeo, brassMat);
      leg.position.set(Math.cos(sa) * 0.19, 0.065, Math.sin(sa) * 0.19);
      leg.rotation.y = -sa;
      leg.rotation.z = -0.14;
      chair.add(leg);

      const wheel = new THREE.Mesh(casterGeo, casterMat);
      wheel.position.set(Math.cos(sa) * 0.35, 0.028, Math.sin(sa) * 0.35);
      wheel.rotation.y = -sa;
      chair.add(wheel);
    }

    // Brass hydraulic column
    const stem = new THREE.Mesh(stemGeo, brassMat);
    stem.position.y = 0.26;
    chair.add(stem);

    // Padded contoured oval seat cushion
    const cushion = new THREE.Mesh(seatCushionGeo, leatherMat);
    cushion.position.y = 0.49;
    cushion.scale.set(1.04, 1.0, 0.94);
    cushion.castShadow = castShadow;
    cushion.receiveShadow = true;
    chair.add(cushion);

    // Curved-arch beveled executive backrest tilted ergonomically back
    const backGroup = new THREE.Group();
    const backPad = new THREE.Mesh(backrestGeo, leatherMat);
    backPad.castShadow = castShadow;
    backPad.receiveShadow = true;
    backGroup.add(backPad);

    const backShell = new THREE.Mesh(backShellGeo, woodShellMat);
    backShell.position.z = -0.056;
    backShell.scale.set(1.03, 1.02, 1.0);
    backGroup.add(backShell);

    const crownHandle = new THREE.Mesh(topBrassArchGeo, brassMat);
    crownHandle.position.set(0, 0.17, -0.072);
    backGroup.add(crownHandle);

    backGroup.position.set(0, 0.81, -0.3);
    backGroup.rotation.x = -0.16;
    chair.add(backGroup);

    // Left & right swept rounded-cap armrests
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(armGeo, leatherMat);
      arm.position.set(side * 0.34, 0.71, -0.03);
      chair.add(arm);

      const post = new THREE.Mesh(armPostGeo, brassMat);
      post.position.set(side * 0.34, 0.59, 0.09);
      post.rotation.x = 0.12;
      chair.add(post);
    }

    // Grounded contact shadow disc
    const sh = new THREE.Mesh(shadowGeo, shadowMat);
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.005;
    chair.add(sh);

    chair.position.set(cx, 0, cz);
    chair.lookAt(0, 0, 0);
    group.add(chair);
  }

  return group;
}

/**
 * Floating warm golden chandelier dust motes suspended in the overhead spotlight cone
 */
export function createChandelierDustMotes(): THREE.Points {
  const count = 72;
  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const angle = (i * 2.39996) % (Math.PI * 2);
    const radius = 0.35 + ((i * 37) % 100) / 100 * 2.55;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = FELT_Y + 0.35 + ((i * 53) % 100) / 100 * 3.1;
    positions[i * 3 + 2] = Math.sin(angle) * radius * 0.58;
    phases[i] = (i * 0.618) * Math.PI * 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

  const tex = createBokehParticleTexture();
  const mat = new THREE.PointsMaterial({
    map: tex,
    color: 0xffe2a8,
    size: 0.055,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geo, mat);
  points.name = 'ChandelierDustMotes';
  return points;
}

/**
 * Custom GLSL felt turn/winner aura ring (soft breathing radial glow with zero Z-fighting)
 */
export function createTurnHaloMesh(colorHex: number, radius = 0.62): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(radius * 2, radius * 2);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    uniforms: {
      uColor: { value: new THREE.Color(colorHex) },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float ring = smoothstep(0.98, 0.78, d) * smoothstep(0.56, 0.80, d);
        float innerGlow = smoothstep(0.74, 0.0, d) * 0.09;
        float breath = 0.86 + 0.14 * sin(uTime * 2.6);
        float alpha = (ring * 0.52 + innerGlow) * breath;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'ActiveSeatFeltHalo';
  return mesh;
}

/**
 * Composite 3-part Dealer Button Puck (beveled metallic rim + brushed ivory "D" cap + contact shadow)
 */
export function createDealerPuckGroup(contactShadowTex: THREE.CanvasTexture): THREE.Group {
  const group = new THREE.Group();
  group.name = 'DealerButtonPuck';

  const puckTex = createDealerPuckTexture();

  const rimGeo = new THREE.CylinderGeometry(0.145, 0.152, 0.036, 28);
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xd4b25c,
    roughness: 0.25,
    metalness: 0.85,
  });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.position.y = 0.018;
  group.add(rim);

  const faceGeo = new THREE.CylinderGeometry(0.132, 0.132, 0.008, 28);
  const faceMat = new THREE.MeshStandardMaterial({
    map: puckTex,
    roughness: 0.35,
    metalness: 0.12,
  });
  const face = new THREE.Mesh(faceGeo, faceMat);
  face.position.y = 0.038;
  group.add(face);

  const shMat = new THREE.MeshBasicMaterial({
    map: contactShadowTex,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
  });
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), shMat);
  sh.rotation.x = -Math.PI / 2;
  sh.position.y = 0.003;
  group.add(sh);

  return group;
}

/**
 * Toggleable ambient high-roller lounge props:
 * 1. Cut-crystal rocks tumbler with optical refraction (on GPU), amber single-malt whiskey & tilted ice cubes
 * 2. Heavy anisotropic brushed-gold spade-crest card-protector medallion beside Hero's hole cards
 * 3. Obsidian & brushed-brass casino lounge ashtray with hand-rolled cigar on the right racetrack
 */
export function createAmbientPropsGroup(
  contactShadowTex: THREE.CanvasTexture,
  isSoftwareGl = false
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'AmbientCasinoProps';

  // --- 1. Crystal Whiskey Tumbler seated inside Hero's unobstructed front-left brass cup holder (ang = 0.615 * PI) ---
  const heroCupAng = Math.PI * 0.615;
  const cupX = Math.cos(heroCupAng) * (TABLE_RX + 0.055);
  const cupZ = Math.sin(heroCupAng) * (TABLE_RZ + 0.055);

  const glassGroup = new THREE.Group();
  glassGroup.name = 'WhiskeyTumbler';

  // Heavy crystal base puck (fast single-pass clearcoat glass, no double-scene transmission pass!)
  const glassBaseMat = new THREE.MeshPhysicalMaterial({
    color: 0xeaf4ff,
    roughness: 0.06,
    metalness: 0.05,
    transparent: true,
    opacity: 0.76,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.25,
  });
  const glassWallMat = new THREE.MeshPhysicalMaterial({
    color: 0xf2f8ff,
    roughness: 0.05,
    metalness: 0.04,
    transparent: true,
    opacity: 0.24,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.35,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const baseDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.04, 24), glassBaseMat);
  baseDisc.position.y = 0.02;
  glassGroup.add(baseDisc);

  // Faceted crystal tumbler wall rising cleanly above the brass cup flange
  const wallMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.088, 0.076, 0.22, 16, 1, true),
    glassWallMat
  );
  wallMesh.position.y = 0.145;
  wallMesh.renderOrder = 2;
  glassGroup.add(wallMesh);

  // Polished glass lip ring
  const lipRing = new THREE.Mesh(new THREE.TorusGeometry(0.087, 0.006, 8, 24), glassBaseMat);
  lipRing.rotation.x = Math.PI / 2;
  lipRing.position.y = 0.255;
  glassGroup.add(lipRing);

  // Rich warm amber single-malt whiskey liquid body
  const whiskeyMat = new THREE.MeshPhysicalMaterial({
    color: 0x9a3d06,
    emissive: 0x451502,
    emissiveIntensity: 0.42,
    roughness: 0.1,
    metalness: 0.02,
    transparent: true,
    opacity: 0.94,
    clearcoat: 0.9,
    envMapIntensity: 0.95,
  });
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.072, 0.115, 20), whiskeyMat);
  liquid.position.y = 0.098;
  glassGroup.add(liquid);

  // Two softly tilted translucent crystal ice cubes floating near the whiskey surface
  const iceMat = new THREE.MeshPhysicalMaterial({
    color: 0xf0f8ff,
    roughness: 0.1,
    metalness: 0.02,
    transparent: true,
    opacity: 0.76,
    clearcoat: 0.95,
    envMapIntensity: 1.1,
  });
  const ice1 = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.044, 0.048), iceMat);
  ice1.position.set(-0.02, 0.138, 0.014);
  ice1.rotation.set(0.28, 0.55, 0.22);
  glassGroup.add(ice1);

  const ice2 = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.038, 0.042), iceMat);
  ice2.position.set(0.024, 0.132, -0.015);
  ice2.rotation.set(-0.24, 1.12, -0.3);
  glassGroup.add(ice2);

  glassGroup.position.set(cupX, FELT_Y + 0.042, cupZ);
  group.add(glassGroup);

  // --- 2. Heavy Anisotropic Brushed-Gold Card-Protector Medallion Coin beside Hero's Hole Cards ---
  const protectorGroup = new THREE.Group();
  protectorGroup.name = 'CardProtectorCoin';
  const coinTex = createCardProtectorTexture();

  const coinRimMat = new THREE.MeshPhysicalMaterial({
    color: 0xdfb450,
    roughness: 0.2,
    metalness: 0.94,
    anisotropy: 0.78,
    clearcoat: 0.35,
    envMapIntensity: 1.05,
  });
  const coinFaceMat = new THREE.MeshPhysicalMaterial({
    map: coinTex,
    roughness: 0.24,
    metalness: 0.68,
    clearcoat: 0.3,
    envMapIntensity: 0.88,
  });

  const coinRim = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.12, 0.028, 32), coinRimMat);
  coinRim.position.y = 0.014;
  protectorGroup.add(coinRim);

  const coinTop = new THREE.Mesh(new THREE.CylinderGeometry(0.108, 0.108, 0.006, 32), coinFaceMat);
  coinTop.position.y = 0.03;
  protectorGroup.add(coinTop);

  const coinShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.32, 0.32),
    new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    })
  );
  coinShadow.rotation.x = -Math.PI / 2;
  coinShadow.position.y = 0.002;
  protectorGroup.add(coinShadow);

  // Positioned cleanly to Hero's right of hole cards (cards are at x = ±0.24, chips at -0.68)
  protectorGroup.position.set(0.64, FELT_Y + 0.002, 1.24);
  protectorGroup.rotation.y = -0.18;
  group.add(protectorGroup);

  // --- 3. Luxury Obsidian & Brass High-Roller Cigar Rest on Far-Right Racetrack ---
  const cigarGroup = new THREE.Group();
  cigarGroup.name = 'HighRollerCigarRest';
  const obsidianMat = new THREE.MeshPhysicalMaterial({
    color: 0x101318,
    roughness: 0.16,
    metalness: 0.08,
    clearcoat: 0.9,
    clearcoatRoughness: 0.12,
    envMapIntensity: 0.85,
  });
  const trayBase = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.032, 0.18), obsidianMat);
  trayBase.position.y = 0.016;
  cigarGroup.add(trayBase);

  const trayBrassFrame = new THREE.Mesh(new THREE.BoxGeometry(0.252, 0.014, 0.192), coinRimMat);
  trayBrassFrame.position.y = 0.008;
  cigarGroup.add(trayBrassFrame);

  // Hand-rolled dark-maduro cigar with gold band & subtle glowing ember tip
  const cigarBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.017, 0.018, 0.24, 14),
    new THREE.MeshStandardMaterial({ color: 0x3f2314, roughness: 0.82, metalness: 0.0 })
  );
  cigarBody.rotation.z = Math.PI / 2;
  cigarBody.position.set(0.01, 0.044, 0);
  cigarGroup.add(cigarBody);

  const cigarBand = new THREE.Mesh(new THREE.CylinderGeometry(0.0185, 0.0185, 0.032, 14), coinRimMat);
  cigarBand.rotation.z = Math.PI / 2;
  cigarBand.position.set(-0.04, 0.044, 0);
  cigarGroup.add(cigarBand);

  const ember = new THREE.Mesh(
    new THREE.SphereGeometry(0.016, 10, 10),
    new THREE.MeshStandardMaterial({
      color: 0xff6b2b,
      emissive: 0xff4500,
      emissiveIntensity: 1.8,
      roughness: 0.9,
    })
  );
  ember.position.set(0.13, 0.044, 0);
  cigarGroup.add(ember);

  const restAng = Math.PI * 0.12;
  cigarGroup.position.set(
    Math.cos(restAng) * (TABLE_RX + 0.06),
    FELT_Y + 0.056,
    Math.sin(restAng) * (TABLE_RZ + 0.06)
  );
  cigarGroup.rotation.y = -0.58;
  group.add(cigarGroup);

  return group;
}

function createRoundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const hw = w / 2;
  const hh = h / 2;
  const s = new THREE.Shape();
  s.moveTo(-hw + r, -hh);
  s.lineTo(hw - r, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + r);
  s.lineTo(hw, hh - r);
  s.quadraticCurveTo(hw, hh, hw - r, hh);
  s.lineTo(-hw + r, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - r);
  s.lineTo(-hw, -hh + r);
  s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return s;
}

function createNormalizedRoundedCardFaceGeo(w: number, h: number, r: number, flipNormal = false): THREE.ShapeGeometry {
  const shape = createRoundedRectShape(w, h, r);
  const geo = new THREE.ShapeGeometry(shape, 8);
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    uv[i * 2] = (x + w / 2) / w;
    uv[i * 2 + 1] = (y + h / 2) / h;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.rotateX(flipNormal ? Math.PI / 2 : -Math.PI / 2);
  return geo;
}

/**
 * Sculpted rounded-corner beveled 3D Playing Card mesh with high-DPI Kem/Copag cardstock,
 * gilded court/Ace details, ornate guilloché back, and grounded felt contact shadow.
 */
export function createPlayingCardGroup(
  card: Card,
  faceUp: boolean,
  fourColor: boolean,
  cardBackTex: THREE.CanvasTexture,
  contactShadowTex: THREE.CanvasTexture,
  scale = 1
): THREE.Group {
  const group = new THREE.Group();
  const w = 0.36 * scale;
  const h = 0.51 * scale;
  const r = 0.03 * scale;
  const thickness = 0.0085;

  const frontTex = createCardFaceTexture(card, fourColor);

  // Rounded-corner extruded cardstock core
  const bodyShape = createRoundedRectShape(w, h, r);
  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.0014,
    bevelSize: 0.0014,
    bevelSegments: 2,
    curveSegments: 8,
  });
  bodyGeo.rotateX(-Math.PI / 2);
  const edgeMat = new THREE.MeshStandardMaterial({
    color: 0xbcb3a0,
    roughness: 0.86,
    metalness: 0.0,
    envMapIntensity: 0.04,
  });
  const bodyMesh = new THREE.Mesh(bodyGeo, edgeMat);
  bodyMesh.position.y = 0.0014;
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  group.add(bodyMesh);

  // Top printed face (calibrated matte cardstock so cards never blow out under overhead spotlight)
  const topGeo = createNormalizedRoundedCardFaceGeo(w * 0.992, h * 0.992, r * 0.96, false);
  const topMat = new THREE.MeshStandardMaterial({
    color: 0xe6dfd0,
    map: faceUp ? frontTex : cardBackTex,
    roughness: 0.94,
    metalness: 0.0,
    envMapIntensity: 0.03,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const topFace = new THREE.Mesh(topGeo, topMat);
  topFace.position.y = thickness + 0.0031;
  topFace.receiveShadow = true;
  group.add(topFace);

  // Underside printed face (visible when peeking or during airborne flip-deal arc)
  const botGeo = createNormalizedRoundedCardFaceGeo(w * 0.992, h * 0.992, r * 0.96, true);
  const botMat = new THREE.MeshStandardMaterial({
    color: 0xe6dfd0,
    map: faceUp ? cardBackTex : frontTex,
    roughness: 0.88,
    metalness: 0.0,
    envMapIntensity: 0.04,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const botFace = new THREE.Mesh(botGeo, botMat);
  botFace.position.y = 0.0005;
  group.add(botFace);

  const shMat = new THREE.MeshBasicMaterial({
    map: contactShadowTex,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
  });
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.32, h * 1.24), shMat);
  sh.rotation.x = -Math.PI / 2;
  sh.position.y = 0.002;
  group.add(sh);

  return group;
}

export interface ChipStackSpec {
  x: number;
  z: number;
  chips: number;
  colorHex: number;
}

/**
 * Instanced Paulson-style clay poker chip stacks with contrasting striped cylinder walls
 * and brushed cream casino inlays (only 2 InstancedMesh draw calls for the entire table!).
 */
export function createChipStacksGroup(
  stacks: ChipStackSpec[],
  contactShadowTex: THREE.CanvasTexture
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'InstancedCasinoChipStacks';

  const totalChips = stacks.reduce((sum, s) => sum + Math.max(0, s.chips), 0);
  if (totalChips === 0) return group;

  const chipRadius = 0.095;
  const chipHeight = 0.023;
  const chipSideTex = createChipSideTexture();
  const chipTopTex = createChipTopTexture();

  const bodyGeo = new THREE.CylinderGeometry(chipRadius, chipRadius, chipHeight, 24, 1, true);
  const bodyMat = new THREE.MeshStandardMaterial({
    map: chipSideTex,
    roughness: 0.56,
    metalness: 0.06,
    envMapIntensity: 0.28,
  });

  const capGeo = new THREE.CylinderGeometry(chipRadius * 0.99, chipRadius * 0.99, 0.004, 24);
  const capMat = new THREE.MeshStandardMaterial({
    map: chipTopTex,
    roughness: 0.54,
    metalness: 0.06,
    envMapIntensity: 0.26,
  });

  const bodyInst = new THREE.InstancedMesh(bodyGeo, bodyMat, totalChips);
  const capInst = new THREE.InstancedMesh(capGeo, capMat, totalChips);
  bodyInst.castShadow = true;
  bodyInst.receiveShadow = true;
  bodyInst.frustumCulled = false;
  capInst.frustumCulled = false;

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const capColor = new THREE.Color();

  let idx = 0;
  for (let sIdx = 0; sIdx < stacks.length; sIdx++) {
    const st = stacks[sIdx];
    if (st.chips <= 0) continue;

    const shMat = new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(chipRadius * 3.15, chipRadius * 3.15), shMat);
    sh.rotation.x = -Math.PI / 2;
    sh.position.set(st.x, FELT_Y + 0.002, st.z);
    group.add(sh);

    color.setHex(st.colorHex);
    capColor.setHex(st.colorHex).lerp(new THREE.Color(0xffffff), 0.22);

    for (let c = 0; c < st.chips; c++) {
      const jx = Math.sin((sIdx * 17 + c * 31) * 1.3) * 0.004;
      const jz = Math.cos((sIdx * 23 + c * 19) * 1.7) * 0.004;
      const yBase = FELT_Y + c * chipHeight;

      dummy.position.set(st.x + jx, yBase + chipHeight / 2, st.z + jz);
      dummy.rotation.set(0, ((sIdx + c) * 0.85) % Math.PI, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      bodyInst.setMatrixAt(idx, dummy.matrix);
      bodyInst.setColorAt(idx, color);

      dummy.position.set(st.x + jx, yBase + chipHeight + 0.001, st.z + jz);
      dummy.updateMatrix();
      capInst.setMatrixAt(idx, dummy.matrix);
      capInst.setColorAt(idx, capColor);

      idx++;
    }
  }

  bodyInst.instanceMatrix.needsUpdate = true;
  if (bodyInst.instanceColor) bodyInst.instanceColor.needsUpdate = true;
  capInst.instanceMatrix.needsUpdate = true;
  if (capInst.instanceColor) capInst.instanceColor.needsUpdate = true;

  group.add(bodyInst);
  group.add(capInst);

  return group;
}

export interface Seat3DSpec {
  seatIndex: number;
  position: Position;
  label: string;
  stackBb: number;
  isHero: boolean;
  isDealer: boolean;
  isActiveTurn: boolean;
  folded: boolean;
  isWinner?: boolean;
  streetBetBb?: number;
  actionText?: string;
  styleTag?: string;
  cards?: [Card, Card] | null;
  revealCards?: boolean;
}

// 6-max elliptical seat coordinates anchored along the outer leather rail
export const SEAT_ANCHORS_3D: { x: number; z: number; rotY: number }[] = [
  { x: 0, z: 2.02, rotY: 0 }, // 0: Hero (bottom center)
  { x: -2.68, z: 1.08, rotY: -Math.PI * 0.34 }, // 1: bottom-left
  { x: -2.68, z: -1.08, rotY: -Math.PI * 0.66 }, // 2: top-left
  { x: 0, z: -2.02, rotY: Math.PI }, // 3: top-center
  { x: 2.68, z: -1.08, rotY: Math.PI * 0.66 }, // 4: top-right
  { x: 2.68, z: 1.08, rotY: Math.PI * 0.34 }, // 5: bottom-right
];

export function getAnchorsForSeatCount(count: number): { x: number; z: number; rotY: number }[] {
  switch (count) {
    case 2:
      return [SEAT_ANCHORS_3D[0], SEAT_ANCHORS_3D[3]];
    case 3:
      return [SEAT_ANCHORS_3D[0], SEAT_ANCHORS_3D[2], SEAT_ANCHORS_3D[4]];
    case 4:
      return [SEAT_ANCHORS_3D[0], SEAT_ANCHORS_3D[1], SEAT_ANCHORS_3D[3], SEAT_ANCHORS_3D[5]];
    case 5:
      return [
        SEAT_ANCHORS_3D[0],
        SEAT_ANCHORS_3D[1],
        SEAT_ANCHORS_3D[2],
        SEAT_ANCHORS_3D[4],
        SEAT_ANCHORS_3D[5],
      ];
    default:
      return SEAT_ANCHORS_3D;
  }
}

/**
 * Luxury brass-trimmed obsidian casino seat nameplate mounted cleanly along the outer bolster
 */
export function createSeatPlaqueMesh(seat: Seat3DSpec): THREE.Group {
  const group = new THREE.Group();
  const tex = createSeatPlaqueTexture(
    seat.position,
    seat.label,
    seat.stackBb,
    seat.isHero,
    seat.isActiveTurn,
    seat.folded,
    seat.styleTag,
    seat.actionText,
    seat.isWinner
  );

  // Sleek tapered brushed-brass or emerald active-turn pedestal base sitting cleanly atop the leather rail
  const standMat = new THREE.MeshStandardMaterial({
    color: seat.isWinner ? 0xf59e0b : seat.isActiveTurn ? 0x10b981 : 0xb38a3b,
    roughness: 0.34,
    metalness: 0.78,
    envMapIntensity: 0.55,
  });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.022, 0.06), standMat);
  base.position.y = 0.011;
  group.add(base);

  // Anti-glare obsidian face plate
  const faceMat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.9,
    metalness: 0.0,
    envMapIntensity: 0.06,
  });
  const backMat = new THREE.MeshStandardMaterial({
    color: 0x17120f,
    roughness: 0.58,
    metalness: 0.25,
    envMapIntensity: 0.28,
  });
  const plateGeo = new THREE.BoxGeometry(0.68, 0.28, 0.024);
  const plate = new THREE.Mesh(plateGeo, [backMat, backMat, backMat, backMat, faceMat, backMat]);
  plate.position.set(0, 0.155, 0);
  plate.rotation.x = -0.24;
  group.add(plate);

  return group;
}
