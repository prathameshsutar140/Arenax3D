import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { SeatRecord, SeatStateDelta, SeatTier, SectionDefinition } from '../types/stadium';
import { TIER_CONFIGS, getStadiumLayout, stadiumCurvePoint } from '../utils/stadiumLayout';

export interface SeatMeshSystem {
  group: THREE.Group;
  seatMesh: THREE.InstancedMesh;
  sectionHitMeshes: THREE.Mesh[];
  seats: SeatRecord[];
  sections: SectionDefinition[];
  seatsBySection: Map<string, SeatRecord[]>;
  updateSeatColors: (
    delta: SeatStateDelta,
    selectedIds: Set<string>,
    hoveredSeatId: string | null,
    activeSectionId: string | null,
    tierFilter: SeatTier | 'ALL',
  ) => void;
  updateHoveredSeatFast: (
    prevSeat: SeatRecord | null,
    nextSeat: SeatRecord | null,
    delta: SeatStateDelta,
    selectedIds: Set<string>,
    activeSectionId: string | null,
    tierFilter: SeatTier | 'ALL',
  ) => void;
  setSectionHighlight: (hoveredSectionId: string | null, selectedSectionId: string | null) => void;
  setFocusedBeacon: (seat: SeatRecord | null) => void;
  updateBeacon: (elapsed: number) => void;
  dispose: () => void;
}

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

const COLOR_LOWER = new THREE.Color('#2563eb');
const COLOR_CLUB = new THREE.Color('#6366f1');
const COLOR_UPPER = new THREE.Color('#0284c7');
const COLOR_DIMMED = new THREE.Color('#1e293b');
const COLOR_SELECTED = new THREE.Color('#10b981');
const COLOR_HOVERED = new THREE.Color('#22d3ee');
const COLOR_HELD = new THREE.Color('#f59e0b');
const COLOR_BOOKED = new THREE.Color('#e11d48');

function createContouredSeatGeometry(): THREE.BufferGeometry {
  const pan = new THREE.BoxGeometry(0.52, 0.1, 0.48);
  pan.translate(0, 0.34, 0.03);

  const backrest = new THREE.BoxGeometry(0.52, 0.56, 0.1);
  backrest.rotateX(-0.14);
  backrest.translate(0, 0.62, -0.2);

  const pedestal = new THREE.BoxGeometry(0.18, 0.3, 0.18);
  pedestal.translate(0, 0.15, -0.02);

  const merged = mergeGeometries([pan, backrest, pedestal]);
  pan.dispose();
  backrest.dispose();
  pedestal.dispose();
  return merged;
}

