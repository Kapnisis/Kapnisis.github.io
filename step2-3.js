function routePackets(container) {
    

    //check if table is full - then algo ends at 1.2 by definition
    const hasEmpty = grid.some(row => row.some(cell => cell.targetX === null));
    if (!hasEmpty) {
        const msg2 = document.createElement('p');
        msg2.className = 'phase-title';
        const msg3 = document.createElement('p');
        msg3.className = 'phase-title';

        if (isGr()) {
            msg2.textContent = 'Φάση 2: Δεν απαιτείται — ο αλγόριθμος τερμάτισε στην 1.2';
            msg3.textContent = 'Φάση 3: Δεν απαιτείται — ο αλγόριθμος τερμάτισε στην 1.2';
        } else {
            msg2.textContent = 'Phase 2: Not necessary — algorithm has finished on 1.2';
            msg3.textContent = 'Phase 3: Not necessary — algorithm has finished on 1.2';
        }

        container.appendChild(msg2);
        container.appendChild(msg3);
        return;
    }


    // Phase 2 - route columns right to left
    for (let r = 0; r < n; r++) {
        let newRow = [];
        for (let c = 0; c < n; c++)
            newRow.push({ targetX: null, targetY: null, value: sentinel });

        for (let c = n - 1; c >= 0; c--) {
            const packet = grid[r][c];
            if (packet.targetX === null) continue;
            const target = packet.targetY - 1;

            if (newRow[target].targetX === null) {
                newRow[target] = packet;
            } else {
                for (let offset = 1; offset < n; offset++) {
                    if (target + offset < n && newRow[target + offset].targetX === null) {
                        newRow[target + offset] = packet;
                        break;
                    }
                    if (target - offset >= 0 && newRow[target - offset].targetX === null) {
                        newRow[target - offset] = packet;
                        break;
                    }
                }
            }
        }
        grid[r] = newRow;
    }
    container.appendChild(renderGrid('Phase 2 - Greedy routing to correct column', 'Φάση 2 - Αποστολή των πακέτων στην σωστή στήλη με άπληστο αλγόριθμο'));




    // Phase 3 - route rows bottom to top
    for (let c = 0; c < n; c++) {
        let newCol = [];
        for (let r = 0; r < n; r++)
            newCol.push({ targetX: null, targetY: null, value: sentinel });

        for (let r = n - 1; r >= 0; r--) {
            const packet = grid[r][c];
            if (packet.targetX === null) continue;
            const target = packet.targetX - 1;

            if (newCol[target].targetX === null) {
                newCol[target] = packet;
            } else {
                for (let offset = 1; offset < n; offset++) {
                    if (target + offset < n && newCol[target + offset].targetX === null) {
                        newCol[target + offset] = packet;
                        break;
                    }
                    if (target - offset >= 0 && newCol[target - offset].targetX === null) {
                        newCol[target - offset] = packet;
                        break;
                    }
                }
            }
        }
        for (let r = 0; r < n; r++) grid[r][c] = newCol[r];
    }
    container.appendChild(renderGrid('Phase 3 - Greedy routing to correct row', 'Φάση 3 - Αποστολή των πακέτων στην σωστή γραμμή με άπληστο αλγόριθμο'));
}