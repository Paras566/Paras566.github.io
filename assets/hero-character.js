(() => {
  'use strict';

  const panel = document.querySelector('.hero-character');
  const heroImg = document.getElementById('hero-character-frame');
  if (!panel || !heroImg) return;

  // The panel is only shown at wider widths (see CSS) - bail before setting
  // any src so narrow viewports never fetch a single frame. (The <img> has
  // no src in the HTML itself for the same reason - display:none does not
  // stop an eager `src` from being requested.)
  if (!window.matchMedia('(min-width: 1000px)').matches) return;

  heroImg.src = heroImg.dataset.src;

  const FRAME_DIR = 'assets/hero-frames';
  const FRAME_COUNT = 78; // full unique range of the captured turn+tilt arc

  const FRAME_NEUTRAL = 1;
  const FRAME_LEVEL_MAX = 44; // fullest horizontal turn, no upward tilt
  const FRAME_PEAK = 78;      // fullest horizontal turn + fullest upward tilt

  const EASE_PER_SEC = 6;
  const RESPONSE_CURVE = 0.7;
  // Full leftward turn is reached once the cursor is this many pixels to the
  // left of his face - a fixed distance, not a fraction of the viewport, so
  // the effect feels the same regardless of screen size.
  const RANGE_X = 420;
  // Fraction of the space between his face and the top of the viewport that
  // maps to full upward tilt. His face sits fairly high up, so there isn't
  // much room above it - using a fraction of that actual space (instead of
  // a large fixed distance) means "up" is reachable instead of capping out
  // at a fraction of the pose before the cursor hits the top of the window.
  const UP_RANGE_FACTOR = 0.8;
  const UP_RANGE_MIN = 90;

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
  let lastFrame = FRAME_NEUTRAL;
  let lastTime = null;

  function shapeResponse(v) {
    const sign = v < 0 ? -1 : 1;
    return sign * Math.pow(Math.abs(v), RESPONSE_CURVE);
  }

  // Gaze is measured from his actual face position on screen (not the
  // viewport center) so "near him" really means "looking at you head-on",
  // and turning only kicks in once the cursor moves away from him.
  function getAnchor() {
    const rect = heroImg.getBoundingClientRect();
    return {
      x: rect.left + rect.width * 0.5,
      y: rect.top + rect.height * 0.22,
    };
  }

  function updateTargets() {
    if (!pointerActive) {
      targetH = 0;
      targetV = 0;
      return;
    }
    const anchor = getAnchor();

    // Only turn for a cursor to the left - there's no captured "look right"
    // pose, only a mirrored flip of the left one, and the shoulders/turn
    // flipping over reads as an unwanted jump rather than a natural look.
    // A cursor to the right just keeps him facing forward.
    const dx = rawX - anchor.x;
    const nx = dx < 0 ? Math.max(-1, dx / RANGE_X) : 0;

    const upRangePx = Math.max(UP_RANGE_MIN, anchor.y * UP_RANGE_FACTOR);
    const dy = anchor.y - rawY;
    const ny = dy > 0 ? Math.min(1, dy / upRangePx) : 0;

    targetH = shapeResponse(nx);
    targetV = shapeResponse(ny);
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

    if (frame !== lastFrame && allLoaded) {
      heroImg.src = imageCache[frame].src;
      lastFrame = frame;
    }
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
