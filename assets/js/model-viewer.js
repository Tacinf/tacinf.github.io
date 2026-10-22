/* TACINF — interactive Tacumi UMI viewer (assembled + exploded GLBs). */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

function setup(stage, options) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
  } catch (error) {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = Boolean(options.shadows);
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);
  stage.insertBefore(renderer.domElement, stage.firstChild);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(options.fov, 1, options.near, options.far);
  camera.position.fromArray(options.eye);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.fromArray(options.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = options.minDistance;
  controls.maxDistance = options.maxDistance;
  controls.maxPolarAngle = options.maxPolarAngle;
  controls.autoRotate = Boolean(options.autoRotate) && !reducedMotion.matches;
  controls.autoRotateSpeed = options.autoRotateSpeed || 0.7;
  controls.update();

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const hemi = new THREE.HemisphereLight(0xffffff, 0x1b1b1e, 0.7);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(1.6, 3.4, 2.0);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.6);
  fill.position.set(-2.2, 1.4, -1.2);
  scene.add(fill);

  const updateSize = () => {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, true);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const resizeObserver = new ResizeObserver(updateSize);
  resizeObserver.observe(stage);
  updateSize();

  let running = false;
  let raf = 0;
  const animate = (now) => {
    if (!running) { raf = 0; return; }
    raf = requestAnimationFrame(animate);
    if (typeof options.onFrame === "function") options.onFrame(now);
    controls.update();
    renderer.render(scene, camera);
  };
  const start = () => { if (!running) { running = true; if (!raf) raf = requestAnimationFrame(animate); } };
  const stop = () => { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; };

  const visibility = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) start();
      else stop();
    },
    { threshold: 0.01 }
  );
  visibility.observe(stage);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else visibility.takeRecords();
  });

  renderer.domElement.addEventListener("pointerdown", () => {
    if (typeof options.onInteract === "function") options.onInteract();
  });

  return { renderer, scene, camera, controls, start, stop };
}

function makeButtonHandler(stage, controls, camera, resetView) {
  const spherical = new THREE.Spherical();
  const offset = new THREE.Vector3();

  const rotate = (dTheta, dPhi) => {
    offset.copy(camera.position).sub(controls.target);
    spherical.setFromVector3(offset);
    spherical.theta += dTheta;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi + dPhi, 0.08, controls.maxPolarAngle);
    offset.setFromSpherical(spherical);
    camera.position.copy(controls.target).add(offset);
    controls.update();
  };

  const zoom = (factor) => {
    offset.copy(camera.position).sub(controls.target);
    const next = offset.length() * factor;
    if (next < controls.minDistance || next > controls.maxDistance) return;
    offset.setLength(next);
    camera.position.copy(controls.target).add(offset);
    controls.update();
  };

  stage.addEventListener("keydown", (event) => {
    const key = event.key;
    if (key === "ArrowLeft") { event.preventDefault(); rotate(-0.08, 0); }
    else if (key === "ArrowRight") { event.preventDefault(); rotate(0.08, 0); }
    else if (key === "ArrowUp") { event.preventDefault(); rotate(0, -0.06); }
    else if (key === "ArrowDown") { event.preventDefault(); rotate(0, 0.06); }
    else if (key === "+" || key === "=") { event.preventDefault(); zoom(0.9); }
    else if (key === "-" || key === "_") { event.preventDefault(); zoom(1.1); }
    else if (key.toLowerCase() === "r") { event.preventDefault(); resetView(); }
  });

  const reset = stage.querySelector(".model-reset");
  if (reset) reset.addEventListener("click", resetView);
}

function setLoading(stage, text) {
  const el = stage.querySelector(".model-loading");
  if (el) el.textContent = text;
}

function markLoaded(stage) {
  stage.classList.add("is-loaded");
}

function markFailed(stage) {
  setLoading(stage, "3D view unavailable — showing the reference image.");
}

