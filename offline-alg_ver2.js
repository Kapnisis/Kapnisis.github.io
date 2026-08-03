/* ════════════════════════════════════════════════════════════════
   Βασικός Offline Αλγόριθμος (column-row-column, 3*sqrt(N)-3 steps, queue=1)
   Βασισμένος στο έργο του T.F. Leighton (Introduction to Parallel
   Algorithms & Architectures, section 1.7).
   Coloring: gray/yellow alternating-path search (Hall's Matching Theorem).
   Greedy routing (Phases 1c/2/3): farthest-first edge-contention priority
   (Lemma 1.5, section 1.7.1) -- n-1 steps, queue=1 (edge-contention sense).
   ════════════════════════════════════════════════════════════════ */

let oaTooltipEl = null;
function ensureTooltip() {
    if (oaTooltipEl) return oaTooltipEl;
    oaTooltipEl = document.createElement('div');
    oaTooltipEl.className = 'oa-tooltip';
    document.body.appendChild(oaTooltipEl);
    return oaTooltipEl;
}
function showTooltip(x, y, html) {
    const t = ensureTooltip();
    t.innerHTML = html;
    t.style.left = (x + 16) + 'px';
    t.style.top = (y + 16) + 'px';
    t.style.display = 'block';
}
function hideTooltip() { if (oaTooltipEl) oaTooltipEl.style.display = 'none'; }
function isGrLang() { return document.body.classList.contains('lang-gr'); }

function oaColorPalette(n) {
    const c = [];
    for (let i = 0; i < n; i++) c.push('hsl(' + Math.round((360 * i) / n) + ', 62%, 42%)');
    return c;
}
function colorLabel(k, colors) {
    const word = isGrLang() ? 'Χρώμα ' + k : 'Color ' + k;
    return '<span style="color:' + colors[k - 1] + '; font-weight:700;">' + word + '</span>';
}

/* ── Gray/yellow alternating-path search, full step recording ── */
function extendMatchingTraced(K, edgesByK, matchOfM, visitedM, color, path, steps) {
    for (const edge of edgesByK[K]) {
        if (visitedM.has(edge.M)) continue;
        if (edge.color !== null) continue;
        visitedM.add(edge.M);
        edge.color = 'yellow-pending';
        path.push(edge);
        steps.push({ type: 'try-gray', edge: edge, K: K });

        const occupant = matchOfM[edge.M];
        if (occupant === null) {
            steps.push({ type: 'found-free', edge: edge });
            return path;
        } else {
            steps.push({ type: 'follow-existing', edge: occupant.edgeRef });
            path.push(occupant.edgeRef);
            const result = extendMatchingTraced(occupant.K, edgesByK, matchOfM, visitedM, color, path, steps);
            if (result) return result;
            path.pop();
            path.pop();
            edge.color = null;
            steps.push({ type: 'backtrack', edge: edge });
        }
    }
    return null;
}

function applyFlip(path, color, matchOfM) {
    for (let i = 0; i < path.length; i++) {
        if (i % 2 === 0) {
            path[i].color = color;
            matchOfM[path[i].M] = { K: path[i].K, edgeRef: path[i] };
        } else {
            path[i].color = null;
        }
    }
}

/* ── Greedy line routing: farthest-first edge-contention priority (Lemma 1.5) ──
   items: array of {id, cur, dest} (0-indexed positions along the line).
   Returns { snapshots, moveLog, steps } where snapshots[t] is the state
   after t rounds (snapshots[0] = initial), and moveLog[t] describes what
   moved during round t+1 (for arrows / step display). */
function simulateGreedyLine(items) {
    const n = items.length;
    let positions = Array.from({ length: n }, () => []);
    items.forEach(function (it) { positions[it.cur].push({ id: it.id, dest: it.dest, cur: it.cur, meta: it.meta }); });

    function isDone() {
        for (let i = 0; i < n; i++) {
            if (positions[i].length !== 1 || positions[i][0].dest !== i) return false;
        }
        return true;
    }

    const snapshots = [positions.map(function (list) { return list.map(function (p) { return Object.assign({}, p); }); })];
    const moveLog = [];
    let round = 0;
    while (!isDone()) {
        round++;
        if (round > n + 5) throw new Error('greedy line routing did not converge');
        const requestsByEdge = {};
        positions.forEach(function (list) {
            list.forEach(function (p) {
                if (p.cur === p.dest) return;
                const dir = p.dest > p.cur ? 1 : -1;
                const to = p.cur + dir;
                const key = p.cur + '->' + to;
                const remaining = Math.abs(p.dest - p.cur);
                (requestsByEdge[key] = requestsByEdge[key] || []).push({ p: p, remaining: remaining });
            });
        });
        const winners = new Map();
        Object.keys(requestsByEdge).forEach(function (key) {
            const reqs = requestsByEdge[key];
            reqs.sort(function (a, b) { return b.remaining - a.remaining; });
            const winner = reqs[0];
            const parts = key.split('->');
            winners.set(winner.p.id, { from: parseInt(parts[0]), to: parseInt(parts[1]) });
        });
        const newPositions = Array.from({ length: n }, () => []);
        positions.forEach(function (list, pos) {
            list.forEach(function (p) {
                if (winners.has(p.id)) {
                    const mv = winners.get(p.id);
                    p.cur = mv.to;
                    newPositions[mv.to].push(p);
                } else {
                    newPositions[pos].push(p);
                }
            });
        });
        positions = newPositions;
        moveLog.push(Array.from(winners.entries()).map(function (entry) {
            return { id: entry[0], from: entry[1].from, to: entry[1].to };
        }));
        snapshots.push(positions.map(function (list) { return list.map(function (p) { return Object.assign({}, p); }); }));
    }
    return { snapshots: snapshots, moveLog: moveLog, steps: round };
}

/* ════════════════════════════════════════════════════════════════
   Main entry point
   ════════════════════════════════════════════════════════════════ */
