import * as THREE from "three";
import { ARButton } from "three/addons/webxr/ARButton.js";

const TOTAL_SHELLS = 5;
const ui = {};
const state = {
  collected: 0,
  score: 0,
  mistakes: 0,
  placed: false,
  xrMode: false,
  previewMode: false,
  hitTestSource: null,
  hitTestSourceRequested: false,
  audio: null,
};

let scene;
let camera;
let renderer;
let reticle;
let world;
let raycaster;
let pointer;
let clock;
let shells = [];
let decoys = [];

function cacheUi() {
  ui.intro = document.querySelector("#intro");
  ui.start = document.querySelector("#start-btn");
  ui.fieldGuide = document.querySelector("#field-guide");
  ui.guideBack = document.querySelector("#guide-back-btn");
  ui.guideStart = document.querySelector("#guide-start-btn");
  ui.hud = document.querySelector("#hud");
  ui.guide = document.querySelector("#scan-guide");
  ui.hint = document.querySelector("#hint");
  ui.shellCount = document.querySelector("#shell-count");
  ui.score = document.querySelector("#score-count");
  ui.finalScore = document.querySelector("#final-score");
  ui.mistakes = document.querySelector("#mistake-count");
  ui.resultStars = document.querySelector("#result-stars");
  ui.resultComment = document.querySelector("#result-comment");
  ui.progress = document.querySelector("#progress-bar");
  ui.toast = document.querySelector("#toast");
  ui.npcDialog = document.querySelector("#npc-dialog");
  ui.npcMessage = document.querySelector("#npc-message");
  ui.complete = document.querySelector("#complete");
  ui.infoCard = document.querySelector("#info-card");
  ui.openInfo = document.querySelector("#open-info-btn");
  ui.replay = document.querySelector("#replay-btn");
  ui.infoReplay = document.querySelector("#info-replay-btn");
  ui.closeResult = document.querySelector("#close-result-btn");
  ui.reset = document.querySelector("#reset-btn");
  ui.cameraFeed = document.querySelector("#camera-feed");
  ui.unsupported = document.querySelector("#unsupported");
}

function initThree() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.01, 100);
  camera.position.set(0, 1.55, 3.6);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.setAnimationLoop(render);
  renderer.xr.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  document.querySelector("#canvas-wrap").appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xfff7e5, 0x5a4335, 2.2));
  const sun = new THREE.DirectionalLight(0xffe7bc, 2.4);
  sun.position.set(-2, 5, 3);
  scene.add(sun);

  reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.13, 0.16, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xf1bb67 })
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  world = createTidalWorld();
  world.visible = false;
  scene.add(world);

  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();
  clock = new THREE.Clock();

  renderer.domElement.addEventListener("pointerup", onPointerUp);
  addEventListener("resize", onResize);
}

