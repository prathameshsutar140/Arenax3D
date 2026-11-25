import * as THREE from 'three';

export interface CourtBuildResult {
  group: THREE.Group;
  dispose: () => void;
}

function createCricketGroundTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 2048;
  const ctx = canvas.getContext('2d')!;

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  // Base emerald outfield turf
  ctx.fillStyle = '#1d5e2a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle radial + linear mowing stripes for realistic broadcast turf
  const stripeCount = 26;
  const stripeW = canvas.width / stripeCount;
  for (let i = 0; i < stripeCount; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(34, 197, 94, 0.08)' : 'rgba(6, 78, 59, 0.14)';
    ctx.fillRect(i * stripeW, 0, stripeW, canvas.height);
  }

  // Concentric circular mow ring accent
  for (let r = 140; r < 980; r += 130) {
    ctx.strokeStyle = 'rgba(134, 239, 172, 0.06)';
    ctx.lineWidth = 55;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Ground coordinate mapping: oval disc radius X=46m, Z=40m mapped onto 2048x2048 UV
  // 30-yard inner fielding circle (approx 48% of boundary radius)
  ctx.save();
  ctx.strokeStyle = 'rgba(248, 250, 252, 0.85)';
  ctx.lineWidth = 6;
  ctx.setLineDash([18, 12]);
  ctx.beginPath();
  ctx.ellipse(cx, cy, 430, 430, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Outer boundary chalk line
  ctx.strokeStyle = 'rgba(248, 250, 252, 0.92)';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 905, 905, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Central Pitch Square (rolled clay / beige turf strip oriented North-South along V/Z)
  const pitchW = 76;
  const pitchL = 320;
  ctx.fillStyle = '#c8b282';
  ctx.fillRect(cx - pitchW / 2, cy - pitchL / 2, pitchW, pitchL);

  // Adjacent practice pitch strips on the square
  ctx.fillStyle = 'rgba(163, 185, 118, 0.55)';
  ctx.fillRect(cx - pitchW * 1.75, cy - pitchL / 2, pitchW * 0.72, pitchL);
  ctx.fillRect(cx + pitchW * 1.03, cy - pitchL / 2, pitchW * 0.72, pitchL);

  // Subtle wear patches near bowling crease
  const wearTop = ctx.createRadialGradient(cx, cy - 115, 2, cx, cy - 115, 28);
  wearTop.addColorStop(0, 'rgba(120, 95, 58, 0.45)');
  wearTop.addColorStop(1, 'rgba(120, 95, 58, 0)');
  ctx.fillStyle = wearTop;
  ctx.fillRect(cx - 35, cy - 145, 70, 60);

  const wearBot = ctx.createRadialGradient(cx, cy + 115, 2, cx, cy + 115, 28);
  wearBot.addColorStop(0, 'rgba(120, 95, 58, 0.45)');
  wearBot.addColorStop(1, 'rgba(120, 95, 58, 0)');
  ctx.fillStyle = wearBot;
  ctx.fillRect(cx - 35, cy + 85, 70, 60);

  // Crisp White Crease Markings at both ends (Popping, Bowling, Return creases)
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3.5;

  for (const dir of [-1, 1]) {
    const bowlY = cy + dir * 126;
    const popY = cy + dir * 104;
    const backY = cy + dir * 144;

    // Bowling crease
    ctx.beginPath();
    ctx.moveTo(cx - 28, bowlY);
    ctx.lineTo(cx + 28, bowlY);
    ctx.stroke();

    // Popping crease (extended)
    ctx.beginPath();
    ctx.moveTo(cx - 38, popY);
    ctx.lineTo(cx + 38, popY);
    ctx.stroke();

    // Return creases
    ctx.beginPath();
    ctx.moveTo(cx - 28, popY);
    ctx.lineTo(cx - 28, backY);
    ctx.moveTo(cx + 28, popY);
    ctx.lineTo(cx + 28, backY);
    ctx.stroke();
  }

  // Subtle outfield ArenaX Cricket Emblem painted on turf
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(cx - 250, cy, 62, 0, Math.PI * 2);
  ctx.arc(cx + 250, cy, 62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e0f2fe';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ARENAX', cx - 250, cy);
  ctx.fillText('CRICKET', cx + 250, cy);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createWicketSet(zPos: number): { group: THREE.Group; disposables: Array<{ dispose: () => void }> } {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  const stumpMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0x1d4ed8,
    emissiveIntensity: 0.25,
    roughness: 0.35,
    metalness: 0.2,
  });
  const bailMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xf97316,
    emissiveIntensity: 1.1,
    roughness: 0.2,
  });
  const stumpGeo = new THREE.CylinderGeometry(0.032, 0.034, 0.82, 8);
  const bailGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.14, 6);
  disposables.push(stumpMat, bailMat, stumpGeo, bailGeo);

  // 3 stumps (off, middle, leg) grounded at y = 0.02
  for (const offsetX of [-0.15, 0, 0.15]) {
    const stump = new THREE.Mesh(stumpGeo, stumpMat);
    stump.position.set(offsetX, 0.42, 0);
    group.add(stump);
  }

  // 2 glowing LED Zing bails across top of stumps
  for (const offsetX of [-0.075, 0.075]) {
    const bail = new THREE.Mesh(bailGeo, bailMat);
    bail.rotation.z = Math.PI / 2;
    bail.position.set(offsetX, 0.84, 0);
    group.add(bail);
  }

  group.position.set(0, 0, zPos);
  return { group, disposables };
}

