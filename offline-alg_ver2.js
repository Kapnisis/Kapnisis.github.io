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

/* Hall alternating path */
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

/* Shared coloring machinery */
function oaBuildDisplayChunks(rawSteps, startK) {
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

function oaComputeColoringOverlay(masterSteps, uptoIdx) {
    const overlay = {};
    let sCounter = 0, dCounter = 0, labels = {}, currentLabel = '';
    for (let i = 0; i <= uptoIdx; i++) {
        const ev = masterSteps[i];
        if (!ev) continue;
        if (ev.type === 'select-K') {
            if (ev.isNewSearch) { sCounter = 0; dCounter = 0; labels = {}; }
            const sLabel = 'S' + sCounter; sCounter++;
            labels['K' + ev.K] = sLabel;
            if (i === uptoIdx) currentLabel = sLabel;
        } else if (ev.type === 'try-gray') {
            overlay[ev.edge.packetId] = 'yellow-pending';
            const dLabel = 'D' + dCounter; dCounter++;
            labels['M' + ev.edge.M] = dLabel;
            if (i === uptoIdx) currentLabel = dLabel;
        } else if (ev.type === 'result-free') {
            if (ev.path) ev.path.forEach(function (e, idx2) { overlay[e.packetId] = (idx2 % 2 === 0) ? ev.color : null; });
            labels = {};
        } else if (ev.type === 'backtrack') {
            overlay[ev.edge.packetId] = null;
        }
    }
    return { overlay: overlay, labels: labels, currentLabel: currentLabel };
}

function oaColorRegularBipartiteTraced(edgeList, m) {
    const edgesByK = Array.from({ length: m + 1 }, function () { return []; });
    const adapters = edgeList.map(function (e, i) {
        const a = { K: e.left + 1, M: e.right + 1, packetId: i, color: null, ref: e };
        edgesByK[a.K].push(a);
        return a;
    });

    const masterSteps = [{ type: 'init-nodes' }, { type: 'init-edges' }];
    const roundRanges = [];
    for (let color = 1; color <= m; color++) {
        const matchOfM = new Array(m + 1).fill(null);
        const roundStart = masterSteps.length;
        for (let K = 1; K <= m; K++) {
            const visitedM = new Set();
            const path = [];
            const steps = [];
            const result = extendMatchingTraced(K, edgesByK, matchOfM, visitedM, color, path, steps);
            const chunks = oaBuildDisplayChunks(steps, K);
            chunks.forEach(function (c) { c.color = color; });
            if (result) {
                chunks.forEach(function (c) { if (c.type === 'result-free') c.path = result; });
                applyFlip(result, color, matchOfM);
            }
            masterSteps.push.apply(masterSteps, chunks);
        }
        roundRanges.push({ color: color, start: roundStart, end: masterSteps.length - 1 });
    }
    masterSteps.push({ type: 'final' });
    adapters.forEach(function (a) { a.ref.hallColor = a.color; });
    return { masterSteps: masterSteps, roundRanges: roundRanges, adapters: adapters };
}

function oaDescribeColoringStep(ev, label, ctx) {
    if (!ev) return '';
    const colors = ctx.colors;
    const color = ev.color;
    const kName = ctx.kName || function (K) { return 'K' + K; };
    const mName = ctx.mName || function (M) { return 'M' + M; };
    switch (ev.type) {
        case 'init-nodes':
            return ctx.initNodes;
        case 'init-edges':
            return ctx.initEdges;
        case 'final':
            return ctx.final;
        case 'select-K':
            return ev.isNewSearch
                ? (isGrLang()
                    ? ('Βρίσκουμε έναν κόκκινο κόμβο που δεν έχει ' + colorLabel(color, colors) + ' ακμή. Επιλέξαμε τον <strong>' + kName(ev.K) + '</strong> κόμβο (' + label + ')')
                    : ('We find a red node with no ' + colorLabel(color, colors) + ' edge. We selected node <strong>' + kName(ev.K) + '</strong> (' + label + ')'))
                : (isGrLang()
                    ? ('Ο κόκκινος κόμβος <strong>' + kName(ev.K) + '</strong> (' + label + ') πρέπει τώρα να βρει άλλη ακμή.')
                    : ('Red node <strong>' + kName(ev.K) + '</strong> (' + label + ') must now find a different edge.'));
        case 'try-gray':
            return isGrLang()
                ? ('Διαλέγουμε μια ελεύθερη/γκρι ακμή του προς μπλε κόμβο. Επιλέξαμε την ακμή που δείχνει τον <strong>' + mName(ev.edge.M) + '</strong> κόμβο (' + label + '), την οποία χρωματίζουμε προσωρινά κίτρινη.')
                : ('We pick a free/gray edge towards a blue node. We selected the edge pointing to node <strong>' + mName(ev.edge.M) + '</strong> (' + label + '), which we temporarily color yellow.');
        case 'result-free':
            return isGrLang()
                ? ('Ελέγχουμε αν ο <strong>' + mName(ev.edge.M) + '</strong> μπλε κόμβος έχει ακμή με ' + colorLabel(color, colors) + '. <strong>Δεν έχει!</strong> Επιτυχές μονοπάτι. Χρωματίζουμε όλες τις κίτρινες ακμές σε ' + colorLabel(color, colors) + ' και όλες τις διακεκομμένες σε γκρι.')
                : ('We check whether node <strong>' + mName(ev.edge.M) + '</strong> has a ' + colorLabel(color, colors) + ' edge. <strong>It does not!</strong> Successful path. We color all yellow edges ' + colorLabel(color, colors) + ' and all dashed edges gray.');
        case 'result-follow':
            return isGrLang()
                ? ('Ελέγχουμε αν ο <strong>' + mName(ev.edge.M) + '</strong> μπλε κόμβος έχει ακμή με ' + colorLabel(color, colors) + '. <strong>Έχει!</strong> Την ακμή <strong>' + kName(ev.edge.K) + '-' + mName(ev.edge.M) + '</strong>. Την ακολουθούμε πίσω στον κόκκινο <strong>' + kName(ev.edge.K) + '</strong> κόμβο.')
                : ('We check whether node <strong>' + mName(ev.edge.M) + '</strong> has a ' + colorLabel(color, colors) + ' edge. <strong>It does!</strong> The edge <strong>' + kName(ev.edge.K) + '-' + mName(ev.edge.M) + '</strong>. We follow it back to red node <strong>' + kName(ev.edge.K) + '</strong>.');
        case 'backtrack':
            return isGrLang() ? 'Αδιέξοδο — επιστρέφουμε.' : 'Dead end — backtracking.';
    }
    return '';
}

/* Greedy line routing */
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

/* Cards */
function buildBasicAlgorithmCards() {
    const n = parseInt(document.getElementById('sideN').value);
    if (isNaN(n) || n < 2) {
        alert(isGrLang() ? 'Παρακαλώ εισάγετε έγκυρο μέγεθος πλέγματος.' : 'Please enter a valid mesh size.');
        return null;
    }

    const packets = [];
    let idCounter = 0;
    for (let r = 1; r <= n; r++) {
        for (let c = 1; c <= n; c++) {
            const input = document.querySelector('#tableContainer input[data-row="' + (r - 1) + '"][data-col="' + (c - 1) + '"]');
            const v = input.value.trim();
            if (v === '') { alert('Cell (' + r + ',' + c + ') is empty. Please fill all cells.'); return null; }
            const parts = v.split(',').map(Number);
            packets.push({ id: idCounter++, sourceRow: r, sourceCol: c, destRow: parts[0], destCol: parts[1], color: null });
        }
    }

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
        afterP1: null, afterP1Steps: 0,
        afterP2: null, afterP2Steps: 0,
        edgesBuilt: false
    };

    function colorWordFor(lang, k) {
        const word = (lang === 'gr' ? 'Χρώμα ' : 'Color ') + k;
        return '<span style="color:' + colors[k - 1] + '; font-weight:700;">' + word + '</span>';
    }

    function actualStepsHtml(steps) {
        return '<span lang="en"> For our instance the routing took <strong>' + steps + '</strong> step' + (steps === 1 ? '' : 's') + '.</span>' +
            '<span lang="gr"> Για το στιγμιότυπο μας η δρομολόγηση χρειάστηκε <strong>' + steps + '</strong> ' + (steps === 1 ? 'βήμα' : 'βήματα') + '.</span>';
    }
    function appendActualSteps(descEl, steps) {
        if (!descEl || descEl.dataset.actualStepsShown === '1') return;
        descEl.dataset.actualStepsShown = '1';
        descEl.insertAdjacentHTML('beforeend', actualStepsHtml(steps));
    }

    const bigIdeaHtml =
        '<span lang="en">We can route a square <span class="glossary-term" data-term="mesh">mesh</span> (&radic;N rows &times; &radic;N columns) in 3&radic;N&minus;3 <span class="glossary-term" data-term="step">steps</span>, keeping the maximum queue size at every processor = 1, by running our algorithm in 3 phases.<br><br>' +
        'In Phase 1 we rearrange the <span class="glossary-term" data-term="packet">packets</span> within each column so that at most one <span class="glossary-term" data-term="packet">packet</span> in each row is destined for each column. In Phase 2 we route every <span class="glossary-term" data-term="packet">packet</span> within its row to its destination column. In Phase 3 we route every <span class="glossary-term" data-term="packet">packet</span> within its column to its destination row (i.e. to its final destination).<br><br>' +
        'The way the <span class="glossary-term" data-term="packet">packets</span> are rearranged within each column during Phase 1 is computed <span class="glossary-term" data-term="offline">offline</span> and guarantees that no queues form during the <span class="glossary-term" data-term="greedy">greedy</span> routing of Phases 2 and 3.</span>' +
        '<span lang="gr">Μπορούμε να δρομολογήσουμε ένα τετραγωνικό <span class="glossary-term" data-term="mesh">πλέγμα</span> (&radic;N γραμμές &times; &radic;N στήλες) σε 3&radic;N&minus;3 <span class="glossary-term" data-term="step">βήματα</span>, διατηρώντας σε κάθε επεξεργαστή μέγιστο μέγεθος ουράς = 1, εκτελώντας τον αλγόριθμό μας σε 3 φάσεις.<br><br>' +
        'Στη Φάση 1, αναδιατάσσουμε τα <span class="glossary-term" data-term="packet">πακέτα</span> εντός κάθε στήλης, έτσι ώστε το πολύ ένα <span class="glossary-term" data-term="packet">πακέτο</span> σε κάθε γραμμή να προορίζεται για κάθε στήλη. Στη Φάση 2, δρομολογούμε κάθε <span class="glossary-term" data-term="packet">πακέτο</span> εντός της γραμμής του προς τη σωστή στήλη. Στη Φάση 3, δρομολογούμε κάθε <span class="glossary-term" data-term="packet">πακέτο</span> εντός της στήλης του προς τη σωστή γραμμή (δηλαδή, στον προορισμό του).<br><br>' +
        'Ο τρόπος αναδιάταξης των <span class="glossary-term" data-term="packet">πακέτων</span> εντός κάθε στήλης κατά τη Φάση 1 υπολογίζεται <span class="glossary-term" data-term="offline">offline</span> και εξασφαλίζει τη μη δημιουργία ουρών κατά την <span class="glossary-term" data-term="greedy">άπληστη</span> δρομολόγηση των φάσεων 2 και 3.</span>' +
        '<div class="algo-source"><span lang="en">Source:</span><span lang="gr">Πηγή:</span> F. T. Leighton, Introduction to Parallel Algorithms and Architectures, San Mateo, CA: Morgan Kaufmann Publishers, 1992.</div>';

    const bigIdeaCard = {
        id: 'p1-bigidea', navLabel: '<span lang="en">Big idea</span><span lang="gr">Βασική ιδέα</span>', kind: 'action', theory: null, interactive: false,
        render: function (body) {
            const div = document.createElement('div');
            div.className = 'substep-explain';
            div.innerHTML = bigIdeaHtml;
            body.appendChild(div);
            const note = document.createElement('div');
            note.className = 'help-hint-note';
            note.innerHTML =
                '<span lang="en">In every phase, press the «?» button for more details.</span>' +
                '<span lang="gr">Σε κάθε φάση, πάτησε το κουμπί «?» για περισσότερες λεπτομέρειες.</span>';
            body.appendChild(note);
        }
    };

    const hallTheory =
        '<span lang="en"><strong>The goal of Phase 1</strong> is to rearrange the packets within each column so that at most one packet per row is destined for any given column — which guarantees no two packets will conflict during the greedy routing of Phases 2 and 3.<br><br>' +
        'To achieve each rearrangement, we color each row of the mesh with a different color (Color 1 = row 1, etc.) and color the packets in each column so that packets of the same color have a different destination column.<br><br>' +
        'We build a bipartite graph: on one side &radic;N red nodes (K1…K&radic;N) representing each source column, on the other &radic;N blue nodes (M1…M&radic;N) representing each destination column. We connect them with edges representing packets: a packet at (a,b) with destination (c,d) gives edge K<sub>b</sub>&ndash;M<sub>d</sub>.<br><br>' +
        'We then color each edge so that no node K has two edges of the same color (so each column\'s packets end up in different rows after rearrangement) and no node M has two edges of the same color (so each row ends up with different destination columns after rearrangement).<br><br>' +
        'This is achieved using <span class="glossary-term" data-term="hall">Hall\'s matching theorem</span>, since our graph is bipartite and &radic;N-regular.<br><br>' +
        'Once the coloring is complete, the packets are rearranged within each column with the <span class="glossary-term" data-term="greedy">greedy</span> algorithm in at most &radic;N&minus;1 <span class="glossary-term" data-term="step">steps</span>.</span>' +
        '<span lang="gr"><strong>Ο στόχος της Φάσης 1</strong> είναι να αναδιατάξουμε τα πακέτα εντός κάθε στήλης, έτσι ώστε το πολύ ένα πακέτο σε κάθε γραμμή να προορίζεται για κάθε στήλη — κάτι που εξασφαλίζει ότι δεν θα δημιουργηθούν ουρές κατά την εκτέλεση του άπληστου αλγορίθμου στις Φάσεις 2 και 3.<br><br>' +
        'Για να επιτύχουμε κάθε αναδιάταξη, χαρακτηρίζουμε κάθε γραμμή του πλέγματος με διαφορετικό χρώμα (Χρώμα 1 αντιστοιχεί στη γραμμή 1 κ.ο.κ.) και χρωματίζουμε τα πακέτα σε κάθε στήλη ώστε τα πακέτα ίδιου χρώματος να έχουν προορισμό διαφορετική στήλη.<br><br>' +
        'Δημιουργούμε ένα διμερές γράφημα: στη μια πλευρά με &radic;N κόκκινους κόμβους (K1…K&radic;N) που αντιπροσωπεύουν κάθε στήλη θέσης και στην άλλη &radic;N μπλε κόμβους (M1…M&radic;N) που αντιπροσωπεύουν κάθε στήλη προορισμού. Ενώνουμε τους κόμβους με ακμές που αντιπροσωπεύουν τα πακέτα. Ένα πακέτο που βρίσκεται στη θέση (a,b) και έχει προορισμό (c,d) δίνει την ακμή K<sub>b</sub>&ndash;M<sub>d</sub>.<br><br>' +
        'Χρωματίζουμε κάθε ακμή έτσι ώστε κανένας κόμβος Κ να μην έχει ακμές ίδιου χρώματος (άρα τα πακέτα κάθε στήλης θα έχουν διαφορετική γραμμή μετά τη μετάθεση) και κανένας κόμβος Μ να μην έχει ακμές ίδιου χρώματος (άρα μετά τη μετάθεση κάθε γραμμή έχει διαφορετικές στήλες προορισμού).<br><br>' +
        'Αυτό επιτυγχάνεται με τη βοήθεια του <span class="glossary-term" data-term="hall">θεωρήματος ταιριάσματος του Hall</span>, αφού το γράφημά μας είναι διμερές και &radic;N-κανονικό.<br><br>' +
        'Μετά την ολοκλήρωση του χρωματισμού, τα πακέτα αναδιατάσσονται σε κάθε στήλη με τον <span class="glossary-term" data-term="greedy">άπληστο</span> αλγόριθμο σε το πολύ &radic;N&minus;1 <span class="glossary-term" data-term="step">βήματα</span>.</span>';

    const coloringCard = {
        id: 'p1-coloring', navLabel: '<span lang="en">Phase 1: Coloring</span><span lang="gr">Φάση 1: Χρωματισμός</span>', kind: 'action', theory: hallTheory, interactive: true,
        render: function (body, api) {

            if (!state.masterSteps) {
                const masterSteps = [{ type: 'init-nodes' }, { type: 'init-edges' }];
                const roundRanges = [];
                for (let color = 1; color <= n; color++) {
                    const matchOfM = new Array(n + 1).fill(null);
                    const roundStart = masterSteps.length;
                    for (let K = 1; K <= n; K++) {
                        const visitedM = new Set();
                        const path = [];
                        const steps = [];
                        const result = extendMatchingTraced(K, edgesByK, matchOfM, visitedM, color, path, steps);
                        const chunks = buildDisplayChunks(steps, K);
                        chunks.forEach(function (c) { c.color = color; });
                        if (result) {
                            chunks.forEach(function (c) { if (c.type === 'result-free') c.path = result; });
                            applyFlip(result, color, matchOfM);
                        }
                        masterSteps.push.apply(masterSteps, chunks);
                    }
                    roundRanges.push({ color: color, start: roundStart, end: masterSteps.length - 1 });
                }
                masterSteps.push({ type: 'final' });
                state.masterSteps = masterSteps;
                state.roundRanges = roundRanges;
                state.timelineIdx = 0;
                packets.forEach(function (p) { p.color = p.edgeRef.color; });
            }

            renderColoringUI(body, api);
        }
    };

    const buildDisplayChunks = oaBuildDisplayChunks;

    function computeColoringOverlay(uptoIdx) {
        return oaComputeColoringOverlay(state.masterSteps, uptoIdx);
    }

    function describeColoringStep(ev, label) {
        return oaDescribeColoringStep(ev, label, {
            colors: colors,
            initNodes: '<span lang="en">We build the graph. On the left we create &radic;N = ' + n + ' red nodes representing the packets\' source column, and on the right &radic;N = ' + n + ' blue nodes representing the destination column.</span>' +
                '<span lang="gr">Δημιουργούμε το γράφημα. Στην αριστερή πλευρά φτιάχνουμε &radic;N = ' + n + ' κόκκινους κόμβους που αντιπροσωπεύουν τη στήλη θέσης των πακέτων και στη δεξιά &radic;N = ' + n + ' μπλε κόμβους που αντιπροσωπεύουν τη στήλη προορισμού όλων των πακέτων.</span>',
            initEdges: '<span lang="en">We create the edges: each packet becomes an edge from its position column to its destination column.</span>' +
                '<span lang="gr">Δημιουργούμε τις ακμές: κάθε πακέτο γίνεται ακμή από τη στήλη θέσης του προς τη στήλη προορισμού του.</span>',
            final: '<span lang="en">Coloring is complete for all colors.</span><span lang="gr">Ο χρωματισμός ολοκληρώθηκε για όλα τα χρώματα.</span>'
        });
    }

    function renderColoringUI(body, api) {
        body.innerHTML = '';

        const phaseHint = document.createElement('p');
        phaseHint.className = 'substep-explain';
        phaseHint.style.marginBottom = '14px';
        phaseHint.innerHTML =
            '<span lang="en">In Phase 1 we rearrange the packets within each column so that at most one packet per row is destined for each column.</span>' +
            '<span lang="gr">Στη Φάση 1, αναδιατάσσουμε τα πακέτα εντός κάθε στήλης, έτσι ώστε το πολύ ένα πακέτο σε κάθε γραμμή να προορίζεται για κάθε στήλη.</span>';
        body.appendChild(phaseHint);

        const stack = document.createElement('div');
        stack.className = 'coloring-stack';
        body.appendChild(stack);

        const layout = document.createElement('div');
        layout.className = 'matching-layout';
        stack.appendChild(layout);

        function buildColHead(wrap, titleEn, titleGr) {
            const head = document.createElement('div');
            head.className = 'kn-col-head';
            const title = document.createElement('span');
            title.innerHTML = '<span lang="en">' + titleEn + '</span><span lang="gr">' + titleGr + '</span>';
            head.appendChild(title);
            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'kn-col-toggle';
            head.appendChild(toggle);
            wrap.appendChild(head);
            return toggle;
        }

        const gridWrap = document.createElement('div');
        gridWrap.className = 'matching-grid-col';
        layout.appendChild(gridWrap);
        const meshToggleBtn = buildColHead(gridWrap, 'Mesh', 'Πλέγμα');
        const gridCol = document.createElement('div');
        gridCol.style.minWidth = '0';
        gridWrap.appendChild(gridCol);

        const graphWrap = document.createElement('div');
        graphWrap.className = 'matching-graph-col';
        layout.appendChild(graphWrap);
        const graphToggleBtn = buildColHead(graphWrap, 'Graph', 'Γράφημα');
        const graphCol = document.createElement('div');
        graphCol.style.minWidth = '0';
        graphWrap.appendChild(graphCol);

        const controlBox = document.createElement('div');
        controlBox.className = 'coloring-control-box';
        stack.appendChild(controlBox);

        const ballRow = document.createElement('div');
        ballRow.className = 'coloring-ball-row';
        const prevBtn = document.createElement('button');
        prevBtn.className = 'btn-secondary coloring-nav-btn';
        prevBtn.innerHTML = '<span lang="en">&larr;</span><span lang="gr">&larr;</span>';
        const ballsInner = document.createElement('div');
        ballsInner.className = 'coloring-balls-inner';
        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn-primary coloring-nav-btn';
        nextBtn.innerHTML = '<span lang="en">&rarr;</span><span lang="gr">&rarr;</span>';
        ballRow.appendChild(prevBtn);
        ballRow.appendChild(ballsInner);
        ballRow.appendChild(nextBtn);
        controlBox.appendChild(ballRow);

        const descRow = document.createElement('div');
        descRow.className = 'coloring-desc-row';
        const descBox = document.createElement('div');
        descBox.className = 'coloring-desc-text';
        descRow.appendChild(descBox);
        controlBox.appendChild(descRow);

        const skipRow = document.createElement('div');
        skipRow.className = 'coloring-skip-row';
        const skipColorBtn = document.createElement('button');
        skipColorBtn.className = 'btn-pale';
        skipColorBtn.innerHTML = '<span lang="en">Skip to end of this color</span><span lang="gr">Παράλειψη έως το τέλος αυτού του χρώματος</span>';
        const skipAllBtn = document.createElement('button');
        skipAllBtn.className = 'btn-pale';
        skipAllBtn.innerHTML = '<span lang="en">Skip to end &rarr;</span><span lang="gr">Παράλειψη έως το τέλος &rarr;</span>';
        skipRow.appendChild(skipColorBtn);
        skipRow.appendChild(skipAllBtn);
        controlBox.appendChild(skipRow);

        let meshHidden = !!state._coloringMeshHidden;
        let graphHidden = !!state._coloringGraphHidden;
        function applyMeshToggleLabel() {
            gridCol.style.display = meshHidden ? 'none' : '';
            gridWrap.classList.toggle('is-collapsed', meshHidden);
            meshToggleBtn.innerHTML = meshHidden
                ? '<span lang="en">Show</span><span lang="gr">Εμφάνιση</span>'
                : '<span lang="en">Hide</span><span lang="gr">Κρύψε</span>';
        }
        function applyGraphToggleLabel() {
            graphCol.style.display = graphHidden ? 'none' : '';
            graphWrap.classList.toggle('is-collapsed', graphHidden);
            graphToggleBtn.innerHTML = graphHidden
                ? '<span lang="en">Show</span><span lang="gr">Εμφάνιση</span>'
                : '<span lang="en">Hide</span><span lang="gr">Κρύψε</span>';
        }

        function refitZoomables() {
            requestAnimationFrame(function () {
                window.dispatchEvent(new Event('resize'));
            });
        }
        applyMeshToggleLabel();
        applyGraphToggleLabel();
        meshToggleBtn.addEventListener('click', function () {
            meshHidden = !meshHidden;
            state._coloringMeshHidden = meshHidden;
            applyMeshToggleLabel();
            refitZoomables();
        });
        graphToggleBtn.addEventListener('click', function () {
            graphHidden = !graphHidden;
            state._coloringGraphHidden = graphHidden;
            applyGraphToggleLabel();
            refitZoomables();
        });

        if (!packets[0].curveOffset && packets[0].curveOffset !== 0) {
            const pairGroups = {};
            packets.forEach(function (p) {
                const key = p.sourceCol + '-' + p.destCol;
                (pairGroups[key] = pairGroups[key] || []).push(p);
            });
            Object.values(pairGroups).forEach(function (group) {
                group.forEach(function (p, idx) { p.curveOffset = (idx - (group.length - 1) / 2) * 16; });
            });
        }

        const badgeByPacketId = {};
        const tdByPacketId = {};
        const table = document.createElement('table');
        table.className = 'oa-table';
        const headerRow = document.createElement('tr');
        headerRow.appendChild(document.createElement('th'));
        const colHeaderEls = {};
        for (let c = 1; c <= n; c++) {
            const th = document.createElement('th');
            th.textContent = c;
            th.style.cursor = 'pointer';
            headerRow.appendChild(th);
            colHeaderEls[c] = th;
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
                td.appendChild(badge);
                tr.appendChild(td);
                badgeByPacketId[p.id] = badge;
                tdByPacketId[p.id] = td;
            }
            table.appendChild(tr);
        }
        gridCol.appendChild(table);

        const ns = 'http://www.w3.org/2000/svg';
        const spacing = Math.max(18, Math.min(32, 420 / n));
        const height = n * spacing + 40;
        const width = 280;
        const leftX = 60, rightX = width - 60;
        function edgePathD(K, M, curveOffset) {
            const y1 = 20 + (K - 1) * spacing + spacing / 2;
            const y2 = 20 + (M - 1) * spacing + spacing / 2;
            const midX = (leftX + rightX) / 2;
            const midY = (y1 + y2) / 2 + curveOffset;
            return 'M ' + leftX + ' ' + y1 + ' Q ' + midX + ' ' + midY + ' ' + rightX + ' ' + y2;
        }
        const svgEl = document.createElementNS(ns, 'svg');
        svgEl.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
        svgEl.classList.add('routing-graph-svg');
        const edgePathByPacketId = {};
        packets.forEach(function (p) {
            const path = document.createElementNS(ns, 'path');
            path.setAttribute('d', edgePathD(p.sourceCol, p.destCol, p.curveOffset));
            path.setAttribute('fill', 'none');
            path.classList.add('rg-edge', 'uncolored');
            path.style.cursor = 'pointer';
            path.dataset.sourceCol = p.sourceCol;
            path.dataset.destCol = p.destCol;
            path.dataset.packetId = p.id;
            svgEl.appendChild(path);
            edgePathByPacketId[p.id] = path;
        });
        const pathLabelEls = {};
        const kCircleByCol = {};
        const mCircleByCol = {};
        for (let c = 1; c <= n; c++) {
            const y = 20 + (c - 1) * spacing + spacing / 2;
            const circleL = document.createElementNS(ns, 'circle');
            circleL.setAttribute('cx', leftX); circleL.setAttribute('cy', y); circleL.setAttribute('r', 6);
            circleL.setAttribute('fill', '#c0392b');
            circleL.style.cursor = 'pointer';
            svgEl.appendChild(circleL);
            kCircleByCol[c] = circleL;
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
            circleR.setAttribute('fill', '#2255c0');
            circleR.style.cursor = 'pointer';
            svgEl.appendChild(circleR);
            mCircleByCol[c] = circleR;
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

        const footnote = document.createElement('div');
        footnote.className = 'coloring-footnote';
        footnote.innerHTML =
            '<span lang="en">Hover over any packet / edge for details.</span>' +
            '<span lang="gr">Κάνε hover σε οποιοδήποτε πακέτο / ακμή για πληροφορίες.</span>';
        stack.appendChild(footnote);

        let lastOverlay = {};
        function highlightColumn(c) {
            Object.keys(tdByPacketId).forEach(function (pid) {
                tdByPacketId[pid].classList.toggle('col-hover', parseInt(tdByPacketId[pid].dataset.col) === c);
            });
            Object.keys(edgePathByPacketId).forEach(function (pid) {
                const el = edgePathByPacketId[pid];
                const match = parseInt(el.dataset.sourceCol) === c;
                el.classList.toggle('highlighted', match);
                el.classList.toggle('faded', !match);
            });
        }
        function highlightDestColumn(c) {
            Object.keys(edgePathByPacketId).forEach(function (pid) {
                const el = edgePathByPacketId[pid];
                const match = parseInt(el.dataset.destCol) === c;
                el.classList.toggle('highlighted', match);
                el.classList.toggle('faded', !match);
            });
        }
        function highlightSingleEdge(packetId) {
            Object.keys(tdByPacketId).forEach(function (pid) {
                tdByPacketId[pid].classList.toggle('col-hover', parseInt(pid) === packetId);
            });
            Object.keys(edgePathByPacketId).forEach(function (pid) {
                const el = edgePathByPacketId[pid];
                const match = parseInt(pid) === packetId;
                el.classList.toggle('highlighted', match);
                el.classList.toggle('faded', !match);
            });
        }
        function clearHighlight() {
            Object.keys(tdByPacketId).forEach(function (pid) { tdByPacketId[pid].classList.remove('col-hover'); });
            Object.keys(edgePathByPacketId).forEach(function (pid) { edgePathByPacketId[pid].classList.remove('highlighted', 'faded'); });
        }
        function packetTooltipHtml(p, r, c) {
            const ov = lastOverlay[p.id];
            const colorLine = typeof ov === 'number'
                ? colorLabel(ov, colors)
                : (ov === 'yellow-pending'
                    ? (isGrLang() ? '<span style="color:#a07d00;">κίτρινο (προσωρινό)</span>' : '<span style="color:#a07d00;">yellow (tentative)</span>')
                    : '<span style="color:#999;">—</span>');
            return isGrLang()
                ? ('Θέση [' + r + ',<span style="color:#c0392b;">' + c + '</span>]<br>' +
                   'Προορισμός [' + p.destRow + ',<span style="color:#2255c0;">' + p.destCol + '</span>]<br>' +
                   'Ακμή: K' + c + '-M' + p.destCol + '<br>Χρώμα: ' + colorLine)
                : ('Position [' + r + ',<span style="color:#c0392b;">' + c + '</span>]<br>' +
                   'Destination [' + p.destRow + ',<span style="color:#2255c0;">' + p.destCol + '</span>]<br>' +
                   'Edge: K' + c + '-M' + p.destCol + '<br>Color: ' + colorLine);
        }

        for (let c = 1; c <= n; c++) {
            colHeaderEls[c].addEventListener('mouseenter', function () { highlightColumn(c); });
            colHeaderEls[c].addEventListener('mouseleave', clearHighlight);
            kCircleByCol[c].addEventListener('mouseenter', function () { highlightColumn(c); });
            kCircleByCol[c].addEventListener('mouseleave', clearHighlight);
            mCircleByCol[c].addEventListener('mouseenter', function () { highlightDestColumn(c); });
            mCircleByCol[c].addEventListener('mouseleave', clearHighlight);
        }
        packets.forEach(function (p) {
            const td = tdByPacketId[p.id];
            td.addEventListener('mouseenter', function (e) {
                highlightSingleEdge(p.id);
                showTooltip(e.clientX, e.clientY, packetTooltipHtml(p, p.sourceRow, p.sourceCol));
            });
            td.addEventListener('mousemove', function (e) { showTooltip(e.clientX, e.clientY, oaTooltipEl.innerHTML); });
            td.addEventListener('mouseleave', function () { clearHighlight(); hideTooltip(); });

            const pathEl = edgePathByPacketId[p.id];
            pathEl.addEventListener('mouseenter', function (e) {
                highlightSingleEdge(p.id);
                showTooltip(e.clientX, e.clientY, packetTooltipHtml(p, p.sourceRow, p.sourceCol));
            });
            pathEl.addEventListener('mousemove', function (e) { showTooltip(e.clientX, e.clientY, oaTooltipEl.innerHTML); });
            pathEl.addEventListener('mouseleave', function () { clearHighlight(); hideTooltip(); });
        });

        function applyOverlayInPlace(overlay) {
            packets.forEach(function (p) {
                const ov = overlay[p.id];
                const badge = badgeByPacketId[p.id];
                const path = edgePathByPacketId[p.id];
                if (typeof ov === 'number') {
                    badge.classList.add('colored');
                    badge.style.borderColor = colors[ov - 1];
                    badge.style.color = colors[ov - 1];
                    badge.style.borderWidth = '';
                    badge.style.fontWeight = '';
                    path.classList.remove('uncolored');
                    path.style.stroke = colors[ov - 1];
                    path.style.strokeWidth = '2';
                } else if (ov === 'yellow-pending') {
                    badge.classList.remove('colored');
                    badge.style.borderColor = '#e0b400';
                    badge.style.color = '#a07d00';
                    badge.style.borderWidth = '3px';
                    badge.style.fontWeight = '700';
                    path.classList.remove('uncolored');
                    path.style.stroke = '#e0b400';
                    path.style.strokeWidth = '3.5';
                } else {
                    badge.classList.remove('colored');
                    badge.style.borderColor = '';
                    badge.style.color = '';
                    badge.style.borderWidth = '';
                    badge.style.fontWeight = '';
                    path.classList.add('uncolored');
                    path.style.stroke = '';
                    path.style.strokeWidth = '';
                }
            });
        }

        function goToIdx(newIdx) {
            newIdx = Math.max(0, Math.min(state.masterSteps.length - 1, newIdx));
            state.timelineIdx = newIdx;
            refresh();
        }

        function renderBalls(idx) {
            ballsInner.innerHTML = '';
            function addBall(colorHex, isCurrent, onClick) {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'coloring-ball' + (isCurrent ? ' current' : '');
                b.style.background = colorHex;
                if (onClick) b.addEventListener('click', onClick);
                ballsInner.appendChild(b);
            }
            addBall('#9aa5b5', idx === 0, function () { goToIdx(0); });
            addBall('#9aa5b5', idx === 1, function () { goToIdx(1); });
            state.roundRanges.forEach(function (range) {
                if (idx < range.start) return;
                const isCurrent = idx >= range.start && idx <= range.end;
                addBall(colors[range.color - 1], isCurrent, function () { goToIdx(range.start); });
            });
            const finalIdx = state.masterSteps.length - 1;
            if (idx >= finalIdx) {
                addBall('#9aa5b5', idx === finalIdx, function () { goToIdx(finalIdx); });
            }
        }

        function currentRoundRange(idx) {
            for (let i = 0; i < state.roundRanges.length; i++) {
                const r = state.roundRanges[i];
                if (idx >= r.start && idx <= r.end) return r;
            }
            return null;
        }

        function refresh() {
            const idx = state.timelineIdx;
            const ev = state.masterSteps[idx];
            const rep = computeColoringOverlay(idx);
            lastOverlay = rep.overlay;
            descBox.innerHTML = describeColoringStep(ev, rep.currentLabel);
            applyOverlayInPlace(rep.overlay);
            Object.keys(pathLabelEls).forEach(function (key) { pathLabelEls[key].textContent = rep.labels[key] || ''; });

            svgEl.querySelectorAll('.rg-edge').forEach(function (p) { p.style.display = idx >= 1 ? '' : 'none'; });

            renderBalls(idx);

            prevBtn.disabled = idx <= 0;
            const atEnd = idx >= state.masterSteps.length - 1;
            nextBtn.disabled = atEnd;
            skipAllBtn.style.display = atEnd ? 'none' : 'inline-block';

            const cr = currentRoundRange(idx);
            skipColorBtn.style.display = (cr && idx < cr.end) ? 'inline-block' : 'none';
            if (cr) skipColorBtn.onclick = function () { goToIdx(cr.end); };

            if (atEnd) api.complete();
        }

        prevBtn.addEventListener('click', function () { goToIdx(state.timelineIdx - 1); });
        nextBtn.addEventListener('click', function () { goToIdx(state.timelineIdx + 1); });
        skipAllBtn.addEventListener('click', function () { goToIdx(state.masterSteps.length - 1); });

        refresh();
    }

    const rearrangeActionCard = {
        id: 'p1-rearrange', navLabel: '<span lang="en">Phase 1: Rearrangement</span><span lang="gr">Φάση 1: Αναδιάταξη</span>', kind: 'action', theory: hallTheory, interactive: true,
        render: function (body, api) {
            const desc = document.createElement('p');
            desc.className = 'substep-explain';
            desc.innerHTML =
                '<span lang="en">With the coloring complete, we <span class="glossary-term" data-term="greedy">greedily</span> rearrange the packets within each column: those with ' + colorWordFor('en', 1) + ' go to row 1, ' + colorWordFor('en', 2) + ' to row 2, and so on. Phase 1 finishes in at most &radic;N&minus;1 = ' + (n) + '&minus;1 = ' + (n - 1) + ' steps.</span>' +
                '<span lang="gr">Με τον χρωματισμό έτοιμο, κάνουμε <span class="glossary-term" data-term="greedy">άπληστη</span> μετακίνηση των πακέτων ανά στήλη: αυτά με ' + colorWordFor('gr', 1) + ' στη γραμμή 1, ' + colorWordFor('gr', 2) + ' στη γραμμή 2 και ούτω καθ&rsquo; εξής. Η Φάση 1 ολοκληρώνεται μετά από το πολύ &radic;N&minus;1 = ' + (n) + '&minus;1 = ' + (n - 1) + ' βήματα.</span>';
            body.appendChild(desc);

            if (state.afterP1) {
                appendActualSteps(desc, state.afterP1Steps || 0);
                renderRearrangeResult(body, api);
                api.complete();
                return;
            }

            const meshSlot = document.createElement('div');
            meshSlot.style.marginTop = '12px';
            body.appendChild(meshSlot);
            const beforePositions = {};
            packets.forEach(function (p) { beforePositions[p.sourceRow + ',' + p.sourceCol] = [p]; });
            drawSimpleGrid(meshSlot, beforePositions, colors, n, null);

            const execBtn = document.createElement('button');
            execBtn.className = 'btn-primary';
            execBtn.style.marginTop = '12px';
            execBtn.innerHTML = '<span lang="en">Rearrange by color</span><span lang="gr">Αναδιάταξη με βάση τα χρώματα</span>';
            body.appendChild(execBtn);

            execBtn.addEventListener('click', function () {
                const items = packets.map(function (p) { return { id: p.id, cur: p.sourceRow - 1, dest: p.color - 1, meta: p }; });
                const byColumn = {};
                items.forEach(function (it) { (byColumn[it.meta.sourceCol] = byColumn[it.meta.sourceCol] || []).push(it); });
                const perColumnResult = {};
                let maxSteps = 0;
                Object.keys(byColumn).forEach(function (col) {
                    const res = simulateGreedyLine(byColumn[col]);
                    perColumnResult[col] = res;
                    maxSteps = Math.max(maxSteps, res.steps);
                });
                state.afterP1Steps = maxSteps;
                state._p1ByColumn = byColumn;
                state._p1PerColumnResult = perColumnResult;
                const finalPos = {};
                Object.keys(byColumn).forEach(function (col) {
                    const snap = perColumnResult[col].snapshots[perColumnResult[col].snapshots.length - 1];
                    snap.forEach(function (list, rowIdx) {
                        const key = (rowIdx + 1) + ',' + col;
                        finalPos[key] = (finalPos[key] || []).concat(list.map(function (p) { return p.meta; }));
                    });
                });
                state.afterP1 = finalPos;
                appendActualSteps(desc, maxSteps);
                execBtn.style.display = 'none';
                drawSimpleGrid(meshSlot, state.afterP1, colors, n, { getDirection: rearrangeDirection });

                const stepToggleBtn = document.createElement('button');
                stepToggleBtn.className = 'btn-secondary';
                stepToggleBtn.style.marginTop = '12px';
                stepToggleBtn.innerHTML = '<span lang="en">Show step by step</span><span lang="gr">Δείξε βήμα-βήμα</span>';
                body.appendChild(stepToggleBtn);

                const navRow = buildStepNavRow(maxSteps, function (cur) {
                    drawSimpleGrid(meshSlot, rearrangePositionsAtStep(cur), colors, n, { getDirection: rearrangeDirection });
                });
                navRow.style.display = 'none';
                body.appendChild(navRow);

                let shown = false;
                stepToggleBtn.addEventListener('click', function () {
                    shown = !shown;
                    navRow.style.display = shown ? '' : 'none';
                    stepToggleBtn.innerHTML = shown
                        ? '<span lang="en">Hide step by step</span><span lang="gr">Κρύψε βήμα-βήμα</span>'
                        : '<span lang="en">Show step by step</span><span lang="gr">Δείξε βήμα-βήμα</span>';
                    if (shown) navRow._goTo(0);
                    else drawSimpleGrid(meshSlot, state.afterP1, colors, n, { getDirection: rearrangeDirection });
                });
                api.complete();
            });
        }
    };
    function rearrangeDirection(p, r) {
        if (p.color === r) return null;
        return p.color > r ? { arrow: '\u2193' } : { arrow: '\u2191' };
    }

    function rearrangePositionsAtStep(stepIdx) {
        const byColumn = state._p1ByColumn, perColumnResult = state._p1PerColumnResult;
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

    function buildBasicAnimationConfig() {
        const p1 = state.afterP1Steps || 0;
        const p2 = state.afterP2Steps || 0;
        const p3 = state._p3MaxSteps || 0;

        const sourcePositions = {};
        packets.forEach(function (p) { sourcePositions[p.sourceRow + ',' + p.sourceCol] = [p]; });

        function dirP2(p, r, c) {
            if (p.destCol === c) return null;
            return p.destCol > c ? { arrow: '\u2192' } : { arrow: '\u2190' };
        }
        function dirP3(p, r) {
            if (p.destRow === r) return null;
            return p.destRow > r ? { arrow: '\u2193' } : { arrow: '\u2191' };
        }
        function frame(label, step, offline, positionsFn, opts) {
            return {
                label: label, step: step, offline: !!offline,
                draw: function (slot) { drawSimpleGrid(slot, positionsFn(), colors, n, opts); }
            };
        }

        const frames = [];
        frames.push(frame(animFrameLabel('Αρχικό πλέγμα', 'Initial mesh'), 0, true,
            function () { return sourcePositions; }, { plain: true }));
        frames.push(frame(animFrameLabel('Χρωματισμός', 'Coloring'), 0, true,
            function () { return sourcePositions; }, { getDirection: rearrangeDirection }));

        let acc = 0;
        for (let t = 1; t <= p1; t++) {
            acc++;
            (function (step, total) {
                frames.push(frame(animPhaseLabel(1, step), total, false,
                    function () { return rearrangePositionsAtStep(step); }, { getDirection: rearrangeDirection }));
            })(t, acc);
        }
        for (let t = 1; t <= p2; t++) {
            acc++;
            (function (step, total) {
                frames.push(frame(animPhaseLabel(2, step), total, false,
                    function () { return state._p2PositionsAtStep(step); }, { getDirection: dirP2 }));
            })(t, acc);
        }
        for (let t = 1; t <= p3; t++) {
            acc++;
            (function (step, total) {
                frames.push(frame(animPhaseLabel(3, step), total, false,
                    function () { return state._p3PositionsAtStep(step); }, { getDirection: dirP3 }));
            })(t, acc);
        }

        return { frames: frames, totalSteps: p1 + p2 + p3 };
    }

    function renderRearrangeResult(body) {

        const maxSteps = state.afterP1Steps || 0;
        const meshSlot = document.createElement('div');
        meshSlot.style.marginTop = '14px';
        body.appendChild(meshSlot);

        const stepToggleBtn = document.createElement('button');
        stepToggleBtn.className = 'btn-secondary';
        stepToggleBtn.style.marginTop = '12px';
        stepToggleBtn.innerHTML = '<span lang="en">Show step by step</span><span lang="gr">Δείξε βήμα-βήμα</span>';
        body.appendChild(stepToggleBtn);

        const navRow = buildStepNavRow(maxSteps, function (cur) {
            drawSimpleGrid(meshSlot, rearrangePositionsAtStep(cur), colors, n, { getDirection: rearrangeDirection });
        });
        navRow.style.display = 'none';
        body.appendChild(navRow);

        drawSimpleGrid(meshSlot, state.afterP1, colors, n, { getDirection: rearrangeDirection });

        let stepByStepShown = false;
        stepToggleBtn.addEventListener('click', function () {
            stepByStepShown = !stepByStepShown;
            navRow.style.display = stepByStepShown ? '' : 'none';
            stepToggleBtn.innerHTML = stepByStepShown
                ? '<span lang="en">Hide step by step</span><span lang="gr">Κρύψε βήμα-βήμα</span>'
                : '<span lang="en">Show step by step</span><span lang="gr">Δείξε βήμα-βήμα</span>';
            if (stepByStepShown) {
                navRow._goTo(0);
            } else {
                drawSimpleGrid(meshSlot, state.afterP1, colors, n, { getDirection: rearrangeDirection });
            }
        });
    }

    function buildStepNavRow(max, onStep) {
        let cur = 0;
        const row = document.createElement('div');
        row.className = 'coloring-ball-row';
        row.style.marginTop = '10px';

        const prevBtn = document.createElement('button');
        prevBtn.className = 'btn-secondary coloring-nav-btn';
        prevBtn.innerHTML = '&larr;';

        const stepLabel = document.createElement('div');
        stepLabel.className = 'step-nav-label';

        const dotsWrap = document.createElement('div');
        dotsWrap.className = 'coloring-balls-inner';

        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn-primary coloring-nav-btn';
        nextBtn.innerHTML = '&rarr;';

        row.appendChild(prevBtn);
        row.appendChild(stepLabel);
        row.appendChild(dotsWrap);
        row.appendChild(nextBtn);

        function renderLabel() {
            stepLabel.innerHTML = (cur === 0)
                ? '<span lang="en">Initial</span><span lang="gr">Αρχικό</span>'
                : ('<span lang="en">Step ' + cur + '</span><span lang="gr">Βήμα ' + cur + '</span>');
        }

        function renderDots() {
            dotsWrap.innerHTML = '';
            for (let i = 0; i <= max; i++) {
                const dot = document.createElement('button');
                dot.type = 'button';
                dot.className = 'coloring-ball' + (i === cur ? ' current' : '');
                dot.style.background = i === cur ? '#1a6bbd' : '#cdd5e0';
                (function(step) {
                    dot.addEventListener('click', function () { goTo(step); });
                })(i);
                dotsWrap.appendChild(dot);
            }
        }

        function goTo(n) {
            cur = Math.max(0, Math.min(max, n));
            renderLabel();
            renderDots();
            prevBtn.disabled = cur <= 0;
            nextBtn.disabled = cur >= max;
            onStep(cur);
        }
        prevBtn.addEventListener('click', function () { goTo(cur - 1); });
        nextBtn.addEventListener('click', function () { goTo(cur + 1); });
        row._goTo = goTo;
        return row;
    }

    const phase2Theory =
        '<span lang="en">The Phase 1 rearrangement guarantees that no row contains two <span class="glossary-term" data-term="packet">packets</span> destined for the same column — so a <span class="glossary-term" data-term="greedy">greedy</span> algorithm can route each row independently in at most &radic;N&minus;1 <span class="glossary-term" data-term="step">steps</span>, with no queues.<br><br>' +
        'All rows run their <span class="glossary-term" data-term="greedy">greedy</span> routines in parallel. Phase 2 ends when every packet is in its destination column.</span>' +
        '<span lang="gr">Η αναδιάταξη της Φάσης 1 εξασφαλίζει ότι καμία γραμμή δεν περιέχει δύο <span class="glossary-term" data-term="packet">πακέτα</span> με τον ίδιο στόχο στήλης — άρα ένας <span class="glossary-term" data-term="greedy">άπληστος</span> αλγόριθμος μπορεί να δρομολογήσει κάθε γραμμή ανεξάρτητα σε το πολύ &radic;N&minus;1 <span class="glossary-term" data-term="step">βήματα</span>, χωρίς ουρές.<br><br>' +
        'Όλες οι γραμμές τρέχουν τους <span class="glossary-term" data-term="greedy">άπληστους</span> αλγορίθμους τους παράλληλα. Η Φάση 2 τελειώνει όταν κάθε πακέτο βρεθεί στη στήλη προορισμού του.</span>';

    const phase2ActionCard = {
        id: 'p2-action', navLabel: '<span lang="en">Phase 2</span><span lang="gr">Φάση 2</span>', kind: 'action', theory: phase2Theory, interactive: true,
        render: function (body, api) {
            const desc = document.createElement('p');
            desc.className = 'substep-explain';
            desc.innerHTML =
                '<span lang="en">In Phase 2 we <span class="glossary-term" data-term="greedy">greedily</span> route every packet within its row to its destination column. Phase 2 completes in at most &radic;N&minus;1 = ' + (n) + '&minus;1 = ' + (n - 1) + ' steps.</span>' +
                '<span lang="gr">Στη Φάση 2 κάνουμε <span class="glossary-term" data-term="greedy">άπληστη</span> δρομολόγηση σε κάθε γραμμή, ώστε το κάθε πακέτο να πάει στη στήλη προορισμού του. Η Φάση 2 ολοκληρώνεται μετά από το πολύ &radic;N&minus;1 = ' + (n) + '&minus;1 = ' + (n - 1) + ' βήματα.</span>';
            body.appendChild(desc);

            function hoverExtra(p, r, c) {
                const dirText = p.destCol > c ? (isGrLang() ? 'Μετακινείται δεξιά' : 'Moves right')
                    : p.destCol < c ? (isGrLang() ? 'Μετακινείται αριστερά' : 'Moves left')
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
            state.afterP2 = positionsAtStep(maxSteps);
            state.afterP2Steps = maxSteps;
            state._p2PositionsAtStep = positionsAtStep;

            const meshSlot = document.createElement('div');
            meshSlot.style.marginTop = '12px';
            body.appendChild(meshSlot);
            drawSimpleGrid(meshSlot, positionsAtStep(0), colors, n, { onHover: hoverExtra, getDirection: direction });

            const execBtn = document.createElement('button');
            execBtn.className = 'btn-primary';
            execBtn.style.marginTop = '12px';
            execBtn.innerHTML = '<span lang="en">Execute Phase 2</span><span lang="gr">Εκτέλεση Φάσης 2</span>';
            body.appendChild(execBtn);

            execBtn.addEventListener('click', function () {
                appendActualSteps(desc, maxSteps);
                execBtn.style.display = 'none';
                drawSimpleGrid(meshSlot, positionsAtStep(maxSteps), colors, n, { onHover: hoverExtra, getDirection: direction });

                const stepToggleBtn = document.createElement('button');
                stepToggleBtn.className = 'btn-secondary';
                stepToggleBtn.style.marginTop = '12px';
                stepToggleBtn.innerHTML = '<span lang="en">Show step by step</span><span lang="gr">Δείξε βήμα-βήμα</span>';
                body.appendChild(stepToggleBtn);

                const navRow = buildStepNavRow(maxSteps, function (cur) {
                    drawSimpleGrid(meshSlot, positionsAtStep(cur), colors, n, { onHover: hoverExtra, getDirection: direction });
                });
                navRow.style.display = 'none';
                body.appendChild(navRow);

                let shown = false;
                stepToggleBtn.addEventListener('click', function () {
                    shown = !shown;
                    navRow.style.display = shown ? '' : 'none';
                    stepToggleBtn.innerHTML = shown
                        ? '<span lang="en">Hide step by step</span><span lang="gr">Κρύψε βήμα-βήμα</span>'
                        : '<span lang="en">Show step by step</span><span lang="gr">Δείξε βήμα-βήμα</span>';
                    if (shown) navRow._goTo(0);
                    else drawSimpleGrid(meshSlot, positionsAtStep(maxSteps), colors, n, { onHover: hoverExtra, getDirection: direction });
                });
                api.complete();
            });
        }
    };

    const phase3Theory =
        '<span lang="en">After Phase 2 every <span class="glossary-term" data-term="packet">packet</span> is in the correct column and needs only to reach its destination row. A <span class="glossary-term" data-term="greedy">greedy</span> algorithm can route each column independently in at most &radic;N&minus;1 <span class="glossary-term" data-term="step">steps</span>, with no conflicts.<br><br>' +
        'All columns run their <span class="glossary-term" data-term="greedy">greedy</span> routines in parallel. Phase 3 ends when every packet reaches its final destination.</span>' +
        '<span lang="gr">Μετά τη Φάση 2 κάθε <span class="glossary-term" data-term="packet">πακέτο</span> βρίσκεται στη σωστή στήλη και χρειάζεται μόνο να φτάσει στη γραμμή προορισμού του. Ένας <span class="glossary-term" data-term="greedy">άπληστος</span> αλγόριθμος μπορεί να δρομολογήσει κάθε στήλη ανεξάρτητα σε το πολύ &radic;N&minus;1 <span class="glossary-term" data-term="step">βήματα</span>, χωρίς συγκρούσεις.<br><br>' +
        'Όλες οι στήλες τρέχουν τους <span class="glossary-term" data-term="greedy">άπληστους</span> αλγορίθμους τους παράλληλα. Η Φάση 3 τελειώνει όταν κάθε πακέτο φτάσει στον τελικό προορισμό του.</span>';

    let phase3MaxSteps = 0;

    const phase3ActionCard = {
        id: 'p3-action', navLabel: '<span lang="en">Phase 3</span><span lang="gr">Φάση 3</span>', kind: 'action', theory: phase3Theory, interactive: true,
        render: function (body, api) {
            const desc = document.createElement('p');
            desc.className = 'substep-explain';
            desc.innerHTML =
                '<span lang="en">In Phase 3 we <span class="glossary-term" data-term="greedy">greedily</span> route every packet within its column to its destination row — its final destination. Phase 3 completes in at most &radic;N&minus;1 = ' + (n) + '&minus;1 = ' + (n - 1) + ' steps.</span>' +
                '<span lang="gr">Στη Φάση 3 κάνουμε <span class="glossary-term" data-term="greedy">άπληστη</span> δρομολόγηση σε κάθε στήλη, ώστε το κάθε πακέτο να πάει στη γραμμή προορισμού του, που πλέον είναι και ο τελικός προορισμός του. Η Φάση 3 ολοκληρώνεται μετά από το πολύ &radic;N&minus;1 = ' + (n) + '&minus;1 = ' + (n - 1) + ' βήματα.</span>';
            body.appendChild(desc);

            function hoverExtra(p, r, c) {
                const dirText = p.destRow > r ? (isGrLang() ? 'Μετακινείται κάτω' : 'Moves down')
                    : p.destRow < r ? (isGrLang() ? 'Μετακινείται πάνω' : 'Moves up')
                    : (isGrLang() ? 'Έφτασε στον τελικό προορισμό' : 'Reached final destination');
                return isGrLang()
                    ? ('Πακέτο στη θέση (' + r + ',' + c + ').<br>Τελικός προορισμός: γραμμή <strong>' + p.destRow + '</strong>.<br>' + dirText + '.')
                    : ('Packet at (' + r + ',' + c + ').<br>Final destination: row <strong>' + p.destRow + '</strong>.<br>' + dirText + '.');
            }
            function direction(p, r, c) {
                if (p.destRow === r) return null;
                return p.destRow > r ? { arrow: '\u2193' } : { arrow: '\u2191' };
            }

            const packetLocation = {};
            Object.keys(state.afterP2).forEach(function (key) {
                const parts = key.split(',');
                state.afterP2[key].forEach(function (p) {
                    packetLocation[p.id] = { row: parseInt(parts[0]), col: parseInt(parts[1]) };
                });
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
            phase3MaxSteps = maxSteps;
            state._p3MaxSteps = maxSteps;

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
            state._p3PositionsAtStep = positionsAtStep;

            const meshSlot = document.createElement('div');
            meshSlot.style.marginTop = '12px';
            body.appendChild(meshSlot);
            drawSimpleGrid(meshSlot, positionsAtStep(0), colors, n, { onHover: hoverExtra, getDirection: direction });

            const execBtn = document.createElement('button');
            execBtn.className = 'btn-primary';
            execBtn.style.marginTop = '12px';
            execBtn.innerHTML = '<span lang="en">Execute Phase 3</span><span lang="gr">Εκτέλεση Φάσης 3</span>';
            body.appendChild(execBtn);

            execBtn.addEventListener('click', function () {
                appendActualSteps(desc, maxSteps);
                execBtn.style.display = 'none';
                state.afterP3 = positionsAtStep(maxSteps);
                drawSimpleGrid(meshSlot, state.afterP3, colors, n, { onHover: hoverExtra, getDirection: direction });

                const stepToggleBtn = document.createElement('button');
                stepToggleBtn.className = 'btn-secondary';
                stepToggleBtn.style.marginTop = '12px';
                stepToggleBtn.innerHTML = '<span lang="en">Show step by step</span><span lang="gr">Δείξε βήμα-βήμα</span>';
                body.appendChild(stepToggleBtn);

                const navRow = buildStepNavRow(maxSteps, function (cur) {
                    drawSimpleGrid(meshSlot, positionsAtStep(cur), colors, n, { onHover: hoverExtra, getDirection: direction });
                });
                navRow.style.display = 'none';
                body.appendChild(navRow);

                let shown = false;
                stepToggleBtn.addEventListener('click', function () {
                    shown = !shown;
                    navRow.style.display = shown ? '' : 'none';
                    stepToggleBtn.innerHTML = shown
                        ? '<span lang="en">Hide step by step</span><span lang="gr">Κρύψε βήμα-βήμα</span>'
                        : '<span lang="en">Show step by step</span><span lang="gr">Δείξε βήμα-βήμα</span>';
                    if (shown) navRow._goTo(0);
                    else drawSimpleGrid(meshSlot, state.afterP3, colors, n, { onHover: hoverExtra, getDirection: direction });
                });

                const p1 = state.afterP1Steps || 0;
                const p2 = state.afterP2Steps || 0;
                const p3 = maxSteps;
                const resultHolder = document.createElement('div');
                resultHolder.style.marginTop = '20px';
                resultHolder.innerHTML =
                    '<div class="result-banner result-banner--green">' +
                    '<div class="result-stat" style="flex-basis:100%;"><div class="label" style="font-size:15px;font-weight:700;">' +
                    '<span lang="en">The algorithm terminates. The mesh has been routed.</span>' +
                    '<span lang="gr">Ο αλγόριθμος τερματίζει, το πλέγμα δρομολογήθηκε.</span></div></div>' +
                    '<div class="result-stat"><div class="num">' + (p1+p2+p3) + '</div><div class="label">' +
                    '<span lang="en">Actual steps</span><span lang="gr">Πραγματικά βήματα</span><br>' +
                    '<span lang="en">(Phase 1=' + p1 + ', Phase 2=' + p2 + ', Phase 3=' + p3 + ')</span>' +
                    '<span lang="gr">(Φάση 1=' + p1 + ', Φάση 2=' + p2 + ', Φάση 3=' + p3 + ')</span></div></div>' +
                    '<div class="result-stat"><div class="num">' + 3*(n-1) + '</div><div class="label">' + formatBound('basic', n) + '</div></div>' +
                    '</div>';
                body.appendChild(resultHolder);

                const resultActions = document.createElement('div');
                resultActions.className = 'result-actions';
                resultHolder.querySelector('.result-banner').appendChild(resultActions);
                appendAnimationLauncher(resultActions, buildBasicAnimationConfig);

                if (n % 2 === 0) {
                    appendTransferButton(resultActions, 'krizanc', n, packets.map(function (p) {
                        return { row: p.sourceRow, col: p.sourceCol, val: p.destRow + ',' + p.destCol };
                    }));
                }

                api.complete();
            });
        }
    };

    return [
        bigIdeaCard, coloringCard,
        rearrangeActionCard,
        phase2ActionCard,
        phase3ActionCard
    ];
}

/* Grid renderer */
function drawSimpleGrid(container, positions, colors, n, options) {
    options = options || {};

    let table = container._sgTable;
    if (!table || table.dataset.n !== String(n)) {
        container.innerHTML = '';
        table = document.createElement('table');
        table.className = 'oa-table';
        table.dataset.n = n;

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
            const rh = document.createElement('th'); rh.textContent = r; tr.appendChild(rh);
            for (let c = 1; c <= n; c++) {
                const td = document.createElement('td');
                td.dataset.row = r; td.dataset.col = c;
                tr.appendChild(td);
            }
            table.appendChild(tr);
        }
        container.appendChild(table);
        container._sgTable = table;

        table._tds = {};
        table.querySelectorAll('td[data-row]').forEach(function (td) {
            table._tds[td.dataset.row + ',' + td.dataset.col] = td;
        });
    }

    for (let r = 1; r <= n; r++) {
        for (let c = 1; c <= n; c++) {
            const oldTd = table._tds[r + ',' + c];
            const td = oldTd.cloneNode(false);
            oldTd.parentNode.replaceChild(td, oldTd);
            table._tds[r + ',' + c] = td;

            const list = positions[r + ',' + c] || [];
            list.forEach(function (p) {
                const badgeLine = document.createElement('div');
                badgeLine.style.marginBottom = '2px';
                const badge = document.createElement('span');
                badge.className = 'packet-badge' + (options.plain ? '' : ' colored');
                badge.textContent = p.destRow + ',' + p.destCol;
                if (!options.plain) {
                    badge.style.borderColor = colors[p.color - 1];
                    badge.style.color = colors[p.color - 1];
                }
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
                td.addEventListener('mousemove', function (e) {
                    if (oaTooltipEl && oaTooltipEl.style.display === 'block') showTooltip(e.clientX, e.clientY, oaTooltipEl.innerHTML);
                });
                td.addEventListener('mouseleave', function () {
                    document.querySelectorAll('.oa-table td').forEach(function (x) { x.classList.remove('col-hover', 'target-hover'); });
                    hideTooltip();
                });
            }
        }
    }
}