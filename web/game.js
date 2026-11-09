import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

const WORLD_SIZE = 40;
const WORLD_DEPTH = 20;
const REACH = 6;
const PLAYER_RADIUS = 0.3;
const PLAYER_HEIGHT = 1.8;
const CROUCH_HEIGHT = 1;
const GRAVITY = 22;
const JUMP_SPEED = 8.5;
const BEDROCK_ID = 7;
const worldSeed = Math.random() * 10000;

const BLOCKS = [
  { id: 1, name: "Grass", color: 0x78a94d, startingCount: 20, breakTime: 0.55 },
  { id: 2, name: "Dirt", color: 0x8a6040, startingCount: 20, breakTime: 0.5 },
  { id: 3, name: "Stone", color: 0x92979a, startingCount: 16, breakTime: 1.3 },
  { id: 4, name: "Sand", color: 0xd5c281, startingCount: 16, breakTime: 0.4 },
  { id: 5, name: "Wood", color: 0x75502f, startingCount: 0, breakTime: 0.8 },
  { id: 6, name: "Leaves", color: 0x477d3c, startingCount: 0, breakTime: 0.25 },
  { id: BEDROCK_ID, name: "Bedrock", color: 0x35383c, startingCount: 0, breakTime: Infinity },
];
const HOTBAR_BLOCKS = BLOCKS.filter((block) => block.id !== BEDROCK_ID);

const world = new Map();
const inventory = new Map(BLOCKS.map((block) => [block.id, block.startingCount]));
const keys = new Set();
const worldElement = document.querySelector("#world");
const overlay = document.querySelector("#overlay");
const playButton = document.querySelector("#play-button");
const loadStatus = document.querySelector("#load-status");
const errorMessage = document.querySelector("#error-message");
const hotbar = document.querySelector("#hotbar");
const targetLabel = document.querySelector("#target-label");
const lookHint = document.querySelector("#look-hint");
const breakIndicator = document.querySelector("#break-indicator");
const breakLabel = document.querySelector("#break-label");
const breakProgress = document.querySelector("#break-progress");

let selectedBlock = HOTBAR_BLOCKS[1].id;
let player;
let velocityY = 0;
let onGround = false;
let crouched = false;
let gameActive = false;
let pointerLockFailed = false;
let miningHeld = false;
let miningTargetKey = "";
let miningElapsed = 0;
let lastFrame = 0;
let blockMeshes = [];

const crackTextures = Array.from({ length: 5 }, (_, index) => {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  const stage = index + 1;

  for (let crack = 0; crack < stage * 3; crack++) {
    let x = 64;
    let y = 64;
    const angle = (crack / (stage * 3)) * Math.PI * 2 + stage * 0.17;
    const length = 20 + stage * 12;
    context.beginPath();
    context.moveTo(x, y);
    for (let segment = 1; segment <= 4; segment++) {
      const distance = (length * segment) / 4;
      const jitter = Math.sin(crack * 7 + segment * 3) * 5;
      x = 64 + Math.cos(angle) * distance + Math.cos(angle + Math.PI / 2) * jitter;
      y = 64 + Math.sin(angle) * distance + Math.sin(angle + Math.PI / 2) * jitter;
      context.lineTo(x, y);
    }
    context.strokeStyle = "rgba(25, 22, 18, 0.95)";
    context.lineWidth = 3;
    context.lineCap = "square";
    context.stroke();
    context.strokeStyle = "rgba(231, 220, 196, 0.85)";
    context.lineWidth = 1;
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
});

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9acbea);
scene.fog = new THREE.Fog(0x9acbea, 28, 62);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
worldElement.append(renderer.domElement);

const controls = new PointerLockControls(camera, renderer.domElement);
scene.add(new THREE.HemisphereLight(0xe4f3ff, 0x70604a, 2.15));

const sunlight = new THREE.DirectionalLight(0xffedc7, 2.6);
sunlight.position.set(-18, 30, 16);
sunlight.castShadow = true;
sunlight.shadow.mapSize.set(1024, 1024);
sunlight.shadow.camera.left = -30;
sunlight.shadow.camera.right = 30;
sunlight.shadow.camera.top = 30;
sunlight.shadow.camera.bottom = -30;
sunlight.shadow.normalBias = 0.04;
scene.add(sunlight);