function offlineAlgorithm() {
    const n = parseInt(document.getElementById('sideN').value);
    if (isNaN(n) || n < 2) { alert('Please enter a valid grid size.'); return; }

    const packets = [];
    let idCounter = 0;
    for (let r = 1; r <= n; r++) {
        for (let c = 1; c <= n; c++) {
            const input = document.querySelector('#tableContainer input[data-row="' + (r - 1) + '"][data-col="' + (c - 1) + '"]');
            const v = input.value.trim();
            if (v === '') { alert('Cell (' + r + ',' + c + ') is empty. Please fill all cells.'); return; }
            const parts = v.split(',').map(Number);
            packets.push({ id: idCounter++, sourceRow: r, sourceCol: c, destRow: parts[0], destCol: parts[1], color: null });
        }
    }

    document.getElementById('tableContainer').innerHTML = '';
    const container = document.getElementById('phaseContainer');
    container.innerHTML = '';

    const colors = oaColorPalette(n);

    const edgesByK = Array.from({ length: n + 1 }, () => []);
    packets.forEach(function (p) {
        const edge = { K: p.sourceCol, M: p.destCol, packetId: p.id, color: null };
        p.edgeRef = edge;
        edgesByK[p.sourceCol].push(edge);
    });
    edgesByK.forEach(function (list) { list.sort(function (a, b) { return a.M - b.M; }); });

    const state = {
        n: n, packets: packets, colors: colors, edgesByK: edgesByK,
        round: 0,
        matchOfM: new Array(n + 1).fill(null),
        currentK: 0,
        steps: null,
        stepIdx: 0,
        afterP1: null,
        afterP2: null,
        edgesBuilt: false
    };

    const subNav = document.createElement('div');
    subNav.className = 'wizard-tabs';
    subNav.style.marginBottom = '18px';
    const subTabsGr = ['Φάση 1 · Χρωματισμός', 'Φάση 2 · Γραμμές', 'Φάση 3 · Στήλες'];
    const subTabsEn = ['Phase 1 · Coloring', 'Phase 2 · Rows', 'Phase 3 · Columns'];
    const subTabEls = [];
    subTabsEn.forEach(function (_, i) {
        const tab = document.createElement('div');
        tab.className = 'wizard-tab' + (i === 0 ? ' active' : ' disabled');
        tab.innerHTML = '<span class="step-num">' + (i + 1) + '</span><span lang="en">' + subTabsEn[i] + '</span><span lang="gr">' + subTabsGr[i] + '</span>';
        subNav.appendChild(tab);
        subTabEls.push(tab);
    });
    container.appendChild(subNav);

    const stepBody = document.createElement('div');
    container.appendChild(stepBody);

    function activateSubTab(i) { subTabEls.forEach(function (t, j) { t.classList.toggle('active', j === i); }); }
    function markSubTabDone(i) { subTabEls[i].classList.remove('disabled'); subTabEls[i].classList.add('done'); }
    function unlockSubTab(i) { subTabEls[i].classList.remove('disabled'); }

    renderPhase1();

    /* ════════════════════════ PHASE 1 : Coloring ════════════════════════ */
    function renderPhase1() {
        activateSubTab(0);
        stepBody.innerHTML = '';

        const bigIdea = document.createElement('div');
        bigIdea.className = 'substep-explain';
        bigIdea.innerHTML =
            '<span lang="en"><strong>Basic idea:</strong> a greedy algorithm can route packets on a one-dimensional array of &radic;N processors in &radic;N &minus; 1 steps, during which no 2 packets will ever "compete" for the same transfer edge (queue size on every edge = 1).<br><br>' +
            'On a two-dimensional &radic;N &times; &radic;N mesh of processors, we can route N packets in time 2&radic;N &minus; 2 (&radic;N &minus; 1 per permutation) with 2 runs of the greedy algorithm (every packet goes to its destination row &rarr; every packet goes to its destination column, or vice versa). Such a sequence, however, creates the possibility of large queues forming, when 2+ packets try to move in the same direction over the same edge (in other words, when 2+ packets of the same row have the same destination column, and likewise for column/row).<br><br>' +
            'We solve this queue-forming problem by executing one extra permutation at the start, essentially sending every packet to a new starting position. This permutation is computed off-line, and is such that in every row all packets end up with a distinct destination column.</span>' +
            '<span lang="gr"><strong>Βασική Ιδέα:</strong> Ένας άπληστος αλγόριθμος μπορεί να δρομολογήσει πακέτα σε μονοδιάστατη διάταξη &radic;Ν επεξεργαστών σε &radic;Ν &minus; 1 βήματα, κατά τον οποίο ποτέ 2 πακέτα δεν θα "ανταγωνιστούν" για την ίδια ακμή μεταφοράς (ουρά σε κάθε ακμή = 1).<br><br>' +
            'Σε ένα διδιάστατο &radic;N &times; &radic;N πλέγμα επεξεργαστών, μπορούμε με 2 εκτελέσεις άπληστου αλγόριθμου (κάθε πακέτο πάει στη γραμμή προορισμού του &rarr; κάθε πακέτο πάει στη στήλη προορισμού του ή το αντίστροφο) να δρομολογήσουμε Ν πακέτα σε χρόνο 2&radic;Ν &minus; 2 (&radic;Ν &minus; 1 ανά μετάθεση). Μια τέτοια αλληλουχία δημιουργεί όμως την πιθανότητα δημιουργίας ουρών μεγάλου μεγέθους, όταν 2+ πακέτα προσπαθήσουν να μετακινηθούν με την ίδια κατεύθυνση στην ίδια ακμή (ή άλλως όταν 2+ πακέτα της ίδιας γραμμής έχουν προορισμό την ίδια στήλη και αντίστοιχα για στήλη/γραμμή).<br><br>' +
            'Λύνουμε αυτό το πρόβλημα δημιουργίας ουρών εκτελώντας μια επιπλέον μετάθεση στην αρχή, ουσιαστικά στέλνοντας κάθε πακέτο σε μια καινούρια αρχική θέση. Η μετάθεση υπολογίζεται off-line και είναι τέτοια ώστε σε κάθε γραμμή όλα τα πακέτα να έχουν προορισμό διαφορετική στήλη.</span>';
        stepBody.appendChild(bigIdea);

        const explain = document.createElement('div');
        explain.className = 'substep-explain';
        explain.innerHTML =
            '<span lang="en"><strong>Goal of Phase 1:</strong> we rearrange each column so that all packets in every row end up with a distinct destination column. ' +
            'This is the basic off-line part of the algorithm, and the most important one. To achieve it, we rely on the idea of a perfect matching, using Hall\'s Matching Theorem.</span>' +
            '<span lang="gr"><strong>Στόχος της Φάσης 1:</strong> Κάνουμε αναδιάταξη κάθε στήλης με τρόπο τέτοιο ώστε όλα τα πακέτα σε κάθε γραμμή να έχουν ξεχωριστή στήλη προορισμού. ' +
            'Η διαδικασία αυτή είναι το βασικό offline κομμάτι του αλγορίθμου αλλά και το σημαντικότερο. Για να το επιτύχουμε, βασιζόμαστε στην ιδέα του τέλειου ταιριάσματος, χρησιμοποιώντας το "Θεώρημα Ταιριάσματος του Hall".</span>';
        stepBody.appendChild(explain);

        const deepBox = document.createElement('div');
        deepBox.className = 'substep-explain deep';
        deepBox.innerHTML =
            '<span lang="en">Each packet is characterized by the position it is in and its destination. We will build a graph that depicts all packets as edges connecting the packet\'s Position column to its Destination column. Using Hall\'s Matching Theorem, we will color each edge so that no node has two edges of the same color. We will then use these colors as destination rows, moving packets of the same color to the same row. This coloring guarantees that at no stage of the rearrangement will 2 packets ever be in conflict over the same transfer edge.</span>' +
            '<span lang="gr">Κάθε πακέτο χαρακτηρίζεται από τη θέση που βρίσκεται και τον προορισμό του. Θα δημιουργήσουμε γράφημα που απεικονίζει όλα τα πακέτα ως ακμές που συνδέουν τη στήλη Θέσης του πακέτου με τη στήλη Προορισμού. Χρησιμοποιώντας το Θεώρημα Ταιριάσματος του Hall θα χρωματίσουμε κάθε ακμή με τέτοιο τρόπο, ώστε κανείς κόμβος να μην έχει ακμές με ίδιο χρώμα. Έπειτα θα χρησιμοποιήσουμε αυτά τα χρώματα ως γραμμές προορισμού, μεταφέροντας τα πακέτα ίδιου χρώματος στην ίδια γραμμή. Ο χρωματισμός αυτός μας εξασφαλίζει ότι σε καμία φάση της αναδιάταξης δεν θα βρεθούν 2 πακέτα σε σύγκρουση για την ίδια ακμή μεταφοράς.</span>';
        stepBody.appendChild(deepBox);

        const msList = document.createElement('ul');
        msList.className = 'microstep-list';
        stepBody.appendChild(msList);

        function appendStep(html, cls) {
            const li = document.createElement('li');
            li.className = 'done' + (cls ? ' ' + cls : '');
            li.innerHTML = html;
            msList.appendChild(li);
            if (typeof li.scrollIntoView === 'function') {
                try { li.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* no-op */ }
            }
            return li;
        }

        const buildEdgesLi = document.createElement('li');
        buildEdgesLi.innerHTML = isGrLang()
            ? ('Δημιουργούμε το γράφημα. Στην αριστερή πλευρά φτιάχνουμε &radic;N = ' + n + ' κόκκινους κόμβους που αντιπροσωπεύουν τη στήλη θέσης των πακέτων και στη δεξιά &radic;N = ' + n + ' μπλε κόμβους που αντιπροσωπεύουν τη στήλη προορισμού όλων των πακέτων.')
            : ('We build the graph. On the left we create &radic;N = ' + n + ' red nodes representing the packets\' source column, and on the right &radic;N = ' + n + ' blue nodes representing the destination column.');
        const buildEdgesBtn = document.createElement('button');
        buildEdgesBtn.className = 'btn-primary';
        buildEdgesBtn.style.marginTop = '8px';
        buildEdgesBtn.innerHTML = '<span lang="en">Create Edges</span><span lang="gr">Δημιουργία Ακμών</span>';
        buildEdgesLi.appendChild(document.createElement('br'));
        buildEdgesLi.appendChild(buildEdgesBtn);
        msList.appendChild(buildEdgesLi);

        const layout = document.createElement('div');
        layout.className = 'matching-layout';
        stepBody.appendChild(layout);

        const gridCol = document.createElement('div');
        gridCol.className = 'matching-grid-col';
        layout.appendChild(gridCol);

        const graphCol = document.createElement('div');
        graphCol.className = 'matching-graph-col';
        layout.appendChild(graphCol);

        const skipAllBtn = document.createElement('button');
        skipAllBtn.className = 'btn-pale';
        skipAllBtn.style.display = 'none';
        skipAllBtn.style.marginBottom = '10px';
        skipAllBtn.innerHTML = '<span lang="en">Skip all matchings</span><span lang="gr">Παράλειψη όλων των matchings</span>';
        stepBody.insertBefore(skipAllBtn, layout);
        skipAllBtn.addEventListener('click', skipAllRounds);

        const rearrangeSection = document.createElement('div');
        rearrangeSection.style.display = 'none';
        rearrangeSection.style.marginTop = '26px';
        rearrangeSection.style.borderTop = '1px dashed #cfd8e3';
        rearrangeSection.style.paddingTop = '18px';
        stepBody.appendChild(rearrangeSection);

        function drawGrid() {
            gridCol.innerHTML = '';
            const table = document.createElement('table');
            table.className = 'oa-table';
            const headerRow = document.createElement('tr');
            headerRow.appendChild(document.createElement('th'));
            for (let c = 1; c <= n; c++) {
                const th = document.createElement('th');
                th.textContent = c;
                th.style.cursor = 'pointer';
                th.addEventListener('mouseenter', function () { highlightColumn(c); });
                th.addEventListener('mouseleave', clearHighlight);
                headerRow.appendChild(th);
            }
            table.appendChild(headerRow);

            for (let r = 1; r <= n; r++) {
                const tr = document.createElement('tr');
                const rh = document.createElement('th'); rh.textContent = r; tr.appendChild(rh);
                for (let c = 1; c <= n; c++) {
                    const p = packets.find(function (pk) { return pk.sourceRow === r && pk.sourceCol === c; });
                    const td = document.createElement('td');
                    td.dataset.col = c;
                    td.dataset.packetId = p.id;
                    const badge = document.createElement('span');
                    badge.className = 'packet-badge';
                    badge.textContent = p.destRow + ',' + p.destCol;
                    const ec = p.edgeRef.color;
                    if (typeof ec === 'number') {
                        badge.classList.add('colored');
                        badge.style.borderColor = colors[ec - 1];
                        badge.style.color = colors[ec - 1];
                    } else if (ec === 'yellow-pending') {
                        badge.style.borderColor = '#e0b400';
                        badge.style.color = '#a07d00';
                        badge.style.borderWidth = '3px';
                        badge.style.fontWeight = '700';
                    }
                    td.appendChild(badge);

                    td.addEventListener('mouseenter', function (e) {
                        highlightSingleEdge(p.id);
                        const ec2 = p.edgeRef.color;
                        const colorLine = typeof ec2 === 'number'
                            ? colorLabel(ec2, colors)
                            : (ec2 === 'yellow-pending'
                                ? (isGrLang() ? '<span style="color:#a07d00;">κίτρινο (προσωρινό)</span>' : '<span style="color:#a07d00;">yellow (tentative)</span>')
                                : (isGrLang() ? '<span style="color:#999;">—</span>' : '<span style="color:#999;">—</span>'));
                        const msg = isGrLang()
                            ? ('Θέση [' + r + ',<span style="color:#c0392b;">' + c + '</span>]<br>' +
                               'Προορισμός [' + p.destRow + ',<span style="color:#2255c0;">' + p.destCol + '</span>]<br>' +
                               'Ακμή: K' + c + '-M' + p.destCol + '<br>' +
                               'Χρώμα: ' + colorLine)
                            : ('Position [' + r + ',<span style="color:#c0392b;">' + c + '</span>]<br>' +
                               'Destination [' + p.destRow + ',<span style="color:#2255c0;">' + p.destCol + '</span>]<br>' +
                               'Edge: K' + c + '-M' + p.destCol + '<br>' +
                               'Color: ' + colorLine);
                        showTooltip(e.clientX, e.clientY, msg);
                    });
                    td.addEventListener('mousemove', function (e) { showTooltip(e.clientX, e.clientY, oaTooltipEl.innerHTML); });
                    td.addEventListener('mouseleave', function () { clearHighlight(); hideTooltip(); });

                    tr.appendChild(td);
                }
                table.appendChild(tr);
            }
            gridCol.appendChild(table);
        }

        let svgEl = null;
        const ns = 'http://www.w3.org/2000/svg';
        let spacing, leftX, rightX, width, height;
        const pathLabelEls = {}; // K or M index -> text element for S/D annotation

        function edgePathD(K, M, curveOffset) {
            const y1 = 20 + (K - 1) * spacing + spacing / 2;
            const y2 = 20 + (M - 1) * spacing + spacing / 2;
            const midX = (leftX + rightX) / 2;
            const midY = (y1 + y2) / 2 + curveOffset;
            return 'M ' + leftX + ' ' + y1 + ' Q ' + midX + ' ' + midY + ' ' + rightX + ' ' + y2;
        }

        // curve offsets for parallel (same K->M) edges so they don't overlap visually
        (function computeCurveOffsets() {
            const pairGroups = {};
            packets.forEach(function (p) {
                const key = p.sourceCol + '-' + p.destCol;
                (pairGroups[key] = pairGroups[key] || []).push(p);
            });
            Object.values(pairGroups).forEach(function (group) {
                group.forEach(function (p, idx) { p.curveOffset = (idx - (group.length - 1) / 2) * 16; });
            });
        })();

        function drawGraph() {
            graphCol.innerHTML = '';
            spacing = Math.max(18, Math.min(32, 420 / n));
            height = n * spacing + 40;
            width = 280;
            leftX = 60; rightX = width - 60;

            svgEl = document.createElementNS(ns, 'svg');
            svgEl.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
            svgEl.classList.add('routing-graph-svg');

            if (state.edgesBuilt) {
                packets.forEach(function (p) {
                    const path = document.createElementNS(ns, 'path');
                    path.setAttribute('d', edgePathD(p.sourceCol, p.destCol, p.curveOffset));
                    path.setAttribute('fill', 'none');
                    path.classList.add('rg-edge');
                    path.style.cursor = 'pointer';
                    const ec = p.edgeRef.color;
                    if (typeof ec === 'number') {
                        path.style.stroke = colors[ec - 1];
                        path.style.strokeWidth = '2';
                    } else if (ec === 'yellow-pending') {
                        path.style.stroke = '#e0b400';
                        path.style.strokeWidth = '3.5';
                    } else {
                        path.classList.add('uncolored');
                    }
                    path.dataset.sourceCol = p.sourceCol;
                    path.dataset.destCol = p.destCol;
                    path.dataset.packetId = p.id;
                    path.dataset.color = typeof ec === 'number' ? ec : '';
                    path.addEventListener('mouseenter', function () { highlightSingleEdge(p.id); });
                    path.addEventListener('mouseleave', clearHighlight);
                    svgEl.appendChild(path);
                });
            }

            for (let c = 1; c <= n; c++) {
                const y = 20 + (c - 1) * spacing + spacing / 2;
                const circleL = document.createElementNS(ns, 'circle');
                circleL.setAttribute('cx', leftX); circleL.setAttribute('cy', y); circleL.setAttribute('r', 6);
                circleL.setAttribute('fill', '#c0392b'); circleL.classList.add('rg-node');
                circleL.style.cursor = 'pointer';
                circleL.addEventListener('mouseenter', function () { highlightColumn(c); });
                circleL.addEventListener('mouseleave', clearHighlight);
                svgEl.appendChild(circleL);

                const labelL = document.createElementNS(ns, 'text');
                labelL.setAttribute('x', leftX - 14); labelL.setAttribute('y', y + 4);
                labelL.setAttribute('text-anchor', 'end'); labelL.classList.add('rg-node-label');
                labelL.textContent = 'K' + c;
                svgEl.appendChild(labelL);

                const pathLabelL = document.createElementNS(ns, 'text');
                pathLabelL.setAttribute('x', leftX - 14); pathLabelL.setAttribute('y', y - 6);
                pathLabelL.setAttribute('text-anchor', 'end'); pathLabelL.classList.add('rg-path-label');
                svgEl.appendChild(pathLabelL);
                pathLabelEls['K' + c] = pathLabelL;

                const circleR = document.createElementNS(ns, 'circle');
                circleR.setAttribute('cx', rightX); circleR.setAttribute('cy', y); circleR.setAttribute('r', 6);
                circleR.setAttribute('fill', '#2255c0'); circleR.classList.add('rg-node');
                svgEl.appendChild(circleR);

                const labelR = document.createElementNS(ns, 'text');
                labelR.setAttribute('x', rightX + 14); labelR.setAttribute('y', y + 4);
                labelR.classList.add('rg-node-label');
                labelR.textContent = 'M' + c;
                svgEl.appendChild(labelR);

                const pathLabelR = document.createElementNS(ns, 'text');
                pathLabelR.setAttribute('x', rightX + 14); pathLabelR.setAttribute('y', y - 6);
                pathLabelR.classList.add('rg-path-label');
                svgEl.appendChild(pathLabelR);
                pathLabelEls['M' + c] = pathLabelR;
            }

            graphCol.appendChild(svgEl);

            const caption = document.createElement('div');
            caption.style.fontSize = '11.5px';
            caption.style.color = '#888';
            caption.style.marginTop = '4px';
            caption.style.textAlign = 'center';
            caption.innerHTML = isGrLang()
                ? '<span style="color:#c0392b">&#9679;</span> στήλη θέσης &nbsp;&nbsp; <span style="color:#2255c0">&#9679;</span> στήλη προορισμού'
                : '<span style="color:#c0392b">&#9679;</span> source column &nbsp;&nbsp; <span style="color:#2255c0">&#9679;</span> destination column';
            graphCol.appendChild(caption);
        }

        function clearPathLabels() {
            Object.values(pathLabelEls).forEach(function (el) { el.textContent = ''; });
        }
        function setPathLabel(nodeKey, label) {
            if (pathLabelEls[nodeKey]) pathLabelEls[nodeKey].textContent = label;
        }

        function highlightColumn(idx) {
            document.querySelectorAll('.oa-table td').forEach(function (td) { td.classList.toggle('col-hover', parseInt(td.dataset.col) === idx); });
            if (!svgEl) return;
            svgEl.querySelectorAll('.rg-edge').forEach(function (edge) {
                const match = parseInt(edge.dataset.sourceCol) === idx;
                edge.classList.toggle('highlighted', match);
                edge.classList.toggle('faded', !match);
            });
        }
        function highlightSingleEdge(packetId) {
            document.querySelectorAll('.oa-table td').forEach(function (td) { td.classList.toggle('col-hover', parseInt(td.dataset.packetId) === packetId); });
            if (!svgEl) return;
            svgEl.querySelectorAll('.rg-edge').forEach(function (edge) {
                const match = parseInt(edge.dataset.packetId) === packetId;
                edge.classList.toggle('highlighted', match);
                edge.classList.toggle('faded', !match);
            });
        }
        function clearHighlight() {
            document.querySelectorAll('.oa-table td').forEach(function (td) { td.classList.remove('col-hover'); });
            if (svgEl) svgEl.querySelectorAll('.rg-edge').forEach(function (edge) { edge.classList.remove('highlighted', 'faded'); });
        }

        drawGrid();
        drawGraph();

        function appendMatchColorButton(colorNum) {
            const nextLi = document.createElement('li');
            nextLi.innerHTML = isGrLang()
                ? ('Χρωματισμός με το ' + colorLabel(colorNum, colors) + '. Πάτησε το κουμπί για να ξεκινήσεις τη διαδικασία.')
                : ('Coloring with ' + colorLabel(colorNum, colors) + '. Press the button to start the process.');
            const matchBtn = document.createElement('button');
            matchBtn.className = 'btn-primary';
            matchBtn.style.marginTop = '8px';
            matchBtn.innerHTML = isGrLang()
                ? ('Ταίριασμα με ' + colorLabel(colorNum, colors))
                : ('Match with ' + colorLabel(colorNum, colors));
            nextLi.appendChild(document.createElement('br'));
            nextLi.appendChild(matchBtn);
            msList.appendChild(nextLi);
            matchBtn.addEventListener('click', function () {
                nextLi.classList.add('done');
                matchBtn.remove();
                startNextRound();
            });
            msList.scrollTop = msList.scrollHeight;
        }

        buildEdgesBtn.addEventListener('click', function () {
            state.edgesBuilt = true;
            skipAllBtn.style.display = 'inline-block';
            buildEdgesLi.classList.add('done');
            buildEdgesBtn.style.display = 'none';
            drawGraph();
            appendMatchColorButton(1);
        });

        /* ── Build the flat, click-by-click display chunk list for one K's search ── */
        function buildDisplayChunks(rawSteps, startK) {
            const chunks = [{ type: 'select-K', K: startK, isNewSearch: true }];
            rawSteps.forEach(function (ev) {
                if (ev.type === 'try-gray') {
                    chunks.push({ type: 'try-gray', edge: ev.edge });
                } else if (ev.type === 'found-free') {
                    chunks.push({ type: 'result-free', edge: ev.edge });
                } else if (ev.type === 'follow-existing') {
                    chunks.push({ type: 'result-follow', edge: ev.edge });
                    chunks.push({ type: 'select-K', K: ev.edge.K, isNewSearch: false });
                } else if (ev.type === 'backtrack') {
                    chunks.push({ type: 'backtrack', edge: ev.edge });
                }
            });
            return chunks;
        }

        function startNextRound() {
            if (state.round >= n) return;
            const color = state.round + 1;
            const matchOfM = new Array(n + 1).fill(null);
            let allChunks = [];
            const roundPaths = []; // per-K final path, captured for correct replay

            for (let K = 1; K <= n; K++) {
                const rawSteps = [];
                const path = [];
                extendMatchingTraced(K, edgesByK, matchOfM, new Set(), color, path, rawSteps);
                applyFlip(path, color, matchOfM);
                roundPaths.push(path);
                allChunks = allChunks.concat(buildDisplayChunks(rawSteps, K));
            }
            // reset all edges touched this round back to null; chunks will replay their color changes
            roundPaths.forEach(function (path) { path.forEach(function (e) { e.color = null; e.walked = false; }); });

            state.roundChunks = allChunks;
            state.chunkIdx = 0;
            state.roundColor = color;
            state.sLabelCounter = 0;
            state.dLabelCounter = 0;
            state._roundPathsLookup = roundPaths;
            clearPathLabels();

            renderNextChunkControls();
        }

        function findEdgeEl(edge) {
            return svgEl.querySelector('.rg-edge[data-packet-id="' + edge.packetId + '"]');
        }
        function refreshEdgeVisual(edge) {
            const el = findEdgeEl(edge);
            if (!el) return;
            if (typeof edge.color === 'number') {
                el.style.stroke = colors[edge.color - 1];
                el.style.strokeWidth = edge.walked ? '3.5' : '2';
                el.style.strokeDasharray = edge.walked ? '5,3' : '';
                el.dataset.color = edge.color;
            } else if (edge.color === 'yellow-pending') {
                el.style.stroke = '#e0b400';
                el.style.strokeWidth = '3.5';
                el.style.strokeDasharray = '';
                el.dataset.color = '';
            } else {
                el.style.stroke = '';
                el.style.strokeWidth = '';
                el.style.strokeDasharray = '';
                el.classList.add('uncolored');
                el.dataset.color = '';
            }
            const badge = gridCol.querySelector('td[data-packet-id="' + edge.packetId + '"] .packet-badge');
            if (badge) {
                if (typeof edge.color === 'number') {
                    badge.classList.add('colored');
                    badge.style.borderColor = colors[edge.color - 1];
                    badge.style.color = colors[edge.color - 1];
                    badge.style.borderStyle = edge.walked ? 'dashed' : 'solid';
                } else if (edge.color === 'yellow-pending') {
                    badge.style.borderColor = '#e0b400';
                    badge.style.color = '#a07d00';
                    badge.style.borderWidth = '3px';
                    badge.style.fontWeight = '700';
                } else {
                    badge.classList.remove('colored');
                    badge.style.borderColor = '';
                    badge.style.color = '';
                    badge.style.borderWidth = '';
                    badge.style.fontWeight = '';
                    badge.style.borderStyle = '';
                }
            }
        }

        function renderNextChunkControls() {
            const oldBtn = document.getElementById('nextChunkBtn');
            if (oldBtn) oldBtn.remove();
            const oldSkip = document.getElementById('skipChunkBtn');
            if (oldSkip) oldSkip.remove();

            const btn = document.createElement('button');
            btn.id = 'nextChunkBtn';
            btn.className = 'btn-primary';
            btn.style.marginTop = '10px';
            btn.style.marginRight = '8px';
            btn.innerHTML = '<span lang="en">Next Step</span><span lang="gr">Επόμενο Βήμα</span>';
            btn.addEventListener('click', advanceChunk);

            const skipBtn = document.createElement('button');
            skipBtn.id = 'skipChunkBtn';
            skipBtn.className = 'btn-pale';
            skipBtn.style.marginTop = '10px';
            skipBtn.style.marginLeft = '4px';
            skipBtn.innerHTML = '<span lang="en">Skip to end of this matching</span><span lang="gr">Παράλειψη έως το τέλος αυτού του matching</span>';
            skipBtn.addEventListener('click', function () {
                while (state.chunkIdx < state.roundChunks.length) advanceChunk();
                const target = document.getElementById('nextChunkBtn') || msList.lastElementChild;
                if (target && typeof target.scrollIntoView === 'function') {
                    try { target.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* no-op */ }
                }
            });

            msList.parentNode.insertBefore(btn, msList.nextSibling);
            btn.insertAdjacentElement('afterend', skipBtn);
        }

        function advanceChunk() {
            const chunks = state.roundChunks;
            if (state.chunkIdx >= chunks.length) return;
            const ev = chunks[state.chunkIdx];
            state.chunkIdx++;
            const color = state.roundColor;

            if (ev.type === 'select-K') {
                if (ev.isNewSearch) {
                    state.sLabelCounter = 0;
                    state.dLabelCounter = 0;
                    clearPathLabels();
                }
                const sLabel = 'S' + state.sLabelCounter;
                state.sLabelCounter++;
                setPathLabel('K' + ev.K, sLabel);
                appendStep(ev.isNewSearch
                    ? (isGrLang()
                        ? ('Βρίσκουμε έναν Κόκκινο κόμβο που δεν έχει ' + colorLabel(color, colors) + ' ακμή. Επιλέξαμε τον <strong>K' + ev.K + '</strong> κόμβο (' + sLabel + ')')
                        : ('We find a red node with no ' + colorLabel(color, colors) + ' edge. We selected node <strong>K' + ev.K + '</strong> (' + sLabel + ')'))
                    : (isGrLang()
                        ? ('Ο Κόκκινος κόμβος <strong>K' + ev.K + '</strong> (' + sLabel + ') πρέπει τώρα να βρει άλλη ακμή.')
                        : ('Red node <strong>K' + ev.K + '</strong> (' + sLabel + ') must now find a different edge.')));
            } else if (ev.type === 'try-gray') {
                ev.edge.color = 'yellow-pending';
                refreshEdgeVisual(ev.edge);
                const dLabel = 'D' + state.dLabelCounter;
                state.dLabelCounter++;
                setPathLabel('M' + ev.edge.M, dLabel);
                appendStep(isGrLang()
                    ? ('Διαλέγουμε μια ελεύθερη/γκρι ακμή του προς Μπλε κόμβο. Επιλέξαμε την ακμή που δείχνει τον <strong>M' + ev.edge.M + '</strong> κόμβο (' + dLabel + '), την οποία χρωματίζουμε προσωρινά κίτρινη.')
                    : ('We pick a free/gray edge towards a blue node. We selected the edge pointing to node <strong>M' + ev.edge.M + '</strong> (' + dLabel + '), which we temporarily color yellow.'));
            } else if (ev.type === 'result-free') {
                appendStep(isGrLang()
                    ? ('Ελέγχουμε αν ο <strong>M' + ev.edge.M + '</strong> Μπλε κόμβος έχει ακμή με ' + colorLabel(color, colors) + '. <strong>Δεν έχει!</strong> Επιτυχές μονοπάτι. Χρωματίζουμε όλες τις κίτρινες ακμές σε ' + colorLabel(color, colors) + ' και όλες τις διακεκομμένες σε γκρι.')
                    : ('We check whether node <strong>M' + ev.edge.M + '</strong> has a ' + colorLabel(color, colors) + ' edge. <strong>It does not!</strong> Successful path. We color all yellow edges ' + colorLabel(color, colors) + ' and all dashed edges gray.'), 'success');
                // commit this K's path colors now (already computed final values -- replay them)
                const path = findPathForEdge(ev.edge);
                if (path) {
                    path.forEach(function (e, i) {
                        e.walked = false;
                        e.color = (i % 2 === 0) ? color : null;
                        refreshEdgeVisual(e);
                    });
                }
                clearPathLabels();
            } else if (ev.type === 'result-follow') {
                ev.edge.walked = true;
                refreshEdgeVisual(ev.edge);
                appendStep(isGrLang()
                    ? ('Ελέγχουμε αν ο <strong>M' + ev.edge.M + '</strong> Μπλε κόμβος έχει ακμή με ' + colorLabel(color, colors) + '. <strong>Έχει!</strong> Την ακμή <strong>K' + ev.edge.K + '-M' + ev.edge.M + '</strong>. Την ακολουθούμε πίσω στον Κόκκινο <strong>K' + ev.edge.K + '</strong> κόμβο.')
                    : ('We check whether node <strong>M' + ev.edge.M + '</strong> has a ' + colorLabel(color, colors) + ' edge. <strong>It does!</strong> The edge <strong>K' + ev.edge.K + '-M' + ev.edge.M + '</strong>. We follow it back to red node <strong>K' + ev.edge.K + '</strong>.'), 'follow');
            } else if (ev.type === 'backtrack') {
                ev.edge.color = null;
                ev.edge.walked = false;
                refreshEdgeVisual(ev.edge);
                appendStep(isGrLang() ? 'Αδιέξοδο — επιστρέφουμε.' : 'Dead end — backtracking.');
            }

            if (state.chunkIdx >= chunks.length) {
                const btn = document.getElementById('nextChunkBtn');
                if (btn) btn.remove();
                const skipBtn = document.getElementById('skipChunkBtn');
                if (skipBtn) skipBtn.remove();
                finishRound();
            }
        }

        function findPathForEdge(edge) {
            // the path that this edge's found-free event concluded is simply
            // reconstructable by walking dashed('walked') edges + this edge itself
            // -- but we captured roundPaths already when computing; find the one containing this edge as its last element
            for (const p of state._roundPathsLookup) {
                if (p[p.length - 1] === edge) return p;
            }
            return null;
        }

        function finishRound() {
            state.round++;
            drawGrid();
            if (state.skippingAll) return; // caller drives the loop, no intermediate UI
            if (state.round >= n) {
                revealRearrangeStage();
            } else {
                appendMatchColorButton(state.round + 1);
            }
        }

        function skipAllRounds() {
            // if a round is already mid-search, finish it first
            if (state.roundChunks && state.chunkIdx < state.roundChunks.length) {
                state.skippingAll = true;
                while (state.chunkIdx < state.roundChunks.length) advanceChunk();
            }
            state.skippingAll = true;
            while (state.round < n) {
                startNextRound();
                while (state.chunkIdx < state.roundChunks.length) advanceChunk();
            }
            state.skippingAll = false;
            // remove any leftover "match with color k" button/li left in the DOM
            Array.from(msList.querySelectorAll('button.btn-primary')).forEach(function (btn) {
                if (/Ταίριασμα|Match with/.test(btn.textContent)) {
                    btn.parentElement.remove();
                }
            });
            const oldNext = document.getElementById('nextChunkBtn');
            if (oldNext) oldNext.remove();
            const oldSkip = document.getElementById('skipChunkBtn');
            if (oldSkip) oldSkip.remove();
            revealRearrangeStage();
        }

        function revealRearrangeStage() {
            skipAllBtn.style.display = 'none';

            packets.forEach(function (p) { p.color = p.edgeRef.color; });

            const li = document.createElement('li');
            li.className = 'done';
            li.innerHTML = isGrLang()
                ? 'Τώρα αναδιατάσουμε ανά στήλη τα πακέτα ανάλογα με το χρώμα τους, ώστε κάθε γραμμή να έχει από ένα χρώμα.'
                : 'We now rearrange within each column according to color, so that every row ends up with one color.';
            const execBtn = document.createElement('button');
            execBtn.className = 'btn-primary';
            execBtn.style.marginTop = '8px';
            execBtn.innerHTML = '<span lang="en">Rearrange by color</span><span lang="gr">Αναδιάταξη με βάση τα χρώματα</span>';
            li.appendChild(document.createElement('br'));
            li.appendChild(execBtn);
            msList.appendChild(li);
            msList.scrollTop = msList.scrollHeight;

            const rearrangeLayout = document.createElement('div');
            rearrangeLayout.className = 'matching-layout';
            rearrangeLayout.style.marginTop = '14px';
            stepBody.appendChild(rearrangeLayout);

            const beforeCol = document.createElement('div');
            const beforeLabel = document.createElement('div');
            beforeLabel.style.fontWeight = '600';
            beforeLabel.style.fontSize = '12.5px';
            beforeLabel.style.color = '#1a2a4a';
            beforeLabel.style.marginBottom = '6px';
            beforeLabel.innerHTML = isGrLang() ? 'Πριν' : 'Before';
            beforeCol.appendChild(beforeLabel);
            const beforeGridDiv = document.createElement('div');
            beforeCol.appendChild(beforeGridDiv);
            rearrangeLayout.appendChild(beforeCol);

            const afterCol = document.createElement('div');
            const afterLabel = document.createElement('div');
            afterLabel.style.fontWeight = '600';
            afterLabel.style.fontSize = '12.5px';
            afterLabel.style.color = '#1e7a3f';
            afterLabel.style.marginBottom = '6px';
            afterLabel.innerHTML = isGrLang() ? 'Μετά' : 'After';
            afterCol.appendChild(afterLabel);
            const afterGridDiv = document.createElement('div');
            afterCol.appendChild(afterGridDiv);
            rearrangeLayout.appendChild(afterCol);
            afterCol.style.display = 'none';

            const beforePositions = {};
            packets.forEach(function (p) { beforePositions[p.sourceRow + ',' + p.sourceCol] = [p]; });
            drawSimpleGrid(beforeGridDiv, beforePositions, colors, n, null);

            const stepCounterHolder = document.createElement('div');
            stepCounterHolder.className = 'substep-progress';
            stepCounterHolder.style.marginTop = '10px';
            stepBody.appendChild(stepCounterHolder);

            const continueWrap = document.createElement('div');
            continueWrap.style.marginTop = '20px';
            continueWrap.style.textAlign = 'right';
            const continueBtn = document.createElement('button');
            continueBtn.className = 'btn-primary';
            continueBtn.disabled = true;
            continueBtn.innerHTML = '<span lang="en">Continue to Phase 2 &rarr;</span><span lang="gr">Συνέχεια στη Φάση 2 &rarr;</span>';
            continueWrap.appendChild(continueBtn);
            stepBody.appendChild(continueWrap);

            execBtn.addEventListener('click', function () {
                execBtn.disabled = true;
                graphCol.style.display = 'none';
                gridCol.style.display = 'none';
                layout.style.display = 'none';
                afterCol.style.display = 'block';
                const items = packets.map(function (p) { return { id: p.id, cur: p.sourceRow - 1, dest: p.color - 1, meta: p }; });
                const byColumn = {};
                items.forEach(function (it) {
                    const col = it.meta.sourceCol;
                    (byColumn[col] = byColumn[col] || []).push(it);
                });
                const perColumnResult = {};
                let maxSteps = 0;
                Object.keys(byColumn).forEach(function (col) {
                    const res = simulateGreedyLine(byColumn[col]);
                    perColumnResult[col] = res;
                    maxSteps = Math.max(maxSteps, res.steps);
                });
                state.afterP1Steps = maxSteps;

                let currentStep = 0;
                function renderStepGrid(stepIdx) {
                    const positions = {};
                    Object.keys(byColumn).forEach(function (col) {
                        const res = perColumnResult[col];
                        const snap = res.snapshots[Math.min(stepIdx, res.snapshots.length - 1)];
                        snap.forEach(function (list, rowIdx) {
                            const key = (rowIdx + 1) + ',' + col;
                            positions[key] = (positions[key] || []).concat(list.map(function (p) { return p.meta; }));
                        });
                    });
                    return positions;
                }

                function rearrangeDirection(p, r, c) {
                    if (p.color === r) return null;
                    return p.color > r ? { arrow: '\u2193' } : { arrow: '\u2191' };
                }

                drawSimpleGrid(afterGridDiv, renderStepGrid(0), colors, n, { getDirection: rearrangeDirection });

                const nextStepBtn = document.createElement('button');
                nextStepBtn.className = 'btn-secondary';
                nextStepBtn.style.marginTop = '10px';
                nextStepBtn.innerHTML = '<span lang="en">Next step</span><span lang="gr">Επόμενο βήμα</span>';
                afterCol.appendChild(nextStepBtn);

                function updateCounter() {
                    stepCounterHolder.textContent = (isGrLang() ? 'Βήματα = ' : 'Steps = ') + currentStep;
                }
                updateCounter();

                nextStepBtn.addEventListener('click', function () {
                    currentStep++;
                    drawSimpleGrid(afterGridDiv, renderStepGrid(currentStep), colors, n, { getDirection: rearrangeDirection });
                    afterCol.appendChild(nextStepBtn);
                    updateCounter();
                    if (currentStep >= maxSteps) {
                        nextStepBtn.remove();
                        state.afterP1 = renderStepGrid(currentStep);
                        continueBtn.disabled = false;
                        markSubTabDone(0);
                        unlockSubTab(1);
                    }
                });
            });

            continueBtn.addEventListener('click', function () { renderPhase2(); });
        }
    }

    /* ════════════════════════ PHASE 2 : Row routing ════════════════════════ */
    function renderPhase2() {
        activateSubTab(1);
        stepBody.innerHTML = '';

        const explain = document.createElement('div');
        explain.className = 'substep-explain';
        explain.innerHTML =
            '<span lang="en"><strong>Goal of Phase 2:</strong> each packet will move within its row to reach its Destination column. Phase 1 guarantees that no packet in the same row shares a Destination column with any other, which in turn guarantees that no packet will ever be in conflict with another over the same edge, ensuring the absence of queues. Packets move "greedily", and the rearrangement is completed after at most &radic;N - 1 = ' + (n - 1) + ' steps.</span>' +
            '<span lang="gr"><strong>Στόχος της Φάσης 2:</strong> Κάθε πακέτο θα μετακινηθεί μέσα στη γραμμή του για να φτάσει στην στήλη Προορισμού του. Η Φάση 1 μας εξασφαλίζει ότι κανένα πακέτο της ίδιας γραμμής δεν θα χει κοινή στήλη Προορισμού με κάποιο άλλο, κατ\' επέκταση μας εξασφαλίζει ότι κανένα πακέτο δεν θα βρεθεί σε κατάσταση σύγκρουσης με άλλο για την ίδια ακμή, εξασφαλίζοντας την έλλειψη ουρών. Τα πακέτα κινούνται "άπληστα" και η μετάθεση ολοκληρώνεται μετά από max &radic;N - 1 = ' + (n - 1) + ' βήματα.</span>';
        stepBody.appendChild(explain);

        const gridHolder = document.createElement('div');
        stepBody.appendChild(gridHolder);

        const stepCounterHolder = document.createElement('div');
        stepCounterHolder.className = 'substep-progress';
        stepBody.appendChild(stepCounterHolder);

        const continueWrap = document.createElement('div');
        continueWrap.style.marginTop = '20px';
        continueWrap.style.textAlign = 'right';
        const backBtn = document.createElement('button');
        backBtn.className = 'btn-secondary';
        backBtn.style.marginRight = '10px';
        backBtn.innerHTML = '<span lang="en">&larr; Back</span><span lang="gr">&larr; Πίσω</span>';
        const continueBtn = document.createElement('button');
        continueBtn.className = 'btn-primary';
        continueBtn.disabled = true;
        continueBtn.innerHTML = '<span lang="en">Continue to Phase 3 &rarr;</span><span lang="gr">Συνέχεια στη Φάση 3 &rarr;</span>';
        continueWrap.appendChild(backBtn);
        continueWrap.appendChild(continueBtn);
        stepBody.appendChild(continueWrap);

        function hoverExtra(p, r, c) {
            const dirText = p.destCol > c
                ? (isGrLang() ? 'Μετακινείται δεξιά' : 'Moves right')
                : p.destCol < c
                    ? (isGrLang() ? 'Μετακινείται αριστερά' : 'Moves left')
                    : (isGrLang() ? 'Έφτασε στη σωστή στήλη' : 'Reached correct column');
            return isGrLang()
                ? ('Πακέτο (' + r + ',' + c + ') &mdash; ' + colorLabel(p.color, colors) + '.<br>Στόχος: στήλη <strong>' + p.destCol + '</strong>.<br>' + dirText + '.')
                : ('Packet (' + r + ',' + c + ') &mdash; ' + colorLabel(p.color, colors) + '.<br>Target: column <strong>' + p.destCol + '</strong>.<br>' + dirText + '.');
        }
        function direction(p, r, c) {
            if (p.destCol === c) return null;
            return p.destCol > c ? { arrow: '\u2192' } : { arrow: '\u2190' };
        }

        const items = packets.map(function (p) { return { id: p.id, cur: p.sourceCol - 1, dest: p.destCol - 1, meta: p }; });
        const byRow = {};
        items.forEach(function (it) { (byRow[it.meta.color] = byRow[it.meta.color] || []).push(it); });
        const perRowResult = {};
        let maxSteps = 0;
        Object.keys(byRow).forEach(function (row) {
            const res = simulateGreedyLine(byRow[row]);
            perRowResult[row] = res;
            maxSteps = Math.max(maxSteps, res.steps);
        });

        function positionsAtStep(stepIdx) {
            const positions = {};
            Object.keys(byRow).forEach(function (row) {
                const res = perRowResult[row];
                const snap = res.snapshots[Math.min(stepIdx, res.snapshots.length - 1)];
                snap.forEach(function (list, colIdx) {
                    const key = row + ',' + (colIdx + 1);
                    positions[key] = (positions[key] || []).concat(list.map(function (p) { return p.meta; }));
                });
            });
            return positions;
        }

        let currentStep = 0;
        drawSimpleGrid(gridHolder, positionsAtStep(0), colors, n, { onHover: hoverExtra, getDirection: direction });

        const stepBtnRow = document.createElement('div');
        stepBtnRow.style.display = 'flex';
        stepBtnRow.style.gap = '8px';
        stepBtnRow.style.marginTop = '10px';
        const prevStepBtn = document.createElement('button');
        prevStepBtn.className = 'btn-secondary';
        prevStepBtn.disabled = true;
        prevStepBtn.innerHTML = '<span lang="en">&larr; Previous step</span><span lang="gr">&larr; Προηγούμενο βήμα</span>';
        const nextStepBtn = document.createElement('button');
        nextStepBtn.className = 'btn-secondary';
        nextStepBtn.innerHTML = '<span lang="en">Next step</span><span lang="gr">Επόμενο βήμα</span>';
        stepBtnRow.appendChild(prevStepBtn);
        stepBtnRow.appendChild(nextStepBtn);
        gridHolder.appendChild(stepBtnRow);

        function updateCounter() { stepCounterHolder.textContent = (isGrLang() ? 'Βήματα = ' : 'Steps = ') + currentStep; }
        function refreshStepButtons() {
            prevStepBtn.disabled = currentStep <= 0;
            nextStepBtn.disabled = currentStep >= maxSteps;
        }
        updateCounter();
        refreshStepButtons();

        function goToStep(target) {
            currentStep = Math.max(0, Math.min(maxSteps, target));
            drawSimpleGrid(gridHolder, positionsAtStep(currentStep), colors, n, { onHover: hoverExtra, getDirection: direction });
            gridHolder.appendChild(stepBtnRow);
            updateCounter();
            refreshStepButtons();
            if (currentStep >= maxSteps) {
                state.afterP2 = positionsAtStep(currentStep);
                state.afterP2Steps = maxSteps;
                continueBtn.disabled = false;
                markSubTabDone(1);
                unlockSubTab(2);
            }
        }

        nextStepBtn.addEventListener('click', function () { goToStep(currentStep + 1); });
        prevStepBtn.addEventListener('click', function () { goToStep(currentStep - 1); });

        backBtn.addEventListener('click', function () { renderPhase1(); });
        continueBtn.addEventListener('click', function () { renderPhase3(); });
    }

    /* ════════════════════════ PHASE 3 : Column routing (final) ════════════════════════ */
    function renderPhase3() {
        activateSubTab(2);
        stepBody.innerHTML = '';

        const explain = document.createElement('div');
        explain.className = 'substep-explain';
        explain.innerHTML =
            '<span lang="en"><strong>Goal of Phase 3:</strong> each packet will move within its column to reach its Destination row (final destination). Phase 2 guarantees that no packet in the same column shares a Destination row with any other, which in turn guarantees that no packet will ever be in conflict with another over the same edge, ensuring the absence of queues. Packets move "greedily", and the rearrangement is completed after at most &radic;N - 1 = ' + (n - 1) + ' steps.</span>' +
            '<span lang="gr"><strong>Στόχος της Φάσης 3:</strong> Κάθε πακέτο θα μετακινηθεί μέσα στη στήλη του για να φτάσει στη γραμμή Προορισμού του (τελικός προορισμός). Η Φάση 2 μας εξασφαλίζει ότι κανένα πακέτο της ίδιας στήλης δεν θα χει κοινή γραμμή Προορισμού με κάποιο άλλο, κατ\' επέκταση μας εξασφαλίζει ότι κανένα πακέτο δεν θα βρεθεί σε κατάσταση σύγκρουσης με άλλο για την ίδια ακμή, εξασφαλίζοντας την έλλειψη ουρών. Τα πακέτα κινούνται "άπληστα" και η μετάθεση ολοκληρώνεται μετά από max &radic;N - 1 = ' + (n - 1) + ' βήματα.</span>';
        stepBody.appendChild(explain);

        const p3Layout = document.createElement('div');
        p3Layout.className = 'matching-layout';
        stepBody.appendChild(p3Layout);

        const gridHolder = document.createElement('div');
        p3Layout.appendChild(gridHolder);

        const originalGridCol = document.createElement('div');
        originalGridCol.style.display = 'none';
        const originalGridLabel = document.createElement('div');
        originalGridLabel.style.fontWeight = '600';
        originalGridLabel.style.fontSize = '12.5px';
        originalGridLabel.style.color = '#1a2a4a';
        originalGridLabel.style.marginBottom = '6px';
        originalGridLabel.innerHTML = isGrLang() ? 'Αρχικό Πλέγμα' : 'Original Grid';
        originalGridCol.appendChild(originalGridLabel);
        const originalGridDiv = document.createElement('div');
        originalGridCol.appendChild(originalGridDiv);
        p3Layout.appendChild(originalGridCol);

        const stepCounterHolder = document.createElement('div');
        stepCounterHolder.className = 'substep-progress';
        stepBody.appendChild(stepCounterHolder);

        const resultHolder = document.createElement('div');
        stepBody.appendChild(resultHolder);

        const backWrap = document.createElement('div');
        backWrap.style.marginTop = '20px';
        const backBtn = document.createElement('button');
        backBtn.className = 'btn-secondary';
        backBtn.innerHTML = '<span lang="en">&larr; Back</span><span lang="gr">&larr; Πίσω</span>';
        backWrap.appendChild(backBtn);
        stepBody.appendChild(backWrap);

        function hoverExtra(p, r, c) {
            const dirText = p.destRow > r
                ? (isGrLang() ? 'Μετακινείται κάτω' : 'Moves down')
                : p.destRow < r
                    ? (isGrLang() ? 'Μετακινείται πάνω' : 'Moves up')
                    : (isGrLang() ? 'Έφτασε στον τελικό προορισμό' : 'Reached final destination');
            return isGrLang()
                ? ('Πακέτο στη θέση (' + r + ',' + c + ').<br>Τελικός προορισμός: γραμμή <strong>' + p.destRow + '</strong>.<br>' + dirText + '.')
                : ('Packet at (' + r + ',' + c + ').<br>Final destination: row <strong>' + p.destRow + '</strong>.<br>' + dirText + '.');
        }
        function direction(p, r, c) {
            if (p.destRow === r) return null;
            return p.destRow > r ? { arrow: '\u2193' } : { arrow: '\u2191' };
        }

        // build packetId -> {row, col} lookup from state.afterP2 (array-based positions)
        const packetLocation = {};
        Object.keys(state.afterP2).forEach(function (key) {
            const parts = key.split(',');
            const row = parseInt(parts[0]), col = parseInt(parts[1]);
            state.afterP2[key].forEach(function (p) { packetLocation[p.id] = { row: row, col: col }; });
        });

        const items = packets.map(function (p) {
            const loc = packetLocation[p.id];
            return { id: p.id, cur: loc.row - 1, dest: p.destRow - 1, meta: p, col: loc.col };
        });
        const byCol = {};
        items.forEach(function (it) { (byCol[it.col] = byCol[it.col] || []).push(it); });
        const perColResult = {};
        let maxSteps = 0;
        Object.keys(byCol).forEach(function (col) {
            const res = simulateGreedyLine(byCol[col]);
            perColResult[col] = res;
            maxSteps = Math.max(maxSteps, res.steps);
        });

        function positionsAtStep(stepIdx) {
            const positions = {};
            Object.keys(byCol).forEach(function (col) {
                const res = perColResult[col];
                const snap = res.snapshots[Math.min(stepIdx, res.snapshots.length - 1)];
                snap.forEach(function (list, rowIdx) {
                    const key = (rowIdx + 1) + ',' + col;
                    positions[key] = (positions[key] || []).concat(list.map(function (p) { return p.meta; }));
                });
            });
            return positions;
        }

        let currentStep = 0;
        drawSimpleGrid(gridHolder, positionsAtStep(0), colors, n, { onHover: hoverExtra, getDirection: direction });

        const stepBtnRow = document.createElement('div');
        stepBtnRow.style.display = 'flex';
        stepBtnRow.style.gap = '8px';
        stepBtnRow.style.marginTop = '10px';
        const prevStepBtn = document.createElement('button');
        prevStepBtn.className = 'btn-secondary';
        prevStepBtn.disabled = true;
        prevStepBtn.innerHTML = '<span lang="en">&larr; Previous step</span><span lang="gr">&larr; Προηγούμενο βήμα</span>';
        const nextStepBtn = document.createElement('button');
        nextStepBtn.className = 'btn-secondary';
        nextStepBtn.innerHTML = '<span lang="en">Next step</span><span lang="gr">Επόμενο βήμα</span>';
        stepBtnRow.appendChild(prevStepBtn);
        stepBtnRow.appendChild(nextStepBtn);
        gridHolder.appendChild(stepBtnRow);

        function updateCounter() { stepCounterHolder.textContent = (isGrLang() ? 'Βήματα = ' : 'Steps = ') + currentStep; }
        function refreshStepButtons() {
            prevStepBtn.disabled = currentStep <= 0;
            nextStepBtn.disabled = currentStep >= maxSteps;
        }
        updateCounter();
        refreshStepButtons();

        let bannerShown = false;
        function goToStep(target) {
            currentStep = Math.max(0, Math.min(maxSteps, target));
            drawSimpleGrid(gridHolder, positionsAtStep(currentStep), colors, n, { onHover: hoverExtra, getDirection: direction });
            gridHolder.appendChild(stepBtnRow);
            updateCounter();
            refreshStepButtons();
            if (currentStep >= maxSteps && !bannerShown) {
                bannerShown = true;
                markSubTabDone(2);

                const originalPositions = {};
                packets.forEach(function (p) { originalPositions[p.sourceRow + ',' + p.sourceCol] = [p]; });
                drawSimpleGrid(originalGridDiv, originalPositions, colors, n, null);
                originalGridCol.style.display = 'block';

                const p1 = state.afterP1Steps || 0;
                const p2 = state.afterP2Steps || 0;
                const p3 = maxSteps;
                const totalSteps = p1 + p2 + p3;
                const theoretical = 3 * (n - 1);
                resultHolder.innerHTML =
                    '<div class="result-banner">' +
                    '<div class="result-stat" style="flex-basis:100%;"><div class="label" style="font-size:14px; font-weight:700; color:#1e7a3f;"><span lang="en">The algorithm stops here, our grid has been routed.</span><span lang="gr">Ο αλγόριθμος σταματά, το πλέγμα μας δρομολογήθηκε.</span></div></div>' +
                    '<div class="result-stat"><div class="num">' + theoretical + '</div><div class="label"><span lang="en">Theoretical Max Step Bound = 3&middot;&radic;N &minus; 3</span><span lang="gr">Θεωρητικό Μέγιστο Όριο Βημάτων = 3 &middot; &radic;N &minus; 3</span></div></div>' +
                    '<div class="result-stat"><div class="num">' + totalSteps + '</div><div class="label"><span lang="en">Actual Number of Steps (Phase 1 = ' + p1 + ', Phase 2 = ' + p2 + ', Phase 3 = ' + p3 + ')</span><span lang="gr">Πραγματικός Αριθμός Βημάτων (Φάση 1 = ' + p1 + ', Φάση 2 = ' + p2 + ', Φάση 3 = ' + p3 + ')</span></div></div>' +
                    '</div>';
            }
        }

        nextStepBtn.addEventListener('click', function () { goToStep(currentStep + 1); });
        prevStepBtn.addEventListener('click', function () { goToStep(currentStep - 1); });

        backBtn.addEventListener('click', function () { renderPhase2(); });
    }
}


