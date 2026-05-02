function startAlgorithm() {
    if (isNaN(n)) return;
    if (!validateGrid()) return;

    // Read grid
    grid = [];
    for (let r = 0; r < n; r++) {
        let row = [];
        for (let c = 0; c < n; c++) {
            const input = document.querySelector(`#tableContainer input[data-row="${r}"][data-col="${c}"]`);
            const v = input.value.trim();
            if (v !== '') {
                const [a, b] = v.split(',').map(Number);
                row.push({ targetX: a, targetY: b, value: (b - 1) * n + a });
            } else {
                row.push({ targetX: null, targetY: null, value: sentinel });
            }
        }
        grid.push(row);
    }

    const container = document.getElementById('phaseContainer');
    container.innerHTML = '';

    // Phase 1.1.1
    for (let bc = 0; bc < n; bc += blockSize)
        for (let br = 0; br < n; br += blockSize)
            sortBlock(br, bc, Math.min(blockSize, n - br), Math.min(blockSize, n - bc));
    container.appendChild(renderGrid('Phase 1.1.1 - Snakelike sort in blocks', 'Φάση 1.1.1 - Snakelike ταξινόμηση των μπλοκ'));

    // Phase 1.1.2
    const numBlocksPerSlice = Math.ceil(n / blockSize);
    for (let bc = 0; bc < n; bc += blockSize) {
        const cols = Math.min(blockSize, n - bc);
        let rows = [];
        for (let r = 0; r < n; r++) {
            let row = [];
            for (let c = bc; c < bc + cols; c++) row.push(grid[r][c]);
            rows.push(row);
        }
        let newRows = new Array(n).fill(null);
        for (let b = 0; b < numBlocksPerSlice; b++)
            for (let i = 0; i < blockSize; i++) {
                const oldIdx = b * blockSize + i;
                const newIdx = i * numBlocksPerSlice + b;
                if (oldIdx < n && newIdx < n) newRows[newIdx] = rows[oldIdx];
            }
        for (let r = 0; r < n; r++) {
            if (newRows[r] === null) continue;
            for (let c = bc; c < bc + cols; c++)
                grid[r][c] = newRows[r][c - bc];
        }
    }
    container.appendChild(renderGrid('Phase 1.1.2 - Unshuffle of rows in slices', 'Φάση 1.1.2 - Μοίρσσμα των γραμμών στις φέτες'));

    // Phase 1.1.3
    for (let bc = 0; bc < n; bc += blockSize)
        for (let br = 0; br < n; br += blockSize)
            sortBlock(br, bc, Math.min(blockSize, n - br), Math.min(blockSize, n - bc));
    container.appendChild(renderGrid('Phase 1.1.3 - Snakelike sort in blocks', 'Φάση 1.1.3 - Snakelike ταξινόμηση των μπλοκ'));

    // Phase 1.1.4
    for (let r = 0; r < n; r++) sortRow(r);
    container.appendChild(renderGrid('Phase 1.1.4 - Row sort - ascending / left to right', 'Φάση 1.1.4 - Ταξινόμηση ανά γραμμή - αύξουσα / αριστερά προς δεξιά'));

    // Phase 1.1.5
    for (let bc = 0; bc < n; bc += blockSize) {
        const cols = Math.min(blockSize, n - bc);
        for (let br = 0; br < n; br += blockSize * 2)
            sortBlock(br, bc, Math.min(blockSize * 2, n - br), cols);
    }
    container.appendChild(renderGrid('Phase 1.1.5 - Snakelike sort in combined blocks 1-2, 3-4, ...', 'Φάση 1.1.5 - Snakelike ταξινόμηση στα μπλοκ 1-2, 3-4, ...'));

    // Phase 1.1.6
    for (let bc = 0; bc < n; bc += blockSize) {
        const cols = Math.min(blockSize, n - bc);
        for (let br = blockSize; br + blockSize < n; br += blockSize * 2)
            sortBlock(br, bc, Math.min(blockSize * 2, n - br), cols);
    }
    container.appendChild(renderGrid('Phase 1.1.6 - Snakelike sort in combined blocks 2-3, 4-5, ...', 'Φάση 1.1.6 - Snakelike ταξινόμηση στα μπλοκ 2-3, 4-5, ...'));

    // Phase 1.1.7
    for (let c = 0; c < n; c++) sortColumn(c);
    container.appendChild(renderGrid('Phase 1.1.7 - Column sort - ascending / top to bottom', 'Φάση 1.1.7 - Ταξινόμηση ανά στήλη - Αύξουσα / από πάνω προς κάτω'));

    // Phase 1.1.8
    const oeSteps = 2 * blockSize;
    for (let step = 0; step < oeSteps; step++) {
        for (let c = 0; c < n; c++) {
            const ascending = (c % 2 === 0);
            const start = step % 2;
            for (let r = start; r + 1 < n; r += 2)
                if (ascending ? grid[r][c].value > grid[r + 1][c].value
                    : grid[r][c].value < grid[r + 1][c].value)
                    swap(r, c, r + 1, c);
        }
        for (let c = 0; c + 1 < n; c++) {
            const ascending = (c % 2 === 0);
            const boundaryR = ascending ? n - 1 : 0;
            const nextR = ascending ? 0 : n - 1;
            if (grid[boundaryR][c].value > grid[nextR][c + 1].value)
                swap(boundaryR, c, nextR, c + 1);
        }
    }
    container.appendChild(renderGrid('Phase 1.1.8 - Snakelike sort in whole grid', 'Φάση 1.1.8 - Snakelike ταξινόμηση στο συνολικό πλέγμα'));

    // Phase 1.2
    for (let c = 0; c < n; c++) sortColumn(c);
    container.appendChild(renderGrid('Phase 1.2 - Column-major sort in every column', 'Φάση 1.2 - Column-major ταξινόμηση ανά στήλη'));

    // Phase 2 and 3
    routePackets(container);
}