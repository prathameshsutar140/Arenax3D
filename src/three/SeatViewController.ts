import gsap from 'gsap';
import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { SeatRecord } from '../types/stadium';
import type { CameraController } from './CameraController';

const EYE_HEIGHT_OFFSET = 0.95;
const COURT_FOCUS_Y = 1.0;

export class SeatViewController {
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private cameraController: CameraController;
  private isSoftwareGl: boolean;
  private savedPosition = new THREE.Vector3();
  private savedTarget = new THREE.Vector3();
  private savedFov = 48;
  private isInSeatView = false;
  private activeTimeline: gsap.core.Timeline | null = null;

  constructor(
    camera: THREE.PerspectiveCamera,
    controls: OrbitControls,
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    cameraController: CameraController,
    isSoftwareGl: boolean,
  ) {
    this.camera = camera;
    this.controls = controls;
    this.renderer = renderer;
    this.scene = scene;
    this.cameraController = cameraController;
    this.isSoftwareGl = isSoftwareGl;
  }

  public get active(): boolean {
    return this.isInSeatView;
  }

  public enterSeatView(seat: SeatRecord, onReady?: () => void): void {
    this.cameraController.cancelTransition();
    this.cameraController.setAutoRotate(false);
    if (this.activeTimeline) {
      this.activeTimeline.kill();
      this.activeTimeline = null;
    }

    if (!this.isInSeatView) {
      this.savedPosition.copy(this.camera.position);
      this.savedTarget.copy(this.controls.target);
      this.savedFov = this.camera.fov;
    }

    const eyePos = new THREE.Vector3(
      seat.worldPosition.x,
      seat.worldPosition.y + EYE_HEIGHT_OFFSET,
      seat.worldPosition.z,
    );
    const lookDir = new THREE.Vector3(0 - eyePos.x, COURT_FOCUS_Y - eyePos.y, 0 - eyePos.z).normalize();
    const targetAhead = eyePos.clone().addScaledVector(lookDir, 0.25);

    const applyLookConstraints = () => {
      this.isInSeatView = true;
      this.activeTimeline = null;
      this.controls.enableZoom = false;
      this.controls.enablePan = false;
      this.controls.rotateSpeed = -0.42;
      this.controls.minDistance = 0.24;
      this.controls.maxDistance = 0.26;
      this.controls.minPolarAngle = Math.PI * 0.28;
      this.controls.maxPolarAngle = Math.PI * 0.72;
      this.controls.update();
      onReady?.();
    };

    const duration = this.isSoftwareGl ? 0.45 : 1.15;
    const tl = gsap.timeline({
      onUpdate: () => {
        this.camera.updateProjectionMatrix();
        this.controls.update();
      },
      onComplete: applyLookConstraints,
    });

    tl.to(
      this.camera.position,
      {
        x: eyePos.x,
        y: eyePos.y,
        z: eyePos.z,
        duration,
        ease: 'expo.inOut',
      },
      0,
    );
    tl.to(
      this.controls.target,
      {
        x: targetAhead.x,
        y: targetAhead.y,
        z: targetAhead.z,
        duration,
        ease: 'expo.inOut',
      },
      0,
    );
    tl.to(
      this.camera,
      {
        fov: 60,
        duration,
        ease: 'power2.inOut',
      },
      0,
    );

    this.activeTimeline = tl;
  }

  public exitSeatView(): void {
    if (!this.isInSeatView) return;
    this.isInSeatView = false;
    if (this.activeTimeline) {
      this.activeTimeline.kill();
      this.activeTimeline = null;
    }

    gsap.to(this.camera, {
      fov: this.savedFov,
      duration: this.isSoftwareGl ? 0.3 : 0.75,
      ease: 'power2.inOut',
      onUpdate: () => this.camera.updateProjectionMatrix(),
    });

    this.cameraController.configureOrbitMode();
    this.cameraController.transitionTo(this.savedPosition, this.savedTarget, 0.9);
  }

  public captureSnapshotForSeat(seat: SeatRecord): string {
    const prevPos = this.camera.position.clone();
    const prevTarget = this.controls.target.clone();
    const prevFov = this.camera.fov;

    const eyePos = new THREE.Vector3(
      seat.worldPosition.x,
      seat.worldPosition.y + EYE_HEIGHT_OFFSET,
      seat.worldPosition.z,
    );
    this.camera.fov = 60;
    this.camera.updateProjectionMatrix();
    this.camera.position.copy(eyePos);
    this.camera.lookAt(0, COURT_FOCUS_Y, 0);

    this.renderer.render(this.scene, this.camera);
    const dataUrl = this.renderer.domElement.toDataURL('image/jpeg', 0.84);

    this.camera.fov = prevFov;
    this.camera.updateProjectionMatrix();
    this.camera.position.copy(prevPos);
    this.controls.target.copy(prevTarget);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);

    return dataUrl;
  }
}