async function initUmi(stage) {
  let tween = null;

  const view = setup(stage, {
    fov: 33,
    near: 0.001,
    far: 10,
    eye: [0.32, 0.16, 0.42],
    target: [0, 0, 0],
    minDistance: 0.08,
    maxDistance: 2.4,
    maxPolarAngle: Math.PI * 0.94,
    autoRotate: true,
    autoRotateSpeed: 0.75,
    shadows: false,
    onInteract: () => { tween = null; },
    onFrame: (now) => {
      if (!tween) return;
      const t = Math.min(1, (now - tween.start) / tween.duration);
      const e = 1 - Math.pow(1 - t, 3);
      view.camera.position.lerpVectors(tween.fromPos, tween.toPos, e);
      view.controls.target.lerpVectors(tween.fromTarget, tween.toTarget, e);
      if (t >= 1) tween = null;
    },
  });
  if (!view) { markFailed(stage); return; }

  const { scene, camera, controls } = view;

  try {
    const [assembledGltf, explodedGltf] = await Promise.all([
      loader.loadAsync("assets/models/tacumi-umi.glb"),
      loader.loadAsync("assets/models/tacumi-umi-exploded.glb"),
    ]);

    const assembled = assembledGltf.scene;
    const exploded = explodedGltf.scene;
    scene.add(assembled, exploded);

    exploded.visible = true;
    assembled.visible = true;
    const boxA = new THREE.Box3().setFromObject(assembled);
    const boxE = new THREE.Box3().setFromObject(exploded);
    exploded.visible = false;

    const sizeA = boxA.getSize(new THREE.Vector3());
    const sizeE = boxE.getSize(new THREE.Vector3());
    const centerA = boxA.getCenter(new THREE.Vector3());
    const centerE = boxE.getCenter(new THREE.Vector3());
    const maxA = Math.max(sizeA.x, sizeA.y, sizeA.z);
    const maxE = Math.max(sizeE.x, sizeE.y, sizeE.z);
    const fits = {
      assembled: { target: centerA.clone(), distance: maxA * 2.1 },
      exploded: { target: centerE.clone(), distance: maxE * 2.1 },
    };

    const initialDirection = new THREE.Vector3(0.9, 0.45, 1.2).normalize();
    camera.position.copy(fits.assembled.target).addScaledVector(initialDirection, fits.assembled.distance);
    controls.target.copy(fits.assembled.target);
    controls.minDistance = Math.min(maxA, maxE) * 0.75;
    controls.maxDistance = Math.max(maxA, maxE) * 6;
    controls.update();
    const initialPos = camera.position.clone();
    const initialTarget = controls.target.clone();

    [assembled, exploded].forEach((model) => {
      model.traverse((child) => {
        if (!child.isMesh) return;
        if (child.material) child.material.envMapIntensity = 0.8;
      });
    });

    const toggle = stage.querySelector("#umi-explode-toggle");
    let explodedState = false;

    const flyTo = (fit, direction) => {
      tween = {
        fromPos: camera.position.clone(),
        fromTarget: controls.target.clone(),
        toPos: fit.target.clone().addScaledVector(direction, fit.distance),
        toTarget: fit.target.clone(),
        start: performance.now(),
        duration: 650,
      };
    };

    const applyState = (next, { animate = true, reset = false } = {}) => {
      explodedState = next;
      assembled.visible = !next;
      exploded.visible = next;
      if (toggle) {
        toggle.setAttribute("aria-pressed", String(next));
        toggle.textContent = next ? "Assembled view" : "Exploded view";
      }
      if (reset) {
        tween = null;
        camera.position.copy(initialPos);
        controls.target.copy(initialTarget);
        controls.update();
        return;
      }
      const fit = next ? fits.exploded : fits.assembled;
      const direction = camera.position.clone().sub(controls.target).normalize();
      if (!animate || reducedMotion.matches) {
        tween = null;
        controls.target.copy(fit.target);
        camera.position.copy(fit.target).addScaledVector(direction, fit.distance);
        controls.update();
      } else {
        flyTo(fit, direction);
      }
    };

    if (toggle) {
      toggle.addEventListener("click", () => applyState(!explodedState));
    }
    const resetView = () => applyState(false, { animate: false, reset: true });
    makeButtonHandler(stage, controls, camera, resetView);

    markLoaded(stage);
    view.start();
  } catch (error) {
    markFailed(stage);
  }
}

function whenNear(stage, init) {
  let started = false;
  const observer = new IntersectionObserver(
    (entries) => {
      if (started || !entries.some((entry) => entry.isIntersecting)) return;
      started = true;
      observer.disconnect();
      init(stage);
    },
    { rootMargin: "400px" }
  );
  observer.observe(stage);
}

const hintText = finePointer ? "Drag to rotate · Scroll to zoom" : "Drag to rotate · Pinch to zoom";
document.querySelectorAll(".model-hint").forEach((hint) => {
  hint.textContent = hintText;
});

const umiStage = document.getElementById("umi-viewer-stage");
if (umiStage) whenNear(umiStage, initUmi);
