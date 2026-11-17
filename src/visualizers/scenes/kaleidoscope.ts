import * as THREE from "three";
import type { AudioFrame, SceneInstance } from "./types";
import { GLSL_HASH, GLSL_NOISE } from "./shader-utils";
import { disposeScene } from "./utils";

export function createKaleidoscopeScene(): SceneInstance {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 1;

  const spectrumData = new Uint8Array(128);
  const spectrumTexture = new THREE.DataTexture(spectrumData, 128, 1, THREE.RedFormat);
  spectrumTexture.minFilter = THREE.LinearFilter;
  spectrumTexture.magFilter = THREE.LinearFilter;
  spectrumTexture.needsUpdate = true;

  const uniforms = {
    uTime: { value: 0 },
    uBass: { value: 0 },
    uMid: { value: 0 },
    uTreble: { value: 0 },
    uBeat: { value: 0 },
    uAspect: { value: 1 },
    uSpectrum: { value: spectrumTexture },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    depthTest: false,
    depthWrite: false,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uBass;
      uniform float uMid;
      uniform float uTreble;
      uniform float uBeat;
      uniform float uAspect;
      uniform sampler2D uSpectrum;
      varying vec2 vUv;

      #define PI 3.14159265359

      ${GLSL_HASH}
      ${GLSL_NOISE}

      void main() {
        vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 2.0;
        float r = length(p);
        float angle = atan(p.y, p.x) + uTime * (0.08 + uBass * 0.25);
        float seg = PI / 4.0;
        angle = mod(angle, seg);
        angle = abs(angle - seg * 0.5);

        float zoom = 1.0 - uBeat * 0.09;
        r *= zoom;

        float spectrum = texture2D(uSpectrum, vec2(clamp(r * 0.32, 0.0, 1.0), 0.5)).r;

        float ringWarp = sin(angle * 3.0 + uTime * 0.4) * 0.35 + spectrum * 1.4;
        float lines = pow(0.5 + 0.5 * sin(r * 17.0 - uTime * 1.35 + ringWarp), 26.0);
        float fineLines = pow(0.5 + 0.5 * sin(r * 41.0 + uTime * 0.9), 40.0) * 0.8;
        float rays = pow(0.5 + 0.5 * sin(angle * 28.0 + uTime * 0.5), 22.0) * smoothstep(1.35, 0.0, r);
        float halo = exp(-r * 2.4) * (0.36 + uBass * 0.55);

        vec3 magenta = vec3(1.0, 0.18, 0.78);
        vec3 cyan = vec3(0.12, 0.88, 1.0);
        vec3 gold = vec3(1.0, 0.78, 0.32);

        vec3 color = mix(magenta, cyan, clamp(angle / seg, 0.0, 1.0));
        color = mix(color, gold, clamp(spectrum * 0.8 + uTreble * 0.4, 0.0, 1.0));
        color = mix(color, cyan, smoothstep(0.55, 1.25, r) * 0.55);

        float intensity = lines * (0.3 + uMid * 0.8) + fineLines * (0.18 + uTreble * 0.55) + rays * (0.22 + uTreble * 0.6) + halo;
        vec3 col = color * intensity;

        vec3 background = mix(vec3(0.012, 0.004, 0.05), vec3(0.05, 0.012, 0.12), smoothstep(0.0, 1.4, r));
        float stars = step(0.9965, hash21(floor(vUv * vec2(520.0, 300.0)))) * (0.16 + uTreble * 0.32);
        background += stars * vec3(0.45, 0.6, 1.0);

        col += background;
        col += cyan * exp(-r * 5.0) * (0.12 + uBass * 0.22);
        col *= 1.0 - smoothstep(0.75, 1.6, r) * 0.55;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  plane.frustumCulled = false;
  scene.add(plane);

  function update(frame: AudioFrame) {
    const { time, bass, mid, treble, beat, spectrum } = frame;
    for (let i = 0; i < spectrumData.length; i++) {
      spectrumData[i] = spectrum[Math.min(i, spectrum.length - 1)];
    }
    spectrumTexture.needsUpdate = true;
    uniforms.uTime.value = time;
    uniforms.uBass.value = bass;
    uniforms.uMid.value = mid;
    uniforms.uTreble.value = treble;
    uniforms.uBeat.value = beat;
  }

  function resize(width: number, height: number) {
    uniforms.uAspect.value = width / Math.max(1, height);
  }

  function dispose() {
    spectrumTexture.dispose();
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

  return { scene, camera, update, resize, dispose, bloom: 0.3, bloomRadius: 0.4, bloomThreshold: 0.85 };
}