const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
const crackGeometry = new THREE.BoxGeometry(1.006, 1.006, 1.006);
const crackMaterials = crackTextures.map((map) => new THREE.MeshBasicMaterial({
  map,
  transparent: true,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -1,
  side: THREE.DoubleSide,
}));
const crackOverlay = new THREE.Mesh(crackGeometry, crackMaterials[0]);
crackOverlay.visible = false;
crackOverlay.renderOrder = 2;
scene.add(crackOverlay);
const blockMaterials = new Map(BLOCKS.map((block) => [
  block.id,
  new THREE.MeshLambertMaterial({ color: block.color }),
]));
const raycaster = new THREE.Raycaster();
raycaster.far = REACH;
const centerOfScreen = new THREE.Vector2(0, 0);
const direction = new THREE.Vector3();
const horizontalForward = new THREE.Vector3();
const horizontalRight = new THREE.Vector3();
const movement = new THREE.Vector3();
const matrix = new THREE.Matrix4();

function cellKey(x, y, z) {
  return `${x},${y},${z}`;
}

function blockAt(x, y, z) {
  return world.get(cellKey(x, y, z)) ?? 0;
}

function randomNoise(x, z) {
  const value = Math.sin(x * 127.1 + z * 311.7 + worldSeed) * 43758.5453;
  return value - Math.floor(value);
}

function terrainHeight(x, z) {
  const hills = Math.sin(x * 0.24) * 1.5 + Math.cos(z * 0.21) * 1.35;
  const detail = (randomNoise(x, z) - 0.5) * 1.1;
  return Math.max(3, Math.min(9, Math.floor(5 + hills + detail)));
}

function generateCaves() {
  for (let tunnel = 0; tunnel < 9; tunnel++) {
    let x = 3 + randomNoise(tunnel, 81) * (WORLD_SIZE - 6);
    let z = 3 + randomNoise(tunnel, 97) * (WORLD_SIZE - 6);
    let y = 2 + randomNoise(tunnel, 113) * 2.5;
    let heading = randomNoise(tunnel, 131) * Math.PI * 2;
    const length = 10 + Math.floor(randomNoise(tunnel, 149) * 13);

    for (let step = 0; step < length; step++) {
      heading += (randomNoise(tunnel * 31 + step, 167) - 0.5) * 0.55;
      x += Math.cos(heading) * 0.8;
      z += Math.sin(heading) * 0.8;
      y += (randomNoise(tunnel * 37 + step, 191) - 0.5) * 0.4;
      const radius = 1.2 + randomNoise(tunnel * 41 + step, 211) * 0.55;

      for (let blockX = Math.floor(x - radius); blockX <= Math.ceil(x + radius); blockX++) {
        for (let blockY = Math.floor(y - radius); blockY <= Math.ceil(y + radius); blockY++) {
          for (let blockZ = Math.floor(z - radius); blockZ <= Math.ceil(z + radius); blockZ++) {
            const distance = ((blockX + 0.5 - x) ** 2
              + (blockY + 0.5 - y) ** 2
              + (blockZ + 0.5 - z) ** 2) / (radius * radius);
            if (distance < 1 && blockY >= 1 && blockY < terrainHeight(blockX, blockZ) - 2) {
              world.delete(cellKey(blockX, blockY, blockZ));
            }
          }
        }
      }
    }
  }
}