/* ════════════════════════════════════════════════════════════════
   Shared simple-grid renderer (used for Phase 1c rearrange, Phase 2, Phase 3)
   options: { getDirection: function(p,r,c) -> {arrow, text} | null,
              onHoverExtra: function(p,r,c) -> string | null }
   ════════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════════
   Shared simple-grid renderer (used for Phase 1c rearrange, Phase 2, Phase 3)
   positions: map "r,c" -> ARRAY of packet objects currently at that cell
              (an array, always -- even for a single packet -- so stacking
              during transient greedy-routing states renders correctly).
   options: { getDirection: function(p,r,c) -> {arrow} | null,
              onHover: function(p,r,c) -> html string | null }
   ════════════════════════════════════════════════════════════════ */
function drawSimpleGrid(container, positions, colors, n, options) {
    options = options || {};
    container.innerHTML = '';
    const table = document.createElement('table');
    table.className = 'oa-table';
    const headerRow = document.createElement('tr');
    headerRow.appendChild(document.createElement('th'));
    for (let c = 1; c <= n; c++) { const th = document.createElement('th'); th.textContent = c; headerRow.appendChild(th); }
    table.appendChild(headerRow);

    for (let r = 1; r <= n; r++) {
        const tr = document.createElement('tr');
        const rh = document.createElement('th'); rh.textContent = r; tr.appendChild(rh);
        for (let c = 1; c <= n; c++) {
            const td = document.createElement('td');
            td.dataset.row = r; td.dataset.col = c;
            const list = positions[r + ',' + c] || [];

            list.forEach(function (p) {
                const badgeLine = document.createElement('div');
                badgeLine.style.marginBottom = '2px';
                const badge = document.createElement('span');
                badge.className = 'packet-badge colored';
                badge.textContent = p.destRow + ',' + p.destCol;
                badge.style.borderColor = colors[p.color - 1];
                badge.style.color = colors[p.color - 1];
                if (options.getDirection) {
                    const dir = options.getDirection(p, r, c);
                    if (dir) {
                        const arrow = document.createElement('span');
                        arrow.className = 'move-arrow';
                        arrow.textContent = dir.arrow;
                        badge.appendChild(arrow);
                    }
                }
                badgeLine.appendChild(badge);
                td.appendChild(badgeLine);
            });

            if (options.onHover) {
                td.addEventListener('mouseenter', function (e) {
                    if (list.length === 0) return;
                    const p = list[0];
                    let extra = options.onHover(p, r, c);
                    if (list.length > 1) {
                        extra += isGrLang()
                            ? ('<br><em>+' + (list.length - 1) + ' ακόμα πακέτο(α) σε αυτό το κελί</em>')
                            : ('<br><em>+' + (list.length - 1) + ' more packet(s) at this cell</em>');
                    }
                    if (extra) showTooltip(e.clientX, e.clientY, extra);
                });
                td.addEventListener('mousemove', function (e) { if (oaTooltipEl && oaTooltipEl.style.display === 'block') showTooltip(e.clientX, e.clientY, oaTooltipEl.innerHTML); });
                td.addEventListener('mouseleave', function () {
                    document.querySelectorAll('.oa-table td').forEach(function (x) { x.classList.remove('col-hover', 'target-hover'); });
                    hideTooltip();
                });
            }

            tr.appendChild(td);
        }
        table.appendChild(tr);
    }
    container.appendChild(table);
}