function buildSectionOverlayGeometry(sec: SectionDefinition): THREE.BufferGeometry {
  const cfg = TIER_CONFIGS.find((t) => t.tier === sec.tier)!;
  const rxIn = cfg.rxStart - 0.35;
  const rzIn = cfg.rzStart - 0.35;
  const yIn = cfg.yStart + 0.06;

  const rxOut = cfg.rxStart + (cfg.rows - 0.3) * cfg.rowDepth;
  const rzOut = cfg.rzStart + (cfg.rows - 0.3) * cfg.rowDepth;
  const yOut = cfg.yStart + (cfg.rows - 0.3) * cfg.rowRise + 0.06;

  const segs = 6;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const a = sec.startAngle + (sec.endAngle - sec.startAngle) * t;
    const pIn = stadiumCurvePoint(rxIn, rzIn, a);
    const pOut = stadiumCurvePoint(rxOut, rzOut, a);
    positions.push(pIn.x, yIn, pIn.z);
    positions.push(pOut.x, yOut, pOut.z);
  }

  for (let i = 0; i < segs; i++) {
    const b = i * 2;
    indices.push(b, b + 1, b + 2);
    indices.push(b + 1, b + 3, b + 2);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function createSeatSystem(isSoftwareGl: boolean): SeatMeshSystem {
  const layout = getStadiumLayout();
  const group = new THREE.Group();
  group.name = 'StadiumSeats';

  const seatsBySection = new Map<string, SeatRecord[]>();
  for (const s of layout.seats) {
    let arr = seatsBySection.get(s.sectionId);
    if (!arr) {
      arr = [];
      seatsBySection.set(s.sectionId, arr);
    }
    arr.push(s);
  }

  const seatGeo = createContouredSeatGeometry();
  const seatMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.42,
    metalness: 0.18,
  });

  const seatMesh = new THREE.InstancedMesh(seatGeo, seatMat, layout.seats.length);
  seatMesh.name = 'InstancedSeats';
  seatMesh.castShadow = false;
  seatMesh.receiveShadow = !isSoftwareGl;

  for (let i = 0; i < layout.seats.length; i++) {
    const seat = layout.seats[i];
    _dummy.position.set(seat.worldPosition.x, seat.worldPosition.y, seat.worldPosition.z);
    _dummy.rotation.set(0, seat.facingAngle, 0);
    _dummy.scale.set(1, 1, 1);
    _dummy.updateMatrix();
    seatMesh.setMatrixAt(i, _dummy.matrix);

    const baseCol = seat.tier === 'Lower' ? COLOR_LOWER : seat.tier === 'Club' ? COLOR_CLUB : COLOR_UPPER;
    seatMesh.setColorAt(i, baseCol);
  }

  seatMesh.instanceMatrix.needsUpdate = true;
  if (seatMesh.instanceColor) seatMesh.instanceColor.needsUpdate = true;
  seatMesh.computeBoundingSphere();
  group.add(seatMesh);

  const beaconGeo = new THREE.TorusGeometry(0.6, 0.08, 10, 28);
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
  const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
  beaconMesh.rotation.x = Math.PI / 2;
  beaconMesh.visible = false;
  group.add(beaconMesh);
  let beaconBaseY = 0;

  const sectionHitMeshes: THREE.Mesh[] = [];
  const sectionGeos: THREE.BufferGeometry[] = [];
  const sectionMats: THREE.MeshBasicMaterial[] = [];

  for (const sec of layout.sections) {
    const sGeo = buildSectionOverlayGeometry(sec);
    const sMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const sMesh = new THREE.Mesh(sGeo, sMat);
    sMesh.userData.sectionId = sec.id;
    sMesh.layers.enable(1);
    sMesh.renderOrder = 2;
    group.add(sMesh);
    sectionHitMeshes.push(sMesh);
    sectionGeos.push(sGeo);
    sectionMats.push(sMat);
  }

  function resolveSeatColor(
    seat: SeatRecord,
    bookedSet: Set<string>,
    heldOthersSet: Set<string>,
    heldMeSet: Set<string>,
    selectedIds: Set<string>,
    hoveredSeatId: string | null,
    activeSectionId: string | null,
    tierFilter: SeatTier | 'ALL',
  ): THREE.Color {
    if (seat.id === hoveredSeatId) return _color.copy(COLOR_HOVERED);
    if (selectedIds.has(seat.id) || heldMeSet.has(seat.id)) return _color.copy(COLOR_SELECTED);
    if (bookedSet.has(seat.id)) return _color.copy(COLOR_BOOKED);
    if (heldOthersSet.has(seat.id)) return _color.copy(COLOR_HELD);
    const baseCol =
      seat.tier === 'Lower' ? COLOR_LOWER : seat.tier === 'Club' ? COLOR_CLUB : COLOR_UPPER;
    const matchesSection = !activeSectionId || seat.sectionId === activeSectionId;
    const matchesTier = tierFilter === 'ALL' || seat.tier === tierFilter;
    if (matchesSection && matchesTier) return _color.copy(baseCol);
    return _color.copy(baseCol).lerp(COLOR_DIMMED, 0.72);
  }

  return {
    group,
    seatMesh,
    sectionHitMeshes,
    seats: layout.seats,
    sections: layout.sections,
    seatsBySection,
    updateSeatColors: (delta, selectedIds, hoveredSeatId, activeSectionId, tierFilter) => {
      const bookedSet = new Set(delta.booked);
      const heldOthersSet = new Set(delta.heldByOthers);
      const heldMeSet = new Set(delta.heldByMe);

      for (let i = 0; i < layout.seats.length; i++) {
        const seat = layout.seats[i];
        resolveSeatColor(
          seat,
          bookedSet,
          heldOthersSet,
          heldMeSet,
          selectedIds,
          hoveredSeatId,
          activeSectionId,
          tierFilter,
        );
        seatMesh.setColorAt(i, _color);
      }
      if (seatMesh.instanceColor) seatMesh.instanceColor.needsUpdate = true;
    },
    updateHoveredSeatFast: (prevSeat, nextSeat, delta, selectedIds, activeSectionId, tierFilter) => {
      if (!seatMesh.instanceColor) return;
      const bookedSet = new Set(delta.booked);
      const heldOthersSet = new Set(delta.heldByOthers);
      const heldMeSet = new Set(delta.heldByMe);
      let dirty = false;

      if (prevSeat) {
        resolveSeatColor(
          prevSeat,
          bookedSet,
          heldOthersSet,
          heldMeSet,
          selectedIds,
          nextSeat?.id || null,
          activeSectionId,
          tierFilter,
        );
        seatMesh.setColorAt(prevSeat.instanceIndex, _color);
        dirty = true;
      }
      if (nextSeat) {
        resolveSeatColor(
          nextSeat,
          bookedSet,
          heldOthersSet,
          heldMeSet,
          selectedIds,
          nextSeat.id,
          activeSectionId,
          tierFilter,
        );
        seatMesh.setColorAt(nextSeat.instanceIndex, _color);
        dirty = true;
      }
      if (dirty) {
        seatMesh.instanceColor.needsUpdate = true;
      }
    },
    setSectionHighlight: (hoveredSectionId, selectedSectionId) => {
      for (const m of sectionHitMeshes) {
        const sid = m.userData.sectionId as string;
        const mat = m.material as THREE.MeshBasicMaterial;
        if (sid === hoveredSectionId) {
          mat.color.setHex(0x38bdf8);
          mat.opacity = 0.22;
        } else if (sid === selectedSectionId) {
          mat.color.setHex(0x8b5cf6);
          mat.opacity = 0.08;
        } else {
          mat.opacity = 0.0;
        }
      }
    },
    setFocusedBeacon: (seat) => {
      if (!seat) {
        beaconMesh.visible = false;
        return;
      }
      beaconBaseY = seat.worldPosition.y + 1.45;
      beaconMesh.position.set(seat.worldPosition.x, beaconBaseY, seat.worldPosition.z);
      beaconMesh.visible = true;
    },
    updateBeacon: (elapsed) => {
      if (!beaconMesh.visible) return;
      beaconMesh.position.y = beaconBaseY + Math.sin(elapsed * 4.2) * 0.2;
      const s = 1 + Math.sin(elapsed * 4.2) * 0.08;
      beaconMesh.scale.set(s, s, 1);
    },
    dispose: () => {
      seatGeo.dispose();
      seatMat.dispose();
      beaconGeo.dispose();
      beaconMat.dispose();
      sectionGeos.forEach((g) => g.dispose());
      sectionMats.forEach((m) => m.dispose());
    },
  };
}
