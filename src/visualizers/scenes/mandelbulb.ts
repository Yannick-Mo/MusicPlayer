import * as THREE from "three";
import type { AudioFrame, SceneInstance } from "./types";
import { GLSL_HASH } from "./shader-utils";
import { disposeScene } from "./utils";

export function createMandelbulbScene(): SceneInstance {
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
      varying vec2 vUv;

      #define MAX_STEPS 84
      #define POWER 8.0

      ${GLSL_HASH}

      mat2 rot(float a) {
        float c = cos(a);
        float s = sin(a);
        return mat2(c, -s, s, c);
      }

      float de(vec3 pos) {
        vec3 z = pos;
        float dr = 1.0;
        float r = 0.0;
        for (int i = 0; i < 9; i++) {
          r = length(z);
          if (r > 2.0) break;
          float theta = acos(z.z / max(r, 1e-5));
          float phi = atan(z.y, z.x);
          dr = pow(r, POWER - 1.0) * POWER * dr + 1.0;
          float zr = pow(r, POWER);
          theta *= POWER;
          phi *= POWER;
          z = zr * vec3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta)) + pos;
        }
        return 0.5 * log(max(r, 1e-5)) * r / dr;
      }

      vec3 calcNormal(vec3 p) {
        vec2 e = vec2(0.0012, 0.0);
        return normalize(vec3(
          de(p + e.xyy) - de(p - e.xyy),
          de(p + e.yxy) - de(p - e.yxy),
          de(p + e.yyx) - de(p - e.yyx)
        ));
      }

      void main() {
        vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 2.0;
        float angle = uTime * 0.07;
        mat2 rotation = rot(angle);

        vec3 ro = vec3(0.0, 0.03 + sin(uTime * 0.09) * 0.2, -2.55);
        ro.xz = rotation * ro.xz;
        vec3 rd = normalize(vec3(p, 1.45));
        rd.xz = rotation * rd.xz;

        float t = 0.0;
        float hit = 0.0;
        for (int i = 0; i < MAX_STEPS; i++) {
          vec3 position = ro + rd * t;
          float distance = de(position);
          if (distance < 0.0016 * t) {
            hit = 1.0;
            break;
          }
          t += max(distance * 0.82, 0.0016);
          if (t > 6.5) break;
        }

        vec3 color = vec3(0.008, 0.012, 0.03);
        float glow = 0.0;

        if (hit > 0.5) {
          vec3 position = ro + rd * t;
          vec3 normal = calcNormal(position);

          vec3 teal = vec3(0.08, 0.85, 0.7);
          vec3 violet = vec3(0.55, 0.2, 0.95);
          vec3 pink = vec3(1.0, 0.18, 0.62);

          float shade = 0.5 + 0.5 * normal.y;
          vec3 base = mix(violet, teal, shade);
          base = mix(base, pink, smoothstep(0.2, 0.9, position.x * 0.3 + position.y * 0.35 + 0.5));
          base = mix(base, vec3(1.0, 0.62, 0.3), smoothstep(0.6, 1.0, normal.z) * 0.28);

          vec3 lightDirection = normalize(vec3(0.7, 0.9, -0.4));
          float diffuse = max(dot(normal, lightDirection), 0.0);
          float rim = pow(1.0 - max(dot(normal, -rd), 0.0), 2.6);
          float cavity = clamp(t * 0.22, 0.0, 0.55);

          color = base * (0.14 + diffuse * 0.95) * (1.0 - cavity);
          color += teal * rim * (0.7 + uBass * 0.9 + uBeat * 0.5);
          color += pink * pow(max(dot(reflect(-lightDirection, normal), -rd), 0.0), 16.0) * 0.3;
          color += vec3(1.0, 0.55, 0.25) * pow(diffuse, 5.0) * 0.12;

          glow = exp(-t * 0.55) * (0.18 + uBass * 0.25 + uBeat * 0.2);
          color += mix(teal, pink, uTreble) * glow;
        } else {
          float haze = exp(-t * 0.4) * 0.11;
          color += mix(vec3(0.1, 0.4, 0.5), vec3(0.4, 0.1, 0.5), vUv.y) * haze * (0.5 + uMid);
        }

        vec3 starDirection = normalize(rd);
        float stars = step(0.9985, hash21(floor((starDirection.xy + starDirection.z) * 720.0)));
        color += vec3(0.5, 0.7, 1.0) * stars * 0.7 * (1.0 - hit);
        color += mix(vec3(0.02, 0.015, 0.07), vec3(0.1, 0.02, 0.14), vUv.y) * 0.7;
        color += mix(vec3(0.1, 0.45, 0.55), vec3(0.45, 0.15, 0.55), 0.5) * exp(-length(p) * 3.5) * 0.1 * (1.0 - hit);
        color *= 1.0 - smoothstep(0.7, 1.5, length(p)) * 0.5;

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });

  const plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  plane.frustumCulled = false;
  scene.add(plane);

  function update(frame: AudioFrame) {
    const { time, bass, mid, treble, beat } = frame;
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

  return { scene, camera, update, resize, dispose, bloom: 0.3, bloomRadius: 0.35, bloomThreshold: 0.9, pixelRatio: 1 };
}
