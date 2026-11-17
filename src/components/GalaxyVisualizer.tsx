import { onMount, onCleanup, createEffect, type Component } from "solid-js";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { AudioEngine } from "../core/audioEngine";

interface GalaxyVisualizerProps {
  active: boolean;
  audioEngine: AudioEngine;
  color: string;
}

const PARTICLE_COUNT = 110000;
const CORE_COUNT = Math.floor(PARTICLE_COUNT * 0.12);
const ARMS = 4;
const GALAXY_RADIUS = 9;
const SPIN = 1.05;
const STAR_COUNT = 1600;

const galaxyVertexShader = `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uBass;
  uniform float uBeat;
  uniform float uRadius;
  uniform vec3 uColorInner;
  uniform vec3 uColorMid;
  uniform vec3 uColorOuter;

  attribute float aScale;
  attribute float aSeed;
  attribute float aRadius;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec3 pos = position;

    float dist = max(length(pos.xz), 0.0001);
    float t = clamp(aRadius / uRadius, 0.0, 1.0);
    float seedPhase = aSeed * 6.2831853;

    float angle = atan(pos.x, pos.z);
    angle += uTime * (0.24 + uBass * 0.22 + uBeat * 0.06);
    angle += sin(uTime * 0.5 - dist * 0.45 + seedPhase) * 0.05 * (1.0 + uBass * 1.2);
    pos.x = sin(angle) * dist;
    pos.z = cos(angle) * dist;

    float ripple = sin(uTime * 1.3 - dist * 0.8 + seedPhase);
    pos.xz *= 1.0 + ripple * (0.012 + uBass * 0.06 + uBeat * 0.02);

    pos.y += sin(uTime * 0.9 + seedPhase + dist * 0.6) * (0.12 + uBass * 0.3);
    pos.y *= 1.0 + uBass * 0.45;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float twinkle = 0.72 + 0.35 * sin(uTime * 2.0 + aSeed * 47.0);
    gl_PointSize = uSize * aScale * twinkle * (1.0 + uBass * 0.4) * uPixelRatio * (26.0 / max(1.0, -mvPosition.z));
    gl_PointSize *= mix(0.5, 1.0, smoothstep(0.0, 0.35, t));
    gl_PointSize = clamp(gl_PointSize, 0.8, 16.0);

    vec3 col = mix(uColorInner, uColorMid, smoothstep(0.0, 0.55, t));
    col = mix(col, uColorOuter, smoothstep(0.55, 1.0, t));
    col *= 0.68 * (0.55 + 0.35 * aScale) * mix(0.45, 1.0, smoothstep(0.0, 0.3, t));
    col *= 0.92 + ripple * 0.12 * (0.6 + uBass * 0.8);

    vColor = col;
    vAlpha = (1.0 - smoothstep(0.8, 1.0, t) * 0.55) * (0.82 + 0.14 * sin(uTime * 1.5 + seedPhase * 5.0));
  }
`;

const galaxyFragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float core = smoothstep(0.3, 0.0, d);
    float halo = smoothstep(0.5, 0.15, d);
    float alpha = (core + halo * 0.5) * vAlpha;
    if (alpha < 0.02) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

function gaussian(): number {
  return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
}

function makeGlowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.22, "rgba(255,255,255,0.5)");
  gradient.addColorStop(0.55, "rgba(255,255,255,0.11)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeBackgroundTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size * 0.5, size * 0.56, 10, size * 0.5, size * 0.56, size * 0.72);
  gradient.addColorStop(0, "#0c1533");
  gradient.addColorStop(0.32, "#070b1d");
  gradient.addColorStop(0.68, "#03040c");
  gradient.addColorStop(1, "#010104");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const GalaxyVisualizer: Component<GalaxyVisualizerProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let renderer: THREE.WebGLRenderer;
  let composer: EffectComposer;
  let bloomPass: UnrealBloomPass;
  let galaxy: THREE.Points;
  let galaxyGeometry: THREE.BufferGeometry;
  let galaxyMaterial: THREE.ShaderMaterial;
  let coreGlow: THREE.Sprite;
  let hazeGroup: THREE.Group;
  let hazeSprites: THREE.Sprite[] = [];
  let starField: THREE.Points;
  let glowTexture: THREE.CanvasTexture;
  let backgroundTexture: THREE.CanvasTexture;
  let rafId: number | null = null;
  let startTime = 0;
  let prevTime = 0;
  let bass = 0;
  let lowAvg = 0;
  let beatPulse = 0;
  let lastBeat = 0;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

  function buildGalaxy() {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const scales = new Float32Array(PARTICLE_COUNT);
    const seeds = new Float32Array(PARTICLE_COUNT);
    const radii = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const isCore = i < CORE_COUNT;
      let radius: number;
      let angle: number;
      let y: number;

      if (isCore) {
        radius = Math.pow(Math.random(), 2) * 3;
        angle = Math.random() * Math.PI * 2;
        y = gaussian() * 0.32 * (1 - radius / 3.6);
      } else {
        radius = 0.6 + Math.pow(Math.random(), 1.6) * (GALAXY_RADIUS - 0.6);
        const branchAngle = ((i % ARMS) / ARMS) * Math.PI * 2;
        const armScatter = 0.12 + 0.35 * (1 - radius / GALAXY_RADIUS);
        angle = branchAngle + radius * SPIN + gaussian() * armScatter;
        y = gaussian() * (0.08 + 0.28 * Math.pow(1 - radius / GALAXY_RADIUS, 2));
      }

      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(angle) * radius;

      scales[i] = 0.45 + Math.pow(Math.random(), 2) * 1.7;
      seeds[i] = Math.random();
      radii[i] = radius;
    }

    galaxyGeometry = new THREE.BufferGeometry();
    galaxyGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    galaxyGeometry.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
    galaxyGeometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    galaxyGeometry.setAttribute("aRadius", new THREE.BufferAttribute(radii, 1));

    galaxyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 1.9 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uBass: { value: 0 },
        uBeat: { value: 0 },
        uRadius: { value: GALAXY_RADIUS },
        uColorInner: { value: new THREE.Color("#d8ecff") },
        uColorMid: { value: new THREE.Color("#5aa7ff") },
        uColorOuter: { value: new THREE.Color("#5b4bff") },
      },
      vertexShader: galaxyVertexShader,
      fragmentShader: galaxyFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    galaxy = new THREE.Points(galaxyGeometry, galaxyMaterial);
    galaxy.frustumCulled = false;
    scene.add(galaxy);
  }

  function buildAtmosphere() {
    coreGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: new THREE.Color("#d8ecff"),
        transparent: true,
        opacity: 0.1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    coreGlow.position.set(0, 0, 0);
    coreGlow.scale.set(2.0, 2.0, 1);
    scene.add(coreGlow);

    hazeGroup = new THREE.Group();
    hazeSprites = [];
    const mid = new THREE.Color("#5aa7ff");
    const outer = new THREE.Color("#5b4bff");

    for (let i = 0; i < 16; i++) {
      const radius = 1.4 + Math.pow(Math.random(), 0.8) * 7.2;
      const branchAngle = (i % ARMS) / ARMS * Math.PI * 2;
      const angle = branchAngle + radius * SPIN + gaussian() * 0.5;
      const material = new THREE.SpriteMaterial({
        map: glowTexture,
        color: (i % 2 === 0 ? mid : outer).clone(),
        transparent: true,
        opacity: 0.012 + Math.random() * 0.018,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.position.set(
        Math.cos(angle) * radius,
        (Math.random() - 0.5) * 0.5,
        Math.sin(angle) * radius
      );
      const scale = 3 + Math.random() * 6;
      sprite.scale.set(scale, scale, 1);
      hazeGroup.add(sprite);
      hazeSprites.push(sprite);
    }

    scene.add(hazeGroup);

    const starPositions = new Float32Array(STAR_COUNT * 3);
    const starColors = new Float32Array(STAR_COUNT * 3);
    const starColor = new THREE.Color();
    for (let i = 0; i < STAR_COUNT; i++) {
      const r = 24 + Math.random() * 20;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi) * 0.6;
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      starColor.setHSL(0.58 + Math.random() * 0.08, 0.25 + Math.random() * 0.4, 0.65 + Math.random() * 0.3);
      starColors[i * 3] = starColor.r;
      starColors[i * 3 + 1] = starColor.g;
      starColors[i * 3 + 2] = starColor.b;
    }

    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute("color", new THREE.BufferAttribute(starColors, 3));

    starField = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        size: 0.35,
        map: glowTexture,
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      })
    );
    starField.frustumCulled = false;
    scene.add(starField);
  }

  function applyPalette(hex: string) {
    const base = new THREE.Color(hex);
    const white = new THREE.Color("#ffffff");
    const dusk = new THREE.Color("#7aa2ff");
    const violet = new THREE.Color("#4b3bff");

    const inner = base.clone().lerp(white, 0.45);
    const mid = base.clone().lerp(dusk, 0.35);
    const outer = base.clone().lerp(violet, 0.6).multiplyScalar(0.85);

    if (galaxyMaterial) {
      (galaxyMaterial.uniforms.uColorInner.value as THREE.Color).copy(inner);
      (galaxyMaterial.uniforms.uColorMid.value as THREE.Color).copy(mid);
      (galaxyMaterial.uniforms.uColorOuter.value as THREE.Color).copy(outer);
    }
    if (coreGlow) {
      (coreGlow.material as THREE.SpriteMaterial).color.copy(inner);
    }
    hazeSprites.forEach((sprite, i) => {
      (sprite.material as THREE.SpriteMaterial).color.copy(i % 2 === 0 ? mid : outer);
    });
  }

  function initScene() {
    scene = new THREE.Scene();
    backgroundTexture = makeBackgroundTexture();
    scene.background = backgroundTexture;

    camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
    camera.position.set(0, 8.5, 16);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.62;

    if (containerRef) {
      containerRef.appendChild(renderer.domElement);
    }

    glowTexture = makeGlowTexture();
    buildGalaxy();
    buildAtmosphere();
    applyPalette(props.color);

    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.24, 0.28, 0.62);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
  }

  function resize() {
    if (!containerRef || !renderer || !composer || !galaxyMaterial) return;
    const w = containerRef.clientWidth || window.innerWidth;
    const h = containerRef.clientHeight || window.innerHeight;
    renderer.setSize(w, h);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    galaxyMaterial.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  }

  function animate() {
    rafId = requestAnimationFrame(animate);

    const now = performance.now();
    const elapsed = (now - startTime) / 1000;
    const dt = Math.min(0.1, Math.max(0.001, (now - prevTime) / 1000));
    prevTime = now;

    let target = 0;
    if (props.active && props.audioEngine.playing) {
      const raw = props.audioEngine.getAnalyserData();
      let low = 0;
      for (let i = 1; i <= 8; i++) low += raw[i];
      target = Math.min(1, low / (8 * 160));
      lowAvg += (target - lowAvg) * Math.min(1, dt * 2);
      if (target > lowAvg * 1.25 + 0.03 && elapsed - lastBeat > 0.22) {
        lastBeat = elapsed;
        beatPulse = 1;
      }
    } else {
      const phase = (elapsed % 2.1) / 2.1;
      beatPulse = Math.max(beatPulse * 0.95, Math.pow(1 - phase, 5) * 0.32);
    }
    beatPulse *= Math.exp(-dt * 3.6);
    bass += (target - bass) * Math.min(1, dt * 4);

    galaxyMaterial.uniforms.uTime.value = elapsed;
    galaxyMaterial.uniforms.uBass.value = bass;
    galaxyMaterial.uniforms.uBeat.value = beatPulse;
    bloomPass.strength = 0.24 + bass * 0.12 + beatPulse * 0.03;

    const pulse = 1 + bass * 0.3 + beatPulse * 0.12;
    coreGlow.scale.set(2.0 * pulse, 2.0 * pulse, 1);
    (coreGlow.material as THREE.SpriteMaterial).opacity = 0.1 + bass * 0.1 + beatPulse * 0.04;
    coreGlow.position.y = Math.sin(elapsed * 0.5) * 0.08;

    hazeGroup.rotation.y = elapsed * 0.2;
    starField.rotation.y = elapsed * 0.012;

    pointer.x += (pointer.tx - pointer.x) * 0.03;
    pointer.y += (pointer.ty - pointer.y) * 0.03;

    camera.position.x = Math.sin(elapsed * 0.15) * 2.6 + pointer.x * 1.6;
    camera.position.y = 8.2 + Math.sin(elapsed * 0.23) * 0.9 - pointer.y * 0.9;
    camera.position.z = 15.5 + Math.cos(elapsed * 0.12) * 1.8 - beatPulse * 0.25;
    camera.lookAt(pointer.x * 0.25, 0.2 + pointer.y * 0.18 + Math.sin(elapsed * 0.19) * 0.15, 0);

    composer.render();
  }

  function onPointerMove(e: PointerEvent) {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }

  onMount(() => {
    startTime = performance.now();
    prevTime = startTime;
    initScene();
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove);
    rafId = requestAnimationFrame(animate);

    onCleanup(() => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      (bloomPass as unknown as { dispose?: () => void }).dispose?.();
      composer.dispose();
      renderer.dispose();
      galaxyGeometry.dispose();
      galaxyMaterial.dispose();
      starField.geometry.dispose();
      (starField.material as THREE.Material).dispose();
      hazeSprites.forEach((sprite) => (sprite.material as THREE.Material).dispose());
      (coreGlow.material as THREE.Material).dispose();
      glowTexture.dispose();
      backgroundTexture.dispose();
      if (containerRef && renderer.domElement.parentElement === containerRef) {
        containerRef.removeChild(renderer.domElement);
      }
    });
  });

  createEffect(() => {
    applyPalette(props.color);
    resize();
  });

  return <div ref={containerRef} class="absolute inset-0 w-full h-full pointer-events-none" style={{ display: props.active ? "" : "none" }} />;
};

export default GalaxyVisualizer;
