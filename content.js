// Spread configuration (tweak these numbers)
const SPREAD_STEP_MS = 90;    // time between each square lighting (spread speed)
const HOLD_AFTER_RUN_MS = 1100; // how long to hold after full spread before resetting
const FLARE_PROBABILITY = 0.12; // chance a square will briefly flare during spread

// selector for LeetCode solved-day rects (matches current UI)
const GREEN_SELECTOR = 'rect[fill^="var(--green"]';

// helper: get all green rects in visual (left→right) order
function getSortedGreenRects() {
  const list = Array.from(document.querySelectorAll(GREEN_SELECTOR));
  // filter visible ones and map to bounding rect for ordering
  const visible = list.filter(r => {
    const bb = r.getBoundingClientRect();
    return bb.width > 0 && bb.height > 0;
  });
  visible.sort((a,b) => {
    const A = a.getBoundingClientRect();
    const B = b.getBoundingClientRect();
    // primary sort: by y (top), secondary: by x (left) — to respect grid rows
    if (Math.abs(A.top - B.top) > 6) return A.top - B.top;
    return A.left - B.left;
  });
  return visible;
}

// add classes in a staggered manner left -> right
let cycleTimer = null;
let running = false;

function runSpreadCycle() {
  if (running) return;
  running = true;

  const rects = getSortedGreenRects();
  if (!rects.length) {
    running = false;
    return;
  }

  // ensure previous classes removed
  rects.forEach(r => r.classList.remove('fire-glow', 'flame-anim', 'flare'));

  rects.forEach((rect, i) => {
    const delay = i * SPREAD_STEP_MS;
    setTimeout(() => {
      // apply main glow + flame animation
      rect.classList.add('fire-glow', 'flame-anim');

      // small chance to trigger a brighter flare on this square
      if (Math.random() < FLARE_PROBABILITY) {
        rect.classList.add('flare');
        // remove flare after its animation completes
        setTimeout(() => rect.classList.remove('flare'), 500);
      }

      // last one => schedule reset after a hold
      if (i === rects.length - 1) {
        setTimeout(() => {
          rects.forEach(r => r.classList.remove('fire-glow', 'flame-anim', 'flare'));
          // schedule next cycle
          setTimeout(() => {
            running = false;
            runSpreadCycle();
          }, 300);
        }, HOLD_AFTER_RUN_MS);
      }
    }, delay);
  });
}

// observe DOM changes and restart cycle when calendar updates
const observer = new MutationObserver(() => {
  // if not running, start a new cycle; else let current run finish
  if (!running) {
    // short debounce so UI finishes rendering
    clearTimeout(cycleTimer);
    cycleTimer = setTimeout(() => {
      runSpreadCycle();
    }, 300);
  }
});
observer.observe(document.body, { childList: true, subtree: true });

// initial attempt (in case heatmap is already there)
window.addEventListener('load', () => {
  // Wait a little for React to render heatmap
  setTimeout(runSpreadCycle, 700);
});

// Also attempt immediately in case load already fired
setTimeout(runSpreadCycle, 500);
