import * as THREE from 'three';
import type { SeatRecord, SectionDefinition } from '../types/stadium';
import type { SeatMeshSystem } from './SeatGenerator';

export interface SeatInteractionCallbacks {
  onHoverSection: (section: SectionDefinition | null, screenPos: { x: number; y: number } | null) => void;
  onSelectSection: (section: SectionDefinition) => void;
  onHoverSeat: (seat: SeatRecord | null) => void;
  onSelectSeat: (seat: SeatRecord) => void;
}

const _seatPos = new THREE.Vector3();

export class SeatInteraction {
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  private seatSystem: SeatMeshSystem;
  private callbacks: SeatInteractionCallbacks;

  private sectionRaycaster = new THREE.Raycaster();
  private pointerNdc = new THREE.Vector2();
  private pointerDownPos = { x: 0, y: 0 };
  private lastHoverCheck = 0;
  private activeSectionId: string | null = null;
  private isSeatView = false;
  private sectionById = new Map<string, SectionDefinition>();

  private handlePointerMoveBound: (e: PointerEvent) => void;
  private handlePointerDownBound: (e: PointerEvent) => void;
  private handlePointerUpBound: (e: PointerEvent) => void;
  private handlePointerLeaveBound: () => void;

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    seatSystem: SeatMeshSystem,
    callbacks: SeatInteractionCallbacks,
  ) {
    this.camera = camera;
    this.domElement = domElement;
    this.seatSystem = seatSystem;
    this.callbacks = callbacks;

    this.sectionRaycaster.layers.set(1);
    for (const sec of seatSystem.sections) {
      this.sectionById.set(sec.id, sec);
    }

    this.handlePointerMoveBound = this.onPointerMove.bind(this);
    this.handlePointerDownBound = this.onPointerDown.bind(this);
    this.handlePointerUpBound = this.onPointerUp.bind(this);
    this.handlePointerLeaveBound = this.onPointerLeave.bind(this);

    domElement.addEventListener('pointermove', this.handlePointerMoveBound, { passive: true });
    domElement.addEventListener('pointerdown', this.handlePointerDownBound, { passive: true });
    domElement.addEventListener('pointerup', this.handlePointerUpBound, { passive: true });
    domElement.addEventListener('pointerleave', this.handlePointerLeaveBound, { passive: true });
  }

  public setMode(activeSectionId: string | null, isSeatView: boolean): void {
    this.activeSectionId = activeSectionId;
    this.isSeatView = isSeatView;
    if (isSeatView) {
      this.callbacks.onHoverSection(null, null);
      this.callbacks.onHoverSeat(null);
    }
  }

  private updateNdc(clientX: number, clientY: number): void {
    const rect = this.domElement.getBoundingClientRect();
    this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  /**
   * Finds the exact seat under the ray within a given section using O(sectionSeats) math
   * instead of brute-force triangle raycasting across 14,064 instances.
   */
  private findSeatInSection(sectionId: string, hitPoint: THREE.Vector3): SeatRecord | null {
    const list = this.seatSystem.seatsBySection.get(sectionId);
    if (!list || list.length === 0) return null;

    const ray = this.sectionRaycaster.ray;
    let bestSeat: SeatRecord | null = null;
    let bestScore = Infinity;

    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      _seatPos.set(s.worldPosition.x, s.worldPosition.y + 0.35, s.worldPosition.z);
      const rayDistSq = ray.distanceSqToPoint(_seatPos);
      // Combine ray distance & hit-point proximity for reliable steep/shallow angle picking
      if (rayDistSq < 0.72) {
        const ptDistSq = _seatPos.distanceToSquared(hitPoint);
        const score = rayDistSq * 0.75 + ptDistSq * 0.25;
        if (score < bestScore) {
          bestScore = score;
          bestSeat = s;
        }
      }
    }
    return bestSeat;
  }

  private onPointerDown(e: PointerEvent): void {
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
  }

  private onPointerLeave(): void {
    this.callbacks.onHoverSection(null, null);
    this.callbacks.onHoverSeat(null);
    this.domElement.style.cursor = 'grab';
  }

  private onPointerMove(e: PointerEvent): void {
    if (this.isSeatView) {
      this.domElement.style.cursor = 'grab';
      return;
    }

    const now = performance.now();
    if (now - this.lastHoverCheck < 28) return;
    this.lastHoverCheck = now;

    this.updateNdc(e.clientX, e.clientY);
    this.sectionRaycaster.setFromCamera(this.pointerNdc, this.camera);
    const secHits = this.sectionRaycaster.intersectObjects(this.seatSystem.sectionHitMeshes, false);

    if (secHits.length === 0) {
      this.callbacks.onHoverSection(null, null);
      this.callbacks.onHoverSeat(null);
      this.domElement.style.cursor = 'grab';
      return;
    }

    const secId = secHits[0].object.userData.sectionId as string;
    const sec = this.sectionById.get(secId) || null;
    this.callbacks.onHoverSection(sec, { x: e.clientX, y: e.clientY });
    this.domElement.style.cursor = 'pointer';

    const dist = this.camera.position.length();
    if (this.activeSectionId || dist < 115) {
      const seat = this.findSeatInSection(secId, secHits[0].point);
      this.callbacks.onHoverSeat(seat);
    } else {
      this.callbacks.onHoverSeat(null);
    }
  }

  private onPointerUp(e: PointerEvent): void {
    if (this.isSeatView) return;

    const dx = e.clientX - this.pointerDownPos.x;
    const dy = e.clientY - this.pointerDownPos.y;
    if (Math.hypot(dx, dy) > 6) return;

    this.updateNdc(e.clientX, e.clientY);
    this.sectionRaycaster.setFromCamera(this.pointerNdc, this.camera);
    const secHits = this.sectionRaycaster.intersectObjects(this.seatSystem.sectionHitMeshes, false);

    if (secHits.length === 0) return;

    const secId = secHits[0].object.userData.sectionId as string;
    const sec = this.sectionById.get(secId);
    if (!sec) return;

    const dist = this.camera.position.length();
    // If zoomed in or already inside a section, tap picks the exact seat immediately
    if (this.activeSectionId === secId || dist < 105) {
      const seat = this.findSeatInSection(secId, secHits[0].point);
      if (seat) {
        this.callbacks.onSelectSeat(seat);
        return;
      }
    }

    // Otherwise zoom smoothly into that section
    this.callbacks.onSelectSection(sec);
  }

  public dispose(): void {
    this.domElement.removeEventListener('pointermove', this.handlePointerMoveBound);
    this.domElement.removeEventListener('pointerdown', this.handlePointerDownBound);
    this.domElement.removeEventListener('pointerup', this.handlePointerUpBound);
    this.domElement.removeEventListener('pointerleave', this.handlePointerLeaveBound);
  }
}
