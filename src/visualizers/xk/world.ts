// @ts-nocheck
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass';
import {
  CINEMATIC_SHADER, PALETTE, clamp, damp, makeFlareTexture, makeGlowTexture, makeStreakTexture, rand,
} from './gfx-utils';
import { LightRibbons, Nebula, Starfield, WarpStreaks } from './starscape';
import { Asteroids } from './asteroids';
import { CometSystem, MeteorSystem, ParticleField, Shockwaves } from './effects';

const STYLE_CONFIGS = {
  cosmos: { nebula: true, stars: true, warp: true, ribbons: true, asteroids: true, particles: true, shockwaves: true, comets: true, meteors: true, sun: true },
  voyage: { nebula: true, stars: true, warp: true, ribbons: true, asteroids: false, particles: true, shockwaves: true, comets: true, meteors: true, sun: true },
  ribbons: { nebula: true, stars: true, warp: false, ribbons: true, asteroids: false, particles: true, shockwaves: false, comets: false, meteors: false, sun: true },
  asteroids: { nebula: true, stars: true, warp: false, ribbons: false, asteroids: true, particles: true, shockwaves: true, comets: true, meteors: true, sun: false },
  nebula: { nebula: true, stars: true, warp: false, ribbons: false, asteroids: false, particles: false, shockwaves: false, comets: false, meteors: false, sun: true },
};

