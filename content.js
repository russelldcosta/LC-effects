function startFireAnimation() {
    const poll = setInterval(() => {

        // Correct selector for 2025 LeetCode
        let squares = [
            ...document.querySelectorAll('rect.cursor-pointer[fill^="var(--green"]')
        ];

        if (squares.length === 0) {
            return; // page still loading
        }

        clearInterval(poll);
        let i = 0;

        function spread() {
            if (i < squares.length) {
                const sq = squares[i];

                sq.classList.add("fire-glow");

                if (Math.random() < 0.35) {
                    sq.classList.add("flicker");
                }

                i++;
                setTimeout(spread, 120); // spread speed
            } else {
                // reset after full run
                setTimeout(() => {
                    squares.forEach(sq => {
                        sq.classList.remove("fire-glow");
                        sq.classList.remove("flicker");
                    });
                    i = 0;
                    spread();
                }, 1400);
            }
        }

        spread();

    }, 300);
}

// start
startFireAnimation();
