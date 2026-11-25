import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { EventRecord, SeatRecord, SeatStateDelta, SeatTier, SectionDefinition } from '../types/stadium';
import { CameraController, OVERVIEW_POS, OVERVIEW_TARGET, type CameraPreset } from './CameraController';
import { buildBasketballCourt } from './CourtBuilder';
import { createSeatSystem, type SeatMeshSystem } from './SeatGenerator';
import { SeatInteraction } from './SeatInteraction';
import { SeatViewController } from './SeatViewController';
import { buildStadiumArchitecture } from './StadiumBuilder';

export function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function isWebGLSupported(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export interface StadiumSceneCallbacks {
  onHoverSection: (section: SectionDefinition | null, screenPos: { x: number; y: number } | null) => void;
  onSelectSection: (section: SectionDefinition) => void;
  onHoverSeat: (seat: SeatRecord | null) => void;
  onSelectSeat: (seat: SeatRecord) => void;
  onContextLost?: () => void;
  onContextRestored?: () => void;
}

export class StadiumScene {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;

  private cameraController: CameraController;
  private seatViewController: SeatViewController;
  private seatSystem: SeatMeshSystem;
  private interaction: SeatInteraction;

  private courtDispose: () => void;
  private archUpdate: (elapsed: number, delta: number) => void;
  private archSetBanner: (title: string, home: string, away: string) => void;
  private archDispose: () => void;

  private isSoftwareGl: boolean;
  private isMobileDevice: boolean;
  private clock = new THREE.Clock();
  private frameId = 0;
  private disposed = false;
  private resizeObserver: ResizeObserver;

  private currentDelta: SeatStateDelta = { heldByMe: [], heldByOthers: [], booked: [], holdExpiresAt: {} };
  private currentSelected = new Set<string>();
  private currentHoveredSeat: SeatRecord | null = null;
  private currentSectionId: string | null = null;
  private currentTierFilter: SeatTier | 'ALL' = 'ALL';

  constructor(container: HTMLElement, callbacks: StadiumSceneCallbacks) {
    this.container = container;
    this.isSoftwareGl = detectSoftwareWebGL();
    this.isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 240);

    // 1. Renderer setup with adaptive pixel ratio for locked smooth framerate
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    const maxDpr = this.isSoftwareGl ? 1 : this.isMobileDevice ? 1.25 : 1.5;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && !this.isMobileDevice;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      callbacks.onContextLost?.();
    });
    canvas.addEventListener('webglcontextrestored', () => {
      callbacks.onContextRestored?.();
    });

    // 2. Scene, Fog & Studio Environment Map
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x030612);
    this.scene.fog = new THREE.FogExp2(0x030612, 0.0024);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 3. Camera & Controls (start with gentle auto-rotate showcase that stops on grab)
    this.camera = new THREE.PerspectiveCamera(48, width / height, 0.15, 600);
    this.camera.position.copy(OVERVIEW_POS);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.copy(OVERVIEW_TARGET);

    this.cameraController = new CameraController(this.camera, this.controls, this.isSoftwareGl);
    this.cameraController.setAutoRotate(true);

    this.seatViewController = new SeatViewController(
      this.camera,
      this.controls,
      this.renderer,
      this.scene,
      this.cameraController,
      this.isSoftwareGl,
    );

    // 4. Cricket Stadium Night Floodlight Rig
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x0b1325, 0.95);
    this.scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.0);
    keyLight.position.set(30, 68, 36);
    if (!this.isSoftwareGl && !this.isMobileDevice) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 5;
      keyLight.shadow.camera.far = 170;
      keyLight.shadow.camera.left = -80;
      keyLight.shadow.camera.right = 80;
      keyLight.shadow.camera.top = 80;
      keyLight.shadow.camera.bottom = -80;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x6366f1, 0.85);
    rimLight.position.set(-42, 48, -50);
    this.scene.add(rimLight);

    const pitchSpot = new THREE.PointLight(0xe0f2fe, 2.6, 120, 1.15);
    pitchSpot.position.set(0, 42, 0);
    this.scene.add(pitchSpot);

    // 5. Build Procedural Cricket Pitch, Architecture & 14,064 Instanced Seats
    const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const court = buildBasketballCourt(maxAnisotropy, this.isSoftwareGl);
    this.scene.add(court.group);
    this.courtDispose = court.dispose;

    const arch = buildStadiumArchitecture(maxAnisotropy);
    this.scene.add(arch.group);
    this.archUpdate = arch.update;
    this.archSetBanner = arch.setEventBanner;
    this.archDispose = arch.dispose;

    this.seatSystem = createSeatSystem(this.isSoftwareGl);
    this.scene.add(this.seatSystem.group);

    // 6. Interaction Manager (O(1) fast hover updates!)
    this.interaction = new SeatInteraction(this.camera, canvas, this.seatSystem, {
      onHoverSection: (sec, pos) => {
        this.seatSystem.setSectionHighlight(sec?.id || null, this.currentSectionId);
        callbacks.onHoverSection(sec, pos);
      },
      onSelectSection: (sec) => {
        callbacks.onSelectSection(sec);
      },
      onHoverSeat: (seat) => {
        const prev = this.currentHoveredSeat;
        if ((prev?.id || null) !== (seat?.id || null)) {
          this.currentHoveredSeat = seat;
          this.seatSystem.updateHoveredSeatFast(
            prev,
            seat,
            this.currentDelta,
            this.currentSelected,
            this.currentSectionId,
            this.currentTierFilter,
          );
        }
        callbacks.onHoverSeat(seat);
      },
      onSelectSeat: (seat) => {
        callbacks.onSelectSeat(seat);
      },
    });

    // 7. Half-Resolution Hardware Post-Processing (Desktop GPUs only for zero-lag 60fps)
    if (!this.isSoftwareGl && !this.isMobileDevice) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(Math.floor(width * 0.5), Math.floor(height * 0.5)),
        0.24,
        0.35,
        0.9,
      );
      this.composer.addPass(this.bloomPass);
      this.renderer.compile(this.scene, this.camera);
    }

    // 8. Responsive Resize Observer
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    // 9. Start Render Loop
    this.tick();
  }

  private handleResize(): void {
    if (this.disposed) return;
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    if (this.composer) {
      this.composer.setSize(width, height);
    }
    if (this.bloomPass) {
      this.bloomPass.resolution.set(Math.floor(width * 0.5), Math.floor(height * 0.5));
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = window.setTimeout(cb, 80);
    }
  }

  private tick = (): void => {
    if (this.disposed) return;

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsed = this.clock.elapsedTime;
    this.archUpdate(elapsed, delta);
    this.seatSystem.updateBeacon(elapsed);
    this.controls.update();

    if (this.composer && !this.isSoftwareGl && !this.isMobileDevice) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private refreshColors(): void {
    this.seatSystem.updateSeatColors(
      this.currentDelta,
      this.currentSelected,
      this.currentHoveredSeat?.id || null,
      this.currentSectionId,
      this.currentTierFilter,
    );
  }

  public syncState(params: {
    delta: SeatStateDelta;
    selectedIds: string[];
    activeSectionId: string | null;
    tierFilter: SeatTier | 'ALL';
    focusedSeat: SeatRecord | null;
  }): void {
    this.currentDelta = params.delta;
    this.currentSelected = new Set(params.selectedIds);
    this.currentSectionId = params.activeSectionId;
    this.currentTierFilter = params.tierFilter;

    this.seatSystem.setSectionHighlight(null, params.activeSectionId);
    this.seatSystem.setFocusedBeacon(params.focusedSeat);
    this.interaction.setMode(params.activeSectionId, this.seatViewController.active);
    this.refreshColors();
  }

  public setEvent(event: EventRecord): void {
    this.archSetBanner(event.title, event.homeTeam, event.awayTeam);
  }

  public setAutoRotate(enabled: boolean): void {
    this.cameraController.setAutoRotate(enabled);
  }

  public goToPreset(preset: CameraPreset): void {
    if (this.seatViewController.active) {
      this.seatViewController.exitSeatView();
    }
    this.cameraController.goToPreset(preset);
  }

  public focusSection(section: SectionDefinition): void {
    if (this.seatViewController.active) {
      this.seatViewController.exitSeatView();
    }
    this.cameraController.focusSection(section);
  }

  public focusTier(tier: SeatTier | 'ALL'): void {
    if (this.seatViewController.active) {
      this.seatViewController.exitSeatView();
    }
    this.cameraController.focusTier(tier);
  }

  public enterFirstPersonSeatView(seat: SeatRecord, onReady?: () => void): void {
    this.interaction.setMode(this.currentSectionId, true);
    this.seatViewController.enterSeatView(seat, onReady);
  }

  public exitFirstPersonSeatView(): void {
    this.seatViewController.exitSeatView();
    this.interaction.setMode(this.currentSectionId, false);
  }

  public captureSeatSnapshot(seat: SeatRecord): string {
    return this.seatViewController.captureSnapshotForSeat(seat);
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.resizeObserver.disconnect();
    this.interaction.dispose();
    this.cameraController.dispose();
    this.controls.dispose();
    this.seatSystem.dispose();
    this.courtDispose();
    this.archDispose();
    this.composer?.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
