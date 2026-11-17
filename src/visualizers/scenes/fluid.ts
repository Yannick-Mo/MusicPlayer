import * as THREE from "three";
import type { AudioFrame, SceneInstance } from "./types";
import { GLSL_NOISE } from "./shader-utils";
import { disposeScene } from "./utils";

export function createFluidScene(): SceneInstance {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 1;

  const uniforms = {
    uTime: { value: 0 },
    uBass: { value: 0 },
    uMid: { value: 0 },
    uTreble: { value: 0 },
    uBeat: { value: 0 },
    uAspect: { value: 1 },
    uImpulse: { value: 0 },
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
      uniform float uImpulse;
      varying vec2 vUv;

      ${GLSL_NOISE}

      void main() {
        vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 2.0;
        float t = uTime * 0.11;

        vec2 q = vec2(
          fbm3(vec3(p * 1.1, t)),
          fbm3(vec3(p * 1.1 + 5.2, t + 1.3))
        );
        vec2 warp = p + q * (0.55 + uBass * 0.45);
        vec2 r = vec2(
          fbm3(vec3(warp * 1.7 + 1.7, t + 2.4)),
          fbm3(vec3(warp * 1.7 + 9.2, t + 4.1))
        );

        float ink = fbm3(vec3(p * 2.0 + q * 0.8 + r * 0.65, t * 1.35 + uMid * 0.25));
        float fine = fbm3(vec3(p * 4.6 + r * 1.4, t * 1.8 + 3.0));

        float density = smoothstep(0.02, 1.05, ink + fine * 0.22);
        float filaments = pow(0.5 + 0.5 * sin(ink * 8.0 + fine * 3.0 - uTime * 0.7), 22.0);
        float ribbons = pow(0.5 + 0.5 * sin(ink * 3.4 + length(p) * 2.0 + q.x * 2.5 - uTime * 0.35), 6.0);

        vec3 blue = vec3(0.04, 0.3, 1.0);
        vec3 magenta = vec3(1.0, 0.12, 0.78);
        vec3 gold = vec3(1.0, 0.78, 0.34);
        vec3 teal = vec3(0.05, 0.9, 0.75);

        float hue = clamp(ink * 0.55 + 0.5 + q.y * 0.25, 0.0, 1.0);
        vec3 color = mix(blue, magenta, smoothstep(0.15, 0.85, hue));
        color = mix(color, teal, smoothstep(0.35, 0.95, r.x * 0.5 + 0.5 - uTreble * 0.3) * 0.45);
        color = mix(color, gold, smoothstep(0.55, 0.95, filaments + fine * 0.3));

        float glow = density * (0.5 + uBass * 0.55) + ribbons * 0.09 + filaments * (0.42 + uTreble * 0.6);
        vec3 col = color * glow;

        float burst = uImpulse * exp(-length(p) * 1.8);
        col += mix(magenta, gold, 0.35) * burst * 0.3;

        vec3 background = mix(vec3(0.003, 0.005, 0.018), vec3(0.03, 0.014, 0.09), r.y * 0.5 + 0.5);
        float vignette = 1.0 - smoothstep(0.65, 1.55, length(p)) * 0.65;
        col = (col + background) * vignette;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  plane.frustumCulled = false;
  scene.add(plane);

  let impulse = 0;
  let lastBeat = 0;

  function update(frame: AudioFrame) {
    const { time, dt, bass, mid, treble, beat } = frame;
    uniforms.uTime.value = time;
    uniforms.uBass.value = bass;
    uniforms.uMid.value = mid;
    uniforms.uTreble.value = treble;
    uniforms.uBeat.value = beat;

    if (beat > 0.55 && time - lastBeat > 0.3) {
      lastBeat = time;
      impulse = 1;
    }
    impulse *= Math.exp(-dt * 2.2);
    uniforms.uImpulse.value = impulse;
  }

  function resize(width: number, height: number) {
    uniforms.uAspect.value = width / Math.max(1, height);
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

  return { scene, camera, update, resize, dispose, bloom: 0.26, bloomRadius: 0.4, bloomThreshold: 0.85, pixelRatio: 1 };
}