function createTidalWorld() {
  const group = new THREE.Group();
  group.name = "tidal-world";

  const texture = new THREE.TextureLoader().load("./assets/muan-tidal-flat-v2.jpg");
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.08, 1.08);

  const mud = new THREE.Mesh(
    new THREE.CircleGeometry(3.35, 80),
    new THREE.MeshStandardMaterial({
      map: texture,
      color: 0xb8b7b1,
      roughness: 0.72,
      metalness: 0.08,
      side: THREE.DoubleSide,
    })
  );
  mud.rotation.x = -Math.PI / 2;
  mud.position.y = -0.02;
  group.add(mud);

  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(3.37, 3.37, 0.07, 80),
    new THREE.MeshStandardMaterial({ color: 0x67615c, roughness: 0.9 })
  );
  rim.position.y = -0.07;
  group.add(rim);

  const waterMaterial = new THREE.MeshStandardMaterial({
    color: 0x8eb9ba,
    transparent: true,
    opacity: 0.4,
    roughness: 0.18,
    metalness: 0.18,
    side: THREE.DoubleSide,
  });

  [
    [-1.25, 0.014, -0.75, 0.82, 0.22, -0.35],
    [0.65, 0.014, 1.15, 1.05, 0.18, 0.28],
    [1.55, 0.014, -0.72, 0.7, 0.16, -0.65],
  ].forEach(([x, y, z, width, depth, rotation]) => {
    const pool = new THREE.Mesh(new THREE.CircleGeometry(1, 44), waterMaterial);
    pool.rotation.x = -Math.PI / 2;
    pool.rotation.z = rotation;
    pool.scale.set(width, depth, 1);
    pool.position.set(x, y, z);
    group.add(pool);
  });

  const shellPositions = [
    [-1.75, 0.11, -1.2, -0.35],
    [0.85, 0.11, -1.62, 0.45],
    [-2.05, 0.11, 0.78, 1.1],
    [0.05, 0.11, 1.55, -0.55],
    [1.95, 0.11, 0.45, 0.2],
  ];

  shellPositions.forEach((data, index) => {
    const shell = createShell(index);
    shell.position.set(data[0], data[1], data[2]);
    shell.rotation.y = data[3];
    group.add(shell);
    shells.push(shell);
  });

  const crabData = [
    [-0.35, 0.11, -0.38, 0.2, 0xd76b45],
    [1.72, 0.1, 1.55, -0.55, 0x8f6a4f],
    [-1.25, 0.09, 1.7, 0.75, 0x9a7053],
  ];
  crabData.forEach(([x, y, z, rotation, color], index) => {
    const crab = createCrab(index, color);
    crab.position.set(x, y, z);
    crab.rotation.y = rotation;
    crab.userData.baseY = y;
    group.add(crab);
    decoys.push(crab);
  });

  [
    [-2.25, 0.1, -0.15, 0.55],
    [1.15, 0.1, -0.95, -0.8],
  ].forEach(([x, y, z, rotation], index) => {
    const mudskipper = createMudskipper(index);
    mudskipper.position.set(x, y, z);
    mudskipper.rotation.y = rotation;
    mudskipper.userData.baseY = y;
    group.add(mudskipper);
    decoys.push(mudskipper);
  });

  [
    [-0.75, 0.075, -1.72, 0.2],
    [2.25, 0.075, -0.55, -0.4],
    [-1.72, 0.075, 1.28, 0.7],
    [0.72, 0.075, 2.05, -0.8],
  ].forEach(([x, y, z, rotation], index) => {
    const snail = createMudSnail(index);
    snail.position.set(x, y, z);
    snail.rotation.y = rotation;
    snail.userData.baseY = y;
    group.add(snail);
    decoys.push(snail);
  });

  addBurrowsAndDebris(group);
  return group;
}

function createShell(index) {
  const shell = new THREE.Group();
  shell.userData.collectible = true;
  shell.userData.index = index;
  shell.userData.phase = index * 0.9;

  const colors = [0xd9b178, 0xc78962, 0xe0c391, 0xb98267, 0xd2a36f];
  const material = new THREE.MeshStandardMaterial({
    color: colors[index],
    roughness: 0.63,
    metalness: 0.02,
    emissive: new THREE.Color(colors[index]).multiplyScalar(0.035),
  });

  const upper = new THREE.Mesh(new THREE.SphereGeometry(0.24, 28, 16), material);
  upper.scale.set(1.2, 0.28, 0.9);
  upper.rotation.x = -0.12;
  shell.add(upper);

  const lower = upper.clone();
  lower.scale.y = 0.2;
  lower.position.y = -0.045;
  lower.rotation.x = Math.PI + 0.1;
  shell.add(lower);

  for (let i = -3; i <= 3; i += 1) {
    const ridge = new THREE.Mesh(
      new THREE.TorusGeometry(0.12 + Math.abs(i) * 0.015, 0.006, 6, 24, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0xe9c996, roughness: 0.7 })
    );
    ridge.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    ridge.position.set(i * 0.045, 0.082, 0.02);
    ridge.scale.set(0.85, 1, 0.7);
    shell.add(ridge);
  }

  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.28, 0.34, 40),
    new THREE.MeshBasicMaterial({
      color: 0xffd36f,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    })
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = -0.1;
  shell.add(halo);
  shell.userData.halo = halo;

  return shell;
}

