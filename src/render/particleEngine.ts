import * as THREE from 'three';
import type { SystemSnapshot } from '../contracts/workflow';
import { buildTextPointCloud } from './textField';

type ParticleMode = 'AMBIENT_SWARM' | 'TEXT_FORMATION';

export class ParticleEngine {
  private readonly particleCount = 30000;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  private readonly clock = new THREE.Clock();
  private elapsedTime = 0;
  private particles!: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private material!: THREE.ShaderMaterial;
  private ambientPositions = new Float32Array(this.particleCount * 3);
  private targetPositions = new Float32Array(this.particleCount * 3);
  private mode: ParticleMode = 'AMBIENT_SWARM';
  private formationBlend = 0;
  private targetFormationBlend = 0;
  private dissolveTimer: number | null = null;
  private interaction = {
    pointer: new THREE.Vector2(2, 2),
    targetBurst: 0,
    burstStrength: 0,
    burstDecay: 1.8,
    direction: 1 as 1 | -1
  };

  constructor(private mountNode: HTMLElement) {
    this.camera.position.z = 400;
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.mountNode.appendChild(this.renderer.domElement);
    this.buildParticles();
  }

  private buildParticles(): void {
    const colors = new Float32Array(this.particleCount * 3);
    const phases = new Float32Array(this.particleCount);
    const responsiveness = new Float32Array(this.particleCount);

    for (let i = 0; i < this.particleCount; i += 1) {
      const r = 100 + Math.random() * 300;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      this.ambientPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      this.ambientPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      this.ambientPositions[i * 3 + 2] = r * Math.cos(phi);

      this.targetPositions[i * 3] = this.ambientPositions[i * 3];
      this.targetPositions[i * 3 + 1] = this.ambientPositions[i * 3 + 1];
      this.targetPositions[i * 3 + 2] = this.ambientPositions[i * 3 + 2];

      colors[i * 3] = 0.38;
      colors[i * 3 + 1] = 0.4;
      colors[i * 3 + 2] = 0.94;
      phases[i] = Math.random() * Math.PI * 2;
      responsiveness[i] = 0.7 + Math.random() * 0.8;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('ambientPosition', new THREE.BufferAttribute(this.ambientPositions, 3));
    geometry.setAttribute('targetPosition', new THREE.BufferAttribute(this.targetPositions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('responsiveness', new THREE.BufferAttribute(responsiveness, 1));

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        energy: { value: 0.2 },
        entropy: { value: 0.1 },
        pointerPosition: { value: new THREE.Vector2(2, 2) },
        burstStrength: { value: 0 },
        burstDecay: { value: this.interaction.burstDecay },
        interactionDirection: { value: 1.0 },
        stateMode: { value: 0.0 },
        formationBlend: { value: 0.0 }
      },
      vertexShader: `
        uniform float time;
        uniform float energy;
        uniform float entropy;
        uniform vec2 pointerPosition;
        uniform float burstStrength;
        uniform float burstDecay;
        uniform float interactionDirection;
        uniform float stateMode;
        uniform float formationBlend;
        attribute vec3 ambientPosition;
        attribute vec3 targetPosition;
        attribute vec3 color;
        attribute float phase;
        attribute float responsiveness;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec3 ambient = ambientPosition;
          float movement = sin(time * 0.5 + phase) * (20.0 * entropy) * (1.0 - formationBlend);
          ambient += normalize(ambient) * movement * (1.0 + energy);
          vec3 pos = mix(ambient, targetPosition, formationBlend);

          vec4 interactionMv = modelViewMatrix * vec4(pos, 1.0);
          vec4 interactionClip = projectionMatrix * interactionMv;
          vec2 particleNdc = interactionClip.xy / max(interactionClip.w, 0.0001);
          vec2 delta = pointerPosition - particleNdc;
          float dist = length(delta) + 0.0001;
          float pullPush = exp(-dist * (8.0 + burstDecay * 2.0));
          float stateForceScale = mix(0.45, 1.25, stateMode);
          float fieldForce = burstStrength * pullPush * responsiveness * stateForceScale * (1.0 - formationBlend * 0.45);
          pos.xy += normalize(delta) * fieldForce * 90.0 * interactionDirection;

          vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = (2.0 + energy * 3.0 + fieldForce * 5.0 + formationBlend * 1.2) * (300.0 / -mvPos.z);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          if (length(gl_PointCoord - vec2(0.5)) > 0.5) discard;
          gl_FragColor = vec4(vColor, 0.8);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.particles = new THREE.Points(geometry, this.material);
    this.scene.add(this.particles);
  }

  render(snapshot: SystemSnapshot): void {
    const deltaTime = this.clock.getDelta();
    this.elapsedTime += deltaTime;
    this.interaction.targetBurst = Math.max(0, this.interaction.targetBurst - this.interaction.burstDecay * deltaTime);
    this.interaction.burstStrength = THREE.MathUtils.lerp(this.interaction.burstStrength, this.interaction.targetBurst, 0.2);
    this.formationBlend = THREE.MathUtils.lerp(this.formationBlend, this.targetFormationBlend, 0.08);

    this.material.uniforms.time.value = this.elapsedTime;
    this.material.uniforms.energy.value = THREE.MathUtils.lerp(this.material.uniforms.energy.value, snapshot.energyLevel, 0.05);
    this.material.uniforms.entropy.value = THREE.MathUtils.lerp(this.material.uniforms.entropy.value, snapshot.entropyLevel, 0.05);
    this.material.uniforms.pointerPosition.value.copy(this.interaction.pointer);
    this.material.uniforms.burstStrength.value = this.interaction.burstStrength;
    this.material.uniforms.burstDecay.value = this.interaction.burstDecay;
    this.material.uniforms.interactionDirection.value = this.interaction.direction;
    this.material.uniforms.stateMode.value = this.mapStateToMode(snapshot.mode);
    this.material.uniforms.formationBlend.value = this.formationBlend;

    const spinScale = this.mode === 'TEXT_FORMATION' ? 0.15 : 1;
    this.particles.rotation.y += 0.001 * (1 + snapshot.energyLevel) * spinScale;
    this.renderer.render(this.scene, this.camera);
  }

  transitionToTextFormation(text: string, holdMs = 1800): void {
    this.mode = 'TEXT_FORMATION';
    const field = buildTextPointCloud({ text, count: this.particleCount });
    this.targetPositions.set(field);

    const targetAttr = this.particles.geometry.getAttribute('targetPosition') as THREE.BufferAttribute;
    targetAttr.needsUpdate = true;
    this.targetFormationBlend = 1;

    if (this.dissolveTimer !== null) window.clearTimeout(this.dissolveTimer);
    this.dissolveTimer = window.setTimeout(() => {
      this.targetFormationBlend = 0;
      this.mode = 'AMBIENT_SWARM';
    }, holdMs);
  }

  applyBurst(clientX: number, clientY: number, intensity: number, direction: 1 | -1 = 1): void {
    this.interaction.pointer.set(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1
    );
    this.interaction.direction = direction;
    this.interaction.targetBurst = Math.max(this.interaction.targetBurst, THREE.MathUtils.clamp(intensity, 0, 3));
  }

  applyColors(hexColors: string[]): void {
    const colors = hexColors.map((hex) => new THREE.Color(hex));
    const attrColors = this.particles.geometry.attributes.color.array as Float32Array;

    for (let i = 0; i < attrColors.length / 3; i += 1) {
      const c = colors[Math.floor(Math.random() * colors.length)] ?? new THREE.Color('#6366F1');
      attrColors[i * 3] = c.r;
      attrColors[i * 3 + 1] = c.g;
      attrColors[i * 3 + 2] = c.b;
    }

    this.particles.geometry.attributes.color.needsUpdate = true;
  }

  resize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private mapStateToMode(mode: SystemSnapshot['mode']): number {
    switch (mode) {
      case 'IDLE':
        return 0.15;
      case 'THINKING':
        return 0.55;
      case 'EMITTING':
        return 1.0;
      case 'COOLDOWN':
      default:
        return 0.3;
    }
  }
}
