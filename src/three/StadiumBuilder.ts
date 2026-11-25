import * as THREE from 'three';
import { TIER_CONFIGS, stadiumCurvePoint } from '../utils/stadiumLayout';

export interface StadiumArchitectureResult {
  group: THREE.Group;
  update: (elapsed: number, delta: number) => void;
  setEventBanner: (title: string, homeTeam: string, awayTeam: string) => void;
  dispose: () => void;
}

function createSoftGlowBeamTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, 'rgba(224, 242, 254, 0.24)');
  grad.addColorStop(0.5, 'rgba(96, 165, 250, 0.08)');
  grad.addColorStop(1, 'rgba(59, 130, 246, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createParticleSpriteTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(224, 242, 254, 1)');
  grad.addColorStop(0.35, 'rgba(96, 165, 250, 0.45)');
  grad.addColorStop(1, 'rgba(59, 130, 246, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function drawCricketScoreboardCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  title: string,
  homeTeam: string,
  awayTeam: string,
  elapsedSec: number,
) {
  ctx.fillStyle = '#050919';
  ctx.fillRect(0, 0, w, h);

  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, '#2563eb');
  grad.addColorStop(0.5, '#7c3aed');
  grad.addColorStop(1, '#06b6d4');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, 8);
  ctx.fillRect(0, h - 8, w, 8);

  ctx.fillStyle = '#93c5fd';
  ctx.font = 'bold 17px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title.toUpperCase().slice(0, 38), w / 2, 34);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(homeTeam.toUpperCase().slice(0, 16), 24, 86);

  ctx.textAlign = 'right';
  ctx.fillText(awayTeam.toUpperCase().slice(0, 16), w - 24, 86);

  // Live Cricket Match Preview Score & Countdown
  const secs = Math.max(0, 1200 - (elapsedSec % 1200));
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(w / 2 - 110, 102, 220, 48);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.strokeRect(w / 2 - 110, 102, 220, 48);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`FIRST BALL ${mm}:${ss}`, w / 2, 134);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '600 13px sans-serif';
  ctx.fillText('ARENAX CRICKET DOME  ·  360° PITCH SIGHTLINE VIEW', w / 2, h - 18);
}

function drawStaticRibbonCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  title: string,
) {
  ctx.fillStyle = '#060c21';
  ctx.fillRect(0, 0, w, h);

  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, '#1d4ed8');
  grad.addColorStop(0.35, '#7c3aed');
  grad.addColorStop(0.7, '#0284c7');
  grad.addColorStop(1, '#1d4ed8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, 5);
  ctx.fillRect(0, h - 5, w, 5);

  const text = `   ARENAX CRICKET   •   ${title.toUpperCase().slice(0, 30)}   •   PITCH VIEW READY   `;
  ctx.fillStyle = '#e0f2fe';
  ctx.font = 'bold 26px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 24, h / 2);
}