function createCrab(index, color) {
  const crab = new THREE.Group();
  crab.userData.decoy = true;
  crab.userData.creatureName = index === 0 ? "칠게" : "꽃게";
  crab.userData.creatureType = "crab";
  crab.userData.index = index;
  crab.userData.phase = index * 1.7;

  const shellMaterial = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.7,
    metalness: 0.02,
  });
  const legMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color).multiplyScalar(0.78),
    roughness: 0.82,
  });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 12), shellMaterial);
  body.scale.set(1.35, 0.42, 0.9);
  body.position.y = 0.06;
  crab.add(body);

  [-1, 1].forEach((side) => {
    for (let i = 0; i < 3; i += 1) {
      const leg = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.025, 0.22, 4, 8),
        legMaterial
      );
      leg.rotation.z = Math.PI / 2 + side * (0.18 + i * 0.1);
      leg.rotation.y = side * (0.25 + i * 0.32);
      leg.position.set(side * (0.25 + i * 0.045), 0.02, (i - 1) * 0.13);
      crab.add(leg);
    }

    const clawArm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.035, 0.2, 4, 8),
      legMaterial
    );
    clawArm.rotation.z = Math.PI / 2 - side * 0.25;
    clawArm.position.set(side * 0.28, 0.09, -0.17);
    crab.add(clawArm);

    const claw = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), shellMaterial);
    claw.scale.set(1, 0.55, 0.72);
    claw.position.set(side * 0.47, 0.11, -0.22);
    crab.add(claw);

    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.025, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x181511, roughness: 0.5 })
    );
    eye.position.set(side * 0.1, 0.16, -0.18);
    crab.add(eye);
  });

  return crab;
}

function createMudskipper(index) {
  const fish = new THREE.Group();
  fish.userData.decoy = true;
  fish.userData.creatureName = "망둥어";
  fish.userData.creatureType = "mudskipper";
  fish.userData.phase = 4.2 + index * 1.4;

  const skin = new THREE.MeshStandardMaterial({
    color: index ? 0x798066 : 0x66745f,
    roughness: 0.82,
  });
  const belly = new THREE.MeshStandardMaterial({ color: 0xb9aa83, roughness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x252823, roughness: 0.7 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 22, 14), skin);
  body.scale.set(1.65, 0.48, 0.68);
  body.rotation.z = 0.06;
  fish.add(body);

  const bellyPatch = new THREE.Mesh(new THREE.SphereGeometry(0.15, 18, 10), belly);
  bellyPatch.scale.set(1.45, 0.2, 0.56);
  bellyPatch.position.set(0.03, -0.045, -0.015);
  fish.add(bellyPatch);

  [-1, 1].forEach((side) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 8), skin);
    eye.position.set(-0.2, 0.13, side * 0.1);
    fish.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 7), dark);
    pupil.position.set(-0.23, 0.15, side * 0.125);
    fish.add(pupil);

    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 3), skin);
    fin.rotation.set(Math.PI / 2, 0, side * 0.7);
    fin.position.set(0.02, -0.015, side * 0.19);
    fish.add(fin);
  });

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.28, 4), skin);
  tail.rotation.z = -Math.PI / 2;
  tail.position.x = 0.38;
  fish.add(tail);
  fish.userData.tail = tail;

  return fish;
}

