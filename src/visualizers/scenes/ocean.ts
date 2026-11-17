import * as THREE from "three";
import type { AudioFrame, SceneInstance } from "./types";
import { createSkyDome, disposeScene, makeGlowTexture } from "./utils";

export function createOceanScene(): SceneInstance {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 900);
  camera.position.set(0, 5.6, 12);

  const sky = createSkyDome({
    top: "#040a2a",
    middle: "#3a1a54",
    horizon: "#ff8a5c",
    radius: 500,
  });
  scene.add(sky);

  const glowTexture = makeGlowTexture(128);
  const sunPosition = new THREE.Vector3(24, 26, -220);
  const sunGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xffa45e,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  sunGlow.position.copy(sunPosition);
  sunGlow.scale.set(110, 110, 1);
  scene.add(sunGlow);

  const sunCore = new THREE.Mesh(
    new THREE.CircleGeometry(13, 64),
    new THREE.MeshBasicMaterial({ color: 0xffd9a8, toneMapped: false }),
  );
  sunCore.position.copy(sunPosition);
  sunCore.lookAt(camera.position);
  scene.add(sunCore);

  const uniforms = {
    uTime: { value: 0 },
    uBass: { value: 0 },
    uMid: { value: 0 },
    uTreble: { value: 0 },
    uBeat: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.2, 0.15, -1).normalize() },
  };

  const geometry = new THREE.PlaneGeometry(420, 420, 170, 170);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      uniform float uTime;
      uniform float uBass;
      uniform float uMid;
      uniform float uTreble;
      uniform float uBeat;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vHeight;

      float wave(vec2 p) {
        float t = uTime;
        float w = 0.0;
        w += sin(p.x * 0.16 + t * 0.85) * 0.42;
        w += sin(p.y * 0.21 - t * 0.62) * 0.34;
        w += sin((p.x + p.y) * 0.1 + t * 0.47) * 0.5;
        w += sin(p.x * 0.47 - p.y * 0.31 + t * 1.15) * 0.12;
        w *= 0.55 + uBass * 1.9 + uBeat * 0.45;
        w += sin(p.x * 1.3 + t * 2.4) * 0.055 * uMid;
        w += sin(p.y * 1.7 - t * 2.1) * 0.045 * uTreble;
        return w;
      }

      void main() {
        vec3 pos = position;
        float height = wave(pos.xz);
        pos.y += height;
        vHeight = height;

        float eps = 0.4;
        float hx = wave(pos.xz + vec2(eps, 0.0));
        float hz = wave(pos.xz + vec2(0.0, eps));
        vNormal = normalize(vec3(height - hx, eps, height - hz));

        vec4 world = modelMatrix * vec4(pos, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform vec3 uSunDir;
      uniform float uBass;
      uniform float uTreble;
      uniform float uBeat;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vHeight;

      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(cameraPosition - vWorld);
        float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        float dist = length(cameraPosition.xz - vWorld.xz);
        float fade = smoothstep(70.0, 215.0, dist);

        vec3 deep = vec3(0.006, 0.035, 0.11);
        vec3 shallow = vec3(0.03, 0.22, 0.36);
        vec3 water = mix(deep, shallow, smoothstep(-0.5, 1.3, vHeight) * 0.8);
        float waveLight = 0.5 + 0.5 * max(dot(N, normalize(vec3(0.35, 0.85, 0.3))), 0.0);
        water *= 0.55 + waveLight * 0.9;

        vec3 skyReflection = mix(vec3(0.12, 0.07, 0.24), vec3(0.9, 0.42, 0.3), 0.5 + N.y * 0.5);
        vec3 color = mix(water, skyReflection, fresnel * 0.42);

        vec3 R = reflect(-normalize(uSunDir), N);
        float spec = pow(max(dot(R, V), 0.0), 120.0);
        float glint = pow(max(dot(R, V), 0.0), 16.0) * 0.05;
        color += vec3(1.0, 0.68, 0.38) * (spec * 0.65 + glint) * (1.0 + uBass * 0.8 + uBeat * 0.5);

        float foam = smoothstep(0.85, 1.35, vHeight) * (0.35 + uTreble * 0.9);
        color += vec3(0.6, 0.78, 1.0) * foam * 0.16;

        vec3 horizon = vec3(0.95, 0.42, 0.36);
        color = mix(color, horizon, fade * 0.9);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  const ocean = new THREE.Mesh(geometry, material);
  ocean.position.z = -105;
  ocean.frustumCulled = false;
  scene.add(ocean);

  function update(frame: AudioFrame) {
    const { time, bass, mid, treble, beat } = frame;
    uniforms.uTime.value = time;
    uniforms.uBass.value = bass;
    uniforms.uMid.value = mid;
    uniforms.uTreble.value = treble;
    uniforms.uBeat.value = beat;

    const sunDirection = sunPosition.clone().sub(camera.position).normalize();
    uniforms.uSunDir.value.copy(sunDirection);

    camera.position.x = Math.sin(time * 0.055) * 2.2;
    camera.position.y = 6.2 + Math.sin(time * 0.33) * 0.22 + bass * 0.5 + beat * 0.35;
    camera.position.z = 12 - Math.sin(time * 0.04) * 1.4;
    camera.lookAt(sunPosition.x * 0.45, 3.4 + bass * 1.5, -120);

    sky.position.set(camera.position.x, 0, camera.position.z);
    sunGlow.material.opacity = 0.3 + bass * 0.14 + beat * 0.06;
    const glowScale = 78 + bass * 14;
    sunGlow.scale.set(glowScale, glowScale, 1);
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

  return { scene, camera, update, resize, dispose, bloom: 0.3, bloomRadius: 0.35, bloomThreshold: 0.9 };
}
