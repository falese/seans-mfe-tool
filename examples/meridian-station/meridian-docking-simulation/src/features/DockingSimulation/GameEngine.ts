/**
 * GameEngine — Babylon.js scene orchestration for docking simulation.
 * Manages scene lifecycle, neon aesthetics, physics engine, and game state.
 *
 * ADR-XXX: Babylon 6DOF arcade physics for docking simulation gameplay.
 */

import * as BABYLON from '@babylonjs/core';
import HavokPlugin from '@babylonjs/havok';

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
  private physicsEngine: BABYLON.PhysicsEngine | null = null;

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
    this.engine = new BABYLON.Engine(config.canvas, true);
    this.scene = this.createScene();
    this.physicsEngine = this.initializePhysics();
  }

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
    this.camera = new BABYLON.UniversalCamera('camera', new BABYLON.Vector3(0, 0, -510), scene);
    this.camera.attachControl(this.engine.getRenderingCanvas()!, true);
    this.camera.speed = 0; // Manual control via physics
    this.camera.angularSensibility = 1000; // Low sensitivity; we handle input separately
    this.camera.inertia = 0.7;

    // First-person view: start far behind berth, looking forward
    this.camera.position = new BABYLON.Vector3(0, 0, -510);
  }

  private setupLighting(scene: BABYLON.Scene): void {
    // Ambient light — dark space
    const ambientLight = new BABYLON.HemisphericLight('ambient', new BABYLON.Vector3(0, 1, 0), scene);
    ambientLight.intensity = 0.3;
    ambientLight.diffuse = new BABYLON.Color3(0.1, 0.1, 0.2);

    // Docking port glow
    const portLight = new BABYLON.PointLight('portLight', new BABYLON.Vector3(0, 0, 50), scene);
    portLight.intensity = 1.5;
    portLight.range = 200;
    portLight.diffuse = new BABYLON.Color3(0, 0.4, 1); // Blue

    // Distant stars as ambient
    const starsLight = new BABYLON.PointLight('starsLight', new BABYLON.Vector3(-100, 100, -100), scene);
    starsLight.intensity = 0.2;
    starsLight.range = 300;
  }

  private setupEnvironment(scene: BABYLON.Scene): void {
    // Distant stars (particle system)
    const starGeo = BABYLON.MeshBuilder.CreateBox('star', { size: 0.1 }, scene);
    const starMaterial = new BABYLON.StandardMaterial('starMat', scene);
    starMaterial.emissiveColor = new BABYLON.Color3(1, 1, 1);
    starGeo.material = starMaterial;
    starGeo.isVisible = false;

    // Create a sparse grid of stars
    for (let i = 0; i < 100; i++) {
      const star = starGeo.createInstance(`star_${i}`);
      star.position.x = (Math.random() - 0.5) * 2000;
      star.position.y = (Math.random() - 0.5) * 2000;
      star.position.z = (Math.random() + 0.5) * 500; // Behind the camera
      star.scaling = new BABYLON.Vector3(0.2, 0.2, 0.2);
    }
  }

  private setupGameObjects(scene: BABYLON.Scene): void {
    // Berth (docking station)
    this.berthMesh = BABYLON.MeshBuilder.CreateCylinder('berth', {
      height: 50,
      diameter: 30,
    }, scene);
    const berthMat = this.createNeonMaterial(scene, 'berth', { r: 0.2, g: 0.2, b: 0.3 });
    this.berthMesh.material = berthMat;
    this.berthMesh.position = new BABYLON.Vector3(
      this.config.berth.centerPosition.x,
      this.config.berth.centerPosition.y,
      this.config.berth.centerPosition.z,
    );

    // Docking port (glowing target)
    const portDim = this.config.berth.dockingPortDimensions;
    this.dockingPortMesh = BABYLON.MeshBuilder.CreateBox('port', {
      width: portDim.width,
      height: portDim.height,
      depth: 2,
    }, scene);
    const portMat = this.createNeonMaterial(scene, 'port', { r: 0, g: 0.6, b: 1 }, true);
    this.dockingPortMesh.material = portMat;
    this.dockingPortMesh.position = new BABYLON.Vector3(
      this.config.berth.centerPosition.x,
      this.config.berth.centerPosition.y,
      this.config.berth.centerPosition.z + 25,
    );
  }

  private createNeonMaterial(
    scene: BABYLON.Scene,
    name: string,
    color: { r: number; g: number; b: number },
    emissive = false,
  ): BABYLON.StandardMaterial {
    const mat = new BABYLON.StandardMaterial(`${name}_mat`, scene);
    mat.diffuse = new BABYLON.Color3(color.r, color.g, color.b);
    mat.specularColor = new BABYLON.Color3(1, 1, 1);
    mat.specularPower = 64;

    if (emissive) {
      mat.emissiveColor = new BABYLON.Color3(color.r * 0.75, color.g * 0.75, color.b * 0.75);
    }

    return mat;
  }

  private initializePhysics(): BABYLON.PhysicsEngine | null {
    try {
      // For now, skip physics setup — use simple distance-based collision detection
      return null;
    } catch (e) {
      console.warn('[GameEngine] Physics init failed, using arcade collision only', e);
      return null;
    }
  }

  /**
   * Apply thrust impulse (6DOF: 3 translation axes, 3 rotation axes).
   */
  public applyThrust(thrustVector: number[], magnitude: number): void {
    if (this.state.fuel < 0) return;

    const maxThrust = this.config.ship.rcsThrust * magnitude;
    const maxTorque = maxThrust * 0.5;

    // Linear acceleration
    const accelX = thrustVector[0] * maxThrust * this.deltaTime / this.config.ship.mass;
    const accelY = thrustVector[1] * maxThrust * this.deltaTime / this.config.ship.mass;
    const accelZ = thrustVector[2] * maxThrust * this.deltaTime / this.config.ship.mass;

    this.state.linearVelocity.x += accelX;
    this.state.linearVelocity.y += accelY;
    this.state.linearVelocity.z += accelZ;

    // Damping
    this.state.linearVelocity.x *= 0.98;
    this.state.linearVelocity.y *= 0.98;
    this.state.linearVelocity.z *= 0.98;

    // Clamp velocity
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

    // Angular velocity
    const angAccelX = thrustVector[3] * maxTorque * this.deltaTime;
    const angAccelY = thrustVector[4] * maxTorque * this.deltaTime;
    const angAccelZ = thrustVector[5] * maxTorque * this.deltaTime;

    this.state.angularVelocity.x += angAccelX;
    this.state.angularVelocity.y += angAccelY;
    this.state.angularVelocity.z += angAccelZ;

    // Damping and clamp
    this.state.angularVelocity.x *= 0.98;
    this.state.angularVelocity.y *= 0.98;
    this.state.angularVelocity.z *= 0.98;

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

    // Consume fuel
    this.state.fuel = Math.max(0, this.state.fuel - magnitude * this.deltaTime * 10);
  }

  /**
   * Update physics and render one frame.
   */
  public update(): PhysicsState {
    const now = Date.now();
    this.deltaTime = Math.min((now - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = now;

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
      const euler = BABYLON.Quaternion.FromArray([
        this.state.orientation.x,
        this.state.orientation.y,
        this.state.orientation.z,
        this.state.orientation.w,
      ]);
      const newQuat = BABYLON.Quaternion.Multiply(euler, deltaQuat);
      this.state.orientation.x = newQuat.x;
      this.state.orientation.y = newQuat.y;
      this.state.orientation.z = newQuat.z;
      this.state.orientation.w = newQuat.w;
    }

    // Update camera
    this.camera.position = new BABYLON.Vector3(
      this.state.position.x,
      this.state.position.y + 0.5,
      this.state.position.z,
    );
    // Look at the berth (target ahead of current position)
    const lookAheadDistance = 100;
    this.camera.setTarget(new BABYLON.Vector3(
      this.state.position.x,
      this.state.position.y,
      this.state.position.z + lookAheadDistance,
    ));
    this.camera.rotationQuaternion = new BABYLON.Quaternion(
      this.state.orientation.x,
      this.state.orientation.y,
      this.state.orientation.z,
      this.state.orientation.w,
    );

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