function createMudSnail(index) {
  const snail = new THREE.Group();
  snail.userData.decoy = true;
  snail.userData.creatureName = "갯고둥";
  snail.userData.creatureType = "snail";
  snail.userData.phase = 7.5 + index * 0.85;

  const colors = [0x777467, 0x8a7963, 0x666b64, 0x917d68];
  const shellMaterial = new THREE.MeshStandardMaterial({
    color: colors[index],
    roughness: 0.88,
  });
  const footMaterial = new THREE.MeshStandardMaterial({
    color: 0x9b927d,
    roughness: 0.95,
  });

  const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.2, 4, 10), footMaterial);
  foot.rotation.z = Math.PI / 2;
  foot.scale.set(1, 0.6, 1);
  snail.add(foot);

  const shell = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.25, 18), shellMaterial);
  shell.rotation.z = -0.28;
  shell.position.set(0.02, 0.11, 0);
  snail.add(shell);

  for (let i = 0; i < 3; i += 1) {
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.052 + i * 0.011, 0.008, 6, 18),
      new THREE.MeshStandardMaterial({ color: 0xb5a48a, roughness: 0.9 })
    );
    band.rotation.x = Math.PI / 2;
    band.position.set(-0.005, 0.07 + i * 0.045, 0);
    snail.add(band);
  }

  return snail;
}

function addBurrowsAndDebris(group) {
  const dark = new THREE.MeshBasicMaterial({ color: 0x3d3936 });
  [
    [-2.4, -0.3],
    [-0.85, 1.08],
    [0.48, -0.68],
    [2.35, -1.15],
    [1.1, 2.05],
    [-1.85, -2.05],
  ].forEach(([x, z], index) => {
    const hole = new THREE.Mesh(
      new THREE.CircleGeometry(0.055 + (index % 2) * 0.018, 18),
      dark
    );
    hole.rotation.x = -Math.PI / 2;
    hole.position.set(x, 0.018, z);
    group.add(hole);
  });

  const pebbleMaterial = new THREE.MeshStandardMaterial({
    color: 0xb7aa98,
    roughness: 0.95,
  });
  [
    [-0.7, -2.15, 0.045],
    [2.35, 0.95, 0.06],
    [-2.55, 1.25, 0.04],
    [0.9, 0.18, 0.05],
  ].forEach(([x, z, size]) => {
    const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), pebbleMaterial);
    pebble.scale.y = 0.55;
    pebble.position.set(x, 0.04, z);
    group.add(pebble);
  });
}

async function startExperience() {
  initAudio();
  ui.fieldGuide.classList.add("hidden");
  ui.hud.classList.remove("hidden");

  const supported = await supportsImmersiveAr();
  if (supported) {
    await enterAr();
  } else {
    await startPreviewMode();
  }
}

async function supportsImmersiveAr() {
  if (!navigator.xr || !window.isSecureContext) return false;
  try {
    return await navigator.xr.isSessionSupported("immersive-ar");
  } catch {
    return false;
  }
}

async function enterAr() {
  try {
    const session = await navigator.xr.requestSession("immersive-ar", {
      requiredFeatures: ["hit-test"],
      optionalFeatures: ["dom-overlay", "local-floor"],
      domOverlay: { root: document.querySelector("#app") },
    });
    state.xrMode = true;
    renderer.xr.setReferenceSpaceType("local");
    await renderer.xr.setSession(session);
    session.addEventListener("end", () => {
      state.xrMode = false;
      if (!state.placed) startPreviewMode();
    });
  } catch {
    await startPreviewMode();
  }
}

async function startPreviewMode() {
  state.previewMode = true;
  showBrowserNote("AR 미지원 환경: 카메라 기반 3D 모드로 전환합니다.");

  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("이 브라우저가 카메라 접근을 지원하지 않습니다.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });
    ui.cameraFeed.srcObject = stream;
    await ui.cameraFeed.play();
    ui.cameraFeed.classList.add("visible");
  } catch (error) {
    document.body.style.background =
      "linear-gradient(180deg, #84c2c6 0%, #d4bc91 55%, #71513d 100%)";
    showBrowserNote(cameraErrorMessage(error), 7000);
  }

  camera.position.set(0, 2.6, 4.1);
  camera.lookAt(0, 0, 0);
  world.position.set(0, -0.9, -2.6);
  world.rotation.x = -0.08;
  reticle.position.set(0, -0.88, -2.6);
  reticle.updateMatrix();
  reticle.visible = true;
  ui.guide.querySelector("strong").textContent = "갯벌을 배치할 준비가 됐어요";
  ui.guide.querySelector("p").textContent = "화면을 터치해 탐험을 시작하세요.";
  ui.hint.textContent = "화면을 터치해 갯벌을 배치하세요.";
}

