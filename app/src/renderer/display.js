const titleEl = document.getElementById("display-title");
const artistEl = document.getElementById("display-artist");
const progressEl = document.getElementById("display-progress");
const nextEl = document.getElementById("display-next");
const contentEl = document.querySelector(".display-content");
const swirlLayer = document.querySelector(".swirl-layer");
const overlayLayer = document.querySelector(".bg-overlay");
const orbA = document.querySelector(".orb-a");
const orbB = document.querySelector(".orb-b");
const orbC = document.querySelector(".orb-c");
const imageA = document.querySelector(".bg-image-a");
const imageB = document.querySelector(".bg-image-b");
const cortinaImageA = document.querySelector(".bg-cortina-a");
const cortinaImageB = document.querySelector(".bg-cortina-b");
const ambientOrbs = [orbA, orbB, orbC].filter(Boolean);

let normalImages = [];
let cortinaImages = [];
let normalQueue = [];
let cortinaQueue = [];
let activeNormalLayer = "a";
let activeCortinaLayer = "a";
let rotationMs = 20000;
let rotationTimer = null;
let mode = "normal";
let useBackgroundImages = true;
let imageDimOpacity = 0.35;
let fontScale = 1;
let cortinaFontScale = 1;
let edgePaddingVmin = 5;
let pointerDown = null;
let ambientTimer = null;
let activeOrbIndex = 0;

const hasAnyBackgroundImages = () =>
  useBackgroundImages && (normalImages.length > 0 || cortinaImages.length > 0);

