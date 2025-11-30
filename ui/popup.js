document.addEventListener("DOMContentLoaded", () => {
    // Selects all radio buttons named 'mode', including the new 'bfs' one.
    const radios = document.querySelectorAll("input[name='mode']");

    // Load saved mode
    chrome.storage.sync.get("fireMode", data => {
        // Sets the default to "sweep" if no mode is saved yet.
        const saved = data.fireMode || "sweep"; 
        radios.forEach(r => r.checked = (r.value === saved));
    });

    // Save mode
    radios.forEach(r => {
        r.addEventListener("change", () => {
            // Saves the newly selected radio button's value (e.g., "bfs")
            chrome.storage.sync.set({ fireMode: r.value });
        });
    });
});