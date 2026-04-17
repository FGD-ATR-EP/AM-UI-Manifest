import * as THREE from 'three';
import type { SystemSnapshot } from '../contracts/workflow';

export class ParticleEngine {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
  private renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  private clock = new THREE.Clock();
  private particles!: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private material!: THREE.ShaderMaterial;

  constructor(private mountNode: HTMLElement) {
    this.camera.position.z = 400;
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.mountNode.appendChild(this.renderer.domElement);
    this.buildParticles();
  }

  private buildParticles(): void {
    const count = 30000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const phases = new Float32Array(count);

    for (let i = 0; i < count; i += 1) {
      const r = 100 + Math.random() * 300;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      colors[i * 3] = 0.38;
      colors[i * 3 + 1] = 0.4;
      colors[i * 3 + 2] = 0.94;
      phases[i] = Math.random() * Math.PI * 2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        energy: { value: 0.2 },
        entropy: { value: 0.1 }
      },
      vertexShader: `
        uniform float time;
        uniform float energy;
        uniform float entropy;
        attribute vec3 color;
        attribute float phase;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec3 pos = position;
          float movement = sin(time * 0.5 + phase) * (20.0 * entropy);
          pos += normalize(pos) * movement * (1.0 + energy);
          vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = (2.0 + energy * 3.0) * (300.0 / -mvPos.z);
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
    this.material.uniforms.time.value = this.clock.getElapsedTime();
    this.material.uniforms.energy.value = THREE.MathUtils.lerp(this.material.uniforms.energy.value, snapshot.energyLevel, 0.05);
    this.material.uniforms.entropy.value = THREE.MathUtils.lerp(this.material.uniforms.entropy.value, snapshot.entropyLevel, 0.05);
    this.particles.rotation.y += 0.001 * (1 + snapshot.energyLevel);
    this.renderer.render(this.scene, this.camera);
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
}
