/**
 * GameEngine — Babylon.js scene orchestration for docking simulation.
 * Manages scene lifecycle, neon aesthetics, physics engine, and game state.
 *
 * ADR-XXX: Babylon 6DOF arcade physics for docking simulation gameplay.
 */

import * as BABYLON from '@babylonjs/core';

// Spawn the ship this many meters in front of the berth so the docking target
// is framed the moment the scene mounts.
const APPROACH_STANDOFF = 140;
// Arcade multiplier turning the (realistically weak) RCS thrust-to-mass ratio
// into usable acceleration for gameplay.
const THRUST_SCALE = 60;

export interface Ship {
  mass: number; // kg
  rcsThrust: number; // Newton per RCS thruster
  maxAngularVelocity: number; // rad/s
  maxLinearVelocity: number; // m/s
}

export interface Berth {
  centerPosition: { x: number; y: number; z: number };
  targetOrientation: { x: number; y: number; z: number; w: number };
  dockingPortDimensions: { width: number; height: number };
}

export interface GameEngineConfig {
  canvas: HTMLCanvasElement;
  ship: Ship;
  berth: Berth;
}

export interface PhysicsState {
  linearVelocity: { x: number; y: number; z: number };
  angularVelocity: { x: number; y: number; z: number };
  position: { x: number; y: number; z: number };
  orientation: { x: number; y: number; z: number; w: number };
  fuel: number;
  collisionCount: number;
}

export class GameEngine {
  private scene: BABYLON.Scene;
  private engine: BABYLON.Engine;
  private camera!: BABYLON.UniversalCamera;

  // Game objects
  private shipMesh: BABYLON.AbstractMesh | null = null;
  private berthMesh: BABYLON.AbstractMesh | null = null;
  private dockingPortMesh: BABYLON.AbstractMesh | null = null;

  // Physics state (arcade 6DOF)
  private state: PhysicsState = {
    linearVelocity: { x: 0, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 },
    position: { x: 0, y: 0, z: 0 },
    orientation: { x: 0, y: 0, z: 0, w: 1 },
    fuel: 100,
    collisionCount: 0,
  };

  private config: GameEngineConfig;
  private deltaTime = 0;
  private lastFrameTime = Date.now();

  constructor(config: GameEngineConfig) {
    this.config = config;

    // Begin at an approach standoff directly in front of the berth.
    this.state.position = {
      x: config.berth.centerPosition.x,
      y: config.berth.centerPosition.y,
      z: config.berth.centerPosition.z - APPROACH_STANDOFF,
    };

    this.engine = new BABYLON.Engine(config.canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });
    this.scene = this.createScene();