function generateTrees() {
  const treeLocations = [];
  for (let x = 2; x < WORLD_SIZE - 2; x++) {
    for (let z = 2; z < WORLD_SIZE - 2; z++) {
      const surface = terrainHeight(x, z);
      if (blockAt(x, surface, z) !== BLOCKS[0].id) continue;
      if (randomNoise(x + 251, z + 269) < 0.985) continue;
      if ((x - WORLD_SIZE / 2) ** 2 + (z - WORLD_SIZE / 2) ** 2 < 36) continue;
      if (treeLocations.some(([treeX, treeZ]) => (x - treeX) ** 2 + (z - treeZ) ** 2 < 16)) continue;

      treeLocations.push([x, z]);
      const trunkHeight = 3 + Math.floor(randomNoise(x + 283, z + 307) * 2);
      for (let offsetY = 1; offsetY <= trunkHeight; offsetY++) {
        world.set(cellKey(x, surface + offsetY, z), BLOCKS[4].id);
      }

      const crownY = surface + trunkHeight;
      for (let offsetY = -1; offsetY <= 2; offsetY++) {
        const radius = offsetY === 2 ? 1 : 2;
        for (let offsetX = -radius; offsetX <= radius; offsetX++) {
          for (let offsetZ = -radius; offsetZ <= radius; offsetZ++) {
            if (Math.abs(offsetX) + Math.abs(offsetZ) + Math.max(0, offsetY - 1) > 3) continue;
            const leafX = x + offsetX;
            const leafY = crownY + offsetY;
            const leafZ = z + offsetZ;
            if (blockAt(leafX, leafY, leafZ) === 0) {
              world.set(cellKey(leafX, leafY, leafZ), BLOCKS[5].id);
            }
          }
        }
      }
    }
  }
}

function generateWorld() {
  for (let x = 0; x < WORLD_SIZE; x++) {
    for (let z = 0; z < WORLD_SIZE; z++) {
      world.set(cellKey(x, 0, z), BEDROCK_ID);
      const surface = terrainHeight(x, z);
      for (let y = 1; y <= surface; y++) {
        let blockId = BLOCKS[2].id;
        if (y === surface) {
          blockId = (x + z) % 9 === 0 ? BLOCKS[3].id : BLOCKS[0].id;
        } else if (y >= surface - 3) {
          blockId = BLOCKS[1].id;
        }
        world.set(cellKey(x, y, z), blockId);
      }
    }
  }
  generateCaves();
  generateTrees();
  rebuildWorldMeshes();
}

function isExposed(x, y, z) {
  return blockAt(x + 1, y, z) === 0
    || blockAt(x - 1, y, z) === 0
    || blockAt(x, y + 1, z) === 0
    || blockAt(x, y - 1, z) === 0
    || blockAt(x, y, z + 1) === 0
    || blockAt(x, y, z - 1) === 0;
}