export function buildStadiumArchitecture(maxAnisotropy: number): StadiumArchitectureResult {
  const group = new THREE.Group();
  group.name = 'CricketStadiumArchitecture';
  const disposables: Array<{ dispose: () => void }> = [];

  // 1. Arena Base Ground Slab
  const floorGeo = new THREE.CylinderGeometry(118, 118, 0.5, 64);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x050814, roughness: 0.85, metalness: 0.1 });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.position.y = -0.35;
  floorMesh.receiveShadow = true;
  group.add(floorMesh);
  disposables.push(floorGeo, floorMat);

  // 2. Stepped Concrete Bowl Risers & Vomitory Portals
  const riserMat = new THREE.MeshStandardMaterial({
    color: 0x11192e,
    roughness: 0.78,
    metalness: 0.12,
    side: THREE.DoubleSide,
  });
  const tunnelGeo = new THREE.BoxGeometry(2.8, 2.4, 1.6);
  const tunnelMat = new THREE.MeshStandardMaterial({
    color: 0x030712,
    emissive: 0x1e3a8a,
    emissiveIntensity: 0.35,
    roughness: 0.9,
  });
  disposables.push(riserMat, tunnelGeo, tunnelMat);

  const ringSteps = 64;
  for (const cfg of TIER_CONFIGS) {
    const positions: number[] = [];
    const indices: number[] = [];

    const rxInner = cfg.rxStart - 0.8;
    const rzInner = cfg.rzStart - 0.8;
    const yInner = cfg.yStart - 0.25;

    const rxOuter = cfg.rxStart + (cfg.rows - 0.1) * cfg.rowDepth;
    const rzOuter = cfg.rzStart + (cfg.rows - 0.1) * cfg.rowDepth;
    const yOuter = cfg.yStart + (cfg.rows - 0.5) * cfg.rowRise;

    for (let i = 0; i <= ringSteps; i++) {
      const a = (i / ringSteps) * Math.PI * 2;
      const pIn = stadiumCurvePoint(rxInner, rzInner, a);
      const pOut = stadiumCurvePoint(rxOuter, rzOuter, a);
      positions.push(pIn.x, yInner, pIn.z);
      positions.push(pOut.x, yOuter, pOut.z);
    }

    for (let i = 0; i < ringSteps; i++) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2);
      indices.push(base + 1, base + 3, base + 2);
    }

    const bowlGeo = new THREE.BufferGeometry();
    bowlGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    bowlGeo.setIndex(indices);
    bowlGeo.computeVertexNormals();
    const bowlMesh = new THREE.Mesh(bowlGeo, riserMat);
    bowlMesh.receiveShadow = true;
    group.add(bowlMesh);
    disposables.push(bowlGeo);

    for (let s = 0; s < cfg.sectionCount; s++) {
      const a = ((s + 0.5) / cfg.sectionCount) * Math.PI * 2;
      const pTop = stadiumCurvePoint(rxOuter - 0.6, rzOuter - 0.6, a);
      const tunnel = new THREE.Mesh(tunnelGeo, tunnelMat);
      tunnel.position.set(pTop.x, yOuter + 0.9, pTop.z);
      tunnel.lookAt(0, yOuter + 0.9, 0);
      group.add(tunnel);
    }
  }

  // 3. Zero-Lag GPU UV-Scrolling LED Boundary Cushions & Club Fascia Ribbon
  const ribbonCanvas = document.createElement('canvas');
  ribbonCanvas.width = 1024;
  ribbonCanvas.height = 64;
  const ribbonCtx = ribbonCanvas.getContext('2d')!;
  let eventTitle = 'Premier T20: Mumbai vs Chennai';
  let homeTeam = 'Mumbai Mavericks';
  let awayTeam = 'Chennai Kings';
  drawStaticRibbonCanvas(ribbonCtx, ribbonCanvas.width, ribbonCanvas.height, eventTitle);

  const ribbonTex = new THREE.CanvasTexture(ribbonCanvas);
  ribbonTex.colorSpace = THREE.SRGBColorSpace;
  ribbonTex.anisotropy = maxAnisotropy;
  ribbonTex.wrapS = THREE.RepeatWrapping;
  ribbonTex.generateMipmaps = false;
  ribbonTex.minFilter = THREE.LinearFilter;

  const ribbonMat = new THREE.MeshStandardMaterial({
    map: ribbonTex,
    emissiveMap: ribbonTex,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.95,
    roughness: 0.3,
    side: THREE.DoubleSide,
  });
  disposables.push(ribbonTex, ribbonMat);

  function addOvalLedRing(rx: number, rz: number, y: number, height: number, repeatU: number) {
    const pos: number[] = [];
    const uvs: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= ringSteps; i++) {
      const u = (i / ringSteps) * repeatU;
      const a = (i / ringSteps) * Math.PI * 2;
      const pt = stadiumCurvePoint(rx, rz, a);
      pos.push(pt.x, y, pt.z, pt.x, y + height, pt.z);
      uvs.push(u, 0, u, 1);
    }
    for (let i = 0; i < ringSteps; i++) {
      const b = i * 2;
      idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, ribbonMat);
    group.add(mesh);
    disposables.push(geo);
  }

  // Outer perimeter boundary LED cushions + Club tier LED fascia
  addOvalLedRing(46.2, 40.2, 0.08, 1.05, 10);
  addOvalLedRing(66.4, 60.4, 8.2, 1.35, 8);

  // 4. Giant Stadium Scoreboard Screen perched at North Pavilion Roof + Opposite South Screen
  const jumboCanvas = document.createElement('canvas');
  jumboCanvas.width = 512;
  jumboCanvas.height = 192;
  const jumboCtx = jumboCanvas.getContext('2d')!;
  drawCricketScoreboardCanvas(
    jumboCtx,
    jumboCanvas.width,
    jumboCanvas.height,
    eventTitle,
    homeTeam,
    awayTeam,
    0,
  );

  const jumboTex = new THREE.CanvasTexture(jumboCanvas);
  jumboTex.colorSpace = THREE.SRGBColorSpace;
  jumboTex.generateMipmaps = false;
  jumboTex.minFilter = THREE.LinearFilter;

  const jumboChassisMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.85,
    roughness: 0.25,
  });
  const jumboScreenMat = new THREE.MeshStandardMaterial({
    map: jumboTex,
    emissiveMap: jumboTex,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.98,
    roughness: 0.2,
  });
  const glowAccentMat = new THREE.MeshStandardMaterial({
    color: 0x2563eb,
    emissive: 0x3b82f6,
    emissiveIntensity: 1.3,
    roughness: 0.2,
  });
  disposables.push(jumboTex, jumboChassisMat, jumboScreenMat, glowAccentMat);

  const sbFrameGeo = new THREE.BoxGeometry(24, 9.5, 1.4);
  const sbScreenGeo = new THREE.PlaneGeometry(22.4, 8.2);
  disposables.push(sbFrameGeo, sbScreenGeo);

  for (const zDir of [-1, 1]) {
    const sbGroup = new THREE.Group();
    sbGroup.add(new THREE.Mesh(sbFrameGeo, jumboChassisMat));
    const scr = new THREE.Mesh(sbScreenGeo, jumboScreenMat);
    scr.position.z = zDir * -0.75;
    if (zDir === -1) scr.rotation.y = 0;
    else scr.rotation.y = Math.PI;
    sbGroup.add(scr);
    sbGroup.position.set(0, 29.5, zDir * 85);
    group.add(sbGroup);
  }

  // 5. Open-Air Cantilevered Cricket Canopy Roof Ring & Outer Shell
  const trussMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.78,
    roughness: 0.32,
  });
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.55,
    metalness: 0.4,
    side: THREE.DoubleSide,
  });
  disposables.push(trussMat, canopyMat);

  // Cantilevered annular roof canopy shading the stands while leaving sky open above the pitch
  const canopyPos: number[] = [];
  const canopyIdx: number[] = [];
  for (let i = 0; i <= ringSteps; i++) {
    const a = (i / ringSteps) * Math.PI * 2;
    const pIn = stadiumCurvePoint(74, 68, a);
    const pOut = stadiumCurvePoint(97, 91, a);
    canopyPos.push(pIn.x, 30.5, pIn.z, pOut.x, 26.8, pOut.z);
  }
  for (let i = 0; i < ringSteps; i++) {
    const b = i * 2;
    canopyIdx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
  }
  const canopyGeo = new THREE.BufferGeometry();
  canopyGeo.setAttribute('position', new THREE.Float32BufferAttribute(canopyPos, 3));
  canopyGeo.setIndex(canopyIdx);
  canopyGeo.computeVertexNormals();
  group.add(new THREE.Mesh(canopyGeo, canopyMat));
  disposables.push(canopyGeo);

  // Outer stadium facade wall
  const outerWallGeo = new THREE.CylinderGeometry(98, 95, 27, 48, 1, true);
  const outerWallMat = new THREE.MeshStandardMaterial({
    color: 0x060a18,
    roughness: 0.85,
    metalness: 0.2,
    side: THREE.BackSide,
  });
  const outerWall = new THREE.Mesh(outerWallGeo, outerWallMat);
  outerWall.position.y = 13.5;
  group.add(outerWall);
  disposables.push(outerWallGeo, outerWallMat);

  // Structural canopy ribs
  const ribGeo = new THREE.BoxGeometry(0.65, 0.8, 25);
  disposables.push(ribGeo);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const pMid = stadiumCurvePoint(86, 80, a);
    const rib = new THREE.Mesh(ribGeo, trussMat);
    rib.position.set(pMid.x, 28.8, pMid.z);
    rib.lookAt(0, 31.8, 0);
    group.add(rib);
  }

  // 6. Four Iconic Towering Cricket Floodlight Pylons + Volumetric Light Cones
  const pylonMastGeo = new THREE.CylinderGeometry(0.75, 1.45, 52, 10);
  const headGeo = new THREE.BoxGeometry(10.5, 5.2, 1.2);
  const ledPanelGeo = new THREE.PlaneGeometry(9.6, 4.4);
  const ledMat = new THREE.MeshBasicMaterial({ color: 0xf0f9ff });
  const beamTex = createSoftGlowBeamTexture();
  const beamMat = new THREE.MeshBasicMaterial({
    map: beamTex,
    transparent: true,
    opacity: 0.34,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const coneGeo = new THREE.ConeGeometry(22, 62, 16, 1, true);
  coneGeo.translate(0, -31, 0);
  disposables.push(pylonMastGeo, headGeo, ledPanelGeo, ledMat, beamTex, beamMat, coneGeo);

  const pylonAngles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
  for (const a of pylonAngles) {
    const pt = stadiumCurvePoint(101, 95, a);
    const pylonGroup = new THREE.Group();
    const mast = new THREE.Mesh(pylonMastGeo, trussMat);
    mast.position.y = 26;
    pylonGroup.add(mast);

    const head = new THREE.Mesh(headGeo, trussMat);
    head.position.y = 53;
    head.lookAt(-pt.x, 2, -pt.z);
    pylonGroup.add(head);

    const ledPanel = new THREE.Mesh(ledPanelGeo, ledMat);
    ledPanel.position.set(0, 0, 0.65);
    head.add(ledPanel);

    pylonGroup.position.set(pt.x, 0, pt.z);
    group.add(pylonGroup);

    // Subtle volumetric floodlight beam aimed at center pitch
    const cone = new THREE.Mesh(coneGeo, beamMat);
    cone.position.set(pt.x * 0.94, 52, pt.z * 0.94);
    cone.lookAt(0, 0, 0);
    cone.rotateX(-Math.PI / 2);
    group.add(cone);
  }

  // 7. Subtle Starry Night Sky Dome & Atmospheric Light Motes
  const starCount = 260;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.38;
    const r = 175;
    starPos[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    starPos[i * 3 + 1] = Math.cos(phi) * r * 0.65 + 35;
    starPos[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const moteTex = createParticleSpriteTexture();
  const starMat = new THREE.PointsMaterial({
    size: 1.1,
    map: moteTex,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  group.add(stars);
  disposables.push(starGeo, moteTex, starMat);

  let lastSecondDrawn = -1;

  return {
    group,
    setEventBanner: (title: string, home: string, away: string) => {
      eventTitle = title;
      homeTeam = home;
      awayTeam = away;
      drawCricketScoreboardCanvas(
        jumboCtx,
        jumboCanvas.width,
        jumboCanvas.height,
        eventTitle,
        homeTeam,
        awayTeam,
        0,
      );
      jumboTex.needsUpdate = true;
      drawStaticRibbonCanvas(ribbonCtx, ribbonCanvas.width, ribbonCanvas.height, eventTitle);
      ribbonTex.needsUpdate = true;
    },
    update: (elapsed: number, delta: number) => {
      // Smooth GPU-only UV scrolling for LED boundary & club ribbons
      ribbonTex.offset.x = (ribbonTex.offset.x + delta * 0.08) % 1;
      stars.rotation.y = elapsed * 0.004;

      const curSec = Math.floor(elapsed);
      if (curSec !== lastSecondDrawn) {
        lastSecondDrawn = curSec;
        drawCricketScoreboardCanvas(
          jumboCtx,
          jumboCanvas.width,
          jumboCanvas.height,
          eventTitle,
          homeTeam,
          awayTeam,
          curSec,
        );
        jumboTex.needsUpdate = true;
      }
    },
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