function cameraErrorMessage(error) {
  if (error?.name === "NotAllowedError") {
    return "카메라 권한이 차단됐습니다. 주소창의 자물쇠에서 카메라를 허용해 주세요.";
  }
  if (error?.name === "NotFoundError") {
    return "사용 가능한 카메라를 찾지 못했습니다.";
  }
  if (error?.name === "NotReadableError") {
    return "다른 앱이 카메라를 사용 중입니다. 다른 앱을 닫고 다시 시도해 주세요.";
  }
  return error?.message || "이 브라우저에서는 카메라를 시작할 수 없습니다.";
}

function showBrowserNote(message, duration = 3200) {
  ui.unsupported.textContent = message;
  ui.unsupported.classList.remove("hidden");
  clearTimeout(showBrowserNote.timer);
  showBrowserNote.timer = setTimeout(
    () => ui.unsupported.classList.add("hidden"),
    duration
  );
}

function onPointerUp(event) {
  if (
    !ui.complete.classList.contains("hidden") ||
    !ui.infoCard.classList.contains("hidden")
  ) return;

  pointer.x = (event.clientX / innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / innerHeight) * 2 + 1;

  if (!state.placed) {
    if (reticle.visible || state.previewMode) placeWorld();
    return;
  }

  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects([...shells, ...decoys], true);
  const collectible = hits
    .map((hit) => findCollectible(hit.object))
    .find((item) => item && !item.userData.collected);

  if (collectible?.userData.collectible) {
    collectShell(collectible);
  } else if (collectible?.userData.decoy) {
    hitDecoy(collectible);
  }
}

function findCollectible(object) {
  let current = object;
  while (current && !current.userData.collectible && !current.userData.decoy) {
    current = current.parent;
  }
  return current;
}

function placeWorld() {
  if (state.xrMode) {
    world.position.setFromMatrixPosition(reticle.matrix);
    world.quaternion.setFromRotationMatrix(reticle.matrix);
  }
  world.visible = true;
  reticle.visible = false;
  state.placed = true;
  ui.guide.classList.add("hidden");
  ui.hint.textContent = "주변을 둘러보고 빛나는 조개를 터치하세요!";
  playTone(330, 0.13, "sine");
  speakNpc("반가워! 나는 무무야. 빛나는 조개 5개를 찾으면 돼. 꽃게를 누르면 50점이 깎이니 조심해!", 6500);
}

function collectShell(shell) {
  shell.userData.collected = true;
  state.collected += 1;
  state.score += 100;
  updateHud();
  showToast("조개 발견! +100점");
  const remaining = TOTAL_SHELLS - state.collected;
  speakNpc(
    remaining > 0
      ? `잘했어! 조개를 찾았네. 이제 ${remaining}개 남았어!`
      : "대단해! 조개를 모두 찾았어. 탐험 결과를 확인해 봐!",
    3200
  );
  playCollectSound();
  if (navigator.vibrate) navigator.vibrate(45);

  const startScale = shell.scale.clone();
  shell.userData.collectAnimation = {
    startedAt: performance.now(),
    startScale,
  };

  if (state.collected === TOTAL_SHELLS) {
    setTimeout(showComplete, 750);
  }
}

