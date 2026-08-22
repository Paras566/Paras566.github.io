(() => {
  'use strict';

  const panel = document.querySelector('.hero-character');
  const heroImg = document.getElementById('hero-character-frame');
  if (!panel || !heroImg) return;

  // The panel is only shown at wider widths (see CSS) - bail before setting
  // any src so narrow viewports never fetch a single frame. (The <img> has
  // no src in the HTML itself for the same reason - display:none does not
  // stop an eager `src` from being requested.)
  if (!window.matchMedia('(min-width: 900px)').matches) return;

  heroImg.src = heroImg.dataset.src;

  const FRAME_DIR = 'assets/hero-frames';
  const FRAME_COUNT = 78; // full unique range of the captured turn+tilt arc

  const FRAME_NEUTRAL = 1;
  const FRAME_LEVEL_MAX = 44; // fullest horizontal turn, no upward tilt
  const FRAME_PEAK = 78;      // fullest horizontal turn + fullest upward tilt

  const EASE_PER_SEC = 10;
  const SENSITIVITY = 0.6;
  const RESPONSE_CURVE = 0.6;

  const pad5 = (n) => String(n).padStart(5, '0');
  const frameSrc = (n) => `${FRAME_DIR}/frame_${pad5(n)}.png`;

  const imageCache = new Array(FRAME_COUNT + 1);
  let loadedCount = 0;
  let allLoaded = false;

  for (let i = 1; i <= FRAME_COUNT; i++) {
    const img = new Image();
    img.onload = img.onerror = () => {
      loadedCount++;
      if (loadedCount === FRAME_COUNT) allLoaded = true;
    };
    img.src = frameSrc(i);
    imageCache[i] = img;
  }

  let pointerActive = false;
  let rawX = 0;
  let rawY = 0;

  window.addEventListener('mousemove', (e) => {
    rawX = e.clientX;
    rawY = e.clientY;
    pointerActive = true;
  }, { passive: true });

  document.addEventListener('mouseleave', () => {
    pointerActive = false;
  });

  window.addEventListener('blur', () => {
    pointerActive = false;
  });

  let currentH = 0;
  let currentV = 0;
  let targetH = 0;
  let targetV = 0;
  let mirrored = false;
  let lastFrame = FRAME_NEUTRAL;
  let lastTime = null;

  function shapeResponse(v) {
    const sign = v < 0 ? -1 : 1;
    return sign * Math.pow(Math.abs(v), RESPONSE_CURVE);
  }

  function updateTargets() {
    if (!pointerActive) {
      targetH = 0;
      targetV = 0;
      return;
    }
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const nx = cx > 0 ? (rawX - cx) / (cx * SENSITIVITY) : 0;
    const ny = cy > 0 ? (cy - rawY) / (cy * SENSITIVITY) : 0;
    targetH = shapeResponse(Math.max(-1, Math.min(1, nx)));
    targetV = shapeResponse(Math.max(0, Math.min(1, ny)));
  }

  function frameForPose(h, v) {
    const hAbs = Math.abs(h);
    const turn = Math.min(1, Math.max(hAbs, v));
    const base = FRAME_NEUTRAL + turn * (FRAME_LEVEL_MAX - FRAME_NEUTRAL);
    const upExtra = v * v * (FRAME_PEAK - FRAME_LEVEL_MAX);
    const f = base + upExtra;
    return Math.round(Math.min(FRAME_PEAK, Math.max(FRAME_NEUTRAL, f)));
  }

  function render() {
    const frame = frameForPose(currentH, currentV);

    if (currentH > 0.015) mirrored = true;
    else if (currentH < -0.015) mirrored = false;

    if (frame !== lastFrame && allLoaded) {
      heroImg.src = imageCache[frame].src;
      lastFrame = frame;
    }

    heroImg.style.transform = mirrored
      ? 'translateX(-50%) scaleX(-1)'
      : 'translateX(-50%)';
  }

  function tick(now) {
    if (lastTime === null) lastTime = now;
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    updateTargets();

    const alpha = 1 - Math.exp(-EASE_PER_SEC * dt);
    currentH += (targetH - currentH) * alpha;
    currentV += (targetV - currentV) * alpha;

    render();
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
})();
