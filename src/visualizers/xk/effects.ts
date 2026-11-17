// @ts-nocheck
import * as THREE from 'three';
import { TAU, rand, clamp, PALETTE, smoothstep01 } from './gfx-utils';

export class ParticleField {
  constructor(scene, capacity = 14000, pixelRatio = 1) {
    this.capacity = capacity;
    this.index = 0;
    this.px = new Float32Array(capacity);
    this.py = new Float32Array(capacity);
    this.pz = new Float32Array(capacity);
    this.vx = new Float32Array(capacity);
    this.vy = new Float32Array(capacity);
    this.vz = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.size = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.r = new Float32Array(capacity);
    this.g = new Float32Array(capacity);
    this.b = new Float32Array(capacity);

    const positions = new Float32Array(capacity * 3);
    const colors = new Float32Array(capacity * 3);
    const sizes = new Float32Array(capacity);
    const alphas = new Float32Array(capacity);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
    this.geo.setDrawRange(0, capacity);

    this.material = new THREE.ShaderMaterial({
      uniforms: { uPixelRatio: { value: pixelRatio } },
      vertexShader: `
        uniform float uPixelRatio;
        attribute float aSize;
        attribute float aAlpha;
        attribute vec3 aColor;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(aSize * uPixelRatio * (420.0 / max(1.0, -mv.z)), 0.7, 56.0);
          vColor = aColor;
          vAlpha = aAlpha;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec2 pc = gl_PointCoord - 0.5;
          float d = length(pc) * 2.0;
          if (d > 1.0) discard;
          float core = smoothstep(1.0, 0.0, d);
          float glow = pow(max(0.0, 1.0 - d), 2.4);
          vec3 col = vColor * (core * 1.35 + glow * 0.6);
          float a = clamp(core + glow * 0.4, 0.0, 1.0) * vAlpha;
          gl_FragColor = vec4(col, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(this.geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
  }

  spawn(x, y, z, vx, vy, vz, life, size, color, drag = 0.8) {
    const i = this.index;
    this.index = (this.index + 1) % this.capacity;
    this.px[i] = x;
    this.py[i] = y;
    this.pz[i] = z;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.vz[i] = vz;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.size[i] = size;
    this.drag[i] = drag;
    this.r[i] = color.r;
    this.g[i] = color.g;
    this.b[i] = color.b;
  }

  burst(origin, count, strength, options = {}) {
    const spread = options.spread ?? 1;
    const speed = options.speed ?? 12;
    const colors = options.colors ?? [PALETTE.ice, PALETTE.cyan, PALETTE.violet, PALETTE.magenta, PALETTE.white];
    const forward = options.forward ?? 0;
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * TAU;
      const phi = Math.acos(rand(-1, 1));
      const s = speed * (0.15 + Math.pow(Math.random(), 0.48)) * strength;
      const sx = Math.sin(phi) * Math.cos(theta);
      const sy = Math.cos(phi) * 0.75;
      const sz = Math.sin(phi) * Math.sin(theta);
      const col = colors[Math.floor(Math.random() * colors.length)].clone();
      col.multiplyScalar(rand(0.55, 1.35) * (options.brightness ?? 1));
      const life = rand(0.7, 2.4) * (0.7 + strength * 0.25);
      this.spawn(
        origin.x + sx * spread,
        origin.y + sy * spread,
        origin.z + sz * spread,
        sx * s + rand(-3, 3),
        sy * s + rand(-2, 2),
        sz * s + forward + rand(-2, 4),
        life,
        rand(0.16, 0.48) * (0.8 + strength * 0.2),
        col,
        rand(0.55, 1.5),
      );
    }
  }

  textBurst(entries) {
    for (const e of entries) {
      this.spawn(e.x, e.y, e.z, e.vx, e.vy, e.vz, e.life, e.size, e.color, e.drag ?? 0.55);
    }
  }

  update(dt) {
    const positions = this.geo.attributes.position.array;
    const colors = this.geo.attributes.aColor.array;
    const sizes = this.geo.attributes.aSize.array;
    const alphas = this.geo.attributes.aAlpha.array;
    let active = 0;
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) {
        alphas[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        alphas[i] = 0;
        continue;
      }
      active++;
      const drag = Math.exp(-this.drag[i] * dt);
      this.vx[i] *= drag;
      this.vy[i] *= drag;
      this.vz[i] *= drag;
      this.px[i] += this.vx[i] * dt;
      this.py[i] += this.vy[i] * dt;
      this.pz[i] += this.vz[i] * dt;
      const lifeRatio = clamp(this.life[i] / this.maxLife[i], 0, 1);
      const fade = Math.pow(lifeRatio, 0.7);
      alphas[i] = fade;
      const i3 = i * 3;
      positions[i3] = this.px[i];
      positions[i3 + 1] = this.py[i];
      positions[i3 + 2] = this.pz[i];
      colors[i3] = this.r[i];
      colors[i3 + 1] = this.g[i];
      colors[i3 + 2] = this.b[i];
      sizes[i] = this.size[i] * (0.5 + 0.5 * fade);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
    this.active = active;
  }

  reset() {
    this.life.fill(0);
    this.geo.attributes.aAlpha.array.fill(0);
    this.geo.attributes.aAlpha.needsUpdate = true;
    this.active = 0;
  }
}

export class Shockwaves {
  constructor(scene, camera) {
    this.camera = camera;
    this.geo = new THREE.RingGeometry(0.885, 1.0, 160);
    this.items = [];
    for (let i = 0; i < 28; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.geo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      scene.add(mesh);
      this.items.push({ mesh, mat, age: 0, life: 1, maxScale: 1, strength: 1, active: false });
    }
  }

  spawn(origin, strength, colors = [PALETTE.ice, PALETTE.cyan, PALETTE.magenta], count = 4, alpha = 1) {
    for (let k = 0; k < count; k++) {
      const item = this.items.find((it) => !it.active);
      if (!item) break;
      item.active = true;
      item.age = -k * 0.05;
      item.life = 0.7 + Math.random() * 0.65 + strength * 0.08;
      item.maxScale = (4 + Math.random() * 8) * (0.65 + strength * 0.5);
      item.strength = strength;
      item.alpha = alpha;
      item.mesh.position.copy(origin);
      item.mesh.position.z += rand(-0.6, 2.0);
      item.mesh.scale.setScalar(0.05);
      item.mat.color.copy(colors[k % colors.length]);
      item.mat.opacity = 0;
      item.mesh.visible = false;
    }
  }

  reset() {
    for (const item of this.items) {
      item.active = false;
      item.mesh.visible = false;
      item.mat.opacity = 0;
    }
  }

  update(dt, camera) {
    for (const item of this.items) {
      if (!item.active) continue;
      item.age += dt;
      if (item.age < 0) continue;
      const u = item.age / item.life;
      if (u >= 1) {
        item.active = false;
        item.mesh.visible = false;
        continue;
      }
      item.mesh.visible = true;
      item.mesh.quaternion.copy(camera.quaternion);
      const ease = 1 - Math.pow(1 - u, 3);
      const scale = 0.3 + ease * item.maxScale;
      item.mesh.scale.setScalar(scale);
      item.mat.opacity = Math.pow(1 - u, 2.1) * (0.65 + item.strength * 0.12) * (item.alpha ?? 1);
    }
  }
}

export class CometSystem {
  constructor(scene, camera, particles, textures) {
    this.scene = scene;
    this.camera = camera;
    this.particles = particles;
    this.textures = textures;
    this.items = [];
    for (let i = 0; i < 5; i++) this.items.push(this._create());
  }

  _create() {
    const group = new THREE.Group();
    group.visible = false;
    this.scene.add(group);

    const headMat = new THREE.SpriteMaterial({
      map: this.textures.flare,
      color: 0xffffff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0,
    });
    const head = new THREE.Sprite(headMat);
    head.scale.setScalar(1.4);
    group.add(head);

    const coreMat = new THREE.SpriteMaterial({
      map: this.textures.glow,
      color: 0xffffff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0,
    });
    const core = new THREE.Sprite(coreMat);
    core.scale.setScalar(0.7);
    group.add(core);

    const segments = 30;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array((segments + 1) * 2 * 3);
    const uvs = new Float32Array((segments + 1) * 2 * 2);
    const idx = [];
    for (let i = 0; i <= segments; i++) {
      const v = i / segments;
      uvs[i * 4] = 0;
      uvs[i * 4 + 1] = v;
      uvs[i * 4 + 2] = 1;
      uvs[i * 4 + 3] = v;
      if (i < segments) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    const tailMat = new THREE.ShaderMaterial({
      uniforms: {
        uColorA: { value: new THREE.Color(1, 1, 1) },
        uColorB: { value: new THREE.Color(0.3, 0.8, 1) },
        uOpacity: { value: 0 },
        uSeed: { value: Math.random() * 10 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        uniform float uOpacity;
        uniform float uSeed;
        varying vec2 vUv;
        void main() {
          float edge = smoothstep(0.0, 0.42, vUv.x) * smoothstep(1.0, 0.58, vUv.x);
          float fade = pow(1.0 - vUv.y, 1.25);
          float glow = smoothstep(0.0, 0.14, vUv.y);
          float flicker = 0.75 + 0.25 * sin(vUv.y * 31.0 + uSeed * 8.0);
          vec3 col = mix(uColorB, uColorA, vUv.y);
          float a = edge * fade * glow * flicker * uOpacity;
          gl_FragColor = vec4(col * a, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const tail = new THREE.Mesh(geo, tailMat);
    tail.frustumCulled = false;
    group.add(tail);

    return {
      group,
      head,
      core,
      tail,
      tailMat,
      geo,
      segments,
      history: [],
      active: false,
      age: 0,
      life: 1,
      curve: null,
      color: PALETTE.ice,
      scale: 1,
      emitAccum: 0,
      angle: 0,
    };
  }

  spawn(options = {}) {
    const item = this.items.find((it) => !it.active);
    if (!item) return null;
    const side = Math.random() < 0.5 ? -1 : 1;
    const start = new THREE.Vector3(side * rand(35, 70), rand(-24, 30), rand(-105, -50));
    const end = new THREE.Vector3(-side * rand(18, 55), rand(-28, 16), rand(-36, -5));
    const c1 = new THREE.Vector3(rand(-35, 35), rand(10, 42), rand(-70, -30));
    const c2 = new THREE.Vector3(rand(-40, 40), rand(-38, 8), rand(-55, -14));
    const curve = new THREE.CubicBezierCurve3(start, c1, c2, end);
    item.active = true;
    item.age = 0;
    item.life = options.life ?? rand(4.5, 7.5);
    item.curve = curve;
    const palette = [PALETTE.ice, PALETTE.cyan, PALETTE.magenta, PALETTE.gold, PALETTE.violet];
    item.color = options.color ?? palette[Math.floor(Math.random() * palette.length)];
    item.scale = options.scale ?? rand(0.7, 1.7);
    item.history = [];
    item.emitAccum = 0;
    const pos0 = curve.getPoint(0);
    for (let i = 0; i < item.segments + 1; i++) item.history.push(pos0.clone());
    item.head.material.color.copy(item.color).lerp(new THREE.Color(1, 1, 1), 0.5);
    item.core.material.color.copy(item.color);
    item.tailMat.uniforms.uColorA.value.copy(item.color).lerp(new THREE.Color(1, 1, 1), 0.4);
    item.tailMat.uniforms.uColorB.value.copy(item.color).multiplyScalar(0.45);
    item.head.material.opacity = 0;
    item.core.material.opacity = 0;
    item.tailMat.uniforms.uOpacity.value = 0;
    item.group.visible = true;
    return item;
  }

  update(dt, time, camera) {
    for (const item of this.items) {
      if (!item.active) continue;
      item.age += dt;
      const u = clamp(item.age / item.life, 0, 1);
      if (u >= 1) {
        item.active = false;
        item.group.visible = false;
        continue;
      }
      const pos = item.curve.getPoint(u);
      const ahead = item.curve.getPoint(Math.min(1, u + 0.004));
      const vel = ahead.clone().sub(pos);
      const fadeIn = smoothstep01(u / 0.12);
      const fadeOut = 1.0 - smoothstep01((u - 0.76) / 0.24);
      const alpha = fadeIn * fadeOut;
      item.head.position.copy(pos);
      item.core.position.copy(pos);
      item.head.material.opacity = alpha * 0.9;
      item.core.material.opacity = alpha * 0.72;
      item.head.scale.setScalar(item.scale * (2.0 + Math.sin(time * 15 + item.age) * 0.12));
      item.core.scale.setScalar(item.scale * (0.9 + Math.sin(time * 19 + item.age) * 0.08));

      if (vel.lengthSq() > 0.00001) {
        const p1 = pos.clone().project(camera);
        const p2 = ahead.clone().project(camera);
        item.angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      }
      item.head.material.rotation = item.angle;
      item.core.material.rotation = item.angle;

      item.history.pop();
      item.history.unshift(pos.clone());
      this._buildTail(item, camera, alpha);

      item.emitAccum += dt;
      if (item.emitAccum > 0.016) {
        item.emitAccum = 0;
        const dir = vel.lengthSq() > 0.000001 ? vel.clone().normalize() : new THREE.Vector3(0, 1, 0);
        const tailPos = pos.clone().addScaledVector(dir.negate(), rand(0.4, 5.5));
        const col = item.color.clone().multiplyScalar(rand(0.55, 1.25));
        this.particles.spawn(
          tailPos.x + rand(-0.4, 0.4),
          tailPos.y + rand(-0.4, 0.4),
          tailPos.z + rand(-0.4, 0.4),
          rand(-1, 1) - vel.x * 0.12,
          rand(-1, 1) - vel.y * 0.12,
          rand(-0.5, 1.6),
          rand(0.6, 2.2),
          rand(0.16, 0.5) * item.scale,
          col,
          0.5,
        );
      }
    }
  }

  _buildTail(item, camera, alpha) {
    const segments = item.segments;
    const pos = item.geo.attributes.position.array;
    const hist = item.history;
    const viewDir = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    const sideVec = new THREE.Vector3();
    for (let i = 0; i <= segments; i++) {
      const p = hist[Math.min(i, hist.length - 1)];
      const prev = hist[Math.max(0, i - 1)];
      const next = hist[Math.min(hist.length - 1, i + 1)];
      tangent.copy(prev).sub(next);
      if (tangent.lengthSq() < 0.000001) tangent.set(0, 1, 0);
      viewDir.copy(camera.position).sub(p).normalize();
      sideVec.crossVectors(tangent, viewDir).normalize();
      if (sideVec.lengthSq() < 0.000001) sideVec.set(0, 1, 0);
      const v = i / segments;
      const width = item.scale * 0.55 * Math.pow(1 - v, 0.82) * (0.8 + 0.2 * Math.sin(v * 18 + item.age * 3));
      const a = i * 6;
      pos[a] = p.x + sideVec.x * width;
      pos[a + 1] = p.y + sideVec.y * width;
      pos[a + 2] = p.z + sideVec.z * width;
      pos[a + 3] = p.x - sideVec.x * width;
      pos[a + 4] = p.y - sideVec.y * width;
      pos[a + 5] = p.z - sideVec.z * width;
    }
    item.geo.attributes.position.needsUpdate = true;
    item.tailMat.uniforms.uOpacity.value = alpha * 0.7;
  }
}

export class MeteorSystem {
  constructor(scene, camera, particles, textures) {
    this.scene = scene;
    this.camera = camera;
    this.particles = particles;
    this.textures = textures;
    this.items = [];
    const colors = [PALETTE.ice, PALETTE.cyan, PALETTE.white, PALETTE.magenta, PALETTE.gold];
    for (let i = 0; i < 12; i++) {
      const mat = new THREE.SpriteMaterial({
        map: textures.streak,
        color: colors[i % colors.length],
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      sprite.frustumCulled = false;
      sprite.renderOrder = 6;
      scene.add(sprite);
      this.items.push({
        sprite,
        mat,
        active: false,
        age: 0,
        life: 1,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        length: 8,
        width: 0.2,
        emit: 0,
      });
    }
  }

  spawn(options = {}) {
    const item = this.items.find((it) => !it.active);
    if (!item) return;
    const side = Math.random() < 0.5 ? -1 : 1;
    const z = rand(-25, -7);
    item.pos.set(side * rand(15, 36), rand(5, 24), z);
    item.vel.set(-side * rand(9, 24), -rand(8, 22), rand(-1.5, 2.0));
    item.active = true;
    item.age = 0;
    item.life = options.life ?? rand(0.7, 1.6);
    item.length = options.length ?? rand(4.5, 13);
    item.width = options.width ?? rand(0.12, 0.36);
    item.emit = 0;
    item.sprite.visible = true;
    item.sprite.position.copy(item.pos);
    item.sprite.scale.set(item.length, item.width, 1);
    item.sprite.material.opacity = 0;
    item.sprite.material.rotation = 0;
  }

  update(dt) {
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    for (const item of this.items) {
      if (!item.active) continue;
      item.age += dt;
      const u = item.age / item.life;
      if (u >= 1) {
        item.active = false;
        item.sprite.visible = false;
        continue;
      }
      item.pos.addScaledVector(item.vel, dt);
      const fade = Math.sin(Math.pow(u, 0.65) * Math.PI);
      item.mat.opacity = fade * 0.95;
      right.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
      up.set(0, 1, 0).applyQuaternion(this.camera.quaternion);
      const dx = item.vel.dot(right);
      const dy = item.vel.dot(up);
      const angle = Math.atan2(dy, dx);
      const len = Math.hypot(dx, dy) || 1;
      const nx = dx / len;
      const ny = dy / len;
      item.sprite.position.copy(item.pos)
        .addScaledVector(right, -nx * item.length * 0.5)
        .addScaledVector(up, -ny * item.length * 0.5);
      item.sprite.scale.set(item.length, item.width, 1);
      item.mat.rotation = angle;
      item.emit += dt;
      if (item.emit > 0.04) {
        item.emit = 0;
        this.particles.spawn(
          item.pos.x,
          item.pos.y,
          item.pos.z,
          rand(-0.6, 0.6),
          rand(-0.6, 0.6),
          rand(-0.4, 0.8),
          rand(0.3, 0.9),
          rand(0.08, 0.22),
          item.mat.color,
          0.6,
        );
      }
    }
  }
}
