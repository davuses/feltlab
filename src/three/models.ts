import * as THREE from 'three';
import type { Card, Position } from '../poker/types';
import {
  createCardBackTexture,
  createCardFaceTexture,
  createCardProtectorTexture,
  createChipSideTexture,
  createChipTopTexture,
  createDealerPuckTexture,
  createFeltTextures,
  createLeatherRailTextures,
  createMahoganyWoodTextures,
  createSeatPlaqueTexture,
  type FeltThemeId,
} from './textures';

export const FELT_Y = 0.84;
export const TABLE_RX = 3.05;
export const TABLE_RZ = 1.66;
export const DEALER_DECK_POS: [number, number, number] = [-1.12, FELT_Y + 0.038, -1.02];

function createOvalShape(rx: number, rz: number, segments = 72): THREE.Shape {
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
  segments = 72
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
function createNormalizedOvalFeltGeometry(rx: number, rz: number, segments = 72): THREE.ShapeGeometry {
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

  const brassMaterial = new THREE.MeshStandardMaterial({
    color: 0xd4ad56,
    roughness: 0.26,
    metalness: 0.88,
    envMapIntensity: 0.85,
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

  // 1. Plump Padded Outer Leather Armrest Bolster
  const railShape = createOvalRingShape(
    TABLE_RX + 0.62,
    TABLE_RZ + 0.56,
    TABLE_RX + 0.2,
    TABLE_RZ + 0.18,
    72
  );
  const railGeo = new THREE.ExtrudeGeometry(railShape, {
    depth: 0.13,
    bevelEnabled: true,
    bevelThickness: 0.075,
    bevelSize: 0.068,
    bevelSegments: 5,
    curveSegments: 48,
  });
  railGeo.rotateX(-Math.PI / 2);
  const railMesh = new THREE.Mesh(railGeo, railMaterial);
  railMesh.position.y = FELT_Y + 0.005;
  railMesh.castShadow = castShadow;
  railMesh.receiveShadow = true;
  group.add(railMesh);

  // 2. Lacquered Mahogany Wood Racetrack (between leather bolster & felt bed)
  const woodShape = createOvalRingShape(
    TABLE_RX + 0.25,
    TABLE_RZ + 0.23,
    TABLE_RX - 0.12,
    TABLE_RZ - 0.1,
    72
  );
  const woodGeo = new THREE.ExtrudeGeometry(woodShape, {
    depth: 0.055,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 3,
    curveSegments: 48,
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
    72
  );
  const brassGeo = new THREE.ExtrudeGeometry(brassShape, {
    depth: 0.032,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
  });
  brassGeo.rotateX(-Math.PI / 2);
  const brassMesh = new THREE.Mesh(brassGeo, brassMaterial);
  brassMesh.position.y = FELT_Y - 0.002;
  brassMesh.receiveShadow = true;
  group.add(brassMesh);

  // 4. Recessed Speed-Cloth Casino Baize Bed (exact 1:1 normalized UVs, cleanly above under-deck)
  const feltBaseShape = createOvalShape(TABLE_RX - 0.1, TABLE_RZ - 0.08, 72);
  const feltBaseGeo = new THREE.ExtrudeGeometry(feltBaseShape, {
    depth: 0.08,
    bevelEnabled: false,
  });
  feltBaseGeo.rotateX(-Math.PI / 2);
  const feltBaseMesh = new THREE.Mesh(feltBaseGeo, darkRecessMaterial);
  feltBaseMesh.position.y = FELT_Y - 0.095;
  group.add(feltBaseMesh);

  const feltTopGeo = createNormalizedOvalFeltGeometry(TABLE_RX - 0.12, TABLE_RZ - 0.1, 72);
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
 * Intimate high-roller casino salon perimeter cues (wood-clad pilasters & warm amber vertical sconces
 * softly veiled by warm room fog, plus a suspended overhead bronze chandelier light bar).
 */
export function createCasinoSalonBackdropGroup(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'CasinoSalonBackdrop';

  const pilasterMat = new THREE.MeshStandardMaterial({
    color: 0x160f0d,
    roughness: 0.65,
    metalness: 0.08,
    envMapIntensity: 0.18,
  });

  const sconceGlowMat = new THREE.MeshBasicMaterial({
    color: 0xf0be6c,
  });

  const brassTrimMat = new THREE.MeshStandardMaterial({
    color: 0xc59a46,
    roughness: 0.32,
    metalness: 0.85,
    envMapIntensity: 0.65,
  });

  const pilasterGeo = new THREE.BoxGeometry(0.62, 6.2, 0.35);
  const sconceGeo = new THREE.BoxGeometry(0.14, 0.92, 0.05);
  const capGeo = new THREE.BoxGeometry(0.24, 0.05, 0.1);

  // 10 architectural mahogany salon pilasters arranged softly around distant perimeter (r = 13.8)
  const count = 10;
  const radius = 13.8;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.PI / 10;
    const colGroup = new THREE.Group();
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    const col = new THREE.Mesh(pilasterGeo, pilasterMat);
    col.position.y = 3.1;
    colGroup.add(col);

    // Warm golden casino wall sconce framed cleanly in mid-background horizon
    const sconce = new THREE.Mesh(sconceGeo, sconceGlowMat);
    sconce.position.set(0, 2.05, 0.2);
    colGroup.add(sconce);

    const topCap = new THREE.Mesh(capGeo, brassTrimMat);
    topCap.position.set(0, 2.54, 0.21);
    colGroup.add(topCap);

    const botCap = new THREE.Mesh(capGeo, brassTrimMat);
    botCap.position.set(0, 1.56, 0.21);
    colGroup.add(botCap);

    colGroup.position.set(x, 0, z);
    colGroup.lookAt(0, 0, 0);
    group.add(colGroup);
  }

  // Subtle dark salon wainscoting ring tying the room together seamlessly into fog
  const wallRing = new THREE.Mesh(
    new THREE.CylinderGeometry(14.1, 14.1, 6.4, 40, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0x0e0a0d,
      roughness: 0.92,
      metalness: 0.02,
      side: THREE.BackSide,
      envMapIntensity: 0.08,
    })
  );
  wallRing.position.y = 3.2;
  group.add(wallRing);

  // Subtle brushed-brass chair-rail molding wrapping the distant salon wall
  const molding = new THREE.Mesh(new THREE.TorusGeometry(13.95, 0.03, 8, 48), brassTrimMat);
  molding.rotation.x = Math.PI / 2;
  molding.position.y = 1.25;
  group.add(molding);

  // Suspended bronze casino pendant light hood overhead (y = 5.4)
  const hoodGroup = new THREE.Group();
  const hood = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.18, 0.72), pilasterMat);
  hoodGroup.add(hood);
  const diffuser = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 0.54), sconceGlowMat);
  diffuser.rotation.x = Math.PI / 2;
  diffuser.position.y = -0.095;
  hoodGroup.add(diffuser);
  const rim = new THREE.Mesh(new THREE.BoxGeometry(3.26, 0.04, 0.78), brassTrimMat);
  rim.position.y = -0.08;
  hoodGroup.add(rim);
  hoodGroup.position.set(0, 5.4, 0);
  group.add(hoodGroup);

  return group;
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
 * 1. Cut-crystal rocks tumbler with amber single-malt whiskey & tilted ice cubes seated in Hero's brass cup holder
 * 2. Heavy brushed-gold spade-crest card-protector medallion resting beside Hero's hole cards
 */