const shuffle = (items) => {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const scheduleRotation = () => {
  if (mode !== "normal") {
    return;
  }
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
  const saturation = 84 + Math.floor(Math.random() * 16);
  const lightness = 66 + Math.floor(Math.random() * 18);
  const alpha = 0.48 + Math.random() * 0.26;
  return {
    x: 15 + Math.random() * 70,
    y: 18 + Math.random() * 64,
    size: (44 + Math.random() * 56) * 2,
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
  ambientOrbs.forEach((orb) => setOrbVisible(orb, false));
};

const advanceAmbient = () => {
  if (hasAnyBackgroundImages()) {
    return;
  }
  if (ambientOrbs.length === 0) {
    return;
  }
  activeOrbIndex = (activeOrbIndex + 1) % ambientOrbs.length;
  const next = ambientOrbs[activeOrbIndex];
  setOrbVisible(next, false);
  window.requestAnimationFrame(() => {
    applyOrb(next, randomOrbConfig());
    window.requestAnimationFrame(() => {
      setOrbVisible(next, true);
    });
  });
  scheduleAmbient();
};

const advanceBackground = async () => {
  if (!useBackgroundImages) {
    return;
  }
  const isCortina = mode === "cortina";
  const source = isCortina ? cortinaImages : normalImages;
  if (source.length === 0) {
    if (rotationTimer) {
      clearTimeout(rotationTimer);
      rotationTimer = null;
    }
    return;
  }
  if (isCortina && cortinaQueue.length === 0) {
    cortinaQueue = shuffle(cortinaImages);
  }
  if (!isCortina && normalQueue.length === 0) {
    normalQueue = shuffle(normalImages);
  }
  const next = isCortina ? cortinaQueue.shift() : normalQueue.shift();
  if (!next) {
    if (!isCortina) {
      scheduleRotation();
    }
    return;
  }
  const nextLayer = isCortina
    ? activeCortinaLayer === "a"
      ? cortinaImageB
      : cortinaImageA
    : activeNormalLayer === "a"
      ? imageB
      : imageA;
  const prevLayer = isCortina
    ? activeCortinaLayer === "a"
      ? cortinaImageA
      : cortinaImageB
    : activeNormalLayer === "a"
      ? imageA
      : imageB;
  nextLayer.style.backgroundImage = `url("${next}")`;
  setLayerVisible(nextLayer, true);
  setLayerVisible(prevLayer, false);
  if (isCortina) {
    activeCortinaLayer = activeCortinaLayer === "a" ? "b" : "a";
  } else {
    activeNormalLayer = activeNormalLayer === "a" ? "b" : "a";
  }
  if (!isCortina) {
    scheduleRotation();
  }
};

const applyBackgroundMode = async () => {
  if (mode === "cortina" && rotationTimer) {
    clearTimeout(rotationTimer);
    rotationTimer = null;
  }
  const anyImagesEnabled = hasAnyBackgroundImages();
  const modeImages =
    useBackgroundImages
      ? mode === "cortina"
        ? cortinaImages
        : normalImages
      : [];
  if (overlayLayer) {
    const hasNormalImages = useBackgroundImages && normalImages.length > 0;
    const strong = hasNormalImages ? imageDimOpacity : 0.38;
    const soft = hasNormalImages ? Math.max(0, imageDimOpacity * 0.22) : 0.08;
    overlayLayer.style.setProperty("--display-overlay-strong", strong.toFixed(3));
    overlayLayer.style.setProperty("--display-overlay-soft", soft.toFixed(3));
  }
  if (anyImagesEnabled) {
    if (swirlLayer) {
      swirlLayer.style.display = "none";
    }
    stopAmbient();
  }
  if (modeImages.length > 0) {
    if (mode !== "cortina") {
      setLayerVisible(cortinaImageA, false);
      setLayerVisible(cortinaImageB, false);
    }
    await advanceBackground();
    return;
  }
  if (anyImagesEnabled) {
    // Keep static image layers (if any) and avoid gradient animation when image mode is enabled.
    if (mode === "cortina") {
      setLayerVisible(cortinaImageA, false);
      setLayerVisible(cortinaImageB, false);
    }
    return;
  }
  setLayerVisible(imageA, false);
  setLayerVisible(imageB, false);
  setLayerVisible(cortinaImageA, false);
  setLayerVisible(cortinaImageB, false);
  if (swirlLayer) {
    swirlLayer.style.display = "block";
  }
  stopAmbient();
  if (ambientOrbs.length > 0) {
    activeOrbIndex = 0;
    applyOrb(ambientOrbs[0], randomOrbConfig());
    setOrbVisible(ambientOrbs[0], true);
  }
  scheduleAmbient();
  if (mode === "normal") {
    scheduleRotation();
  }
};

const refreshImages = async () => {
  if (!window.tanda?.listBackgroundImages) {
    normalImages = [];
    cortinaImages = [];
  } else {
    [normalImages, cortinaImages] = await Promise.all([
      window.tanda.listBackgroundImages("images"),
      window.tanda.listBackgroundImages("cortina_images"),
    ]);
  }
  normalQueue = shuffle(normalImages);
  cortinaQueue = shuffle(cortinaImages);
  await applyBackgroundMode();
};

const applyDisplayUpdate = (payload) => {
  if (!payload) {
    return;
  }
  if (titleEl && payload.title !== undefined) {
    titleEl.textContent = payload.title || "";
  }
  if (artistEl && payload.artist !== undefined) {
    artistEl.textContent = payload.artist || "";
  }
  if (progressEl && payload.progressText !== undefined) {
    progressEl.textContent = payload.progressText || "";
  }
  if (nextEl && payload.nextTandaText !== undefined) {
    nextEl.textContent = payload.nextTandaText || "";
    nextEl.style.opacity = payload.nextTandaText ? "0.85" : "0";
  }
  if (typeof payload.backgroundIntervalSec === "number") {
    const nextMs = Math.max(5000, payload.backgroundIntervalSec * 1000);
    if (rotationMs !== nextMs) {
      rotationMs = nextMs;
      if (mode === "normal") {
        scheduleRotation();
      }
    }
  }
  if (typeof payload.imageDimOpacity === "number") {
    const nextDim = Math.min(0.9, Math.max(0, payload.imageDimOpacity));
    if (Math.abs(nextDim - imageDimOpacity) > 0.0001) {
      imageDimOpacity = nextDim;
      void applyBackgroundMode();
    }
  }
  if (typeof payload.fontScale === "number" && contentEl) {
    const nextScale = Math.min(2, Math.max(0.7, payload.fontScale));
    if (Math.abs(nextScale - fontScale) > 0.0001) {
      fontScale = nextScale;
      contentEl.style.setProperty("--display-font-scale", nextScale.toFixed(3));
    }
  }
  if (typeof payload.cortinaFontScale === "number" && contentEl) {
    const nextScale = Math.min(2.4, Math.max(0.7, payload.cortinaFontScale));
    if (Math.abs(nextScale - cortinaFontScale) > 0.0001) {
      cortinaFontScale = nextScale;
      contentEl.style.setProperty("--display-cortina-font-scale", nextScale.toFixed(3));
    }
  }
  if (typeof payload.edgePaddingVmin === "number" && contentEl) {
    const nextPadding = Math.min(16, Math.max(1, payload.edgePaddingVmin));
    if (Math.abs(nextPadding - edgePaddingVmin) > 0.0001) {
      edgePaddingVmin = nextPadding;
      contentEl.style.setProperty("--display-edge-padding-vmin", nextPadding.toFixed(2));
    }
  }
  if (typeof payload.useBackgroundImages === "boolean") {
    const nextUseBackgroundImages = payload.useBackgroundImages;
    if (nextUseBackgroundImages !== useBackgroundImages) {
      useBackgroundImages = nextUseBackgroundImages;
      void applyBackgroundMode();
    }
  }
  if (payload.mode !== undefined) {
    const nextMode = payload.mode === "cortina" ? "cortina" : "normal";
    if (nextMode !== mode) {
      mode = nextMode;
      void applyBackgroundMode();
    }
  }
  if (contentEl) {
    contentEl.classList.toggle("cortina-mode", mode === "cortina");
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
