/* Configuration */
const SPREAD_STEP_MS = 120;
const HOLD_AFTER_RUN_MS = 3000;
const FLARE_PROBABILITY = 0.10;
const RANDOM_INTERVAL_MIN = 300;
const RANDOM_INTERVAL_MAX = 900;

/* New Config for Random Bursts */
const RANDOM_BATCH_SIZE = 10;    // How many squares light up at once
const BATCH_DELAY_MS = 250;     // Delay between the first group and second group

const GREEN_SELECTOR = 'rect[fill^="var(--green"]';

let currentMode = "sweep";
let FIRE_MODE = "sweep";

/* Remove all glow from all squares immediately */
function resetAllGlow() {
    getFlatRects().forEach(r => removeGlow(r));
}

/* Load mode from storage */
function loadMode() {
    chrome.storage.sync.get("fireMode", data => {
        const newMode = data.fireMode || "sweep";
        
        currentMode = newMode;
        FIRE_MODE = newMode;

        stopSweepLoop();
        stopRandomLoop();
        resetAllGlow();

        scheduleRun(100);
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

    const sorted = Object.keys(columns).map(Number).sort((a, b) => a - b);
    return sorted.map(k => columns[k].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top));
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
function scheduleRun(ms = 250) {
    clearTimeout(runTimeout);
    runTimeout = setTimeout(() => runModeController(), ms);
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
    if (FIRE_MODE !== "sweep") {
        stopSweepLoop();
        return;
    }

    const flat = getFlatRects();
    if (!flat.length) {
        sweepRunning = false;
        return;
    }

    flat.forEach(r => removeGlow(r));

    flat.forEach((rect, i) => {
        const onDelay = i * SPREAD_STEP_MS;
        const onTimer = setTimeout(() => {
            if (FIRE_MODE !== "sweep") return; 

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

/* -------- RANDOM MODE (UPDATED) -------- */
let randomRunning = false;
let randomTimer = null;

function stopRandomLoop() {
    if (randomTimer) clearTimeout(randomTimer);
    randomRunning = false;
}

function scheduleNextRandom(rects) {
    const delay = Math.random() * (RANDOM_INTERVAL_MAX - RANDOM_INTERVAL_MIN) + RANDOM_INTERVAL_MIN;
    randomTimer = setTimeout(() => runRandomBurst(rects), delay);
}

// Helper to light up a specific number of random squares
function igniteBatch(allRects, count) {
    for(let i = 0; i < count; i++) {
        const rect = allRects[Math.floor(Math.random() * allRects.length)];
        if (!rect) continue;

        addGlow(rect);

        // Random Flare
        if (Math.random() < FLARE_PROBABILITY) {
            rect.classList.add("flare");
            setTimeout(() => rect.classList.remove("flare"), 420);
        }

        // Schedule Fade
        setTimeout(() => {
            fadeGlow(rect);
        }, 500 + Math.random() * 400);
    }
}

function runRandomBurst(allRects) {
    if (FIRE_MODE !== "random") {
        stopRandomLoop();
        return;
    }

    if (!allRects || !allRects.length) {
        scheduleNextRandom(getFlatRects());
        return;
    }

    // --- 1. Ignite First Batch (4 squares) ---
    igniteBatch(allRects, RANDOM_BATCH_SIZE);

    // --- 2. Ignite Second Batch after small delay ---
    // We reuse randomTimer here so stopRandomLoop() can kill this delay if needed
    randomTimer = setTimeout(() => {
        if (FIRE_MODE !== "random") return;
        
        igniteBatch(allRects, RANDOM_BATCH_SIZE);
        
        // --- 3. Schedule the next cycle loop ---
        scheduleNextRandom(allRects);
        
    }, BATCH_DELAY_MS);
}

function runRandomMode() {
    stopSweepLoop();
    
    if (FIRE_MODE !== "random") return;
    if (randomRunning) return;
    
    randomRunning = true;
    scheduleNextRandom(getFlatRects());
}

/* -------- MAIN CONTROLLER -------- */
function runModeController() {
    if (FIRE_MODE === "sweep") {
        runSpreadCycle();
    } else {
        runRandomMode();
    }
}

window.addEventListener("load", () => setTimeout(runModeController, 700));
setTimeout(runModeController, 700);