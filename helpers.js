
function isGr() {
    return document.body.classList.contains('lang-gr');
}


function swap(r1, c1, r2, c2) {
    [grid[r1][c1], grid[r2][c2]] = [grid[r2][c2], grid[r1][c1]];
}



function sortBlock(r0, c0, rows, cols) {
    const phases = Math.ceil(Math.log2(rows * cols)) + 1;
    for (let op = 0; op < phases; op++) {
        if (op % 2 === 0) {
            for (let c = c0; c < c0 + cols; c++) {
                const ascending = ((c - c0) % 2 === 0);
                for (let step = 0; step < rows; step++) {
                    const start = step % 2;
                    for (let r = r0 + start; r + 1 < r0 + rows; r += 2) {
                        if (ascending ? grid[r][c].value > grid[r + 1][c].value
                            : grid[r][c].value < grid[r + 1][c].value)
                            swap(r, c, r + 1, c);
                    }
                }
            }
        } else {
            for (let r = r0; r < r0 + rows; r++) {
                for (let step = 0; step < cols; step++) {
                    const start = step % 2;
                    for (let c = c0 + start; c + 1 < c0 + cols; c += 2) {
                        if (grid[r][c].value > grid[r][c + 1].value)
                            swap(r, c, r, c + 1);
                    }
                }
            }
        }
    }
}



function sortColumn(c) {
    for (let step = 0; step < n; step++) {
        const start = step % 2;
        for (let r = start; r + 1 < n; r += 2)
            if (grid[r][c].value > grid[r + 1][c].value)
                swap(r, c, r + 1, c);
    }
}



function sortRow(r) {
    for (let step = 0; step < n; step++) {
        const start = step % 2;
        for (let c = start; c + 1 < n; c += 2)
            if (grid[r][c].value > grid[r][c + 1].value)
                swap(r, c, r, c + 1);
    }
}




function renderGrid(labelEn, labelGr) {

    const wrapper = document.createElement('div');
    
    const titleEn = document.createElement('p');
    titleEn.className = 'phase-title';
    titleEn.setAttribute('lang', 'en');
    titleEn.textContent = labelEn;
    wrapper.appendChild(titleEn);

    const titleGr = document.createElement('p');
    titleGr.className = 'phase-title';
    titleGr.setAttribute('lang', 'gr');
    titleGr.textContent = labelGr;
    wrapper.appendChild(titleGr);


    const table = document.createElement('table');
    const headerRow = document.createElement('tr');
    
    headerRow.appendChild(document.createElement('th'));
    for (let i = 1; i <= n; i++) {
        const th = document.createElement('th');
        th.textContent = i;
        headerRow.appendChild(th);
    }
    table.appendChild(headerRow);

    for (let r = 0; r < n; r++) {
        const tr = document.createElement('tr');
        const rowHeader = document.createElement('th');
        rowHeader.textContent = r + 1;
        tr.appendChild(rowHeader);
        for (let c = 0; c < n; c++) {
            const td = document.createElement('td');
            const obj = grid[r][c];
            td.textContent = obj.targetX !== null ? `${obj.targetX},${obj.targetY}` : '';
            tr.appendChild(td);
        }
        table.appendChild(tr);
    }

    wrapper.appendChild(table);
    return wrapper;
}


