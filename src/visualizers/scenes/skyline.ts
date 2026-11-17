import * as THREE from "three";
import type { AudioFrame, SceneInstance } from "./types";
import { GLSL_HASH } from "./shader-utils";
import { clamp, createSkyDome, damp, disposeScene, makeGlowTexture, spectrumAt } from "./utils";

const CITY_SIZE = 24;
const CITY_SPACING = 7;

export function createSkylineScene(): SceneInstance {
  const scene = new THREE.Scene();
  const fogColor = new THREE.Color(0x140722);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 600);
  camera.position.set(0, 16.5, 46);

  scene.add(
    createSkyDome({
      top: "#020108",
      middle: "#120630",
      horizon: "#521038",
      radius: 420,
    }),
  );

  const glowTexture = makeGlowTexture(128);
  const haze = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xff3f9a,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  haze.position.set(-34, 34, -150);
  haze.scale.set(120, 120, 1);
  scene.add(haze);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(460, 460),
    new THREE.MeshStandardMaterial({ color: 0x06020f, metalness: 0.8, roughness: 0.35 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -90);
  scene.add(ground);

  const grid = new THREE.GridHelper(440, 110, 0x8b3fff, 0x3a1370);
  grid.position.set(0, 0.03, -90);
  const gridMaterial = grid.material as THREE.LineBasicMaterial;
  gridMaterial.transparent = true;
  gridMaterial.opacity = 0.3;
  gridMaterial.depthWrite = false;
  gridMaterial.blending = THREE.AdditiveBlending;
  scene.add(grid);

  const fogUniforms = {
    uFogColor: { value: fogColor.clone() },
    uFogDensity: { value: 0.0068 },
  };

  const uniforms = {
    ...fogUniforms,
    uTime: { value: 0 },
    uBass: { value: 0 },
    uMid: { value: 0 },
    uTreble: { value: 0 },
    uBeat: { value: 0 },
  };

  const buildingMaterial = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec3 vWorld;
      varying vec3 vNormalW;
      varying vec2 vUv;
      varying float vScale;

      void main() {
        #ifdef USE_INSTANCING
          mat4 im = instanceMatrix;
        #else
          mat4 im = mat4(1.0);
        #endif
        vec4 world = modelMatrix * im * vec4(position, 1.0);
        vWorld = world.xyz;
        vNormalW = normalize(mat3(modelMatrix) * mat3(im) * normal);
        vUv = uv;
        vScale = length(im[1].xyz);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uBass;
      uniform float uMid;
      uniform float uTreble;
      uniform float uBeat;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      varying vec3 vWorld;
      varying vec3 vNormalW;
      varying vec2 vUv;
      varying float vScale;

      ${GLSL_HASH}

      void main() {
        vec3 N = normalize(vNormalW);
        float side = step(0.5, abs(N.y));

        float horizontal = abs(N.x) > 0.5 ? vWorld.z : vWorld.x;
        vec2 coord = vec2(horizontal * 0.7, vWorld.y * 1.0);
        vec2 cell = floor(coord);
        vec2 cellUv = fract(coord);

        float windowMask = step(0.16, cellUv.x) * step(cellUv.x, 0.84)
          * step(0.24, cellUv.y) * step(cellUv.y, 0.76) * (1.0 - side);
        float seed = hash21(cell + 3.7);
        float lit = 0.45 + 0.55 * hash21(cell * 1.3 + 1.1);
        lit *= 0.75 + 0.25 * sin(uTime * 1.6 + seed * 43.0);

        vec3 cyan = vec3(0.15, 0.85, 1.0);
        vec3 pink = vec3(1.0, 0.2, 0.7);
        vec3 amber = vec3(1.0, 0.65, 0.25);
        vec3 windowColor = mix(cyan, pink, step(0.5, hash21(cell * 0.7 + 5.0)));
        windowColor = mix(windowColor, amber, step(0.82, hash21(cell * 1.9 + 2.0)));

        vec3 base = mix(vec3(0.014, 0.01, 0.035), vec3(0.05, 0.025, 0.09), fract(vWorld.y * 0.35));
        vec3 color = base;
        color += windowColor * windowMask * lit * (0.38 + uBass * 0.55 + uBeat * 0.3);
        color += windowColor * windowMask * uTreble * 0.2;

        float topGlow = smoothstep(vScale - 0.9, vScale, vWorld.y) * (1.0 - side);
        vec3 neon = mix(cyan, pink, clamp(vScale / 30.0, 0.0, 1.0));
        color += neon * topGlow * (0.22 + uMid * 0.5);

        float fogDistance = distance(cameraPosition, vWorld);
        float fogFactor = 1.0 - exp(-pow(fogDistance * uFogDensity, 2.0));
        color = mix(color, uFogColor, clamp(fogFactor, 0.0, 1.0));

        float rainStreak = smoothstep(0.996, 1.0, hash21(floor(vWorld.xz * 40.0) + floor(uTime * 6.0))) * 0.04;
        color += vec3(0.5, 0.65, 1.0) * rainStreak;

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });

  const buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
  buildingGeometry.translate(0, 0.5, 0);
  const count = CITY_SIZE * CITY_SIZE;
  const buildings = new THREE.InstancedMesh(buildingGeometry, buildingMaterial, count);
  buildings.frustumCulled = false;
  scene.add(buildings);

  const dummy = new THREE.Object3D();
  const baseHeights = new Float32Array(count);
  const currentHeights = new Float32Array(count);
  const positionsX = new Float32Array(count);
  const positionsZ = new Float32Array(count);
  let index = 0;
  for (let row = 0; row < CITY_SIZE; row++) {
    for (let column = 0; column < CITY_SIZE; column++) {
      const x = (column - (CITY_SIZE - 1) / 2) * CITY_SPACING + (Math.random() - 0.5) * 1.2;
      const z = (row - (CITY_SIZE - 1) / 2) * CITY_SPACING - 60 + (Math.random() - 0.5) * 1.2;
      positionsX[index] = x;
      positionsZ[index] = z;
      const distanceFromCenter = Math.sqrt(x * x + (z + 60) * (z + 60));
      const base = 3 + Math.random() * 20 * (1 - clamp(distanceFromCenter / 150, 0, 0.7));
      baseHeights[index] = base;
      currentHeights[index] = base;
      dummy.position.set(x, 0, z);
      dummy.scale.set(2.2 + Math.random() * 2.4, base, 2.2 + Math.random() * 2.4);
      dummy.updateMatrix();
      buildings.setMatrixAt(index, dummy.matrix);
      index++;
    }
  }
  buildings.instanceMatrix.needsUpdate = true;
  const scaleX = new Float32Array(count);
  const scaleZ = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    buildings.getMatrixAt(i, dummy.matrix);
    scaleX[i] = new THREE.Vector3().setFromMatrixScale(dummy.matrix).x;
    scaleZ[i] = new THREE.Vector3().setFromMatrixScale(dummy.matrix).z;
  }

  const rainCount = 1600;
  const rainPositions = new Float32Array(rainCount * 3);
  const rainSpeeds = new Float32Array(rainCount);
  for (let i = 0; i < rainCount; i++) {
    rainPositions[i * 3] = (Math.random() - 0.5) * 140;
    rainPositions[i * 3 + 1] = Math.random() * 60;
    rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 180 - 40;
    rainSpeeds[i] = 16 + Math.random() * 26;
  }
  const rainGeometry = new THREE.BufferGeometry();
  rainGeometry.setAttribute("position", new THREE.BufferAttribute(rainPositions, 3));
  const rain = new THREE.Points(
    rainGeometry,
    new THREE.PointsMaterial({
      color: 0x9ab8ff,
      size: 0.16,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    }),
  );
  rain.frustumCulled = false;
  scene.add(rain);

  const cityCenterZ = -60;

  function update(frame: AudioFrame) {
    const { time, dt, bass, mid, treble, beat, spectrum } = frame;
    uniforms.uTime.value = time;
    uniforms.uBass.value = bass;
    uniforms.uMid.value = mid;
    uniforms.uTreble.value = treble;
    uniforms.uBeat.value = beat;

    for (let i = 0; i < count; i++) {
      const x = positionsX[i];
      const z = positionsZ[i];
      const frequency = clamp((x + 90) / 180, 0, 1) * 0.75 + 0.04;
      const level = spectrumAt(spectrum, frequency) * 0.85 + bass * 0.5 + 0.1;
      const target = baseHeights[i] * (0.62 + level * 0.72) + beat * baseHeights[i] * 0.05;
      currentHeights[i] = damp(currentHeights[i], target, 4.6, dt);
      dummy.position.set(x, 0, z);
      dummy.scale.set(scaleX[i], currentHeights[i], scaleZ[i]);
      dummy.updateMatrix();
      buildings.setMatrixAt(i, dummy.matrix);
    }
    buildings.instanceMatrix.needsUpdate = true;

    const rainArray = rainGeometry.attributes.position.array as Float32Array;
    for (let i = 0; i < rainCount; i++) {
      rainArray[i * 3 + 1] -= rainSpeeds[i] * dt;
      rainArray[i * 3] += dt * 2.2;
      if (rainArray[i * 3 + 1] < 0) {
        rainArray[i * 3 + 1] = 55 + Math.random() * 15;
        rainArray[i * 3] = (Math.random() - 0.5) * 140;
        rainArray[i * 3 + 2] = (Math.random() - 0.5) * 180 - 40;
      }
    }
    rainGeometry.attributes.position.needsUpdate = true;

    camera.position.x = Math.sin(time * 0.06) * 14;
    camera.position.y = 16.5 + Math.sin(time * 0.17) * 1.2 + bass * 1.0;
    camera.position.z = 46 + Math.cos(time * 0.045) * 7 - beat * 1.5;
    camera.lookAt(Math.sin(time * 0.05) * 10, 11.5 + bass * 2.0, cityCenterZ);

    haze.material.opacity = 0.1 + bass * 0.1 + beat * 0.05;
    const hazeScale = 110 + bass * 25;
    haze.scale.set(hazeScale, hazeScale, 1);
    gridMaterial.opacity = 0.22 + mid * 0.2 + beat * 0.08;
  }

  function resize(width: number, height: number) {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function dispose() {
    disposeScene(scene);
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

  return { scene, camera, update, resize, dispose, bloom: 0.34, bloomRadius: 0.45, bloomThreshold: 0.85 };
}
