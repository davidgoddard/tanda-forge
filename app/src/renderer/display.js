const titleEl = document.getElementById("display-title");
const artistEl = document.getElementById("display-artist");
const progressEl = document.getElementById("display-progress");
const nextEl = document.getElementById("display-next");
const contentEl = document.querySelector(".display-content");
const swirlLayer = document.querySelector(".swirl-layer");
const orbA = document.querySelector(".orb-a");
const orbB = document.querySelector(".orb-b");
const imageA = document.querySelector(".bg-image-a");
const imageB = document.querySelector(".bg-image-b");

let images = [];
let imageQueue = [];
let activeLayer = "a";
let rotationMs = 20000;
let rotationTimer = null;
let hasImages = false;
let pointerDown = null;
let ambientTimer = null;
let activeOrb = "a";

const shuffle = (items) => {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const scheduleRotation = () => {
  if (rotationTimer) {
    clearTimeout(rotationTimer);
  }
  rotationTimer = setTimeout(() => {
    void advanceBackground();
  }, rotationMs);
};

const setLayerVisible = (layer, visible) => {
  if (!layer) {
    return;
  }
  if (visible) {
    layer.classList.add("visible");
  } else {
    layer.classList.remove("visible");
  }
};

const setOrbVisible = (orb, visible) => {
  if (!orb) {
    return;
  }
  if (visible) {
    orb.classList.add("visible");
  } else {
    orb.classList.remove("visible");
  }
};

const randomOrbConfig = () => {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 72 + Math.floor(Math.random() * 24);
  const lightness = 58 + Math.floor(Math.random() * 16);
  const alpha = 0.4 + Math.random() * 0.2;
  return {
    x: 15 + Math.random() * 70,
    y: 18 + Math.random() * 64,
    size: (34 + Math.random() * 42) * 2,
    scale: 0.9 + Math.random() * 0.3,
    color: `hsla(${hue} ${saturation}% ${lightness}% / ${alpha.toFixed(3)})`,
  };
};

const applyOrb = (orb, config) => {
  if (!orb) {
    return;
  }
  orb.style.left = `${config.x}%`;
  orb.style.top = `${config.y}%`;
  orb.style.width = `${config.size}vmin`;
  orb.style.height = `${config.size}vmin`;
  orb.style.background = `radial-gradient(circle at 50% 50%, ${config.color} 0%, rgba(0, 0, 0, 0) 72%)`;
  orb.style.transform = `translate(-50%, -50%) scale(${config.scale.toFixed(3)})`;
};

const scheduleAmbient = () => {
  if (ambientTimer) {
    clearTimeout(ambientTimer);
  }
  ambientTimer = setTimeout(() => {
    advanceAmbient();
  }, 12000);
};

const stopAmbient = () => {
  if (ambientTimer) {
    clearTimeout(ambientTimer);
    ambientTimer = null;
  }
  setOrbVisible(orbA, false);
  setOrbVisible(orbB, false);
};

const advanceAmbient = () => {
  if (hasImages) {
    return;
  }
  const next = activeOrb === "a" ? orbB : orbA;
  setOrbVisible(next, false);
  window.requestAnimationFrame(() => {
    applyOrb(next, randomOrbConfig());
    window.requestAnimationFrame(() => {
      setOrbVisible(next, true);
    });
  });
  activeOrb = activeOrb === "a" ? "b" : "a";
  scheduleAmbient();
};

const advanceBackground = async () => {
  if (!hasImages) {
    scheduleRotation();
    return;
  }
  if (imageQueue.length === 0) {
    imageQueue = shuffle(images);
  }
  const next = imageQueue.shift();
  if (!next) {
    scheduleRotation();
    return;
  }
  const nextLayer = activeLayer === "a" ? imageB : imageA;
  const prevLayer = activeLayer === "a" ? imageA : imageB;
  nextLayer.style.backgroundImage = `url("${next}")`;
  setLayerVisible(nextLayer, true);
  setLayerVisible(prevLayer, false);
  activeLayer = activeLayer === "a" ? "b" : "a";
  scheduleRotation();
};

const refreshImages = async () => {
  if (!window.tanda?.listBackgroundImages) {
    images = [];
  } else {
    images = await window.tanda.listBackgroundImages();
  }
  hasImages = images.length > 0;
  if (!hasImages) {
    setLayerVisible(imageA, false);
    setLayerVisible(imageB, false);
    if (swirlLayer) {
      swirlLayer.style.display = "block";
    }
    stopAmbient();
    applyOrb(orbA, randomOrbConfig());
    setOrbVisible(orbA, true);
    activeOrb = "a";
    scheduleAmbient();
    scheduleRotation();
    return;
  }
  if (swirlLayer) {
    swirlLayer.style.display = "none";
  }
  stopAmbient();
  imageQueue = shuffle(images);
  await advanceBackground();
};

const applyDisplayUpdate = (payload) => {
  if (!payload) {
    return;
  }
  if (titleEl) {
    titleEl.textContent = payload.title || "";
  }
  if (artistEl) {
    artistEl.textContent = payload.artist || "";
  }
  if (progressEl) {
    progressEl.textContent = payload.progressText || "";
  }
  if (nextEl) {
    nextEl.textContent = payload.nextTandaText || "";
    nextEl.style.opacity = payload.nextTandaText ? "0.85" : "0";
  }
  if (typeof payload.backgroundIntervalSec === "number") {
    const nextMs = Math.max(5000, payload.backgroundIntervalSec * 1000);
    if (rotationMs !== nextMs) {
      rotationMs = nextMs;
      scheduleRotation();
    }
  }
  if (contentEl) {
    contentEl.classList.toggle("cortina-mode", payload.mode === "cortina");
  }
};

window.tanda?.onDisplayUpdate?.((payload) => {
  applyDisplayUpdate(payload);
});

window.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) {
    pointerDown = null;
    return;
  }
  pointerDown = {
    x: event.clientX,
    y: event.clientY,
    ts: performance.now(),
  };
});

window.addEventListener("pointerup", (event) => {
  if (event.button !== 0 || !pointerDown) {
    pointerDown = null;
    return;
  }
  const dx = Math.abs(event.clientX - pointerDown.x);
  const dy = Math.abs(event.clientY - pointerDown.y);
  const elapsed = performance.now() - pointerDown.ts;
  pointerDown = null;
  if (dx > 6 || dy > 6 || elapsed > 600) {
    return;
  }
  window.close();
});

void refreshImages();
