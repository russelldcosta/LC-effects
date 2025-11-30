/* Configuration */
const SPREAD_STEP_MS = 120;       // For Sweep
const BFS_STEP_MS = 200;           // Faster step for BFS ripple
const HOLD_AFTER_RUN_MS = 3000;
const FLARE_PROBABILITY = 0.10;
const RANDOM_INTERVAL_MIN = 300;
const RANDOM_INTERVAL_MAX = 900;

/* Random Burst Config */
const RANDOM_BATCH_SIZE = 4;
const BATCH_DELAY_MS = 250;

const GREEN_SELECTOR = 'rect[fill^="var(--green"]';

let currentMode = "sweep"; // Options: "sweep", "random", "bfs"
let FIRE_MODE = "sweep";

/* ------------------------------------------------------ */
/* CORE UTILITIES                        */
/* ------------------------------------------------------ */

function resetAllGlow() {
    getFlatRects().forEach(r => removeGlow(r));
}

function loadMode() {
    chrome.storage.sync.get("fireMode", data => {
        const newMode = data.fireMode || "sweep";
        
        currentMode = newMode;
        FIRE_MODE = newMode;

        // Stop ALL loops
        stopSweepLoop();
        stopRandomLoop();
        stopBFSLoop(); 

        resetAllGlow();

        scheduleRun(100);
    });
}

chrome.storage.onChanged.addListener(loadMode);
loadMode();

/* Helpers: Returns a 2D Grid (Array of Columns, where Col = Array of Rows) */
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

    // Sort columns by Left position
    const sortedKeys = Object.keys(columns).map(Number).sort((a, b) => a - b);
    
    // Sort rows within columns by Top position
    return sortedKeys.map(k => columns[k].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top));
}

function getFlatRects() {
    return getColumns().flat();
}

/* Glow Effects */
function addGlow(el) {
    if(!el) return;
    el.classList.add("fire-bright", "flame-anim");
}

function removeGlow(el) {
    if(!el) return;
    el.classList.remove("fire-bright", "flame-anim", "flare", "fire-fade");
}

function fadeGlow(el) {
    if(!el) return;
    removeGlow(el);
    el.classList.add("fire-fade");
    setTimeout(() => el.classList.remove("fire-fade"), 700);
}

/* Central Scheduler */
let runTimeout = null;
function scheduleRun(ms = 250) {
    clearTimeout(runTimeout);
    runTimeout = setTimeout(() => runModeController(), ms);
}

/* Observer */
const observer = new MutationObserver(() => {
    if (!sweepRunning && !randomRunning && !bfsRunning) scheduleRun(200);
});
observer.observe(document.body, { childList: true, subtree: true });

/* ------------------------------------------------------ */
/* MODE: SWEEP                         */
/* ------------------------------------------------------ */
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
    if (FIRE_MODE !== "sweep") { stopSweepLoop(); return; }

    const flat = getFlatRects();
    if (!flat.length) { sweepRunning = false; return; }

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
    stopBFSLoop();
    if (FIRE_MODE !== "sweep") return;
    if (sweepRunning) return;
    sweepRunning = true;
    runSweepOnce();
}

/* ------------------------------------------------------ */
/* MODE: RANDOM                        */
/* ------------------------------------------------------ */
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

function igniteBatch(allRects, count) {
    for(let i = 0; i < count; i++) {
        const rect = allRects[Math.floor(Math.random() * allRects.length)];
        if (!rect) continue;
        addGlow(rect);
        if (Math.random() < FLARE_PROBABILITY) {
            rect.classList.add("flare");
            setTimeout(() => rect.classList.remove("flare"), 420);
        }
        setTimeout(() => fadeGlow(rect), 500 + Math.random() * 400);
    }
}