export function buildBasketballCourt(maxAnisotropy: number, _isSoftwareGl: boolean): CourtBuildResult {
  const group = new THREE.Group();
  group.name = 'CricketGround';
  const disposables: Array<{ dispose: () => void }> = [];

  // 1. Oval Emerald Cricket Outfield + Rolled Pitch (rx = 46m, rz = 40m)
  const turfTex = createCricketGroundTexture(maxAnisotropy);
  const turfGeo = new THREE.CylinderGeometry(1, 1, 0.16, 72);
  turfGeo.scale(46.0, 1, 40.0);
  const turfMat = new THREE.MeshStandardMaterial({
    map: turfTex,
    roughness: 0.82,
    metalness: 0.04,
  });
  const turfMesh = new THREE.Mesh(turfGeo, turfMat);
  turfMesh.position.y = -0.05;
  turfMesh.receiveShadow = true;
  group.add(turfMesh);
  disposables.push(turfTex, turfGeo, turfMat);

  // 2. Raised Padded Boundary Rope (rx = 41.2m, rz = 35.8m)
  const boundaryPts: THREE.Vector3[] = [];
  const segs = 96;
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    boundaryPts.push(new THREE.Vector3(Math.cos(a) * 41.2, 0.14, Math.sin(a) * 35.8));
  }
  const ropeCurve = new THREE.CatmullRomCurve3(boundaryPts, true);
  const ropeGeo = new THREE.TubeGeometry(ropeCurve, 96, 0.14, 6, true);
  const ropeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    emissive: 0x2563eb,
    emissiveIntensity: 0.35,
    roughness: 0.4,
  });
  const ropeMesh = new THREE.Mesh(ropeGeo, ropeMat);
  group.add(ropeMesh);
  disposables.push(ropeGeo, ropeMat);

  // 3. North & South Cricket Wickets (Stumps & LED Bails)
  const northWicket = createWicketSet(-5.6);
  const southWicket = createWicketSet(5.6);
  group.add(northWicket.group, southWicket.group);
  disposables.push(...northWicket.disposables, ...southWicket.disposables);

  // 4. Two Sightscreens behind North & South boundaries
  const screenMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5, metalness: 0.05 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.7 });
  const screenGeo = new THREE.BoxGeometry(11.0, 4.4, 0.4);
  const frameGeo = new THREE.BoxGeometry(11.6, 4.9, 0.3);
  disposables.push(screenMat, frameMat, screenGeo, frameGeo);

  for (const zDir of [-1, 1]) {
    const ssGroup = new THREE.Group();
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.y = 2.45;
    const face = new THREE.Mesh(screenGeo, screenMat);
    face.position.set(0, 2.45, zDir * -0.12);
    ssGroup.add(frame, face);
    ssGroup.position.set(0, 0, zDir * 42.5);
    group.add(ssGroup);
  }

  return {
    group,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
