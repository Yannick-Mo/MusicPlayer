import * as THREE from "three";

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const damp = (current: number, target: number, lambda: number, dt: number): number =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function spectrumRange(spectrum: Uint8Array, from: number, to: number): number {
  const length = spectrum.length;
  const start = Math.max(1, Math.floor(from * length));
  const end = Math.max(start + 1, Math.floor(to * length));
  let sum = 0;
  for (let i = start; i < end; i++) sum += spectrum[i];
  return clamp(sum / ((end - start) * 255), 0, 1);
}

export function spectrumAt(spectrum: Uint8Array, t: number): number {
  const position = clamp(t, 0, 1) * (spectrum.length - 1);
  const index = Math.floor(position);
  const next = Math.min(spectrum.length - 1, index + 1);
  const mix = position - index;
  return clamp(lerp(spectrum[index], spectrum[next], mix) / 255, 0, 1);
}

export function makeGlowTexture(size = 64): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.25, "rgba(255,255,255,0.85)");
    gradient.addColorStop(0.55, "rgba(255,255,255,0.28)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export interface SkyOptions {
  top: string;
  middle: string;
  horizon: string;
  radius?: number;
}

export function createSkyDome(options: SkyOptions): THREE.Mesh {
  const radius = options.radius ?? 300;
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(options.top) },
      uMiddle: { value: new THREE.Color(options.middle) },
      uHorizon: { value: new THREE.Color(options.horizon) },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform vec3 uTop;
      uniform vec3 uMiddle;
      uniform vec3 uHorizon;
      varying vec3 vWorld;
      void main() {
        float h = normalize(vWorld).y;
        vec3 color = mix(uHorizon, uMiddle, smoothstep(-0.04, 0.25, h));
        color = mix(color, uTop, smoothstep(0.2, 0.85, h));
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 24), material);
  dome.frustumCulled = false;
  return dome;
}

export function createStarField(
  count: number,
  innerRadius: number,
  outerRadius: number,
  size = 0.5,
  opacity = 0.75,
): THREE.Points {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const radius = innerRadius + Math.random() * (outerRadius - innerRadius);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    color.setHSL(0.55 + Math.random() * 0.12, 0.3 + Math.random() * 0.4, 0.6 + Math.random() * 0.35);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size,
    map: makeGlowTexture(),
    vertexColors: true,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return points;
}

export function disposeScene(root: THREE.Object3D): void {
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = (object as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!material) return;
    const list = Array.isArray(material) ? material : [material];
    list.forEach((entry) => {
      const record = entry as unknown as Record<string, unknown>;
      for (const key of Object.keys(record)) {
        const value = record[key];
        if (value instanceof THREE.Texture) textures.add(value);
      }
      const uniforms = (entry as THREE.ShaderMaterial).uniforms;
      if (uniforms) {
        for (const key of Object.keys(uniforms)) {
          const value = uniforms[key]?.value;
          if (value instanceof THREE.Texture) textures.add(value);
        }
      }
      entry.dispose();
    });
  });
  textures.forEach((texture) => texture.dispose());
}
