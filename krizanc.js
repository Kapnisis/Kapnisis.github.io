function krizancAlgorithm() {
    const n = parseInt(document.getElementById('sideN').value);
    if (isNaN(n) || n < 2 || n % 2 !== 0) {
        alert('Please enter a valid even value for √N.');
        return;
    }

    const half = n / 2;

    let grid = {};
    for (let r = 1; r <= n; r++) {
        grid[r] = {};
        for (let c = 1; c <= n; c++) {
            const input = document.querySelector(
                `#tableContainer input[data-row="${r-1}"][data-col="${c-1}"]`
            );
            const v = input.value.trim();
            if (v === '') {
                alert(`Cell (${r},${c}) is empty. Please fill all cells.`);
                return;
            }
            const [a, b] = v.split(',').map(Number);
            grid[r][c] = [{
                sourceRow: r,
                sourceCol: c,
                destRow: a,
                destCol: b,
                moved: false
            }];
        }
    }

    krizancInitialGrid = JSON.parse(JSON.stringify(grid));

    document.getElementById('tableContainer').innerHTML = '';
    
    const container = document.getElementById('phaseContainer');
    container.innerHTML = '';

    function rowHalf(r) { return r <= half ? 1 : 2; }
    function colHalf(c) { return c <= half ? 1 : 2; }
    function relRow(r)  { return r <= half ? r : r - half; }
    function relCol(c)  { return c <= half ? c : c - half; }
    function quadrantOrigin(rh, ch) {
        return {
            r: rh === 1 ? 1 : half + 1,
            c: ch === 1 ? 1 : half + 1
        };
    }

    const quadrantColors = {
        '1-1': '#000000',
        '1-2': '#d30ae6',
        '2-1': '#e67e22',
        '2-2': '#13afb4'
    };

    function cellBorderColor(r, c) {
        return quadrantColors[`${rowHalf(r)}-${colHalf(c)}`];
    }

    function packetColor(p) {
        const rh = rowHalf(p.destRow);
        const ch = colHalf(p.sourceCol);
        return quadrantColors[`${rh}-${ch}`];
    }

    function buildSlide(titleEn, titleGr, gridState, mode, phaseSteps, totalSteps, descEn, descGr) {
        const wrapper = document.createElement('div');
        wrapper.style.display = 'none';
        wrapper.className = 'krizanc-slide';

        const table = document.createElement('table');
        const headerRow = document.createElement('tr');
        headerRow.appendChild(document.createElement('th'));
        for (let c = 1; c <= n; c++) {
            const th = document.createElement('th');
            th.textContent = c;
            headerRow.appendChild(th);
        }
        table.appendChild(headerRow);

        for (let r = 1; r <= n; r++) {
            const tr = document.createElement('tr');
            const rh = document.createElement('th');
            rh.textContent = r;
            tr.appendChild(rh);
            for (let c = 1; c <= n; c++) {
                const td = document.createElement('td');
                td.style.borderColor = cellBorderColor(r, c);
                td.style.borderWidth = '2.5px';
                td.style.borderStyle = 'solid';
                td.style.verticalAlign = 'middle';
                td.style.lineHeight = '1.4';

                const packets = gridState[r][c];
                packets.forEach(p => {
                    const line = document.createElement('div');
                    const span = document.createElement('span');

                    if (mode === 'initial') {
                        // No packet coloring — plain black text, borders only
                        span.textContent = `${p.destRow},${p.destCol}`;
                    } else if (mode === 'analysis1') {
                        // Color by quadrant; underline packets that cross row halves
                        const isLong = rowHalf(r) !== rowHalf(p.destRow);
                        span.style.color = packetColor(p);
                        if (isLong) span.style.textDecoration = 'underline';
                        span.textContent = `${p.destRow},${p.destCol}`;
                    } else if (mode === 'analysis3') {
                        // Color by quadrant; underline packets that cross col halves
                        const isLong = colHalf(c) !== colHalf(p.destCol);
                        span.style.color = packetColor(p);
                        if (isLong) span.style.textDecoration = 'underline';
                        span.textContent = `${p.destRow},${p.destCol}`;
                    } else {
                        // Normal: color by quadrant, no extra decoration
                        span.style.color = packetColor(p);
                        span.textContent = `${p.destRow},${p.destCol}`;
                    }

                    line.appendChild(span);
                    td.appendChild(line);
                });

                tr.appendChild(td);
            }
            table.appendChild(tr);
        }

        wrapper.appendChild(table);

        // Step counters
        const steps = document.createElement('div');
        steps.style.marginTop = '10px';
        steps.style.fontSize = '12px';
        steps.style.color = '#666';
        steps.innerHTML = `
            <span lang="en">Phase Steps: <strong>${phaseSteps}</strong> &nbsp;|&nbsp; Total Steps: <strong>${totalSteps}</strong> &nbsp;|&nbsp; Predicted: <strong>${2.5 * n}</strong></span>
            <span lang="gr">Βήματα Φάσης: <strong>${phaseSteps}</strong> &nbsp;|&nbsp; Συνολικά Βήματα: <strong>${totalSteps}</strong> &nbsp;|&nbsp; Πρόβλεψη: <strong>${2.5 * n}</strong></span>
        `;
        wrapper.appendChild(steps);

        wrapper.dataset.titleEn = titleEn;
        wrapper.dataset.titleGr = titleGr;
        wrapper.dataset.descEn = descEn || '';
        wrapper.dataset.descGr = descGr || '';
        return wrapper;
    }

    // ── Compute Phase 1 ──
    const gridAfterP1 = JSON.parse(JSON.stringify(grid));
    const moves1 = [];
    for (let c = 1; c <= n; c++) {
        for (let r = 1; r <= n; r++) {
            const packet = gridAfterP1[r][c][0];
            if (!packet) continue;
            if (rowHalf(r) !== rowHalf(packet.destRow)) {
                const targetRow = rowHalf(r) === 1 ? r + half : r - half;
                moves1.push({ fromR: r, fromC: c, toR: targetRow, packet });
            }
        }
    }
    for (const { fromR, fromC, toR, packet } of moves1) {
        gridAfterP1[fromR][fromC] = gridAfterP1[fromR][fromC].filter(p => p !== packet);
        packet.moved = true;
        gridAfterP1[toR][fromC].push(packet);
    }

    // ── Compute Phase 2 ──
    const gridAfterP2 = JSON.parse(JSON.stringify(gridAfterP1));
    for (let rh = 1; rh <= 2; rh++) {
        for (let ch = 1; ch <= 2; ch++) {
            const origin = quadrantOrigin(rh, ch);
            const r0 = origin.r;
            const c0 = origin.c;
            const r1 = r0 + half - 1;
            const c1 = c0 + half - 1;

            let packets = [];
            for (let r = r0; r <= r1; r++)
                for (let c = c0; c <= c1; c++)
                    for (const p of gridAfterP2[r][c])
                        packets.push({ p, fromR: r, fromC: c });

            for (let r = r0; r <= r1; r++)
                for (let c = c0; c <= c1; c++)
                    gridAfterP2[r][c] = [];

            for (const { p, fromR, fromC } of packets) {
                const targetR = r0 + relRow(p.destRow) - 1;
                const targetC = c0 + relCol(p.destCol) - 1;
                p.moved = targetR !== fromR || targetC !== fromC;
                gridAfterP2[targetR][targetC].push(p);
            }
        }
    }

    // ── Compute Phase 3 ──
    const gridAfterP3 = JSON.parse(JSON.stringify(gridAfterP2));
    const moves3 = [];
    for (let r = 1; r <= n; r++) {
        for (let c = 1; c <= n; c++) {
            for (const packet of gridAfterP3[r][c]) {
                packet.moved = false;
                if (colHalf(c) !== colHalf(packet.destCol)) {
                    const targetCol = colHalf(c) === 1 ? c + half : c - half;
                    moves3.push({ fromR: r, fromC: c, toC: targetCol, packet });
                }
            }
        }
    }
    for (const { fromR, fromC, toC, packet } of moves3) {
        gridAfterP3[fromR][fromC] = gridAfterP3[fromR][fromC].filter(p => p !== packet);
        packet.moved = true;
        gridAfterP3[fromR][toC].push(packet);
    }

    function resetMovedInGrid(g) {
        for (let r = 1; r <= n; r++)
            for (let c = 1; c <= n; c++)
                for (const p of g[r][c])
                    p.moved = false;
    }

    const gridInitial = JSON.parse(JSON.stringify(grid));
    resetMovedInGrid(gridInitial);
    const gridPreP1 = JSON.parse(JSON.stringify(grid));
    resetMovedInGrid(gridPreP1);
    const gridPreP2 = JSON.parse(JSON.stringify(gridAfterP1));
    resetMovedInGrid(gridPreP2);
    const gridPreP3 = JSON.parse(JSON.stringify(gridAfterP2));
    resetMovedInGrid(gridPreP3);

    // ── Build slides ──
    const slides = [
        buildSlide('Initial Grid',  'Αρχικό Πλέγμα',    gridInitial,  'initial',   0,        0,
            'We divide the grid into 4 sub-meshes (quadrants) of size √N/2 × √N/2.',
            'Χωρίζουμε το πλέγμα σε 4 τεταρτημόρια (sub-mesh) μεγέθους √N/2 × √N/2.'),
        buildSlide('Phase 1',       'Φάση 1',            gridPreP1,    'normal',    0,        0,
            'We determine the intermediate sub-mesh for each packet, coloring it accordingly.',
            'Προσδιορίζουμε για κάθε πακέτο το intermediate sub-mesh, χρωματίζοντάς το ανάλογα.'),
        buildSlide('Phase 1',       'Φάση 1',            gridPreP1,    'analysis1', 0,        0,
            'Each packet in this phase will travel either 0 or <u>√N/2 positions away</u> in its column to reach its virtual source.',
            'Κάθε πακέτο σε αυτή τη φάση θα ταξιδέψει είτε 0 είτε <u>√N/2 θέσεις μακριά</u> στη στήλη του για να βρεθεί στη virtual source θέση του.'),
        buildSlide('Phase 1',       'Φάση 1',            gridAfterP1,  'normal',    half,     half,
            'End of phase 1. Packets are now at their virtual source position.',
            'Τέλος 1ης φάσης. Τα πακέτα βρίσκονται στη virtual source θέση τους.'),
        buildSlide('Phase 2',       'Φάση 2',            gridPreP2,    'normal',    0,        half,
            'Routing packets in each sub-mesh. 3*√N/2 steps needed.',
            'Γίνεται δρομολόγηση των πακέτων σε κάθε sub-mesh. Απαιτούνται 3*√N/2 βήματα.'),
        buildSlide('Phase 2',       'Φάση 2',            gridAfterP2,  'normal',    3*half,   4*half,
            'End of phase 2. Packets are now at their virtual destination.',
            'Τέλος 2ης φάσης. Τα πακέτα βρίσκονται τώρα στη virtual destination θέση τους.'),
        buildSlide('Phase 3',       'Φάση 3',            gridPreP3,    'analysis3', 0,        4*half,
            'Each packet in this phase will travel either 0 or <u>√N/2 positions away</u> in its row to reach its final position.',
            'Κάθε πακέτο σε αυτή τη φάση θα ταξιδέψει είτε 0 είτε <u>√N/2 θέσεις μακριά</u> στη γραμμή του για να βρεθεί στην τελική θέση του.'),
        buildSlide('Final Result',  'Τελικό Αποτέλεσμα', gridAfterP3,  'normal',    half,     2.5*n,
            'The grid has been fully routed.',
            'Το πλέγμα έχει δρομολογηθεί πλήρως.'),
    ];

    // ── Navigation ──
    let currentSlide = 0;

    const nav = document.createElement('div');
    nav.style.display = 'flex';
    nav.style.alignItems = 'center';
    nav.style.justifyContent = 'center';
    nav.style.gap = '16px';
    nav.style.marginBottom = '16px';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'run-btn';
    prevBtn.innerHTML = '<span lang="en">← Previous</span><span lang="gr">← Προηγούμενο</span>';

    const phaseLabel = document.createElement('span');
    phaseLabel.style.fontWeight = 'bold';
    phaseLabel.style.fontSize = '14px';
    phaseLabel.style.color = '#1a2a4a';
    phaseLabel.style.minWidth = '200px';
    phaseLabel.style.textAlign = 'center';

    const nextBtn = document.createElement('button');
    nextBtn.className = 'run-btn';
    nextBtn.innerHTML = '<span lang="en">Next →</span><span lang="gr">Επόμενο →</span>';

    nav.appendChild(prevBtn);
    nav.appendChild(phaseLabel);
    nav.appendChild(nextBtn);
    container.appendChild(nav);

    const descBox = document.createElement('div');
    descBox.style.margin = '0 auto 14px auto';
    descBox.style.maxWidth = '520px';
    descBox.style.textAlign = 'center';
    descBox.style.fontSize = '13px';
    descBox.style.color = '#444';
    descBox.style.fontStyle = 'italic';
    container.appendChild(descBox);

    slides.forEach(s => container.appendChild(s));

    function showSlide(i) {
        slides.forEach((s, j) => s.style.display = j === i ? 'block' : 'none');
        const isGrLang = document.body.classList.contains('lang-gr');
        phaseLabel.textContent = isGrLang
            ? slides[i].dataset.titleGr
            : slides[i].dataset.titleEn;
        descBox.innerHTML = isGrLang
            ? slides[i].dataset.descGr
            : slides[i].dataset.descEn;
        prevBtn.disabled = i === 0;
        nextBtn.disabled = i === slides.length - 1;
        currentSlide = i;
    }

    prevBtn.addEventListener('click', () => { if (currentSlide > 0) showSlide(currentSlide - 1); });
    nextBtn.addEventListener('click', () => { if (currentSlide < slides.length - 1) showSlide(currentSlide + 1); });

    showSlide(0);
}

let krizancInitialGrid = null;