function hitDecoy(decoy) {
  const now = performance.now();
  if (now - (decoy.userData.lastPenalty || 0) < 900) return;
  decoy.userData.lastPenalty = now;
  state.score -= 50;
  state.mistakes += 1;
  updateHud();
  const name = decoy.userData.creatureName || "갯벌 친구";
  showToast(`${name}예요! 조개가 아니에요 · -50점`);
  speakNpc(`앗, ${name}이야! 갯벌 생물은 눈으로 관찰하고 빛나는 조개를 찾아보자.`, 4200);
  playTone(170, 0.2, "sawtooth");
  if (navigator.vibrate) navigator.vibrate([30, 40, 30]);

  decoy.userData.wrongAnimation = { startedAt: now };
}

function updateHud() {
  ui.shellCount.textContent = state.collected;
  ui.score.textContent = state.score;
  ui.progress.style.width = `${(state.collected / TOTAL_SHELLS) * 100}%`;
}

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => ui.toast.classList.remove("show"), 1000);
}

function speakNpc(message, duration = 3500) {
  ui.npcMessage.textContent = message;
  ui.npcDialog.classList.add("show");
  clearTimeout(speakNpc.timer);
  speakNpc.timer = setTimeout(() => ui.npcDialog.classList.remove("show"), duration);
}

function showComplete() {
  ui.finalScore.textContent = `${state.score}점`;
  ui.mistakes.textContent = `${state.mistakes}회`;
  const starCount = state.score >= 500 ? 3 : state.score >= 400 ? 2 : 1;
  ui.resultStars.innerHTML = [1, 2, 3]
    .map((star) => `<span class="${star > starCount ? "off" : ""}">★</span>`)
    .join("");
  ui.resultComment.textContent =
    starCount === 3
      ? "완벽한 탐험이야! 갯벌 박사로 임명할게."
      : starCount === 2
        ? "멋진 탐험이야! 갯벌 생물을 조금만 더 잘 관찰해 보자."
        : "조개와 갯벌 친구들의 생김새를 기억하고 다시 도전해 봐!";
  ui.complete.classList.remove("hidden");
  ui.infoCard.classList.add("hidden");
  ui.npcDialog.classList.remove("show");
  playVictorySound();
}

function resetGame() {
  state.collected = 0;
  state.score = 0;
  state.mistakes = 0;
  updateHud();
  ui.complete.classList.add("hidden");
  ui.infoCard.classList.add("hidden");
  shells.forEach((shell) => {
    shell.visible = true;
    shell.scale.set(1, 1, 1);
    shell.userData.collected = false;
    delete shell.userData.collectAnimation;
  });
  decoys.forEach((decoy) => {
    decoy.rotation.z = 0;
    delete decoy.userData.wrongAnimation;
    delete decoy.userData.lastPenalty;
  });
  ui.hint.textContent = "주변을 둘러보고 빛나는 조개를 터치하세요!";
  speakNpc("다시 시작해볼까? 이번에는 꽃게를 피해서 더 높은 점수에 도전해 봐!", 4200);
}

function render(timestamp, frame) {
  const elapsed = clock.getElapsedTime();

  if (frame && state.xrMode && !state.placed) updateHitTest(frame);

  shells.forEach((shell) => {
    if (!shell.userData.collected) {
      shell.position.y = 0.14 + Math.sin(elapsed * 2.1 + shell.userData.phase) * 0.035;
      shell.rotation.z = Math.sin(elapsed * 1.5 + shell.userData.phase) * 0.06;
      if (shell.userData.halo) {
        shell.userData.halo.material.opacity = 0.48 + Math.sin(elapsed * 3 + shell.userData.phase) * 0.22;
      }
    }

    const animation = shell.userData.collectAnimation;
    if (animation) {
      const t = Math.min((performance.now() - animation.startedAt) / 420, 1);
      const scale = 1 + Math.sin(t * Math.PI) * 0.8;
      shell.scale.copy(animation.startScale).multiplyScalar(scale * (1 - t));
      shell.rotation.y += 0.18;
      if (t >= 1) {
        shell.visible = false;
        delete shell.userData.collectAnimation;
      }
    }
  });

  decoys.forEach((decoy) => {
    const wrong = decoy.userData.wrongAnimation;
    if (wrong) {
      const t = Math.min((performance.now() - wrong.startedAt) / 450, 1);
      decoy.rotation.z = Math.sin(t * Math.PI * 6) * 0.12 * (1 - t);
      if (t >= 1) {
        decoy.rotation.z = 0;
        delete decoy.userData.wrongAnimation;
      }
    } else {
      decoy.position.y =
        (decoy.userData.baseY ?? 0.1) +
        Math.sin(elapsed * 1.6 + decoy.userData.phase) * 0.012;
      if (decoy.userData.creatureType === "mudskipper") {
        decoy.rotation.z = Math.sin(elapsed * 2.5 + decoy.userData.phase) * 0.035;
        if (decoy.userData.tail) {
          decoy.userData.tail.rotation.y =
            Math.sin(elapsed * 5 + decoy.userData.phase) * 0.24;
        }
      } else if (decoy.userData.creatureType === "snail") {
        decoy.rotation.y += 0.0008;
      }
    }
  });

  if (state.previewMode && state.placed) {
    world.rotation.y = Math.sin(elapsed * 0.16) * 0.08;
  }

  renderer.render(scene, camera);
}