function rebuildWorldMeshes() {
  for (const mesh of blockMeshes) {
    scene.remove(mesh);
    mesh.dispose();
  }
  blockMeshes = [];

  const visibleBlocks = new Map(BLOCKS.map((block) => [block.id, []]));
  for (const [key, blockId] of world) {
    const [x, y, z] = key.split(",").map(Number);
    if (isExposed(x, y, z)) {
      visibleBlocks.get(blockId).push({ x, y, z });
    }
  }

  for (const block of BLOCKS) {
    const cells = visibleBlocks.get(block.id);
    if (cells.length === 0) continue;

    const mesh = new THREE.InstancedMesh(cubeGeometry, blockMaterials.get(block.id), cells.length);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.cells = cells;
    cells.forEach(({ x, y, z }, index) => {
      matrix.makeTranslation(x + 0.5, y + 0.5, z + 0.5);
      mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
    blockMeshes.push(mesh);
  }
}

function buildHotbar() {
  hotbar.replaceChildren();
  for (const [index, block] of HOTBAR_BLOCKS.entries()) {
    const button = document.createElement("button");
    button.className = "slot";
    button.type = "button";
    button.title = `${block.name} (${index + 1})`;
    button.setAttribute("aria-label", `Select ${block.name}, ${inventory.get(block.id)} available`);
    button.innerHTML = `<span class="slot-number">${index + 1}</span>`
      + `<span class="slot-swatch" style="background:#${block.color.toString(16).padStart(6, "0")}"></span>`
      + `<span class="slot-count">${inventory.get(block.id)}</span>`;
    button.addEventListener("click", () => selectBlock(block.id));
    hotbar.append(button);
  }
  updateHotbarSelection();
}

function updateHotbarSelection() {
  for (const [index, button] of [...hotbar.children].entries()) {
    const block = HOTBAR_BLOCKS[index];
    button.classList.toggle("selected", block.id === selectedBlock);
    button.setAttribute(
      "aria-label",
      `${block.id === selectedBlock ? "Selected " : ""}${block.name}, ${inventory.get(block.id)} available`,
    );
    button.querySelector(".slot-count").textContent = inventory.get(block.id);
  }
}

function selectBlock(blockId) {
  selectedBlock = blockId;
  updateHotbarSelection();
}

function currentPlayerHeight() {
  return crouched ? CROUCH_HEIGHT : PLAYER_HEIGHT;
}

function intersectsBlock(x, y, z, feetY = player.position.y) {
  const minX = player.position.x - PLAYER_RADIUS;
  const maxX = player.position.x + PLAYER_RADIUS;
  const minZ = player.position.z - PLAYER_RADIUS;
  const maxZ = player.position.z + PLAYER_RADIUS;
  const minY = feetY;
  const maxY = feetY + currentPlayerHeight();

  return maxX > x && minX < x + 1
    && maxY > y && minY < y + 1
    && maxZ > z && minZ < z + 1;
}

function hasCollision(position, height = currentPlayerHeight()) {
  const minX = Math.floor(position.x - PLAYER_RADIUS);
  const maxX = Math.floor(position.x + PLAYER_RADIUS - 0.001);
  const minY = Math.floor(position.y);
  const maxY = Math.floor(position.y + height - 0.001);
  const minZ = Math.floor(position.z - PLAYER_RADIUS);
  const maxZ = Math.floor(position.z + PLAYER_RADIUS - 0.001);

  if (position.x - PLAYER_RADIUS < 0 || position.x + PLAYER_RADIUS > WORLD_SIZE
    || position.z - PLAYER_RADIUS < 0 || position.z + PLAYER_RADIUS > WORLD_SIZE
    || position.y < 0) {
    return true;
  }

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        if (blockAt(x, y, z) !== 0) return true;
      }
    }
  }
  return false;
}

function hasGroundSupport(position) {
  const footY = Math.floor(position.y - 0.05);
  const inset = PLAYER_RADIUS * 0.8;
  for (const offsetX of [-inset, inset]) {
    for (const offsetZ of [-inset, inset]) {
      if (blockAt(
        Math.floor(position.x + offsetX),
        footY,
        Math.floor(position.z + offsetZ),
      ) === 0) {
        return false;
      }
    }
  }
  return true;
}

function updatePlayer(delta) {
  if (keys.has("ControlLeft") || keys.has("ControlRight")) {
    crouched = true;
  } else if (!hasCollision(player.position, PLAYER_HEIGHT)) {
    crouched = false;
  }

  movement.set(0, 0, 0);
  camera.getWorldDirection(direction);
  horizontalForward.set(direction.x, 0, direction.z).normalize();
  horizontalRight.crossVectors(horizontalForward, camera.up).normalize();

  if (keys.has("KeyW")) movement.add(horizontalForward);
  if (keys.has("KeyS")) movement.sub(horizontalForward);
  if (keys.has("KeyD")) movement.add(horizontalRight);
  if (keys.has("KeyA")) movement.sub(horizontalRight);
  if (movement.lengthSq() > 0) {
    const edgeCareful = crouched
      || keys.has("ShiftLeft")
      || keys.has("ShiftRight");
    const speed = crouched ? 1.6 : edgeCareful ? 2.5 : 5;
    movement.normalize().multiplyScalar(speed * delta);
    const nextX = player.position.clone();
    nextX.x += movement.x;
    if (!hasCollision(nextX) && (!edgeCareful || !onGround || hasGroundSupport(nextX))) {
      player.position.x = nextX.x;
    }

    const nextZ = player.position.clone();
    nextZ.z += movement.z;
    if (!hasCollision(nextZ) && (!edgeCareful || !onGround || hasGroundSupport(nextZ))) {
      player.position.z = nextZ.z;
    }
  }

  velocityY -= GRAVITY * delta;
  const nextY = player.position.clone();
  nextY.y += velocityY * delta;
  if (!hasCollision(nextY)) {
    player.position.y = nextY.y;
    onGround = false;
  } else {
    if (velocityY < 0) onGround = true;
    velocityY = 0;
  }

  camera.position.set(
    player.position.x,
    player.position.y + currentPlayerHeight() * 0.9,
    player.position.z,
  );
}