function runRandomBurst(allRects) {
    if (FIRE_MODE !== "random") { stopRandomLoop(); return; }
    if (!allRects || !allRects.length) { scheduleNextRandom(getFlatRects()); return; }

    igniteBatch(allRects, RANDOM_BATCH_SIZE);
    
    randomTimer = setTimeout(() => {
        if (FIRE_MODE !== "random") return;
        igniteBatch(allRects, RANDOM_BATCH_SIZE);
        scheduleNextRandom(allRects);
    }, BATCH_DELAY_MS);
}

function runRandomMode() {
    stopSweepLoop();
    stopBFSLoop();
    if (FIRE_MODE !== "random") return;
    if (randomRunning) return;
    randomRunning = true;
    scheduleNextRandom(getFlatRects());
}

/* ------------------------------------------------------ */
/* MODE: BFS (RIPPLE)                  */
/* ------------------------------------------------------ */
let bfsRunning = false;
let bfsTimers = [];

function stopBFSLoop() {
    bfsTimers.forEach(t => clearTimeout(t));
    bfsTimers = [];
    bfsRunning = false;
}

function runBFSOnce() {
    if (FIRE_MODE !== "bfs") { stopBFSLoop(); return; }

    const grid = getColumns(); // Returns [Col][Row]
    if (!grid.length) { bfsRunning = false; return; }

    // 1. Pick a random start node
    const maxCols = grid.length;
    const startCol = Math.floor(Math.random() * maxCols);
    const startRow = Math.floor(Math.random() * grid[startCol].length);

    // 2. BFS Algorithm to calculate delays
    // Queue stores: [colIndex, rowIndex, distance]
    const queue = [[startCol, startRow, 0]];
    const visited = new Set([`${startCol},${startRow}`]);
    
    // Store animations to run: [{ rect, distance }]
    const animations = []; 
    let maxDistance = 0;

    // Directions: Up, Down, Left, Right
    const dirs = [[0,1], [0,-1], [1,0], [-1,0]];

    while(queue.length > 0) {
        const [c, r, dist] = queue.shift();
        
        animations.push({ rect: grid[c][r], dist: dist });
        maxDistance = Math.max(maxDistance, dist);

        // Check neighbors
        for (let d of dirs) {
            const nc = c + d[0];
            const nr = r + d[1];

            // Boundary Check
            if (nc >= 0 && nc < maxCols && nr >= 0 && nr < grid[nc].length) {
                const key = `${nc},${nr}`;
                if (!visited.has(key)) {
                    visited.add(key);
                    queue.push([nc, nr, dist + 1]);
                }
            }
        }
    }

    // 3. Execute Animations
    animations.forEach(anim => {
        const delay = anim.dist * BFS_STEP_MS;
        
        const t = setTimeout(() => {
            if (FIRE_MODE !== "bfs") return;
            addGlow(anim.rect);
            
            // Short flare for ripple effect
            if (Math.random() < 0.05) {
                 anim.rect.classList.add("flare");
                 setTimeout(() => anim.rect.classList.remove("flare"), 300);
            }

            // Fade out
            setTimeout(() => {
                fadeGlow(anim.rect);
            }, 800); // Hold briefly
        }, delay);

        bfsTimers.push(t);
    });

    // 4. Schedule next ripple after the last one finishes + buffer
    const totalDuration = (maxDistance * BFS_STEP_MS) + 1200; 
    
    const nextTimer = setTimeout(() => {
        bfsRunning = false;
        scheduleRun(100);
    }, totalDuration);
    
    bfsTimers.push(nextTimer);
}

function runBFSMode() {
    stopSweepLoop();
    stopRandomLoop();

    if (FIRE_MODE !== "bfs") return;
    if (bfsRunning) return;

    bfsRunning = true;
    runBFSOnce();
}

/* ------------------------------------------------------ */
/* MAIN CONTROLLER                       */
/* ------------------------------------------------------ */

function runModeController() {
    if (FIRE_MODE === "sweep") {
        runSpreadCycle();
    } else if (FIRE_MODE === "bfs") {
        runBFSMode();
    } else {
        runRandomMode(); // Default to random if unknown
    }
}

window.addEventListener("load", () => setTimeout(runModeController, 700));
setTimeout(runModeController, 700);