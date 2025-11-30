/* Configuration */
const SPREAD_STEP_MS = 90;
const HOLD_AFTER_RUN_MS = 900;
const FLARE_PROBABILITY = 0.10;
const RANDOM_INTERVAL_MIN = 300;
const RANDOM_INTERVAL_MAX = 900;

const GREEN_SELECTOR = 'rect[fill^="var(--green"]';

let currentMode = "sweep";
let FIRE_MODE = "sweep";

/* Remove all glow from all squares */
function resetAllGlow() {
    getFlatRects().forEach(r => removeGlow(r));
}

/* Load mode from storage */
function loadMode() {
    chrome.storage.sync.get("fireMode", data => {
        currentMode = data.fireMode || "sweep";
        FIRE_MODE = currentMode;

        stopSweepLoop();
        stopRandomLoop();
        resetAllGlow();   // <<<<< THE FIX
        scheduleRun(120);
    });
}

chrome.storage.onChanged.addListener(loadMode);
loadMode();

/* Helpers: group into columns */
function getColumns() {
  const list = Array.from(document.querySelectorAll(GREEN_SELECTOR));
  const visible = list.filter(r => {
    const bb = r.getBoundingClientRect();
    return bb.width > 0 && bb.height > 0;
  });

  const columns = {};
  visible.forEach(r => {
    const bb = r.getBoundingClientRect();
    const key = Math.round(bb.left);
    if (!columns[key]) columns[key] = [];
    columns[key].push(r);
  });

  const sorted = Object.keys(columns).map(Number).sort((a,b)=>a-b);
  return sorted.map(k => columns[k].sort((a,b)=> a.getBoundingClientRect().top - b.getBoundingClientRect().top));
}

function getFlatRects() {
  return getColumns().flat();
}

/* Glow effect */
function addGlow(el) {
    el.classList.add("fire-bright", "flame-anim");
}
function removeGlow(el) {
    el.classList.remove("fire-bright", "flame-anim", "flare", "fire-fade");
}
function fadeGlow(el) {
    removeGlow(el);
    el.classList.add("fire-fade");
    setTimeout(() => el.classList.remove("fire-fade"), 700);
}

/* Debounced runner */
let runTimeout = null;
function scheduleRun(ms=250) {
    clearTimeout(runTimeout);
    runTimeout = setTimeout(() => runSpreadCycle(), ms);
}

/* Observer */
const observer = new MutationObserver(() => {
  if (!sweepRunning && !randomRunning) scheduleRun(200);
});
observer.observe(document.body, { childList: true, subtree: true });

/* -------- SWEEP MODE -------- */
let sweepRunning = false;
let sweepTimers = [];

function clearSweepTimers() {
    sweepTimers.forEach(t => clearTimeout(t));
    sweepTimers = [];
}

function stopSweepLoop() {
    clearSweepTimers();
    sweepRunning = false;
}

function runSweepOnce() {
    const flat = getFlatRects();
    if (!flat.length) {
        sweepRunning = false;
        return;
    }

    flat.forEach(r => removeGlow(r));

    flat.forEach((rect, i) => {
        const onDelay = i * SPREAD_STEP_MS;

        const onTimer = setTimeout(() => {
            addGlow(rect);

            if (Math.random() < FLARE_PROBABILITY) {
                rect.classList.add("flare");
                setTimeout(() => rect.classList.remove("flare"), 420);
            }

            const fadeTimer = setTimeout(() => {
                fadeGlow(rect);
                if (i === flat.length - 1) {
                    sweepRunning = false;
                    scheduleRun(120);
                }
            }, HOLD_AFTER_RUN_MS);

            sweepTimers.push(fadeTimer);
        }, onDelay);

        sweepTimers.push(onTimer);
    });
}

function runSpreadCycle() {
    stopRandomLoop();
    if (FIRE_MODE !== "sweep") return;

    if (sweepRunning) return;
    sweepRunning = true;
    runSweepOnce();
}

/* -------- RANDOM MODE -------- */
let randomRunning = false;
let randomTimer = null;

function stopRandomLoop() {
    if (randomTimer) clearTimeout(randomTimer);
    randomRunning = false;
}

function scheduleNextRandom(rects) {
    const delay = Math.random() * (RANDOM_INTERVAL_MAX - RANDOM_INTERVAL_MIN) + RANDOM_INTERVAL_MIN;
    randomTimer = setTimeout(() => runRandomOnce(rects), delay);
}

function runRandomOnce(allRects) {
    if (FIRE_MODE !== "random") {
        stopRandomLoop();
        return;
    }

    if (!allRects || !allRects.length) {
        scheduleNextRandom(getFlatRects());
        return;
    }

    const rect = allRects[Math.floor(Math.random() * allRects.length)];
    if (!rect) {
        scheduleNextRandom(allRects);
        return;
    }

    addGlow(rect);

    if (Math.random() < FLARE_PROBABILITY) {
        rect.classList.add("flare");
        setTimeout(() => rect.classList.remove("flare"), 420);
    }

    setTimeout(() => {
        fadeGlow(rect);
        scheduleNextRandom(allRects);
    }, 500 + Math.random() * 400);
}

function runRandomMode() {
    stopSweepLoop();
    if (randomRunning) return;
    randomRunning = true;
    scheduleNextRandom(getFlatRects());
}

/* -------- MAIN -------- */
function runModeController() {
    if (FIRE_MODE === "sweep") runSpreadCycle();
    else runRandomMode();
}

window.addEventListener("load", () => setTimeout(runModeController, 700));
setTimeout(runModeController, 700);