    // Babylon sizes its render buffer from the canvas; force a resize now that
    // the canvas is laid out, and keep it in sync with the viewport.
    this.engine.resize();
    window.addEventListener('resize', this.handleResize);
  }

  private handleResize = (): void => {
    this.engine.resize();
  };

  private createScene(): BABYLON.Scene {
    const scene = new BABYLON.Scene(this.engine);
    scene.gravity = BABYLON.Vector3.Zero(); // No gravity — pure 6DOF
    scene.clearColor = new BABYLON.Color4(0.01, 0.01, 0.05, 1); // Deep space blue

    this.setupCamera(scene);
    this.setupLighting(scene);
    this.setupEnvironment(scene);
    this.setupGameObjects(scene);

    return scene;
  }

  private setupCamera(scene: BABYLON.Scene): void {
    this.camera = new BABYLON.UniversalCamera(
      'camera',
      new BABYLON.Vector3(this.state.position.x, this.state.position.y, this.state.position.z),
      scene,
    );
    // No attachControl: the physics state is the only thing that moves the view.
    // The camera is aimed each frame from the ship's orientation quaternion (see
    // update()); we deliberately do not use the built-in input controllers.
    this.camera.speed = 0; // Manual control via physics
    this.camera.inertia = 0; // No built-in smoothing; physics owns the motion
    this.camera.minZ = 0.1;
    this.camera.maxZ = 6000; // keep the far berth and starfield inside the frustum
    this.camera.fov = 0.9;
    // Leave rotationQuaternion null on purpose: a UniversalCamera re-derives its
    // rotationQuaternion from the Euler `rotation` every frame, so a quaternion
    // written straight onto the camera is silently overwritten and the view
    // never turns. We drive `camera.rotation` (Euler) from physics instead.
    this.camera.rotationQuaternion = null;
  }

  private setupLighting(scene: BABYLON.Scene): void {
    scene.ambientColor = new BABYLON.Color3(0.3, 0.3, 0.4);

    // Fill light so lit surfaces read against deep space.
    const ambientLight = new BABYLON.HemisphericLight('ambient', new BABYLON.Vector3(0, 1, 0), scene);
    ambientLight.intensity = 0.8;
    ambientLight.diffuse = new BABYLON.Color3(0.6, 0.6, 0.8);
    ambientLight.groundColor = new BABYLON.Color3(0.2, 0.2, 0.3);

    // Key light travelling down the approach axis toward the berth.
    const keyLight = new BABYLON.DirectionalLight('key', new BABYLON.Vector3(0, -0.2, 1), scene);
    keyLight.intensity = 0.9;
    keyLight.diffuse = new BABYLON.Color3(0.8, 0.85, 1);

    // Docking-port glow, anchored on the berth so it reaches the target.
    const portLight = new BABYLON.PointLight(
      'portLight',
      new BABYLON.Vector3(
        this.config.berth.centerPosition.x,
        this.config.berth.centerPosition.y,
        this.config.berth.centerPosition.z,
      ),
      scene,
    );
    portLight.intensity = 1.2;
    portLight.range = 600;
    portLight.diffuse = new BABYLON.Color3(0, 0.4, 1); // Blue
  }

  private setupEnvironment(scene: BABYLON.Scene): void {
    // Distant stars (particle system)
    const starGeo = BABYLON.MeshBuilder.CreateBox('star', { size: 0.1 }, scene);
    const starMaterial = new BABYLON.StandardMaterial('starMat', scene);
    starMaterial.emissiveColor = new BABYLON.Color3(1, 1, 1);
    starGeo.material = starMaterial;
    starGeo.isVisible = false;

    // Scatter stars across a large shell surrounding the whole play volume so
    // the starfield frames the scene from every angle rather than clustering in
    // front of the berth.
    for (let i = 0; i < 300; i++) {
      const star = starGeo.createInstance(`star_${i}`);
      star.position.x = (Math.random() - 0.5) * 4000;
      star.position.y = (Math.random() - 0.5) * 4000;
      star.position.z = (Math.random() - 0.5) * 4000;
      const s = 0.5 + Math.random() * 1.5;
      star.scaling = new BABYLON.Vector3(s, s, s);
    }
  }

  private setupGameObjects(scene: BABYLON.Scene): void {
    const center = this.config.berth.centerPosition;

    // Berth (docking station) — lit neon hull so it reads at approach range.
    this.berthMesh = BABYLON.MeshBuilder.CreateCylinder('berth', {
      height: 50,
      diameter: 30,
    }, scene);
    this.berthMesh.material = this.createNeonMaterial(scene, 'berth', { r: 0.35, g: 0.4, b: 0.6 }, true);
    this.berthMesh.position = new BABYLON.Vector3(center.x, center.y, center.z);

    // Docking port (glowing target) — on the face turned toward the approach.
    const portDim = this.config.berth.dockingPortDimensions;
    this.dockingPortMesh = BABYLON.MeshBuilder.CreateBox('port', {
      width: portDim.width,
      height: portDim.height,
      depth: 2,
    }, scene);
    this.dockingPortMesh.material = this.createNeonMaterial(scene, 'port', { r: 0, g: 0.8, b: 1 }, true);
    this.dockingPortMesh.position = new BABYLON.Vector3(center.x, center.y, center.z - 25);
  }

  private createNeonMaterial(
    scene: BABYLON.Scene,
    name: string,
    color: { r: number; g: number; b: number },
    emissive = false,
  ): BABYLON.StandardMaterial {
    const mat = new BABYLON.StandardMaterial(`${name}_mat`, scene);
    mat.diffuseColor = new BABYLON.Color3(color.r, color.g, color.b);
    mat.specularColor = new BABYLON.Color3(1, 1, 1);
    mat.specularPower = 64;

    // Every surface gets a self-lit floor so nothing renders pure black; the
    // neon targets glow at full colour.
    mat.emissiveColor = emissive
      ? new BABYLON.Color3(color.r, color.g, color.b)
      : new BABYLON.Color3(color.r * 0.25, color.g * 0.25, color.b * 0.25);

    return mat;
  }

  /**
   * Apply thrust impulse (6DOF: 3 translation axes, 3 rotation axes).
   */
  public applyThrust(thrustVector: number[], magnitude: number): void {
    if (this.state.fuel <= 0) return;

    // Convert the RCS thrust-to-mass ratio into an arcade acceleration.
    const accel =
      (this.config.ship.rcsThrust / this.config.ship.mass) *
      THRUST_SCALE *
      this.deltaTime;
    const angAccel = accel * 0.5;

    // Linear impulse
    this.state.linearVelocity.x += thrustVector[0] * accel;
    this.state.linearVelocity.y += thrustVector[1] * accel;
    this.state.linearVelocity.z += thrustVector[2] * accel;

    // Angular impulse
    this.state.angularVelocity.x += thrustVector[3] * angAccel;
    this.state.angularVelocity.y += thrustVector[4] * angAccel;
    this.state.angularVelocity.z += thrustVector[5] * angAccel;

    // Consume fuel
    this.state.fuel = Math.max(0, this.state.fuel - magnitude * this.deltaTime * 5);
  }

  /**
   * Update physics and render one frame.
   */
  public update(): PhysicsState {
    const now = Date.now();
    this.deltaTime = Math.min((now - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = now;

    // Arcade damping so the ship settles when thrust stops.
    const linDamp = 0.995;
    const angDamp = 0.98;
    this.state.linearVelocity.x *= linDamp;
    this.state.linearVelocity.y *= linDamp;
    this.state.linearVelocity.z *= linDamp;
    this.state.angularVelocity.x *= angDamp;
    this.state.angularVelocity.y *= angDamp;
    this.state.angularVelocity.z *= angDamp;

    // Clamp linear velocity
    const speed = Math.sqrt(
      this.state.linearVelocity.x ** 2 +
      this.state.linearVelocity.y ** 2 +
      this.state.linearVelocity.z ** 2,
    );
    if (speed > this.config.ship.maxLinearVelocity) {
      const scale = this.config.ship.maxLinearVelocity / speed;
      this.state.linearVelocity.x *= scale;
      this.state.linearVelocity.y *= scale;
      this.state.linearVelocity.z *= scale;
    }

    // Clamp angular velocity
    const angSpeed = Math.sqrt(
      this.state.angularVelocity.x ** 2 +
      this.state.angularVelocity.y ** 2 +
      this.state.angularVelocity.z ** 2,
    );
    if (angSpeed > this.config.ship.maxAngularVelocity) {
      const scale = this.config.ship.maxAngularVelocity / angSpeed;
      this.state.angularVelocity.x *= scale;
      this.state.angularVelocity.y *= scale;
      this.state.angularVelocity.z *= scale;
    }

    // Update position
    this.state.position.x += this.state.linearVelocity.x * this.deltaTime;
    this.state.position.y += this.state.linearVelocity.y * this.deltaTime;
    this.state.position.z += this.state.linearVelocity.z * this.deltaTime;

    // Update orientation (simplified)
    const angMag = Math.sqrt(
      this.state.angularVelocity.x ** 2 +
      this.state.angularVelocity.y ** 2 +
      this.state.angularVelocity.z ** 2,
    );
    if (angMag > 0.001) {
      const theta = angMag * this.deltaTime;
      const axis = new BABYLON.Vector3(
        this.state.angularVelocity.x / angMag,
        this.state.angularVelocity.y / angMag,
        this.state.angularVelocity.z / angMag,
      );
      const deltaQuat = BABYLON.Quaternion.RotationAxis(axis, theta);
      const current = BABYLON.Quaternion.FromArray([
        this.state.orientation.x,
        this.state.orientation.y,
        this.state.orientation.z,
        this.state.orientation.w,
      ]);
      const newQuat = current.multiply(deltaQuat).normalize();
      this.state.orientation.x = newQuat.x;
      this.state.orientation.y = newQuat.y;
      this.state.orientation.z = newQuat.z;
      this.state.orientation.w = newQuat.w;
    }

    // First-person camera follows the ship. Convert the orientation quaternion
    // to Euler angles and feed the camera's `rotation` (yaw/pitch/roll) — the
    // representation a UniversalCamera actually renders from. This carries all
    // three rotational axes, including roll.
    this.camera.position.set(
      this.state.position.x,
      this.state.position.y,
      this.state.position.z,
    );
    const orientation = new BABYLON.Quaternion(
      this.state.orientation.x,
      this.state.orientation.y,
      this.state.orientation.z,
      this.state.orientation.w,
    );
    this.camera.rotation.copyFrom(orientation.toEulerAngles());

    // Collision detection
    if (this.dockingPortMesh) {
      const dist = Math.sqrt(
        (this.state.position.x - this.config.berth.centerPosition.x) ** 2 +
        (this.state.position.y - this.config.berth.centerPosition.y) ** 2 +
        (this.state.position.z - this.config.berth.centerPosition.z) ** 2,
      );

      if (dist < 5) {
        const pushBackX = (this.config.berth.centerPosition.x - this.state.position.x) / dist * -5;
        const pushBackY = (this.config.berth.centerPosition.y - this.state.position.y) / dist * -5;
        const pushBackZ = (this.config.berth.centerPosition.z - this.state.position.z) / dist * -5;

        this.state.position.x += pushBackX;
        this.state.position.y += pushBackY;
        this.state.position.z += pushBackZ;

        this.state.linearVelocity.x *= 0.7;
        this.state.linearVelocity.y *= 0.7;
        this.state.linearVelocity.z *= 0.7;
      }
    }

    return { ...this.state };
  }

  /**
   * Render the scene.
   */
  public render(): void {
    this.engine.runRenderLoop(() => {
      this.update();
      this.scene.render();
    });
  }

  /**
   * Start the render loop.
   */
  public start(): void {
    this.render();
  }

  /**
   * Stop the render loop and clean up.
   */
  public stop(): void {
    this.engine.stopRenderLoop();
  }

  /**
   * Dispose of all resources.
   */
  public dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.handleResize);
    this.scene.dispose();
    this.engine.dispose();
  }

  /**
   * Get current game state.
   */
  public getState(): PhysicsState {
    return { ...this.state };
  }

  /**
   * Get the Babylon scene.
   */
  public getScene(): BABYLON.Scene {
    return this.scene;
  }
}
