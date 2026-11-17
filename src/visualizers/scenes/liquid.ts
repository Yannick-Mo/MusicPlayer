import * as THREE from "three";
import { ImprovedNoise } from "three/examples/jsm/math/ImprovedNoise.js";
import type { AudioFrame, SceneInstance } from "./types";
import { createSkyDome, createStarField, disposeScene, makeGlowTexture } from "./utils";

function createEnvironmentTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const background = ctx.createLinearGradient(0, 0, 0, canvas.height);
    background.addColorStop(0, "#05030f");
    background.addColorStop(0.45, "#0d1240");
    background.addColorStop(0.62, "#2a1550");
    background.addColorStop(1, "#05030c");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const blobs: Array<[number, number, number, string, number]> = [
      [180, 150, 110, "rgba(120,180,255,0.85)", 0.9],
      [420, 110, 80, "rgba(255,140,230,0.8)", 0.8],
      [700, 170, 120, "rgba(255,210,150,0.7)", 0.75],
      [900, 130, 90, "rgba(150,120,255,0.9)", 0.8],
      [300, 320, 150, "rgba(60,220,255,0.4)", 0.6],
      [820, 360, 130, "rgba(255,90,180,0.45)", 0.5],
    ];
    for (const [x, y, radius, color, strength] of blobs) {
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, color);
      gradient.addColorStop(strength, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }

    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 18; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height * 0.55;
      const width = 40 + Math.random() * 160;
      const height = 2 + Math.random() * 6;
      const gradient = ctx.createLinearGradient(x, y, x + width, y);
      gradient.addColorStop(0, "rgba(255,255,255,0)");
      gradient.addColorStop(0.5, "rgba(255,255,255,0.55)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, width, height);
    }
    ctx.globalAlpha = 1;
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createLiquidScene(): SceneInstance {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03040c);
  scene.fog = new THREE.FogExp2(0x04050f, 0.018);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  camera.position.set(0, 0.6, 5.4);

  const envTexture = createEnvironmentTexture();
  scene.environment = envTexture;

  scene.add(
    createSkyDome({
      top: "#020309",
      middle: "#071030",
      horizon: "#1c0b34",
      radius: 140,
    }),
  );
  const stars = createStarField(1000, 26, 70, 0.55, 0.6);
  scene.add(stars);

  const geometry = new THREE.SphereGeometry(1.62, 112, 72);
  const basePositions = Float32Array.from(geometry.attributes.position.array);
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xc9d6ff,
    metalness: 1,
    roughness: 0.3,
    envMapIntensity: 0.65,
    iridescence: 0.9,
    iridescenceIOR: 1.65,
    iridescenceThicknessRange: [120, 780],
    clearcoat: 0.3,
    clearcoatRoughness: 0.5,
  });
  const orb = new THREE.Mesh(geometry, material);
  scene.add(orb);

  const glowTexture = makeGlowTexture(128);
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0x7a8dff,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  glow.position.set(0, 0, -2.2);
  glow.scale.set(7.8, 7.8, 1);
  scene.add(glow);

  const particleCount = 700;
  const particlePositions = new Float32Array(particleCount * 3);
  const particleColors = new Float32Array(particleCount * 3);
  const particleColor = new THREE.Color();
  for (let i = 0; i < particleCount; i++) {
    const radius = 2.3 + Math.random() * 2.0;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    particlePositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    particlePositions[i * 3 + 1] = radius * Math.cos(phi);
    particlePositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    particleColor.setHSL(0.55 + Math.random() * 0.22, 0.65, 0.7);
    particleColors[i * 3] = particleColor.r;
    particleColors[i * 3 + 1] = particleColor.g;
    particleColors[i * 3 + 2] = particleColor.b;
  }
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
  particleGeometry.setAttribute("color", new THREE.BufferAttribute(particleColors, 3));
  const particles = new THREE.Points(
    particleGeometry,
    new THREE.PointsMaterial({
      size: 0.055,
      map: glowTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    }),
  );
  particles.frustumCulled = false;
  scene.add(particles);

  const light = new THREE.DirectionalLight(0xbcd4ff, 0.3);
  light.position.set(3, 4, 5);
  scene.add(light);
  const rim = new THREE.PointLight(0xff6ad5, 5, 12, 2);
  rim.position.set(-3.2, -1.4, -3);
  scene.add(rim);

  const noise = new ImprovedNoise();
  const positionAttribute = geometry.attributes.position as THREE.BufferAttribute;
  const baseVector = new THREE.Vector3();

  function update(frame: AudioFrame) {
    const { time, bass, mid, beat } = frame;
    const positionArray = positionAttribute.array as Float32Array;
    const breathe = 1 + bass * 0.1 + beat * 0.035;
    for (let i = 0; i < positionArray.length; i += 3) {
      const bx = basePositions[i];
      const by = basePositions[i + 1];
      const bz = basePositions[i + 2];
      baseVector.set(bx, by, bz).normalize();
      const nx = baseVector.x;
      const ny = baseVector.y;
      const nz = baseVector.z;
      const swell =
        noise.noise(nx * 1.15 + time * 0.16, ny * 1.15, nz * 1.15 + time * 0.05) * 0.21 +
        noise.noise(nx * 2.6 - time * 0.1, ny * 2.6 + time * 0.12, nz * 2.6) * 0.075 +
        Math.sin(ny * 5.0 + time * 0.9) * 0.022;
      const spike = Math.pow(Math.max(0, noise.noise(nx * 3.4, ny * 3.4 + time * 0.2, nz * 3.4)), 3) * bass * 0.55;
      const radius = 1.62 * (swell + 1 + bass * 0.2 + spike) * breathe;
      positionArray[i] = nx * radius;
      positionArray[i + 1] = ny * radius * (1 + mid * 0.05);
      positionArray[i + 2] = nz * radius;
    }
    positionAttribute.needsUpdate = true;
    geometry.computeVertexNormals();

    orb.rotation.y = time * 0.12;
    orb.rotation.x = Math.sin(time * 0.18) * 0.12;

    particles.rotation.y = time * 0.16;
    particles.rotation.x = Math.sin(time * 0.11) * 0.15;
    const particleScale = 1 + bass * 0.18;
    particles.scale.set(particleScale, particleScale, particleScale);

    glow.material.opacity = 0.1 + bass * 0.12 + beat * 0.05;
    const glowScale = 8.2 + bass * 1.2 + beat * 0.8;
    glow.scale.set(glowScale, glowScale, 1);
    glow.position.y = Math.sin(time * 0.4) * 0.15;

    rim.intensity = 4 + bass * 5 + beat * 3;

    stars.rotation.y = time * 0.005;
    const orbit = Math.sin(time * 0.07) * 0.55;
    camera.position.x = Math.sin(orbit) * 5.3;
    camera.position.z = Math.cos(orbit) * 5.3;
    camera.position.y = 0.7 + Math.sin(time * 0.21) * 0.28 + bass * 0.25 - beat * 0.35;
    camera.lookAt(0, 0, 0);
  }

  function resize(width: number, height: number) {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function dispose() {
    disposeScene(scene);
    envTexture.dispose();
    scene.environment = null;
    scene.clear();
  }

  update({
    time: 0,
    dt: 0.016,
    playing: false,
    bass: 0.14,
    mid: 0.09,
    treble: 0.06,
    energy: 0.1,
    beat: 0,
    spectrum: new Uint8Array(128),
  });

  return { scene, camera, update, resize, dispose, bloom: 0.26, bloomRadius: 0.35, bloomThreshold: 0.92 };
}
