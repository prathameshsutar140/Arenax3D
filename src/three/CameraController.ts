import gsap from 'gsap';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { SeatTier, SectionDefinition } from '../types/stadium';

export type CameraPreset = 'overview' | 'courtside' | 'lower' | 'club' | 'upper';

export const OVERVIEW_POS = new THREE.Vector3(0, 74, 122);
export const OVERVIEW_TARGET = new THREE.Vector3(0, 3, 0);

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private activeTween: gsap.core.Timeline | null = null;
  private isSoftwareGl: boolean;
  private onFrameRequest?: () => void;

  constructor(
    camera: THREE.PerspectiveCamera,
    controls: OrbitControls,
    isSoftwareGl: boolean,
    onFrameRequest?: () => void,
  ) {
    this.camera = camera;
    this.controls = controls;
    this.isSoftwareGl = isSoftwareGl;
    this.onFrameRequest = onFrameRequest;

    this.configureOrbitMode();

    this.controls.addEventListener('start', () => {
      this.cancelTransition();
      this.controls.autoRotate = false;
    });
  }

  public configureOrbitMode(): void {
    this.controls.enabled = true;
    this.controls.enableZoom = true;
    this.controls.enablePan = true;
    this.controls.rotateSpeed = 0.72;
    this.controls.zoomSpeed = 1.0;
    this.controls.panSpeed = 0.75;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 215;
    this.controls.minPolarAngle = 0.12;
    this.controls.maxPolarAngle = Math.PI * 0.485;
    this.controls.minAzimuthAngle = -Infinity;
    this.controls.maxAzimuthAngle = Infinity;
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.055;
  }

  public setAutoRotate(enabled: boolean): void {
    if (this.isSoftwareGl) {
      this.controls.autoRotate = false;
      return;
    }
    this.controls.autoRotate = enabled;
    this.controls.autoRotateSpeed = 0.7;
  }

  public cancelTransition(): void {
    if (this.activeTween) {
      this.activeTween.kill();
      this.activeTween = null;
    }
  }

  public transitionTo(
    position: THREE.Vector3,
    target: THREE.Vector3,
    duration = 1.05,
    onComplete?: () => void,
  ): void {
    this.cancelTransition();
    this.setAutoRotate(false);
    this.configureOrbitMode();

    if (this.isSoftwareGl) {
      duration = 0.45;
    }

    const tl = gsap.timeline({
      onUpdate: () => {
        this.controls.update();
        this.onFrameRequest?.();
      },
      onComplete: () => {
        this.activeTween = null;
        this.controls.update();
        onComplete?.();
      },
    });

    tl.to(
      this.camera.position,
      {
        x: position.x,
        y: position.y,
        z: position.z,
        duration,
        ease: 'expo.inOut',
      },
      0,
    );

    tl.to(
      this.controls.target,
      {
        x: target.x,
        y: target.y,
        z: target.z,
        duration,
        ease: 'expo.inOut',
      },
      0,
    );

    this.activeTween = tl;
  }

  public goToPreset(preset: CameraPreset): void {
    switch (preset) {
      case 'overview':
        this.transitionTo(OVERVIEW_POS, OVERVIEW_TARGET);
        break;
      case 'courtside':
        // Boundary / Sightline pitch view
        this.transitionTo(new THREE.Vector3(0, 12, 46), new THREE.Vector3(0, 1.2, 0));
        break;
      case 'lower':
        this.transitionTo(new THREE.Vector3(38, 22, 54), new THREE.Vector3(0, 2, 0));
        break;
      case 'club':
        this.transitionTo(new THREE.Vector3(-56, 30, 68), new THREE.Vector3(0, 3, 0));
        break;
      case 'upper':
        this.transitionTo(new THREE.Vector3(0, 50, 104), new THREE.Vector3(0, 6, 0));
        break;
    }
  }

  public focusSection(section: SectionDefinition): void {
    const pos = new THREE.Vector3(
      section.cameraPosition.x,
      section.cameraPosition.y,
      section.cameraPosition.z,
    );
    const tgt = new THREE.Vector3(
      section.cameraTarget.x,
      section.cameraTarget.y,
      section.cameraTarget.z,
    );
    this.transitionTo(pos, tgt, 1.05);
  }

  public focusTier(tier: SeatTier | 'ALL'): void {
    if (tier === 'ALL') this.goToPreset('overview');
    else if (tier === 'Lower') this.goToPreset('lower');
    else if (tier === 'Club') this.goToPreset('club');
    else this.goToPreset('upper');
  }

  public dispose(): void {
    this.cancelTransition();
  }
}