function targetBlock() {
  raycaster.setFromCamera(centerOfScreen, camera);
  const hits = raycaster.intersectObjects(blockMeshes, false);
  return hits[0] ?? null;
}

function updateTargetLabel(hit) {
  if (!gameActive) {
    targetLabel.textContent = "READY TO EXPLORE";
    return;
  }
  if (!hit) {
    targetLabel.textContent = "LOOK AT A BLOCK";
    return;
  }
  const cell = hit.object.userData.cells[hit.instanceId];
  const blockId = blockAt(cell.x, cell.y, cell.z);
  if (blockId === BEDROCK_ID) {
    targetLabel.textContent = "BEDROCK · UNBREAKABLE";
    return;
  }
  const block = BLOCKS.find((item) => item.id === blockId);
  targetLabel.textContent = block?.name.toUpperCase() ?? "BLOCK";
}

function clearMiningProgress() {
  miningTargetKey = "";
  miningElapsed = 0;
  crackOverlay.visible = false;
  breakIndicator.hidden = true;
  breakProgress.style.width = "0%";
}

function updateMining(delta) {
  if (!gameActive || !miningHeld) {
    clearMiningProgress();
    return;
  }

  const hit = targetBlock();
  if (!hit || hit.instanceId === undefined) {
    clearMiningProgress();
    return;
  }

  const cell = hit.object.userData.cells[hit.instanceId];
  const { x, y, z } = cell;
  const blockId = blockAt(x, y, z);
  const block = BLOCKS.find((item) => item.id === blockId);
  if (!block || blockId === BEDROCK_ID) {
    clearMiningProgress();
    return;
  }

  const key = cellKey(x, y, z);
  if (key !== miningTargetKey) {
    miningTargetKey = key;
    miningElapsed = 0;
  }
  miningElapsed += delta;
  const progress = Math.min(miningElapsed / block.breakTime, 1);
  const stage = Math.min(crackMaterials.length - 1, Math.floor(progress * crackMaterials.length));
  crackOverlay.position.set(x + 0.5, y + 0.5, z + 0.5);
  crackOverlay.material = crackMaterials[stage];
  crackOverlay.visible = progress > 0;
  breakIndicator.hidden = false;
  breakLabel.textContent = `BREAKING ${block.name.toUpperCase()}`;
  breakProgress.style.width = `${progress * 100}%`;
  targetLabel.textContent = `${block.name.toUpperCase()} · ${Math.ceil(progress * 100)}%`;

  if (progress < 1) return;
  inventory.set(blockId, inventory.get(blockId) + 1);
  world.delete(key);
  clearMiningProgress();
  rebuildWorldMeshes();
  updateHotbarSelection();
}

function handlePlace() {
  if (!gameActive) return;
  const hit = targetBlock();
  if (!hit || !hit.face || hit.instanceId === undefined) return;

  const target = hit.object.userData.cells[hit.instanceId];
  const normal = hit.face.normal;
  const x = target.x + Math.round(normal.x);
  const y = target.y + Math.round(normal.y);
  const z = target.z + Math.round(normal.z);
  if (x < 0 || x >= WORLD_SIZE || y <= 0 || y >= WORLD_DEPTH || z < 0 || z >= WORLD_SIZE) return;
  if (blockAt(x, y, z) !== 0 || inventory.get(selectedBlock) <= 0) return;
  if (intersectsBlock(x, y, z)) return;

  world.set(cellKey(x, y, z), selectedBlock);
  inventory.set(selectedBlock, inventory.get(selectedBlock) - 1);
  rebuildWorldMeshes();
  updateHotbarSelection();
}