export class World {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.style = options.style || 'cosmos';
    const config = STYLE_CONFIGS[this.style] || STYLE_CONFIGS.cosmos;
    this.config = config;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.isPortrait = this.height > this.width;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, this.isPortrait ? 1.4 : 1.8);
    this.time = 0;
    this.elapsed = 0;
    this.travel = 0;
    this.visualIntensity = 0.06;
    this.trauma = 0;
    this.flash = 0;
    this.aberr = 0;
    this.bloomKick = 0;
    this.fovKick = 0;
    this.warpSurge = 0;
    this.mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    this.paused = false;
    this.nextComet = rand(3.0, 6.5);
    this.nextMeteor = rand(1.0, 2.6);
    this.reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(this.width, this.height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.setClearColor(0x010207, 1);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.isPortrait ? 70 : 60, this.width / this.height, 0.1, 900);
    this.camera.position.set(0, 0, 0);

    this.assets = {
      glow: makeGlowTexture(128),
      flare: makeFlareTexture(512),
      streak: makeStreakTexture(512, 96),
    };

    this.nebula = config.nebula ? new Nebula(this.scene, this.width / this.height) : null;
    this.stars = config.stars ? new Starfield(this.scene, this.isPortrait ? 9000 : 15000, this.pixelRatio) : null;
    this.warp = config.warp ? new WarpStreaks(this.scene, this.isPortrait ? 500 : 900) : null;
    this.ribbons = config.ribbons
      ? new LightRibbons(this.scene, this.isPortrait ? 6 : (this.style === 'ribbons' ? 10 : 7), this.isPortrait ? 110 : 150)
      : null;
    if (this.ribbons && this.style === 'ribbons') {
      for (const ribbon of this.ribbons.items) ribbon.width *= 2.4;
    }
    this.asteroids = config.asteroids ? new Asteroids(this.scene) : null;
    this.particles = config.particles ? new ParticleField(this.scene, this.isPortrait ? 8000 : 14000, this.pixelRatio) : null;
    this.shockwaves = config.shockwaves ? new Shockwaves(this.scene, this.camera) : null;
    this.comets = config.comets && this.particles ? new CometSystem(this.scene, this.camera, this.particles, this.assets) : null;
    this.meteors = config.meteors && this.particles ? new MeteorSystem(this.scene, this.camera, this.particles, this.assets) : null;
    this.sun = null;
    if (config.sun) this.createSun();
    this.setupPost();
    this.resize();
    this.bindEvents();
  }

  createSun() {
    const glowMat = new THREE.SpriteMaterial({
      map: this.assets.glow,
      color: new THREE.Color(0.42, 0.8, 1.0),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.3,
    });
    const glow = new THREE.Sprite(glowMat);
    glow.position.set(-150, 70, -310);
    glow.scale.setScalar(210);
    this.scene.add(glow);

    const coreMat = new THREE.SpriteMaterial({
      map: this.assets.flare,
      color: new THREE.Color(0.82, 0.97, 1.0),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.6,
    });
    const core = new THREE.Sprite(coreMat);
    core.position.copy(glow.position);
    core.scale.set(72, 72, 1);
    this.scene.add(core);

    const streakMat = new THREE.SpriteMaterial({
      map: this.assets.streak,
      color: new THREE.Color(0.4, 0.75, 1.0),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.22,
      rotation: 0.12,
    });
    const streak = new THREE.Sprite(streakMat);
    streak.position.set(-150, 70, -312);
    streak.scale.set(360, 10, 1);
    this.scene.add(streak);

    this.sun = { glow, core, streak };
  }

  setupPost() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(this.width, this.height);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(this.width, this.height), 1.15, 0.62, 0.17);
    this.cinematic = new ShaderPass(CINEMATIC_SHADER);
    this.output = new OutputPass();
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.cinematic);
    this.composer.addPass(this.output);
    this.post = this.cinematic.material.uniforms;
    this.post.uResolution.value.set(this.width * this.pixelRatio, this.height * this.pixelRatio);
  }

  bindEvents() {
    this.onPointer = (event) => {
      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = -((event.clientY / window.innerHeight) * 2 - 1);
      this.mouse.tx = x;
      this.mouse.ty = y;
    };
    window.addEventListener('pointermove', this.onPointer, { passive: true });
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.isPortrait = this.height > this.width;
    const maxRatio = this.isPortrait ? 1.35 : 1.8;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, maxRatio);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(this.width, this.height);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(this.width, this.height);
    this.camera.aspect = this.width / this.height;
    this.camera.fov = this.isPortrait ? 70 : 60;
    this.camera.updateProjectionMatrix();
    if (this.stars) this.stars.update(this.travel, this.time, this.pixelRatio);
    if (this.particles) this.particles.material.uniforms.uPixelRatio.value = this.pixelRatio;
    this.post.uResolution.value.set(this.width * this.pixelRatio, this.height * this.pixelRatio);
    if (this.nebula) this.nebula.update(this.time, this.visualIntensity, this.camera.aspect);
    this.post.uLetterbox.value = 0;
  }

  setMouse(x, y) {
    this.mouse.tx = x;
    this.mouse.ty = y;
  }

  updateCamera(dt, time, frame) {
    const intensity = this.visualIntensity;
    const shakeBase = this.reducedMotion ? 0.35 : 1;
    this.trauma = Math.max(0, this.trauma - dt * 1.35);
    const shake = this.trauma * this.trauma * shakeBase;
    const n1 = Math.sin(time * 21.7 + 1.1) * Math.sin(time * 7.1 + 2.3);
    const n2 = Math.sin(time * 18.3 + 4.2) * Math.sin(time * 9.7 + 0.7);
    const mouse = this.mouse;
    mouse.x = damp(mouse.x, mouse.tx, 2.6, dt);
    mouse.y = damp(mouse.y, mouse.ty, 2.6, dt);

    const sx = n1 * shake * 1.7;
    const sy = n2 * shake * 1.15;
    const swayX = Math.sin(time * 0.19) * (0.35 + intensity * 0.4);
    const swayY = Math.cos(time * 0.143) * (0.25 + intensity * 0.3);
    const baseX = mouse.x * 1.5 + sx;
    const baseY = mouse.y * 0.9 + sy;
    this.camera.position.set(
      baseX * 0.9 + swayX * 0.32,
      baseY * 0.8 + swayY * 0.3,
      Math.sin(time * 0.11) * 0.3 - intensity * 0.9,
    );
    this.camera.lookAt(baseX * 1.35, baseY * 1.05, -30);
    const roll = Math.sin(time * 0.11) * 0.028
      + Math.sin(time * 0.27 + 1.7) * 0.012
      + n1 * shake * 0.05
      + mouse.x * 0.012;
    this.camera.rotateZ(roll);

    const targetFov = (this.isPortrait ? 70 : 60)
      + intensity * 4.2
      + (frame.beatPulse || 0) * 1.6
      + this.fovKick;
    this.fovKick = damp(this.fovKick, 0, 2.4, dt);
    this.camera.fov = damp(this.camera.fov, targetFov, 3.4, dt);
    this.camera.updateProjectionMatrix();
  }

  impulse(strength = 1, options = {}) {
    this.trauma = clamp(this.trauma + 0.26 * strength, 0, 1.25);
    this.flash = clamp(this.flash + (options.flash ?? 0.18) * strength, 0, 0.92);
    this.aberr = clamp(this.aberr + 0.18 * strength, 0, 1.2);
    this.fovKick = clamp(this.fovKick + 1.3 * strength, 0, 9);
    this.bloomKick = Math.max(this.bloomKick, (options.bloom ?? 0.7) * strength);
    this.warpSurge = Math.max(this.warpSurge, 0.65 * strength);
    const origin = options.origin
      ? options.origin.clone()
      : new THREE.Vector3(0, 0, -15);
    const colors = options.colors ?? [PALETTE.ice, PALETTE.cyan, PALETTE.magenta, PALETTE.white];
    if (this.shockwaves) {
      this.shockwaves.spawn(
        origin,
        strength,
        colors,
        Math.round(options.ringCount ?? (3 + strength)),
        options.ringAlpha ?? 1,
      );
    }
    if (this.particles) {
      const count = Math.round((options.count ?? 260) * strength);
      this.particles.burst(origin, count, strength, {
        spread: options.spread ?? 1.3,
        speed: options.speed ?? 13,
        colors,
        forward: options.forward ?? 2.5,
        brightness: options.brightness ?? 1,
      });
      if (options.cameraBurst) {
        const camOrigin = new THREE.Vector3(0, 0, -7.5);
        this.particles.burst(camOrigin, Math.round((options.cameraCount ?? 160) * strength), strength * 1.2, {
          spread: 7,
          speed: 20,
          colors,
          forward: 3,
        });
      }
    }
  }

  textBurst(entries) {
    if (this.particles) this.particles.textBurst(entries);
  }

  burst(entries) {
    if (this.particles) this.particles.textBurst(entries);
  }

  update(dt, time, frame) {
    this.time = time;
    this.paused = !!frame.paused;
    if (!this.paused) this.elapsed += dt;
    this.visualIntensity = damp(this.visualIntensity, frame.intensity ?? 0.1, 3.2, dt);
    const intensity = this.visualIntensity;
    const travelDelta = dt * (7 + intensity * 56 + this.warpSurge * 65) * (this.paused ? 0.18 : 1);
    this.travel += travelDelta;
    this.travel %= 1000000;

    this.flash *= Math.exp(-dt * 3.1);
    this.aberr *= Math.exp(-dt * 2.5);
    this.bloomKick *= Math.exp(-dt * 2.1);
    this.warpSurge *= Math.exp(-dt * 2.3);

    this.updateCamera(dt, time, frame);
    const warpIntensity = this.style === 'voyage' || this.style === 'cosmos' ? Math.max(intensity, 0.45) : intensity;
    const ribbonIntensity = this.style === 'ribbons' ? Math.max(intensity, 0.55) : intensity;
    if (this.nebula) this.nebula.update(time, intensity, this.camera.aspect);
    if (this.stars) this.stars.update(this.travel, time, this.pixelRatio);
    if (this.warp) this.warp.update(this.paused ? dt * 0.2 : dt, time, warpIntensity, this.warpSurge);
    if (this.ribbons) this.ribbons.update(time, ribbonIntensity, this.warpSurge);
    if (this.asteroids) this.asteroids.update(time, this.paused ? 0 : dt);
    if (this.particles) this.particles.update(this.paused ? dt * 0.3 : dt);
    if (this.shockwaves) this.shockwaves.update(this.paused ? dt * 0.3 : dt, this.camera);
    if (this.comets) this.comets.update(this.paused ? dt * 0.3 : dt, time, this.camera);
    if (this.meteors) this.meteors.update(this.paused ? dt * 0.3 : dt);

    const pulse = frame.beatPulse || 0;
    if (this.sun) {
      const sunPulse = 1 + pulse * 0.06 + Math.sin(time * 0.3) * 0.025;
      this.sun.glow.scale.setScalar(210 * sunPulse);
      this.sun.core.scale.setScalar(72 * sunPulse);
      this.sun.glow.material.opacity = 0.24 + intensity * 0.16 + pulse * 0.04;
      this.sun.core.material.opacity = 0.45 + intensity * 0.24 + pulse * 0.05;
      this.sun.streak.material.opacity = 0.13 + intensity * 0.16;
    }

    if (!this.paused) this.scheduleEvents(dt, intensity);

    this.post.uTime.value = time;
    this.post.uAberration.value = 0.28 + intensity * 0.55 + this.aberr * 2.3 + pulse * 0.12;
    this.post.uDistortion.value = 0.008 + intensity * 0.018 + this.warpSurge * 0.03 + this.flash * 0.1;
    this.post.uFlash.value = this.flash * 0.9;
    this.post.uGrain.value = 0.045 + intensity * 0.012;
    this.post.uVignette.value = 1.0;
    this.bloom.strength = 0.46 + intensity * 0.32 + pulse * 0.14 + this.bloomKick * 0.55;
    this.bloom.radius = 0.36 + intensity * 0.08;
    this.bloom.threshold = clamp(0.66 - this.bloomKick * 0.03, 0.5, 0.78);
  }

  scheduleEvents(dt, intensity) {
    if (this.comets && this.elapsed > this.nextComet) {
      this.comets.spawn({ scale: rand(0.8, 1.5) * (1 + intensity * 0.35) });
      this.nextComet = this.elapsed + (intensity > 0.7 ? rand(3.8, 6.8) : rand(6.5, 12.0));
    }
    if (this.meteors && this.elapsed > this.nextMeteor) {
      const count = intensity > 0.7 ? (Math.random() < 0.5 ? 2 : 1) : 1;
      for (let i = 0; i < count; i++) this.meteors.spawn();
      this.nextMeteor = this.elapsed + (intensity > 0.7 ? rand(0.65, 1.9) : rand(1.8, 4.8));
    }
  }

  reset() {
    this.trauma = 0;
    this.flash = 0;
    this.aberr = 0;
    this.bloomKick = 0;
    this.fovKick = 0;
    this.warpSurge = 0;
    if (this.particles) this.particles.reset();
    if (this.shockwaves) this.shockwaves.reset();
    this.nextComet = this.elapsed + rand(2.4, 5.0);
    this.nextMeteor = this.elapsed + rand(0.6, 2.0);
  }

  render() {
    this.composer.render();
  }

  dispose() {
    window.removeEventListener('pointermove', this.onPointer);
    this.scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      const materials = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
      for (const material of materials) {
        for (const key of Object.keys(material)) {
          const value = material[key];
          if (value && value.isTexture) value.dispose();
        }
        material.dispose();
      }
    });
    for (const texture of Object.values(this.assets)) {
      if (texture && texture.dispose) texture.dispose();
    }
    if (this.composer && this.composer.dispose) this.composer.dispose();
    if (this.renderer.forceContextLoss) this.renderer.forceContextLoss();
    this.renderer.dispose();
  }
}
