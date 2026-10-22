/* TACINF — interactive GLB viewers (Taco scene and Tacumi UMI). */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/* Object positions from gentle_grasp.json task 6; orientations set to the
   upright Figure-12 layout (Coca-Cola, cookie and Vitasoy standing). */
const TACO_OBJECTS = [
  {
    url: "assets/models/object-vitasoy.glb",
    position: [-0.033, 0.156, 0.779],
    rotation: [0, 0, Math.PI / 2],
    scale: [0.07, 0.056, 0.056],
  },
  {
    url: "assets/models/object-coca.glb",
    position: [0.0135, -0.08, 0.778],
    rotation: [-Math.PI / 2, 0, 0],
    scale: [0.06, 0.0704, 0.06],
  },
  {
    url: "assets/models/object-cookie.glb",
    position: [0.092, 0.035, 0.791],
    rotation: [Math.PI / 2, 0, -3.541592653589793],
    scale: [0.07, 0.0822, 0.07],
  },
  {
    url: "assets/models/object-basket.glb",
    position: [0.05, -0.262, 0.761],
    rotation: [0, 0, -Math.PI],
    scale: [0.16, 0.16, 0.108],
  },
];

/* Realworld agentview camera, converted from USD Z-up to three.js Y-up:
   (x, y, z)_usd -> (x, z, -y)_three.  fov is the 640x480 vertical FOV. */
const TACO_CAMERA = {
  eye: [0.7586131746834771, 1.6503500240372423, 0],
  target: [0.0973145992, 1.11632363, 0],
  fov: 43.5,
};

function makeButtonHandler(stage, controls, camera, initialEye, initialTarget) {
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
    else if (key.toLowerCase() === "r") {
      event.preventDefault();
      camera.position.copy(initialEye);
      controls.target.copy(initialTarget);
      controls.update();
    }
  });

  const reset = stage.querySelector(".model-reset");
  if (reset) {
    reset.addEventListener("click", () => {
      camera.position.copy(initialEye);
      controls.target.copy(initialTarget);
      controls.update();
    });
  }
}

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
  if (options.shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -1.6;
    key.shadow.camera.right = 1.6;
    key.shadow.camera.top = 1.6;
    key.shadow.camera.bottom = -1.6;
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 8;
    key.shadow.bias = -0.0004;
  }
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
  const animate = () => {
    if (!running) { raf = 0; return; }
    raf = requestAnimationFrame(animate);
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

  return { renderer, scene, camera, controls, start, stop };
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

async function initTaco(stage) {
  const view = setup(stage, {
    fov: TACO_CAMERA.fov,
    near: 0.01,
    far: 20,
    eye: TACO_CAMERA.eye,
    target: TACO_CAMERA.target,
    minDistance: 0.28,
    maxDistance: 4.5,
    maxPolarAngle: Math.PI / 2 - 0.02,
    autoRotate: false,
    shadows: true,
  });
  if (!view) { markFailed(stage); return; }
  const { scene } = view;
  makeButtonHandler(stage, view.controls, view.camera, view.camera.position.clone(), view.controls.target.clone());

  try {
    const root = new THREE.Group();
    root.rotation.x = -Math.PI / 2; // USD Z-up -> three.js Y-up
    scene.add(root);

    const tableMaterial = new THREE.MeshStandardMaterial({
      color: 0xf2f2f0,
      roughness: 0.62,
      metalness: 0.0,
    });
    const table = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 0.018), tableMaterial);
    table.position.set(0, 0, 0.700);
    table.receiveShadow = true;
    root.add(table);

    const [robot, ...objects] = await Promise.all([
      loader.loadAsync("assets/models/taco-robot.glb"),
      ...TACO_OBJECTS.map((object) => loader.loadAsync(object.url)),
    ]);

    const robotGroup = new THREE.Group();
    robotGroup.position.set(-0.5, 0, 0.728);
    robotGroup.add(robot.scene);
    root.add(robotGroup);

    TACO_OBJECTS.forEach((object, index) => {
      const group = new THREE.Group();
      group.position.fromArray(object.position);
      group.rotation.set(object.rotation[0], object.rotation[1], object.rotation[2], "XYZ");
      group.scale.fromArray(object.scale);
      // The object GLBs were exported Y-up (a -90 deg X root rotation);
      // undo that so the task-6 poses are applied in the asset's Z-up frame.
      const upFix = new THREE.Group();
      upFix.rotation.x = Math.PI / 2;
      upFix.add(objects[index].scene);
      group.add(upFix);
      root.add(group);
    });

    root.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
      if (child.material) child.material.envMapIntensity = 0.7;
    });

    markLoaded(stage);
    view.start();
  } catch (error) {
    markFailed(stage);
  }
}

async function initUmi(stage) {
  const view = setup(stage, {
    fov: 34,
    near: 0.001,
    far: 10,
    eye: [0.32, 0.16, 0.42],
    target: [0, 0, 0],
    minDistance: 0.25,
    maxDistance: 2.4,
    maxPolarAngle: Math.PI * 0.94,
    autoRotate: true,
    autoRotateSpeed: 0.8,
    shadows: false,
  });
  if (!view) { markFailed(stage); return; }
  const { scene, camera, controls } = view;

  try {
    const gltf = await loader.loadAsync("assets/models/tacumi-umi.glb");
    const model = new THREE.Group();
    model.rotation.x = -Math.PI / 2; // USD Z-up -> three.js Y-up
    model.add(gltf.scene);
    scene.add(model);

    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    model.position.sub(center);

    const maxDimension = Math.max(size.x, size.y, size.z);
    const distance = maxDimension * 2.2;
    const direction = new THREE.Vector3(0.9, 0.45, 1.2).normalize();
    camera.position.copy(direction.multiplyScalar(distance));
    controls.target.set(0, 0, 0);
    controls.minDistance = maxDimension * 0.85;
    controls.maxDistance = maxDimension * 6.5;
    controls.update();

    makeButtonHandler(stage, controls, camera, camera.position.clone(), controls.target.clone());

    model.traverse((child) => {
      if (!child.isMesh) return;
      if (child.material) child.material.envMapIntensity = 0.8;
    });

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

const tacoStage = document.getElementById("taco-viewer-stage");
if (tacoStage) whenNear(tacoStage, initTaco);
const umiStage = document.getElementById("umi-viewer-stage");
if (umiStage) whenNear(umiStage, initUmi);