function onKeyDown(event) {
  if (event.code === "Escape" && pointerLockFailed && gameActive) {
    gameActive = false;
    overlay.classList.remove("hidden");
    loadStatus.textContent = "Click to resume your world.";
    playButton.querySelector("span").textContent = "BACK TO THE WORLD";
    targetLabel.textContent = "PAUSED";
    return;
  }

  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
    event.preventDefault();
  }
  keys.add(event.code);
  if (event.repeat) return;

  const number = Number(event.key);
  if (number >= 1 && number <= HOTBAR_BLOCKS.length) selectBlock(HOTBAR_BLOCKS[number - 1].id);
  if (event.code === "Space" && gameActive && onGround && !crouched) {
    velocityY = JUMP_SPEED;
    onGround = false;
  }
}

function startFallbackGame() {
  gameActive = true;
  overlay.classList.add("hidden");
  loadStatus.textContent = "Move the mouse to look around; press Esc to pause.";
  lookHint.textContent = "MOVE MOUSE TO LOOK AROUND";
  targetLabel.textContent = "LOOK AT A BLOCK";
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
  loadStatus.textContent = "Check your browser setup and reload the page.";
}

function animate(timestamp) {
  requestAnimationFrame(animate);
  const delta = Math.min((timestamp - (lastFrame || timestamp)) / 1000, 0.05);
  lastFrame = timestamp;

  if (gameActive && player) {
    updatePlayer(delta);
    const hit = targetBlock();
    updateTargetLabel(hit);
    updateMining(delta);
  }
  renderer.render(scene, camera);
}

generateWorld();
buildHotbar();
const spawnX = Math.floor(WORLD_SIZE / 2);
const spawnZ = Math.floor(WORLD_SIZE / 2);
player = new THREE.Object3D();
player.position.set(spawnX + 0.5, terrainHeight(spawnX, spawnZ) + 1.01, spawnZ + 0.5);
camera.position.set(player.position.x, player.position.y + PLAYER_HEIGHT * 0.9, player.position.z);
camera.lookAt(player.position.x + 0.3, camera.position.y - 0.18, player.position.z - 1);
animate(0);

playButton.addEventListener("click", () => {
  errorMessage.hidden = true;
  if (pointerLockFailed) {
    startFallbackGame();
    return;
  }
  controls.lock();
  window.setTimeout(() => {
    if (!controls.isLocked && !pointerLockFailed) {
      pointerLockFailed = true;
      startFallbackGame();
    }
  }, 800);
});
controls.addEventListener("lock", () => {
  gameActive = true;
  pointerLockFailed = false;
  overlay.classList.add("hidden");
  lookHint.textContent = "CLICK TO LOOK AROUND";
  targetLabel.textContent = "LOOK AT A BLOCK";
});
controls.addEventListener("unlock", () => {
  gameActive = false;
  overlay.classList.remove("hidden");
  loadStatus.textContent = "Click to resume your world.";
  playButton.querySelector("span").textContent = "BACK TO THE WORLD";
  lookHint.textContent = "CLICK TO LOOK AROUND";
  targetLabel.textContent = "PAUSED";
});
document.addEventListener("pointerlockerror", () => {
  pointerLockFailed = true;
  startFallbackGame();
});

document.addEventListener("keydown", onKeyDown);
document.addEventListener("keyup", (event) => keys.delete(event.code));
document.addEventListener("mousedown", (event) => {
  if (event.button === 0) {
    miningHeld = true;
    event.preventDefault();
  }
  if (event.button === 2) handlePlace();
});
document.addEventListener("mouseup", (event) => {
  if (event.button === 0) {
    miningHeld = false;
    clearMiningProgress();
  }
});
document.addEventListener("mousemove", (event) => {
  if (!pointerLockFailed || !gameActive) return;
  camera.rotation.y -= event.movementX * 0.002;
  camera.rotation.x = THREE.MathUtils.clamp(
    camera.rotation.x - event.movementY * 0.002,
    -Math.PI / 2 + 0.01,
    Math.PI / 2 - 0.01,
  );
});
document.addEventListener("contextmenu", (event) => event.preventDefault());
window.addEventListener("blur", () => {
  keys.clear();
  miningHeld = false;
  clearMiningProgress();
});
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
});

if (!renderer.capabilities.isWebGL2) {
  showError("This game needs a browser with WebGL 2 support. Try a recent version of Chrome, Edge, or Firefox.");
}