function updateHitTest(frame) {
  const session = renderer.xr.getSession();
  const referenceSpace = renderer.xr.getReferenceSpace();

  if (!state.hitTestSourceRequested) {
    session.requestReferenceSpace("viewer").then((viewerSpace) => {
      session.requestHitTestSource({ space: viewerSpace }).then((source) => {
        state.hitTestSource = source;
      });
    });
    session.addEventListener("end", () => {
      state.hitTestSourceRequested = false;
      state.hitTestSource = null;
    });
    state.hitTestSourceRequested = true;
  }

  if (state.hitTestSource) {
    const results = frame.getHitTestResults(state.hitTestSource);
    if (results.length) {
      const pose = results[0].getPose(referenceSpace);
      reticle.visible = true;
      reticle.matrix.fromArray(pose.transform.matrix);
      ui.hint.textContent = "표시된 위치를 터치해 갯벌을 배치하세요.";
    } else {
      reticle.visible = false;
    }
  }
}

function initAudio() {
  if (!state.audio) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) state.audio = new AudioContext();
  }
  state.audio?.resume();
}

function playTone(frequency, duration, type = "sine", delay = 0) {
  if (!state.audio) return;
  const start = state.audio.currentTime + delay;
  const oscillator = state.audio.createOscillator();
  const gain = state.audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.16, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(state.audio.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.04);
}

function playCollectSound() {
  playTone(520, 0.16);
  playTone(760, 0.2, "sine", 0.09);
}

function playVictorySound() {
  [392, 523, 659, 784, 1047].forEach((frequency, index) => {
    playTone(frequency, 0.38, "triangle", index * 0.1);
  });
  [262, 330, 392].forEach((frequency) => playTone(frequency, 0.72, "sine", 0.5));
  setTimeout(() => navigator.vibrate?.([90, 55, 140]), 80);
}

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

cacheUi();
initThree();
ui.start.addEventListener("click", () => {
  ui.intro.classList.add("hidden");
  ui.fieldGuide.classList.remove("hidden");
});
ui.guideBack.addEventListener("click", () => {
  ui.fieldGuide.classList.add("hidden");
  ui.intro.classList.remove("hidden");
});
ui.guideStart.addEventListener("click", startExperience);
ui.reset.addEventListener("click", resetGame);
ui.replay.addEventListener("click", resetGame);
ui.infoReplay.addEventListener("click", resetGame);
ui.openInfo.addEventListener("click", () => {
  ui.complete.classList.add("hidden");
  ui.infoCard.classList.remove("hidden");
});
ui.closeResult.addEventListener("click", () => {
  ui.infoCard.classList.add("hidden");
  speakNpc(`최종 점수는 ${state.score}점이야. 갯벌 친구들을 천천히 더 둘러봐!`, 4200);
});
