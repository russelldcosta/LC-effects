document.addEventListener("DOMContentLoaded", () => {
    const radios = document.querySelectorAll("input[name='mode']");

    // Load saved mode
    chrome.storage.sync.get("fireMode", data => {
        const saved = data.fireMode || "sweep";
        radios.forEach(r => r.checked = (r.value === saved));
    });

    // Save mode
    radios.forEach(r => {
        r.addEventListener("change", () => {
            chrome.storage.sync.set({ fireMode: r.value });
        });
    });
});