export function createAmbientPropsGroup(contactShadowTex: THREE.CanvasTexture): THREE.Group {
  const group = new THREE.Group();
  group.name = 'AmbientCasinoProps';

  // --- 1. Crystal Whiskey Tumbler seated inside Hero's unobstructed front-left brass cup holder (ang = 0.615 * PI) ---
  const heroCupAng = Math.PI * 0.615;
  const cupX = Math.cos(heroCupAng) * (TABLE_RX + 0.055);
  const cupZ = Math.sin(heroCupAng) * (TABLE_RZ + 0.055);

  const glassGroup = new THREE.Group();
  glassGroup.name = 'WhiskeyTumbler';

  // Heavy optical-crystal base puck
  const glassBaseMat = new THREE.MeshPhysicalMaterial({
    color: 0xeef6ff,
    roughness: 0.08,
    metalness: 0.05,
    transparent: true,
    opacity: 0.78,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.2,
  });
  const glassWallMat = new THREE.MeshPhysicalMaterial({
    color: 0xf4f9ff,
    roughness: 0.05,
    metalness: 0.04,
    transparent: true,
    opacity: 0.22,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.25,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const baseDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.04, 20), glassBaseMat);
  baseDisc.position.y = 0.02;
  glassGroup.add(baseDisc);

  // Faceted crystal tumbler wall rising cleanly above the brass cup flange
  const wallMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.088, 0.076, 0.22, 16, 1, true),
    glassWallMat
  );
  wallMesh.position.y = 0.145;
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
    roughness: 0.12,
    metalness: 0.02,
    transparent: true,
    opacity: 0.94,
    clearcoat: 0.85,
    envMapIntensity: 0.9,
  });
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.072, 0.115, 20), whiskeyMat);
  liquid.position.y = 0.098;
  glassGroup.add(liquid);

  // Two softly tilted translucent crystal ice cubes floating near the whiskey surface
  const iceMat = new THREE.MeshPhysicalMaterial({
    color: 0xf0f8ff,
    roughness: 0.12,
    metalness: 0.02,
    transparent: true,
    opacity: 0.74,
    clearcoat: 0.92,
    envMapIntensity: 1.05,
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

  // --- 2. Heavy Brushed-Gold Card-Protector Medallion Coin beside Hero's Hole Cards ---
  const protectorGroup = new THREE.Group();
  protectorGroup.name = 'CardProtectorCoin';
  const coinTex = createCardProtectorTexture();

  const coinRimMat = new THREE.MeshStandardMaterial({
    color: 0xd9ae4c,
    roughness: 0.24,
    metalness: 0.9,
    envMapIntensity: 0.95,
  });
  const coinFaceMat = new THREE.MeshStandardMaterial({
    map: coinTex,
    roughness: 0.28,
    metalness: 0.62,
    envMapIntensity: 0.8,
  });

  const coinRim = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.12, 0.028, 28), coinRimMat);
  coinRim.position.y = 0.014;
  protectorGroup.add(coinRim);

  const coinTop = new THREE.Mesh(new THREE.CylinderGeometry(0.108, 0.108, 0.006, 28), coinFaceMat);
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

  return group;
}

/**
 * 3D Playing Card mesh with warm matte Kem/Copag cardstock, filigree back, and grounded shadow
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
  const thickness = 0.008;

  const frontTex = createCardFaceTexture(card, fourColor);
  const edgeMat = new THREE.MeshStandardMaterial({
    color: 0xd5d2c8,
    roughness: 0.82,
    metalness: 0.0,
    envMapIntensity: 0.1,
  });
  const topMat = new THREE.MeshStandardMaterial({
    map: faceUp ? frontTex : cardBackTex,
    roughness: 0.78,
    metalness: 0.0,
    envMapIntensity: 0.08,
  });
  const bottomMat = new THREE.MeshStandardMaterial({
    map: faceUp ? cardBackTex : frontTex,
    roughness: 0.78,
    metalness: 0.0,
    envMapIntensity: 0.08,
  });

  const geo = new THREE.BoxGeometry(w, thickness, h);
  const mesh = new THREE.Mesh(geo, [edgeMat, edgeMat, topMat, bottomMat, edgeMat, edgeMat]);
  mesh.position.y = thickness / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  const shMat = new THREE.MeshBasicMaterial({
    map: contactShadowTex,
    transparent: true,
    opacity: 0.46,
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
