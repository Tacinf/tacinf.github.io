/* Tacumi actuator viewer. Lighting and camera match the existing Tacumi UMI viewer. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export async function initActuator(stage, options = {}) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const captureMode = new URLSearchParams(location.search).has('capture');
  const loading = stage.querySelector('.model-loading');
  const toggle = stage.querySelector('[data-actuator-explode]');
  const rotateButton = stage.querySelector('[data-actuator-rotate]');
  const resetButton = stage.querySelector('[data-actuator-reset]');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: captureMode }); }
  catch (error) { if (loading) loading.textContent = '3D view unavailable — showing the reference image.'; throw error; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.setClearColor(0x000000, 0);
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(33, 1, 0.001, 10);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.maxPolarAngle = Math.PI * 0.94;
  controls.autoRotate = !reducedMotion && !captureMode;
  controls.autoRotateSpeed = 0.75;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  room.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x1b1b1e, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(1.6, 3.4, 2);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.6);
  fill.position.set(-2.2, 1.4, -1.2);
  scene.add(fill);
  const resize = () => {
    const width = stage.clientWidth, height = stage.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, true);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(stage);
  resize();
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const urls = {
    assembled: options.assembled || stage.dataset.assembled || 'assets/models/tacumi-actuator.glb',
    exploded: options.exploded || stage.dataset.exploded || 'assets/models/tacumi-actuator-exploded.glb',
  };
  let models;
  try {
    const [a, e] = await Promise.all([loader.loadAsync(urls.assembled), loader.loadAsync(urls.exploded)]);
    models = { assembled: a.scene, exploded: e.scene };
  } catch (error) {
    if (loading) loading.textContent = '3D view unavailable — showing the reference image.';
    console.error('Actuator model could not be loaded.', error);
    throw error;
  }
  const fits = {};
  for (const [name, model] of Object.entries(models)) {
    scene.add(model);
    model.traverse((object) => {
      if (!object.isMesh || !object.material) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.envMapIntensity = 0.8;
    });
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const max = Math.max(size.x, size.y, size.z);
    fits[name] = { target: box.getCenter(new THREE.Vector3()), distance: max * 2.1, max };
  }
  const initialDirection = new THREE.Vector3(...(options.direction || [0.9, 0.45, 1.2])).normalize();
  controls.minDistance = Math.min(fits.assembled.max, fits.exploded.max) * 0.75;
  controls.maxDistance = Math.max(fits.assembled.max, fits.exploded.max) * 6;
  let tween = null;
  let state = 'assembled';
  let running = false;
  let raf = 0;
  const render = () => renderer.render(scene, camera);
  const animate = (now) => {
    if (!running) return;
    raf = requestAnimationFrame(animate);
    if (tween) {
      const t = Math.min(1, (now - tween.start) / 650);
      const e = 1 - Math.pow(1 - t, 3);
      camera.position.lerpVectors(tween.fromPos, tween.toPos, e);
      controls.target.lerpVectors(tween.fromTarget, tween.toTarget, e);
      if (t === 1) tween = null;
    }
    controls.update();
    render();
  };
  const start = () => { if (!running) { running = true; raf = requestAnimationFrame(animate); } };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  const setState = (next, { animate: transition = false, reset = false } = {}) => {
    state = next === true || next === 'exploded' ? 'exploded' : 'assembled';
    models.assembled.visible = state === 'assembled';
    models.exploded.visible = state === 'exploded';
    const fit = fits[state];
    const direction = reset ? initialDirection : camera.position.clone().sub(controls.target).normalize();
    if (!direction.lengthSq()) direction.copy(initialDirection);
    const toPos = fit.target.clone().addScaledVector(direction, fit.distance);
    if (transition && !reducedMotion) {
      tween = { start: performance.now(), fromPos: camera.position.clone(), fromTarget: controls.target.clone(), toPos, toTarget: fit.target.clone() };
    } else {
      tween = null;
      controls.target.copy(fit.target);
      camera.position.copy(toPos);
      // Flush damping without permitting auto-rotation to alter deterministic capture.
      const wasAuto = controls.autoRotate;
      controls.autoRotate = false;
      controls.update();
      controls.autoRotate = wasAuto;
      render();
    }
    if (toggle) { toggle.textContent = state === 'exploded' ? 'Assembled view' : 'Exploded view'; toggle.setAttribute('aria-pressed', String(state === 'exploded')); }
  };
  const setAutoRotate = (next) => {
    controls.autoRotate = Boolean(next);
    if (rotateButton) { rotateButton.textContent = next ? 'Pause rotation' : 'Rotate'; rotateButton.setAttribute('aria-pressed', String(next)); }
  };
  const reset = () => setState('assembled', { reset: true });
  toggle?.addEventListener('click', () => setState(state === 'assembled' ? 'exploded' : 'assembled', { animate: true }));
  resetButton?.addEventListener('click', reset);
  rotateButton?.addEventListener('click', () => setAutoRotate(!controls.autoRotate));
  renderer.domElement.addEventListener('pointerdown', () => { tween = null; });
  stage.addEventListener('keydown', (event) => {
    if (event.target.tagName === 'BUTTON') return;
    const key = event.key;
    const offset = camera.position.clone().sub(controls.target);
    if (key.startsWith('Arrow')) {
      event.preventDefault();
      const spherical = new THREE.Spherical().setFromVector3(offset);
      spherical.theta += key === 'ArrowLeft' ? -0.08 : key === 'ArrowRight' ? 0.08 : 0;
      spherical.phi = THREE.MathUtils.clamp(spherical.phi + (key === 'ArrowUp' ? -0.06 : key === 'ArrowDown' ? 0.06 : 0), 0.08, controls.maxPolarAngle);
      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
    } else if (['+', '=', '-', '_'].includes(key)) {
      event.preventDefault();
      const factor = key === '+' || key === '=' ? 0.9 : 1.1;
      offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance));
      camera.position.copy(controls.target).add(offset);
    } else if (key.toLowerCase() === 'r') reset();
    else return;
    controls.update(); render();
  });
  let inView = true;
  const visibility = new IntersectionObserver((entries) => { inView = entries.some(e => e.isIntersecting); if (inView && !document.hidden) start(); else stop(); }, { threshold: 0.01 });
  visibility.observe(stage);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && inView) start(); else stop(); });
  const hint = stage.querySelector('.model-hint');
  if (hint && !matchMedia('(hover:hover) and (pointer:fine)').matches) hint.textContent = 'Drag to rotate · Pinch to zoom';
  setState('assembled', { reset: true });
  setAutoRotate(controls.autoRotate);
  stage.classList.add('is-loaded');
  stage.dataset.ready = 'true';
  const api = { renderer, scene, camera, controls, models, fits, setState, setAutoRotate, reset, render, start, stop, resize, THREE, get state() { return state; } };
  if (captureMode) window.actuatorViewer = api;
  start();
  return api;
}
