/* Αλγόριθμος Krizanc-Narayanan*/

/* ── Τα 4 sub-mesh: ονόματα & χρώματα ── */
const KN_QUADS = [
    { key: 'red',    gr: 'Κόκκινο',       en: 'Red',    color: '#c0392b', tint: 'rgba(192,57,43,0.10)'  },
    { key: 'green',  gr: 'Πράσινο',    en: 'Green',  color: '#1e8e3e', tint: 'rgba(30,142,62,0.10)'  },
    { key: 'yellow', gr: 'Κίτρινο',      en: 'Yellow', color: '#c9a300', tint: 'rgba(201,163,0,0.14)'  },
    { key: 'orange', gr: 'Πορτοκαλί',   en: 'Orange', color: '#e07b2f', tint: 'rgba(224,123,47,0.12)' }
];

function knQuadIndex(row, col, half) {
    return (row <= half ? 0 : 2) + (col <= half ? 0 : 1);
}
function knQuadName(qi) { return isGrLang() ? KN_QUADS[qi].gr : KN_QUADS[qi].en; }
function knQuadChip(qi) {
    return '<span style="color:' + KN_QUADS[qi].color + '; font-weight:700;">' + knQuadName(qi) + '</span>';
}
const KN_PERM = [
    { gr: 'Μετάθεση Α', en: 'Permutation A', color: '#1a5eb8', dash: false },
    { gr: 'Μετάθεση Β', en: 'Permutation B', color: '#7d3cb5', dash: true }
];
function knPermChip(g) {
    const p = KN_PERM[g - 1];
    return '<span style="color:' + p.color + '; font-weight:700;">' + (isGrLang() ? p.gr : p.en) + '</span>';
}

/* Odd-even transposition sort */
function knOddEvenLine(items, len) {
    const curUsed = new Set(items.map(function (it) { return it.cur; }));
    const destUsed = new Set(items.map(function (it) { return it.dest; }));
    const line = new Array(len).fill(null);
    items.forEach(function (it) { line[it.cur] = { id: it.id, dest: it.dest, real: true }; });
    const freeDests = [];
    for (let i = 0; i < len; i++) if (!destUsed.has(i)) freeDests.push(i);
    let fd = 0;
    for (let i = 0; i < len; i++) {
        if (!curUsed.has(i)) line[i] = { id: 'dummy' + i, dest: freeDests[fd++], real: false };
    }

    const traj = {};
    items.forEach(function (it) { traj[it.id] = [it.cur]; });

    function isSorted() {
        for (let i = 0; i < len; i++) if (line[i].dest !== i) return false;
        return true;
    }

    let steps = 0;
    while (!isSorted()) {
        steps++;
        if (steps > len + 2) throw new Error('kn odd-even sort did not converge');
        const start = (steps % 2 === 1) ? 0 : 1;   /* εναλλάξ περιττές/άρτιες ακμές */
        for (let i = start; i + 1 < len; i += 2) {
            if (line[i].dest > line[i + 1].dest) {
                const tmp = line[i]; line[i] = line[i + 1]; line[i + 1] = tmp;
            }
        }
        for (let i = 0; i < len; i++) {
            if (line[i].real) traj[line[i].id].push(i);
        }
    }
    return { traj: traj, steps: steps };
}

/* Hall 1 */
function knSplitIntoTwoPermutations(realEdges, m) {
    const cells = m * m;
    const degU = new Array(cells).fill(0);
    const degV = new Array(cells).fill(0);
    const edges = [];

    realEdges.forEach(function (e) {
        degU[e.u]++; degV[e.v]++;
        edges.push({ u: e.u, v: e.v, packet: e.packet, dummy: false, perm: 0 });
    });

    /* dummies */
    const uDef = [], vDef = [];
    for (let i = 0; i < cells; i++) {
        for (let k = degU[i]; k < 2; k++) uDef.push(i);
        for (let k = degV[i]; k < 2; k++) vDef.push(i);
    }
    for (let i = 0; i < uDef.length; i++) {
        edges.push({ u: uDef[i], v: vDef[i], packet: null, dummy: true, perm: 0 });
    }

    
    const adjU = Array.from({ length: cells }, function () { return []; });
    const adjV = Array.from({ length: cells }, function () { return []; });
    edges.forEach(function (e) { adjU[e.u].push(e); adjV[e.v].push(e); });

    function otherAt(list, e) { return list[0] === e ? list[1] : list[0]; }

   
    const cyclesLog = [];
    edges.forEach(function (e0) {
        if (e0.perm !== 0) return;
        const cyc = [];
        let e = e0, g = 1;
        while (true) {
            e.perm = g; g = 3 - g; cyc.push(e);
            const e2 = otherAt(adjV[e.v], e);
            if (e2 === e0) break;
            e2.perm = g; g = 3 - g; cyc.push(e2);
            const e3 = otherAt(adjU[e2.u], e2);
            if (e3 === e0) break;
            e = e3;
        }
        cyclesLog.push(cyc);
    });

    const permOfCell = [new Array(cells).fill(-1), new Array(cells).fill(-1)];
    edges.forEach(function (e) { permOfCell[e.perm - 1][e.u] = e.v; });
    return { edges: edges, permOfCell: permOfCell, cyclesLog: cyclesLog };
}

/* Hall 2 */
function knDecomposeRegular(edges, m) {
    edges.forEach(function (e) { e.hallColor = 0; });
    const byLeft = Array.from({ length: m }, function () { return []; });
    edges.forEach(function (e) { byLeft[e.left].push(e); });

    for (let color = 1; color <= m; color++) {
        const matchEdgeOfRight = new Array(m).fill(null);
        function tryAugment(u, visited) {
            for (const e of byLeft[u]) {
                if (e.hallColor !== 0 || visited.has(e.right)) continue;
                visited.add(e.right);
                const occ = matchEdgeOfRight[e.right];
                if (occ === null || tryAugment(occ.left, visited)) {
                    matchEdgeOfRight[e.right] = e;
                    return true;
                }
            }
            return false;
        }
        for (let u = 0; u < m; u++) {
            if (!tryAugment(u, new Set())) throw new Error('Hall decomposition failed (should be impossible on a regular graph)');
        }
        matchEdgeOfRight.forEach(function (e) { e.hallColor = color; });
    }
}

/* grid renderer */
function knDrawGrid(container, positions, n, half, options) {
    options = options || {};
    const r0 = options.rowStart || 1, r1 = options.rowEnd || n;
    const c0 = options.colStart || 1, c1 = options.colEnd || n;
    container.innerHTML = '';
    const table = document.createElement('table');
    table.className = 'oa-table';
    const headerRow = document.createElement('tr');
    headerRow.appendChild(document.createElement('th'));
    for (let c = c0; c <= c1; c++) { const th = document.createElement('th'); th.textContent = c; headerRow.appendChild(th); }
    table.appendChild(headerRow);

    for (let r = r0; r <= r1; r++) {
        const tr = document.createElement('tr');
        const rh = document.createElement('th'); rh.textContent = r; tr.appendChild(rh);
        for (let c = c0; c <= c1; c++) {
            const td = document.createElement('td');
            td.dataset.row = r; td.dataset.col = c;
            if (options.tint) {
                const qi = knQuadIndex(r, c, half);
                td.style.background = KN_QUADS[qi].tint;
                if (r === half && r1 > half) td.style.borderBottom = '2px solid #7a8aa0';
                if (c === half && c1 > half) td.style.borderRight = '2px solid #7a8aa0';
            }
            const list = positions[r + ',' + c] || [];
            list.forEach(function (p) {
                const badgeLine = document.createElement('div');
                badgeLine.style.marginBottom = '2px';
                const badge = document.createElement('span');
                badge.className = 'packet-badge' + (options.plain ? '' : ' colored');
                badge.dataset.packetId = p.id;
                badge.textContent = p.destRow + ',' + p.destCol;
                if (!options.plain) {
                    badge.style.borderColor = KN_QUADS[p.quad].color;
                    badge.style.color = KN_QUADS[p.quad].color;
                }
                if (options.getStyle) options.getStyle(p, badge);
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
                    let html = '';
                    list.forEach(function (p, i) {
                        if (i > 0) html += '<hr style="margin:5px 0; border-color:#ccc;">';
                        html += options.onHover(p, r, c);
                    });
                    if (html) showTooltip(e.clientX, e.clientY, html);
                });
                td.addEventListener('mousemove', function (e) {
                    if (oaTooltipEl && oaTooltipEl.style.display === 'block') showTooltip(e.clientX, e.clientY, oaTooltipEl.innerHTML);
                });
                td.addEventListener('mouseleave', function () { hideTooltip(); });
            }
            tr.appendChild(td);
        }
        table.appendChild(tr);
    }
    container.appendChild(table);
}

/* Βοηθητικό: map θέσεων από trajectories σε συγκεκριμένο βήμα */
function knPositionsAt(packets, trajMap, step) {
    const positions = {};
    packets.forEach(function (p) {
        const t = trajMap[p.id];
        const pos = t[Math.min(step, t.length - 1)];
        const key = pos.r + ',' + pos.c;
        (positions[key] = positions[key] || []).push(p);
    });
    return positions;
}
const KN_C_COLOR = '#b8860b'; /* κίτρινο, για το c */
const KN_B_COLOR = '#1f9fe0'; /* γαλάζιο, για το b */
function knCTag(text) { return '<span style="color:' + KN_C_COLOR + '; font-weight:700;">' + text + '</span>'; }
function knBTag(text) { return '<span style="color:' + KN_B_COLOR + '; font-weight:700;">' + text + '</span>'; }
function knHoverBasic(p) {
    const gr = isGrLang();
    return '<strong>' + (gr ? 'Πακέτο' : 'Packet') + '</strong><br>' +
        (gr ? 'Θέση (a,b)' : 'Position (a,b)') + ' = (' + p.sourceRow + ',' + p.sourceCol + ')<br>' +
        (gr ? 'Προορισμός (c,d)' : 'Destination (c,d)') + ' = (' + p.destRow + ',' + p.destCol + ')<br>' +
        (gr ? 'Κόμβος' : 'Node') + ' (' + knCTag('c') + ',' + knBTag('b') + ') = (' + knCTag(p.destRow) + ',' + knBTag(p.sourceCol) + ') &rArr; ISM: ' + knQuadChip(p.quad) + '<br>' +
        'Virtual source: (' + p.vsRow + ',' + p.vsCol + ')<br>' +
        'Virtual destination: (' + p.vdRow + ',' + p.vdCol + ')';
}

/* Γενικός renderer διμερούς γραφήματος */
function knDrawBipartite(container, nodesLeft, nodesRight, edges, caption) {
    container.innerHTML = '';
    const ns = 'http://www.w3.org/2000/svg';
    const count = Math.max(nodesLeft.length, nodesRight.length);
    const spacing = Math.max(20, Math.min(34, 440 / count));
    const height = count * spacing + 40;
    const width = 300;
    const leftX = 80, rightX = width - 80;

    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    svg.classList.add('routing-graph-svg');

    function yOf(i) { return 20 + i * spacing + spacing / 2; }

    /* curve offsets για παράλληλες ακμές */
    const groups = {};
    edges.forEach(function (e) {
        const key = e.li + '-' + e.ri;
        (groups[key] = groups[key] || []).push(e);
    });
    Object.values(groups).forEach(function (g) {
        g.forEach(function (e, idx) { e._curve = (idx - (g.length - 1) / 2) * 18; });
    });

    edges.forEach(function (e) {
        const y1 = yOf(e.li), y2 = yOf(e.ri);
        const midX = (leftX + rightX) / 2;
        const midY = (y1 + y2) / 2 + e._curve;
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('d', 'M ' + leftX + ' ' + y1 + ' Q ' + midX + ' ' + midY + ' ' + rightX + ' ' + y2);
        path.setAttribute('fill', 'none');
        path.classList.add('rg-edge');
        if (e.stroke) { path.style.stroke = e.stroke; path.style.strokeWidth = e.width || 2; }
        else path.classList.add('uncolored');
        if (e.dash) { path.style.strokeDasharray = '5,4'; path.style.opacity = '0.55'; }
        if (e.packetId != null) path.dataset.packetId = e.packetId;
        if (e.title) {
            const t = document.createElementNS(ns, 'title');
            t.textContent = e.title;
            path.appendChild(t);
        }
        svg.appendChild(path);
    });

    nodesLeft.forEach(function (nd, i) {
        const y = yOf(i);
        const c = document.createElementNS(ns, 'circle');
        c.setAttribute('cx', leftX); c.setAttribute('cy', y); c.setAttribute('r', 6);
        c.setAttribute('fill', '#c0392b'); c.classList.add('rg-node');
        svg.appendChild(c);
        const l = document.createElementNS(ns, 'text');
        l.setAttribute('x', leftX - 12); l.setAttribute('y', y + 4);
        l.setAttribute('text-anchor', 'end'); l.classList.add('rg-node-label');
        l.textContent = nd.label;
        svg.appendChild(l);
    });
    nodesRight.forEach(function (nd, i) {
        const y = yOf(i);
        const c = document.createElementNS(ns, 'circle');
        c.setAttribute('cx', rightX); c.setAttribute('cy', y); c.setAttribute('r', 6);
        c.setAttribute('fill', '#2255c0'); c.classList.add('rg-node');
        svg.appendChild(c);
        const l = document.createElementNS(ns, 'text');
        l.setAttribute('x', rightX + 12); l.setAttribute('y', y + 4);
        l.classList.add('rg-node-label');
        l.textContent = nd.label;
        svg.appendChild(l);
    });

    container.appendChild(svg);
    if (caption) {
        const cap = document.createElement('div');
        cap.style.fontSize = '11.5px'; cap.style.color = '#888';
        cap.style.marginTop = '4px'; cap.style.textAlign = 'center';
        cap.innerHTML = caption;
        container.appendChild(cap);
    }
}

/* hover */
function knAttachLinkHighlighting(scopeEl) {
    if (scopeEl._knLinkAttached) return;
    scopeEl._knLinkAttached = true;
    function clear() {
        scopeEl.querySelectorAll('.rg-edge').forEach(function (e) { e.classList.remove('highlighted', 'faded'); });
        scopeEl.querySelectorAll('.packet-badge').forEach(function (b) { b.style.opacity = ''; b.style.outline = ''; });
    }
    scopeEl.addEventListener('mouseover', function (ev) {
        const target = ev.target.closest('[data-packet-id]');
        if (!target) return;
        const pid = target.dataset.packetId;
        scopeEl.querySelectorAll('.rg-edge').forEach(function (e) {
            const has = !!e.dataset.packetId;
            const match = e.dataset.packetId === pid;
            e.classList.toggle('highlighted', match);
            e.classList.toggle('faded', has && !match);
        });
        scopeEl.querySelectorAll('.packet-badge').forEach(function (b) {
            const match = b.dataset.packetId === pid;
            b.style.opacity = match ? '1' : '0.3';
            b.style.outline = match ? '2px solid #333' : '';
        });
    });
    scopeEl.addEventListener('mouseout', function (ev) {
        if (!ev.target.closest('[data-packet-id]')) return;
        clear();
    });
}

/* ── Περιγραφή τρέχουσας υπο-φάσης κατά τη δρομολόγηση της Φάσης 2 */
function knSubphaseIndex(t, boundaries) {
    for (let s = 0; s < 3; s++) if (t <= boundaries[s + 1]) return s;
    return 2;
}
function knSubphaseHoverExtra(p, t, boundaries) {
    if (t <= 0 || t >= boundaries[3]) return '';
    const s = knSubphaseIndex(t, boundaries);
    const axes = p.permGroup === 1 ? ['col', 'row', 'col'] : ['row', 'col', 'row'];
    const axis = axes[s];
    const gr = isGrLang();
    const axisTxt = axis === 'col' ? (gr ? 'στήλη' : 'column') : (gr ? 'γραμμή' : 'row');
    return '<br>' + (gr ? 'Υπο-φάση ' : 'Sub-phase ') + (s + 1) + '/3 (' + (gr ? 'κίνηση σε ' : 'moving along ') + axisTxt + ')';
}

/* ──*/
function knSchemeAxes(permIdx) { return permIdx === 1 ? ['col', 'row', 'col'] : ['row', 'col', 'row']; }
function knSchemeHtml(permIdx, s) {
    const gr = isGrLang();
    const wordFor = function (axis) { return axis === 'col' ? (gr ? 'στήλη' : 'column') : (gr ? 'γραμμή' : 'row'); };
    return knSchemeAxes(permIdx).map(function (ax, i) {
        const w = wordFor(ax);
        return (i === s) ? ('<strong><u>' + w + '</u></strong>') : w;
    }).join(' &rarr; ');
}


function knSoloStepsLine(t, boundaries, theoreticalBound) {
    const b1 = boundaries[1], b2 = boundaries[2], b3 = boundaries[3];
    const X = Math.min(t, b1);
    const Y = Math.max(0, Math.min(t, b2) - b1);
    const Z = Math.max(0, t - b2);
    const gr = isGrLang();
    let html = (gr ? 'Βήματα = ' : 'Steps = ');
    if (t <= b1) html += X;
    else if (t <= b2) html += X + ' + ' + Y;
    else html += X + ' + ' + Y + ' + ' + Z;
    if (t >= b3) {
        html += ' = ' + b3 + ' (' + (gr ? 'θεωρητικό μέγιστο όριο' : 'theoretical max bound') + ': 3&middot;n/2 = ' + theoreticalBound + ')';
    }
    return html;
}

/* Main */
function krizancNarayananAlgorithm() {
    const n = parseInt(document.getElementById('sideN').value);
    if (isNaN(n) || n < 2) { alert('Please enter a valid grid size.'); return; }
    if (n % 2 !== 0) {
        alert(isGrLang()
            ? 'Ο αλγόριθμος Krizanc-Narayanan απαιτεί άρτιο √N (το πλέγμα χωρίζεται σε 4 τεταρτημόρια n/2 × n/2).'
            : 'The Krizanc-Narayanan algorithm requires an even √N (the mesh is split into 4 quadrants of side n/2).');
        return;
    }
    const half = n / 2;

    /* ── Διάβασμα πλέγματος ── */
    const packets = [];
    let idCounter = 0;
    for (let r = 1; r <= n; r++) {
        for (let c = 1; c <= n; c++) {
            const input = document.querySelector('#tableContainer input[data-row="' + (r - 1) + '"][data-col="' + (c - 1) + '"]');
            const v = input.value.trim();
            if (v === '') { alert('Cell (' + r + ',' + c + ') is empty. Please fill all cells.'); return; }
            const parts = v.split(',').map(Number);
            packets.push({ id: idCounter++, sourceRow: r, sourceCol: c, destRow: parts[0], destCol: parts[1] });
        }
    }

    packets.forEach(function (p) {
        p.quad = knQuadIndex(p.destRow, p.sourceCol, half);
        const rowOffset = p.destRow <= half ? 0 : half;
        const colOffset = p.sourceCol <= half ? 0 : half;
        p.vsRow = ((p.sourceRow - 1) % half) + rowOffset + 1;
        p.vsCol = p.sourceCol;
        p.vdRow = p.destRow;
        p.vdCol = ((p.destCol - 1) % half) + colOffset + 1;
    });

    /* Offline υπολογισμός Φάσης 2: Hall δύο φορές */
    const quadInfo = [];
    for (let qi = 0; qi < 4; qi++) {
        const qRow0 = qi >= 2 ? half : 0;   /* offset γραμμών του τεταρτημορίου */
        const qCol0 = (qi % 2) ? half : 0;  /* offset στηλών */
        const qPackets = packets.filter(function (p) { return p.quad === qi; });

        const toLocalIdx = function (r, c) { return (r - 1 - qRow0) * half + (c - 1 - qCol0); };
        const realEdges = qPackets.map(function (p) {
            return { packet: p, u: toLocalIdx(p.vsRow, p.vsCol), v: toLocalIdx(p.vdRow, p.vdCol) };
        });

        /* Hall #1 */
        const split = knSplitIntoTwoPermutations(realEdges, half);
        split.edges.forEach(function (e) { if (e.packet) e.packet.permGroup = e.perm; });

        /* Hall #2 */
        const midOf = [{}, {}];  /* midOf[g][u] = ενδιάμεση γραμμή (g=0) / στήλη (g=1), 0-based τοπικά */
        const rgEdgesOf = [null, null]; /* κρατάμε τις ακμές για το γράφημα του Βήματος 3 */
        for (let g = 0; g < 2; g++) {
            const perm = split.permOfCell[g];
            const rgEdges = [];
            for (let u = 0; u < half * half; u++) {
                const v = perm[u];
                rgEdges.push(g === 0
                    ? { left: u % half, right: v % half, u: u }               /* στήλες */
                    : { left: Math.floor(u / half), right: Math.floor(v / half), u: u }); /* γραμμές */
            }
            knDecomposeRegular(rgEdges, half);
            rgEdges.forEach(function (e) { midOf[g][e.u] = e.hallColor - 1; });
            rgEdgesOf[g] = rgEdges;
        }

        /* Ενδιάμεση γραμμή/στήλη πάνω στα πακέτα (για τα tooltips), και
           χάρτης τοπικό-κελί -> πραγματικό πακέτο (για να ξεχωρίζουμε
           πραγματικές από dummy ακμές στα routing graphs Α/Β) */
        const cellPacket = [{}, {}];
        qPackets.forEach(function (p) {
            const u = toLocalIdx(p.vsRow, p.vsCol);
            const g = p.permGroup - 1;
            cellPacket[g][u] = p;
            if (g === 0) p.midRow = midOf[0][u] + 1 + qRow0;
            else p.midCol = midOf[1][u] + 1 + qCol0;
        });

        quadInfo.push({ qi: qi, key: KN_QUADS[qi].key, qRow0: qRow0, qCol0: qCol0, packets: qPackets, split: split, midOf: midOf, rgEdgesOf: rgEdgesOf, cellPacket: cellPacket });
    }

    /* ── Προσομοίωση Φάσης 2 */
    quadInfo.forEach(function (Q) {
        Q.gSegs = [[], []];          
        Q.gPackets = [null, null];
        for (let g = 0; g < 2; g++) {
            const groupPk = Q.packets.filter(function (p) { return p.permGroup === g + 1; });
            Q.gPackets[g] = groupPk;
            const cur = {};
            groupPk.forEach(function (p) { cur[p.id] = { r: p.vsRow, c: p.vsCol }; });
            for (let s = 0; s < 3; s++) {
                const axisCols = (g === 0) ? (s !== 1) : (s === 1);  /* Α: col,row,col / Β: row,col,row */
                const lineRuns = [];
                const byLine = {};
                groupPk.forEach(function (p) {
                    const u = (p.vsRow - 1 - Q.qRow0) * half + (p.vsCol - 1 - Q.qCol0);
                    const vd = { lr: p.vdRow - 1 - Q.qRow0, lc: p.vdCol - 1 - Q.qCol0 };
                    const mid = Q.midOf[g][u];
                    const curL = { lr: cur[p.id].r - 1 - Q.qRow0, lc: cur[p.id].c - 1 - Q.qCol0 };
                    let lineKey, curPos, destPos;
                    if (axisCols) {  /* κίνηση μέσα σε στήλη */
                        lineKey = 'c' + curL.lc;
                        curPos = curL.lr;
                        destPos = (g === 0) ? (s === 0 ? mid : vd.lr) : vd.lr;
                    } else {         /* κίνηση μέσα σε γραμμή */
                        lineKey = 'r' + curL.lr;
                        curPos = curL.lc;
                        destPos = (g === 0) ? vd.lc : (s === 0 ? mid : vd.lc);
                    }
                    (byLine[lineKey] = byLine[lineKey] || []).push({ id: p.id, cur: curPos, dest: destPos });
                });
                Object.keys(byLine).forEach(function (key) {
                    const res = knOddEvenLine(byLine[key], half);
                    lineRuns.push({ res: res, items: byLine[key] });
                });

                const subLen = lineRuns.reduce(function (mx, lr) { return Math.max(mx, lr.res.steps); }, 0);
                const seg = { len: subLen, pos: {} };
                groupPk.forEach(function (p) { seg.pos[p.id] = []; });
                for (let t = 1; t <= subLen; t++) {
                    lineRuns.forEach(function (lr) {
                        lr.items.forEach(function (it) {
                            const arr = lr.res.traj[it.id];
                            const pos = arr[Math.min(t, arr.length - 1)];
                            if (axisCols) cur[it.id] = { r: pos + 1 + Q.qRow0, c: cur[it.id].c };
                            else cur[it.id] = { r: cur[it.id].r, c: pos + 1 + Q.qCol0 };
                        });
                    });
                    groupPk.forEach(function (p) { seg.pos[p.id].push({ r: cur[p.id].r, c: cur[p.id].c }); });
                }
                Q.gSegs[g].push(seg);
            }
        }

        /* Ανεξάρτητα timelines ανά μετάθεση (για τις προβολές "Μετάθεση Α/Β") */
        Q.gSubLens = [0, 1].map(function (g) { return Q.gSegs[g].map(function (s) { return s.len; }); });
        Q.gS2 = [0, 1].map(function (g) { return Q.gSubLens[g][0] + Q.gSubLens[g][1] + Q.gSubLens[g][2]; });
        Q.gSubBoundaries = [0, 1].map(function (g) {
            return [0, Q.gSubLens[g][0], Q.gSubLens[g][0] + Q.gSubLens[g][1], Q.gS2[g]];
        });
        Q.gTraj = [0, 1].map(function (g) {
            const traj = {};
            Q.gPackets[g].forEach(function (p) { traj[p.id] = [{ r: p.vsRow, c: p.vsCol }]; });
            Q.gSegs[g].forEach(function (seg) {
                for (let t = 0; t < seg.len; t++) {
                    Q.gPackets[g].forEach(function (p) { traj[p.id].push(seg.pos[p.id][t]); });
                }
            });
            return traj;
        });

        /* Α + Β ταυτόχρονα */
        Q.segs = [0, 1, 2].map(function (s) {
            const combLen = Math.max(Q.gSegs[0][s].len, Q.gSegs[1][s].len);
            return { len: combLen, pos: {} };
        });
        const lastPos = {};
        Q.packets.forEach(function (p) { lastPos[p.id] = { r: p.vsRow, c: p.vsCol }; });
        for (let s = 0; s < 3; s++) {
            const comb = Q.segs[s];
            Q.packets.forEach(function (p) { comb.pos[p.id] = []; });
            for (let t = 1; t <= comb.len; t++) {
                Q.packets.forEach(function (p) {
                    const arr = Q.gSegs[p.permGroup - 1][s].pos[p.id];
                    const pos = (arr && arr.length > 0) ? arr[Math.min(t, arr.length) - 1] : lastPos[p.id];
                    lastPos[p.id] = pos;
                    comb.pos[p.id].push({ r: pos.r, c: pos.c });
                });
            }
        }
        Q.qSubLens = Q.segs.map(function (s) { return s.len; });
        Q.qS2 = Q.qSubLens[0] + Q.qSubLens[1] + Q.qSubLens[2];
        Q.qSubBoundaries = [0, Q.qSubLens[0], Q.qSubLens[0] + Q.qSubLens[1], Q.qS2];

        /* Συνδυασμένο timeline του sub-mesh (για την προβολή "Οι δύο μαζί") */
        Q.qTraj = {};
        Q.packets.forEach(function (p) { Q.qTraj[p.id] = [{ r: p.vsRow, c: p.vsCol }]; });
        Q.segs.forEach(function (seg) {
            for (let t = 0; t < seg.len; t++) {
                Q.packets.forEach(function (p) { Q.qTraj[p.id].push(seg.pos[p.id][t]); });
            }
        });
    });

    /* Ευθυγραμμισμένο ολικό timeline Φάσης 2 (για την "Προβολή όλων") */
    const globalSubLens = [0, 1, 2].map(function (s) {
        return quadInfo.reduce(function (mx, Q) { return Math.max(mx, Q.segs[s].len); }, 0);
    });
    const S2 = globalSubLens[0] + globalSubLens[1] + globalSubLens[2];
    const globalSubBoundaries = [0, globalSubLens[0], globalSubLens[0] + globalSubLens[1], S2];
    const traj2 = {};
    packets.forEach(function (p) { traj2[p.id] = [{ r: p.vsRow, c: p.vsCol }]; });
    for (let s = 0; s < 3; s++) {
        for (let t = 1; t <= globalSubLens[s]; t++) {
            packets.forEach(function (p) {
                const seg = quadInfo[p.quad].segs[s];
                const arr = seg.pos[p.id];
                const pos = (arr && arr.length > 0)
                    ? arr[Math.min(t, arr.length) - 1]
                    : traj2[p.id][traj2[p.id].length - 1];
                traj2[p.id].push({ r: pos.r, c: pos.c });
            });
        }
    }

    /* ── Επαλήθευση (offline) ── */
    packets.forEach(function (p) {
        const last = traj2[p.id][traj2[p.id].length - 1];
        if (last.r !== p.vdRow || last.c !== p.vdCol) console.error('KN phase-2 verification failed', p, last);
        if (p.vdRow !== p.destRow) console.error('KN vd row mismatch', p);
    });

    
    
    /* ════════════════════════ UI ════════════════════════ */
    document.getElementById('tableContainer').innerHTML = '';
    const container = document.getElementById('phaseContainer');
    container.innerHTML = '';

    const subNav = document.createElement('div');
    subNav.className = 'wizard-tabs';
    subNav.style.marginBottom = '18px';
    const subTabsGr = ['Βήμα 1 · Intermediate Sub-Mesh', 'Βήμα 2 · Virtual Source', 'Βήμα 3 · Hall & 2 Μεταθέσεις', 'Βήμα 4 · Τελικός Προορισμός'];
    const subTabsEn = ['Step 1 · Intermediate Sub-Mesh', 'Step 2 · Virtual Source', 'Step 3 · Hall & 2 Permutations', 'Step 4 · Final Destination'];
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

    const renderers = [];
    subTabEls.forEach(function (tab, i) {
        tab.addEventListener('click', function () {
            if (tab.classList.contains('disabled')) return;
            renderers[i]();
        });
    });

    const hoverFn = function (p) { return knHoverBasic(p); };
    const hoverWithPerm = function (p) {
        const gr = isGrLang();
        let html = hoverFn(p) + '<br>' + (gr ? 'Ομάδα: ' : 'Group: ') + knPermChip(p.permGroup) +
            '<br>' + (gr ? 'Διαδρομή: ' : 'Route: ') + (p.permGroup === 1 ? 'col &rarr; row &rarr; col' : 'row &rarr; col &rarr; row');
        if (p.permGroup === 1) html += '<br>' + (gr ? 'Ενδιάμεση γραμμή: ' : 'Intermediate row: ') + p.midRow;
        else html += '<br>' + (gr ? 'Ενδιάμεση στήλη: ' : 'Intermediate column: ') + p.midCol;
        return html;
    };
    const makeHoverWithPerm = function (t, boundaries) {
        return function (p) { return hoverWithPerm(p) + knSubphaseHoverExtra(p, t, boundaries); };
    };
    const permStyle = function (p, badge) {
        const g = KN_PERM[p.permGroup - 1];
        badge.style.borderStyle = g.dash ? 'dashed' : 'solid';
        badge.style.borderWidth = '2px';
        badge.style.boxShadow = '0 0 0 1px ' + g.color;
    };

    /* Βοηθητικό: layout δύο στηλών με τίτλους */
    function makeTwoCols(parent, titleGrL, titleEnL, titleGrR, titleEnR) {
        const layout = document.createElement('div');
        layout.style.display = 'flex';
        layout.style.gap = '28px';
        layout.style.flexWrap = 'wrap';
        layout.style.alignItems = 'flex-start';
        parent.appendChild(layout);
        function col(titleGr, titleEn) {
            const div = document.createElement('div');
            const h = document.createElement('div');
            h.style.fontWeight = '700';
            h.style.marginBottom = '6px';
            h.innerHTML = '<span lang="en">' + titleEn + '</span><span lang="gr">' + titleGr + '</span>';
            div.appendChild(h);
            const grid = document.createElement('div');
            div.appendChild(grid);
            layout.appendChild(div);
            return { wrap: div, grid: grid };
        }
        return { left: col(titleGrL, titleEnL), right: col(titleGrR, titleEnR), layout: layout };
    }

    /* Βοηθητικό: prev/next stepper (μόνο για το Βήμα 3) */
    function makeStepper(gridHolder, counterHolder, drawFn, maxSteps, boundHtml, onDone) {
        let currentStep = 0;
        const row = document.createElement('div');
        row.style.display = 'flex'; row.style.gap = '8px'; row.style.marginTop = '10px';
        const prevBtn = document.createElement('button');
        prevBtn.className = 'btn-secondary'; prevBtn.disabled = true;
        prevBtn.innerHTML = '<span lang="en">&larr; Previous step</span><span lang="gr">&larr; Προηγούμενο βήμα</span>';
        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn-secondary';
        nextBtn.innerHTML = '<span lang="en">Next step</span><span lang="gr">Επόμενο βήμα</span>';
        const allBtn = document.createElement('button');
        allBtn.className = 'btn-pale';
        allBtn.innerHTML = '<span lang="en">Run to the end</span><span lang="gr">Εκτέλεση μέχρι το τέλος</span>';
        row.appendChild(prevBtn); row.appendChild(nextBtn); row.appendChild(allBtn);

        let doneFired = false;
        function refresh() {
            prevBtn.disabled = currentStep <= 0;
            nextBtn.disabled = currentStep >= maxSteps;
            allBtn.disabled = currentStep >= maxSteps;
            counterHolder.innerHTML = (isGrLang() ? 'Βήματα = ' : 'Steps = ') + currentStep + (boundHtml || '');
        }
        function goTo(t) {
            currentStep = Math.max(0, Math.min(maxSteps, t));
            drawFn(currentStep);
            gridHolder.appendChild(row);
            refresh();
            if (currentStep >= maxSteps && !doneFired) { doneFired = true; if (onDone) onDone(); }
        }
        prevBtn.addEventListener('click', function () { goTo(currentStep - 1); });
        nextBtn.addEventListener('click', function () { goTo(currentStep + 1); });
        allBtn.addEventListener('click', function () { goTo(maxSteps); });
        goTo(0);
        if (maxSteps === 0 && !doneFired) { doneFired = true; if (onDone) onDone(); }
    }

    /* Δρομολόγηση με stepper πάνω σε συγκεκριμένο timeline.
       mode: 'solo' (permIdx=1|2, δικό της timeline, γραμμή "Χ+Υ+Ζ"),
             'combo' (sub-mesh, Α+Β μαζί), 'global' (όλο το πλέγμα, Α+Β μαζί)
       gridOpts: πρόσθετα options για το knDrawGrid (π.χ. rowStart/rowEnd
       για την προβολή ενός sub-mesh· {} για ολόκληρο το πλέγμα). */
    function makeRoutingSection(parent, pkts, traj, totalSteps, boundaries, mode, permIdx, gridOpts) {
        gridOpts = gridOpts || {};
        const titleLine = document.createElement('div');
        titleLine.style.fontWeight = '700';
        parent.appendChild(titleLine);
        if (mode === 'solo') {
            titleLine.innerHTML = '<span lang="en">Routing of Permutation ' + (permIdx === 1 ? 'A' : 'B') + '</span><span lang="gr">Δρομολόγηση Μετάθεσης ' + (permIdx === 1 ? 'Α' : 'Β') + '</span>';
        } else if (mode === 'global') {
            titleLine.innerHTML = '<span lang="en">Phase 3 &mdash; Routing of the whole mesh</span><span lang="gr">Φάση 3 &mdash; Δρομολόγηση ολόκληρου του πλέγματος</span>';
        } else {
            titleLine.innerHTML = '<span lang="en">Routing of this sub-mesh</span><span lang="gr">Δρομολόγηση αυτού του sub-mesh</span>';
        }

        const schemeLine = document.createElement('div');
        schemeLine.style.margin = '4px 0 8px 0';
        parent.appendChild(schemeLine);

        const stepsLine = document.createElement('div');
        stepsLine.style.fontWeight = '700';
        stepsLine.style.margin = '6px 0';
        parent.appendChild(stepsLine);

        const routeGrid = document.createElement('div');
        parent.appendChild(routeGrid);

        function updateHeaders(t) {
            const s = knSubphaseIndex(t, boundaries);
            if (mode === 'solo') {
                schemeLine.innerHTML = '(' + knSchemeHtml(permIdx, s) + ')';
                stepsLine.innerHTML = knSoloStepsLine(t, boundaries, 3 * half);
            } else {
                const gr = isGrLang();
                schemeLine.innerHTML =
                    knPermChip(1) + ' = ' + knSchemeHtml(1, s) + ' <span style="color:#888;">(' + (gr ? 'πακέτα με συνεχές περίγραμμα' : 'packets with solid border') + ')</span><br>' +
                    knPermChip(2) + ' = ' + knSchemeHtml(2, s) + ' <span style="color:#888;">(' + (gr ? 'πακέτα με διακεκομμένο περίγραμμα' : 'packets with dashed border') + ')</span>';
                stepsLine.innerHTML = (gr ? 'Βήματα = ' : 'Steps = ') + t +
                    (gr ? ' (όριο: 3&middot;n/2 = ' + (3 * half) + ')' : ' (bound: 3&middot;n/2 = ' + (3 * half) + ')');
            }
        }

        /* κρυφός δέκτης του default μετρητή του makeStepper — δεν τον
           δείχνουμε, αφού τη γραμμή "Βήματα" τη διαχειριζόμαστε εμείς
           μέσα στο updateHeaders */
        const hiddenCounter = document.createElement('div');
        hiddenCounter.style.display = 'none';

        function drawAt(t) {
            updateHeaders(t);
            knDrawGrid(routeGrid, knPositionsAt(pkts, traj, t), n, half,
                Object.assign({ onHover: makeHoverWithPerm(t, boundaries), getStyle: permStyle,
                    getDirection: function (p) {
                        const arr = traj[p.id];
                        if (t >= arr.length - 1) return null;
                        const cur = arr[t], nxt = arr[t + 1];
                        if (nxt.r > cur.r) return { arrow: '\u2193' };
                        if (nxt.r < cur.r) return { arrow: '\u2191' };
                        if (nxt.c > cur.c) return { arrow: '\u2192' };
                        if (nxt.c < cur.c) return { arrow: '\u2190' };
                        return null;
                    } }, gridOpts));
        }
        makeStepper(routeGrid, hiddenCounter, drawAt, totalSteps, '', null);
    }

    /* ════════════════════════ ΒΗΜΑ 1 : ISM ════════════════════════ */
    function renderStep1() {
        activateSubTab(0);
        stepBody.innerHTML = '';

        const bigIdea = document.createElement('div');
        bigIdea.className = 'substep-explain';
        bigIdea.innerHTML =
            '<span lang="en"><strong>Basic idea:</strong> on a two-dimensional &radic;N &times; &radic;N mesh of processors, we can route a permutation in 2.5&radic;N steps in such a way that never more than 2 packets end up on the same processor. To achieve this, we send every packet to a temporary sub-mesh of size &radic;N/2 &times; &radic;N/2, inside which we run 2 odd-even transposition permutations in parallel, bringing every packet to within &radic;N/2 steps of its final destination.</span>' +
            '<span lang="gr"><strong>Βασική Ιδέα:</strong> Σε ένα διδιάστατο &radic;N x &radic;N πλέγμα επεξεργαστών μπορούμε να δρομολογήσουμε μια μετάθεση σε 2.5&radic;N βήματα με τέτοιο τρόπο ώστε ποτέ περισσότερα από 2 πακέτα να μη βρεθούν στον ίδιο επεξεργαστή. Για να το επιτύχουμε αυτό, στέλνουμε κάθε πακέτο σε ένα προσωρινό υπό-πλέγμα μεγέθους &radic;N/2 x &radic;N/2, μέσα στο οποίο εκτελούμε 2 μεταθέσεις τύπου odd-even transposition παράλληλα, φέρνοντας έτσι το κάθε πακέτο σε απόσταση &radic;N/2 βημάτων από τον τελικό του προορισμό.</span>';
        stepBody.appendChild(bigIdea);

        const explain = document.createElement('div');
        explain.className = 'substep-explain';
        explain.innerHTML =
            '<span lang="en"><strong>Goal of Phase 1:</strong> we split the &radic;N &times; &radic;N mesh into 4 sub-meshes of side n/2 = ' + half + ', colored ' +
            knQuadChip(0) + ' (top-left), ' + knQuadChip(1) + ' (top-right), ' + knQuadChip(2) + ' (bottom-left) and ' + knQuadChip(3) + ' (bottom-right), and find the <strong>Intermediate Sub-Mesh (ISM)</strong> of every packet.</span>' +
            '<span lang="gr"><strong>Στόχος της Φάσης 1:</strong> χωρίζουμε το πλέγμα &radic;N &times; &radic;N σε 4 sub-mesh με πλευρά n/2 = ' + half + ', τα οποία χρωματίζουμε ' +
            knQuadChip(0) + ' (πάνω-αριστερά), ' + knQuadChip(1) + ' (πάνω-δεξιά), ' + knQuadChip(2) + ' (κάτω-αριστερά) και ' + knQuadChip(3) + ' (κάτω-δεξιά), και βρίσκουμε το <strong>Intermediate Sub-Mesh (ISM)</strong> κάθε πακέτου.</span>';
        stepBody.appendChild(explain);

        const deepBox = document.createElement('div');
        deepBox.className = 'substep-explain deep';
        deepBox.innerHTML =
            '<span lang="en"><strong>Definition:</strong> for a packet at position (a,b) with destination (c,d), its ISM is the unique sub-mesh that contains the node <strong>(c,b)</strong> &mdash; the row zone of its destination combined with the column zone of its source. Its <strong>virtual source</strong> is the position corresponding to (a,b) inside the ISM (same column b), and its <strong>virtual destination</strong> is the position corresponding to (c,d) inside the ISM (same row c).</span>' +
            '<span lang="gr"><strong>Ορισμός:</strong> για πακέτο στη θέση (a,b) με προορισμό (c,d), ISM του είναι το μοναδικό sub-mesh που περιέχει τον κόμβο <strong>(c,b)</strong> &mdash; η ζώνη γραμμών του προορισμού του σε συνδυασμό με τη ζώνη στηλών της πηγής του. <strong>Virtual source</strong> του είναι η θέση που αντιστοιχεί στην (a,b) μέσα στο ISM (ίδια στήλη b) και <strong>virtual destination</strong> η θέση που αντιστοιχεί στην (c,d) μέσα στο ISM (ίδια γραμμή c).</span>';
        stepBody.appendChild(deepBox);

        const cols = makeTwoCols(stepBody, 'Αρχικό Πλέγμα', 'Initial grid', 'Τα 4 sub-mesh', 'The 4 sub-meshes');

        const positions0 = {};
        packets.forEach(function (p) { positions0[p.sourceRow + ',' + p.sourceCol] = [p]; });

        /* Αριστερά: αρχικό πλέγμα, εντελώς αχρωμάτιστο */
        knDrawGrid(cols.left.grid, positions0, n, half, { plain: true });

        /* Δεξιά: χρωματισμένα τεταρτημόρια, αρχικά χωρίς πακέτα */
        knDrawGrid(cols.right.grid, {}, n, half, { tint: true });

        const btnRow = document.createElement('div');
        btnRow.style.marginTop = '14px';
        const computeBtn = document.createElement('button');
        computeBtn.className = 'btn-primary';
        computeBtn.innerHTML = '<span lang="en">Compute intermediate sub-meshes</span><span lang="gr">Υπολογισμός intermediate sub-mesh</span>';
        btnRow.appendChild(computeBtn);
        const continueBtn = document.createElement('button');
        continueBtn.className = 'btn-primary';
        continueBtn.style.marginLeft = '10px';
        continueBtn.disabled = true;
        continueBtn.innerHTML = '<span lang="en">Continue to Step 2 &rarr;</span><span lang="gr">Συνέχεια στο Βήμα 2 &rarr;</span>';
        btnRow.appendChild(continueBtn);
        stepBody.appendChild(btnRow);

        computeBtn.addEventListener('click', function () {
            /* Τα πακέτα εμφανίζονται στο 2ο grid χρωματισμένα κατά ISM,
               με το tooltip του (c,b). Το αρχικό μένει όπως ήταν. */
            knDrawGrid(cols.right.grid, positions0, n, half, { tint: true, onHover: hoverFn });
            cols.right.wrap.querySelector('div').innerHTML =
                '<span lang="en">The 4 sub-meshes &amp; each packet colored by its ISM (hover for details)</span>' +
                '<span lang="gr">Τα 4 sub-mesh &amp; κάθε πακέτο χρωματισμένο κατά το ISM του (hover για λεπτομέρειες)</span>';
            computeBtn.style.display = 'none';
            continueBtn.disabled = false;
        });

        continueBtn.addEventListener('click', function () {
            markSubTabDone(0);
            renderStep2();
        });
    }

    /* ════════════════════════ ΒΗΜΑ 2 : προς Virtual Source ════════════════════════ */
    function renderStep2() {
        activateSubTab(1);
        stepBody.innerHTML = '';

        const explain = document.createElement('div');
        explain.className = 'substep-explain';
        explain.innerHTML =
            '<span lang="en"><strong>Goal of Phase 2:</strong> every packet moves <strong>only inside its column</strong>, either 0 steps (it is already inside its ISM) or exactly n/2 = ' + half + ' steps up or down, to reach its <strong>virtual source</strong>. The arrow on each packet shows its direction. At the end of the phase every cell holds 0, 1 or 2 packets: the only packets that can end up on a processor are the one that started there and the one that started n/2 cells away in the same column.</span>' +
            '<span lang="gr"><strong>Στόχος της Φάσης 2:</strong> κάθε πακέτο κινείται <strong>μόνο μέσα στη στήλη του</strong>, είτε 0 βήματα (αν είναι ήδη στο ISM του) είτε ακριβώς n/2 = ' + half + ' βήματα πάνω ή κάτω, ώστε να φτάσει στη <strong>virtual source</strong> του. Το βελάκι σε κάθε πακέτο δείχνει την κατεύθυνσή του. Στο τέλος της φάσης κάθε κελί έχει 0, 1 ή 2 πακέτα: τα μόνα πακέτα που μπορούν να καταλήξουν σε έναν επεξεργαστή είναι αυτό που ξεκίνησε εκεί και αυτό που ξεκίνησε n/2 κελιά μακριά στην ίδια στήλη.</span>';
        stepBody.appendChild(explain);

        const cols = makeTwoCols(stepBody, 'Αρχικό Πλέγμα', 'Initial grid', 'Πλέγμα μετά τη Φάση 2', 'Grid after Phase 2');
        cols.right.wrap.style.display = 'none';

        const startPositions = {};
        packets.forEach(function (p) { startPositions[p.sourceRow + ',' + p.sourceCol] = [p]; });
        knDrawGrid(cols.left.grid, startPositions, n, half, {
            tint: true, onHover: hoverFn,
            getDirection: function (p) {
                if (p.vsRow === p.sourceRow) return null;
                return { arrow: p.vsRow > p.sourceRow ? '\u2193' : '\u2191' };
            }
        });

        const stepsLine = document.createElement('div');
        stepsLine.style.fontWeight = '700';
        stepsLine.style.margin = '12px 0';
        stepBody.appendChild(stepsLine);

        const btnRow = document.createElement('div');
        const moveBtn = document.createElement('button');
        moveBtn.className = 'btn-primary';
        moveBtn.innerHTML = '<span lang="en">Move to virtual source</span><span lang="gr">Μετακίνηση στο virtual source</span>';
        btnRow.appendChild(moveBtn);
        const continueBtn = document.createElement('button');
        continueBtn.className = 'btn-primary';
        continueBtn.style.marginLeft = '10px';
        continueBtn.disabled = true;
        continueBtn.innerHTML = '<span lang="en">Continue to Step 3 &rarr;</span><span lang="gr">Συνέχεια στο Βήμα 3 &rarr;</span>';
        btnRow.appendChild(continueBtn);
        stepBody.appendChild(btnRow);

        moveBtn.addEventListener('click', function () {
            const vsPositions = {};
            packets.forEach(function (p) {
                const key = p.vsRow + ',' + p.vsCol;
                (vsPositions[key] = vsPositions[key] || []).push(p);
            });
            cols.right.wrap.style.display = 'block';
            knDrawGrid(cols.right.grid, vsPositions, n, half, { tint: true, onHover: hoverFn });
            stepsLine.innerHTML = '<span lang="en">Steps = n/2 = ' + half + '</span><span lang="gr">Βήματα = n/2 = ' + half + '</span>';
            moveBtn.style.display = 'none';
            continueBtn.disabled = false;
        });

        continueBtn.addEventListener('click', function () {
            markSubTabDone(1);
            renderStep3();
        });
    }

    /* ════════════════════════ ΒΗΜΑ 3 : Hall & 2 μεταθέσεις ════════════════════════ */
    /* Μόνιμη γραμμή πλοήγησης του Βήματος 3: ένα κουμπί ανά sub-mesh +
       "Προβολή όλων" + "Συνέχεια στο Βήμα 4", πάντα ορατή πάνω από τα
       grid/γραφήματα σε ΚΑΘΕ υπο-προβολή (καμία ανάγκη για κουμπί "πίσω"). */
    function buildStep3NavRow(activeKey) {
        const btnRow = document.createElement('div');
        btnRow.style.marginBottom = '16px';
        btnRow.style.display = 'flex';
        btnRow.style.gap = '8px';
        btnRow.style.flexWrap = 'wrap';
        btnRow.style.alignItems = 'center';

        quadInfo.forEach(function (Q) {
            const active = activeKey === Q.key;
            const b = document.createElement('button');
            b.className = active ? 'btn-primary' : 'btn-secondary';
            if (!active) { b.style.borderColor = KN_QUADS[Q.qi].color; b.style.color = KN_QUADS[Q.qi].color; }
            else { b.style.background = KN_QUADS[Q.qi].color; b.style.borderColor = KN_QUADS[Q.qi].color; }
            b.innerHTML = '<span lang="en">' + KN_QUADS[Q.qi].en + ' sub-mesh</span><span lang="gr">' + KN_QUADS[Q.qi].gr + ' sub-mesh</span>';
            b.addEventListener('click', function () { renderQuadView(Q); });
            btnRow.appendChild(b);
        });
        const allBtn = document.createElement('button');
        allBtn.className = activeKey === 'all' ? 'btn-primary' : 'btn-secondary';
        allBtn.innerHTML = '<span lang="en">View all</span><span lang="gr">Προβολή όλων</span>';
        allBtn.addEventListener('click', renderAllView);
        btnRow.appendChild(allBtn);

        const spacer = document.createElement('span');
        spacer.style.flex = '1 1 auto';
        btnRow.appendChild(spacer);

        const continueBtn = document.createElement('button');
        continueBtn.className = 'btn-primary';
        continueBtn.innerHTML = '<span lang="en">Continue to Step 4 &rarr;</span><span lang="gr">Συνέχεια στο Βήμα 4 &rarr;</span>';
        continueBtn.addEventListener('click', function () {
            markSubTabDone(2);
            renderStep4();
        });
        btnRow.appendChild(continueBtn);

        return btnRow;
    }

    function renderStep3() {
        activateSubTab(2);
        stepBody.innerHTML = '';

        const explain = document.createElement('div');
        explain.className = 'substep-explain';
        explain.innerHTML =
            '<span lang="en"><strong>Goal of Phase 3:</strong> here each intermediate sub-mesh operates separately. After Phase 2 every processor has 0, 1 or 2 packets, and after Phase 3 completes it will again have 0, 1 or 2 packets &mdash; the routing problem inside each sub-mesh is now a <strong>(2,2) mapping</strong>. We solve it by "running" <strong>2 permutations simultaneously</strong>: one that performs odd-even transposition per column &rarr; row &rarr; column (' + knPermChip(1) + ') and one row &rarr; column &rarr; row (' + knPermChip(2) + '). Using <strong>Hall\'s Matching Theorem</strong>, we split the packets into the permutations so that no processor ever has 2 packets of the same permutation. Then, using Hall again, we build permutations that guarantee neither of the 2 permutations will "fill up" a processor, leaving room for the other permutation to execute and keeping the processor queue bound &le; 2.</span>' +
            '<span lang="gr"><strong>Στόχος της Φάσης 3:</strong> εδώ κάθε intermediate sub-mesh λειτουργεί ξεχωριστά. Κάθε επεξεργαστής μετά τη Φάση 2 έχει 0, 1 ή 2 πακέτα και μετά την ολοκλήρωση της Φάσης 3 θα έχει 0, 1 ή 2 πακέτα &mdash; το πρόβλημα δρομολόγησης σε κάθε sub-mesh είναι πλέον ένα <strong>(2,2) mapping</strong>. Το λύνουμε &laquo;τρέχοντας&raquo; <strong>2 μεταθέσεις ταυτόχρονα</strong>: μία που εκτελεί odd-even transportation ανά στήλη &rarr; γραμμή &rarr; στήλη (' + knPermChip(1) + ') και μία γραμμή &rarr; στήλη &rarr; γραμμή (' + knPermChip(2) + '). Χρησιμοποιώντας το <strong>Θεώρημα Ταιριάσματος του Hall</strong>, χωρίζουμε τα πακέτα στις μεταθέσεις ώστε κανένας επεξεργαστής να μην έχει 2 πακέτα της ίδιας μετάθεσης. Έπειτα ξαναχρησιμοποιώντας Hall, δημιουργούμε μεταθέσεις τέτοιες που να εξασφαλίζουν ότι καμία από τις 2 μεταθέσεις δεν θα "γεμίσει" έναν επεξεργαστή, αφήνοντας χώρο για την εκτέλεση της άλλης μετάθεσης και διατηρώντας το όριο ουράς επεξεργαστή &le; 2.</span>';
        stepBody.appendChild(explain);

        const pickNote = document.createElement('div');
        pickNote.style.margin = '14px 0 10px 0';
        pickNote.innerHTML = '<span lang="en">You can view each sub-mesh separately, or all of them together:</span><span lang="gr">Μπορείς να δεις κάθε sub-mesh ξεχωριστά, ή όλα μαζί:</span>';
        stepBody.appendChild(pickNote);

        stepBody.appendChild(buildStep3NavRow(null));

        /* Grid μετά τη Φάση 2, για πλαίσιο */
        const overviewGrid = document.createElement('div');
        stepBody.appendChild(overviewGrid);
        knDrawGrid(overviewGrid, knPositionsAt(packets, traj2, 0), n, half, { tint: true, onHover: hoverFn });
    }

    /* ── Βήμα 3, προβολή ενός sub-mesh: γράφημα vs→vd, χρωματισμός
       βήμα-βήμα σε 2 μεταθέσεις, και ανάλυση ανά μετάθεση (Α / Β / μαζί) ── */
    function renderQuadView(Q) {
        stepBody.innerHTML = '';
        const rowStart = Q.qRow0 + 1, rowEnd = Q.qRow0 + half;
        const colStart = Q.qCol0 + 1, colEnd = Q.qCol0 + half;

        knAttachLinkHighlighting(stepBody);

        const head = document.createElement('div');
        head.className = 'substep-explain';
        head.innerHTML =
            '<span lang="en"><strong>' + knQuadChip(Q.qi) + ' sub-mesh</strong> (rows ' + rowStart + '-' + rowEnd + ', columns ' + colStart + '-' + colEnd + '): ' + Q.packets.length + ' packets. ' +
            'We build a graph with <span style="color:#c0392b; font-weight:700;">red</span> nodes corresponding to all virtual sources and <span style="color:#2255c0; font-weight:700;">blue</span> nodes with all possible virtual destinations. Then, for every packet we create an edge between its virtual source and its virtual destination. Finally we add some empty/dummy edges (dashed) so that our graph becomes <strong>2-regular</strong> (every node has exactly 2 edges). Then, starting from an uncolored edge, we color edges alternately ' + knPermChip(1) + ' / ' + knPermChip(2) + ': at every node we reach, we follow its other (uncolored) edge and give it the other color, until we return to the starting edge and the cycle closes. We continue with a new cycle until all edges are colored. This way no cell ever has 2 packets of the same permutation.</span>' +
            '<span lang="gr"><strong>' + knQuadChip(Q.qi) + ' sub-mesh</strong> (γραμμές ' + rowStart + '-' + rowEnd + ', στήλες ' + colStart + '-' + colEnd + '): ' + Q.packets.length + ' πακέτα. ' +
            'Φτιάχνουμε γράφημα με <span style="color:#c0392b; font-weight:700;">Κόκκινους</span> κόμβους που αντιστοιχούν σε όλα τα virtual sources και <span style="color:#2255c0; font-weight:700;">Μπλε</span> κόμβους με όλα τα πιθανά virtual destinations. Έπειτα, για κάθε πακέτο δημιουργούμε ακμή μεταξύ virtual source και virtual destination του. Στο τέλος προσθέτουμε κάποιες κενές/dummy ακμές (διακεκομμένες) ώστε το γράφημά μας να γίνει <strong>2-regular</strong> (κάθε κόμβος με ακριβώς 2 ακμές). Έπειτα, ξεκινώντας από μια άχρωμη ακμή, χρωματίζουμε εναλλάξ ' + knPermChip(1) + ' / ' + knPermChip(2) + ': σε κάθε κόμβο που φτάνουμε ακολουθούμε την άλλη (άχρωμη) ακμή του και της δίνουμε το άλλο χρώμα, μέχρι να επιστρέψουμε στην αρχική ακμή και να κλείσει ο κύκλος. Συνεχίζουμε με νέο κύκλο, μέχρι να χρωματιστούν όλες οι ακμές. Έτσι κανένα κελί δεν έχει ποτέ 2 πακέτα της ίδιας μετάθεσης.</span>';
        stepBody.appendChild(head);

        stepBody.appendChild(buildStep3NavRow(Q.key));

        const cols = makeTwoCols(stepBody,
            'Sub-mesh (μετά τη Φάση 2)', 'Sub-mesh (after Phase 2)',
            'γράφημα vs &rarr; vd', 'graph vs &rarr; vd');
        cols.right.wrap.style.minWidth = '300px';
        cols.right.wrap.style.flex = '0 0 320px';

        const subOpts = { tint: true, rowStart: rowStart, rowEnd: rowEnd, colStart: colStart, colEnd: colEnd };

        function cellLabel(idx) {
            const lr = Math.floor(idx / half), lc = idx % half;
            return '(' + (lr + 1 + Q.qRow0) + ',' + (lc + 1 + Q.qCol0) + ')';
        }
        const nodeLabels = [];
        for (let i = 0; i < half * half; i++) nodeLabels.push({ label: cellLabel(i) });

        /* ── Σειρά χρωματισμού: οι ακμές με τη σειρά που τις περπατά ο
           κύκλος (ήδη υπολογισμένη offline στο cyclesLog) ── */
        const colorOrder = [];
        Q.split.cyclesLog.forEach(function (cyc, ci) {
            cyc.forEach(function (e, j) {
                colorOrder.push({ e: e, ci: ci, isFirst: j === 0, isLast: j === cyc.length - 1 });
            });
        });
        let edgesBuilt = false;
        let revealed = 0;   /* πόσες ακμές έχουν χρωματιστεί μέχρι τώρα */

        function drawCellGraph() {
            if (!edgesBuilt) {
                knDrawBipartite(cols.right.grid, nodeLabels, nodeLabels, [], isGrLang()
                    ? '<span style="color:#c0392b">&#9679;</span> κελί ως virtual source &nbsp;&nbsp; <span style="color:#2255c0">&#9679;</span> κελί ως virtual destination'
                    : '<span style="color:#c0392b">&#9679;</span> cell as virtual source &nbsp;&nbsp; <span style="color:#2255c0">&#9679;</span> cell as virtual destination');
                return;
            }
            const done = new Set();
            for (let i = 0; i < revealed; i++) done.add(colorOrder[i].e);
            const lastEdge = revealed > 0 ? colorOrder[revealed - 1].e : null;
            const edges = Q.split.edges.map(function (e) {
                const colored = done.has(e);
                const stroke = colored ? KN_PERM[e.perm - 1].color : null;
                const width = (e === lastEdge) ? 3.6 : (e.dummy ? 1.4 : 2.4);
                const title = e.dummy
                    ? (isGrLang() ? 'dummy ακμή' : 'dummy edge')
                    : ((isGrLang() ? 'Πακέτο ' : 'Packet ') + '(' + e.packet.destRow + ',' + e.packet.destCol + '): vs ' + cellLabel(e.u) + ' \u2192 vd ' + cellLabel(e.v));
                return { li: e.u, ri: e.v, stroke: stroke, dash: e.dummy, width: width, title: title, packetId: e.dummy ? null : e.packet.id };
            });
            const capBase = isGrLang()
                ? '<span style="color:#c0392b">&#9679;</span> κελί ως virtual source &nbsp;&nbsp; <span style="color:#2255c0">&#9679;</span> κελί ως virtual destination<br>' + knPermChip(1) + ' &nbsp;&nbsp; ' + knPermChip(2) + ' &nbsp;&nbsp; <span style="color:#999;">γκρι = άχρωμη ακόμα</span> (διακεκομμένες = dummy)'
                : '<span style="color:#c0392b">&#9679;</span> cell as virtual source &nbsp;&nbsp; <span style="color:#2255c0">&#9679;</span> cell as virtual destination<br>' + knPermChip(1) + ' &nbsp;&nbsp; ' + knPermChip(2) + ' &nbsp;&nbsp; <span style="color:#999;">gray = not colored yet</span> (dashed = dummy)';
            knDrawBipartite(cols.right.grid, nodeLabels, nodeLabels, edges, capBase);
        }

        knDrawGrid(cols.left.grid, knPositionsAt(Q.packets, Q.qTraj, 0), n, half, Object.assign({ onHover: hoverFn }, subOpts));
        drawCellGraph();

        /* ── Χειριστήρια χρωματισμού ── */
        const ctrlRow = document.createElement('div');
        ctrlRow.style.display = 'flex';
        ctrlRow.style.gap = '8px';
        ctrlRow.style.flexWrap = 'wrap';
        ctrlRow.style.marginTop = '12px';
        stepBody.appendChild(ctrlRow);

        const buildBtn = document.createElement('button');
        buildBtn.className = 'btn-primary';
        buildBtn.innerHTML = '<span lang="en">Create edges</span><span lang="gr">Δημιουργία ακμών</span>';
        ctrlRow.appendChild(buildBtn);

        const stepColorBtn = document.createElement('button');
        stepColorBtn.className = 'btn-primary';
        stepColorBtn.style.display = 'none';
        stepColorBtn.innerHTML = '<span lang="en">Start coloring</span><span lang="gr">Έναρξη χρωματισμού</span>';
        ctrlRow.appendChild(stepColorBtn);

        const skipBtn = document.createElement('button');
        skipBtn.className = 'btn-pale';
        skipBtn.style.display = 'none';
        skipBtn.innerHTML = '<span lang="en">Skip all</span><span lang="gr">Παράλειψη όλων</span>';
        ctrlRow.appendChild(skipBtn);

        const statusLine = document.createElement('div');
        statusLine.style.margin = '8px 0';
        statusLine.style.minHeight = '20px';
        stepBody.appendChild(statusLine);

        const msList = document.createElement('ul');
        msList.className = 'microstep-list';
        stepBody.appendChild(msList);

        function appendCycleLi(ci) {
            const cyc = Q.split.cyclesLog[ci];
            const li = document.createElement('li');
            li.className = 'done';
            const realInCyc = cyc.filter(function (e) { return !e.dummy; }).length;
            const walk = cyc.map(function (e) {
                return '<span style="color:' + KN_PERM[e.perm - 1].color + ';">' + cellLabel(e.u) + '&rarr;' + cellLabel(e.v) + '</span>';
            }).join(' , ');
            li.innerHTML = (isGrLang()
                ? ('Κύκλος ' + (ci + 1) + ' (' + cyc.length + ' ακμές, ' + realInCyc + ' πακέτα): ' + walk)
                : ('Cycle ' + (ci + 1) + ' (' + cyc.length + ' edges, ' + realInCyc + ' packets): ' + walk));
            msList.appendChild(li);
        }

        function describeReveal(o) {
            const e = o.e;
            const permTxt = knPermChip(e.perm);
            const edgeTxt = cellLabel(e.u) + ' &rarr; ' + cellLabel(e.v) + (e.dummy ? (isGrLang() ? ' (dummy)' : ' (dummy)') : '');
            if (o.isFirst) {
                statusLine.innerHTML = isGrLang()
                    ? ('<strong>Κύκλος ' + (o.ci + 1) + ':</strong> ξεκινάμε από άχρωμη ακμή ' + edgeTxt + ' και τη χρωματίζουμε ' + permTxt + '.')
                    : ('<strong>Cycle ' + (o.ci + 1) + ':</strong> we start from uncolored edge ' + edgeTxt + ' and color it ' + permTxt + '.');
            } else if (o.isLast) {
                statusLine.innerHTML = isGrLang()
                    ? ('Ακολουθούμε την άλλη ακμή του κόμβου: ' + edgeTxt + ' &rarr; ' + permTxt + '. Ο <strong>Κύκλος ' + (o.ci + 1) + ' έκλεισε</strong> &mdash; επιστρέψαμε στην αρχική ακμή.')
                    : ('We follow the node\'s other edge: ' + edgeTxt + ' &rarr; ' + permTxt + '. <strong>Cycle ' + (o.ci + 1) + ' closed</strong> &mdash; we returned to the starting edge.');
            } else {
                statusLine.innerHTML = isGrLang()
                    ? ('Ακολουθούμε την άλλη (άχρωμη) ακμή του κόμβου: ' + edgeTxt + ' &rarr; τη χρωματίζουμε ' + permTxt + '.')
                    : ('We follow the node\'s other (uncolored) edge: ' + edgeTxt + ' &rarr; we color it ' + permTxt + '.');
            }
        }

        function finishColoring() {
            stepColorBtn.style.display = 'none';
            skipBtn.style.display = 'none';
            statusLine.innerHTML = isGrLang()
                ? ('Όλες οι ακμές χρωματίστηκαν: προέκυψαν οι δύο πλήρεις μεταθέσεις ' + knPermChip(1) + ' και ' + knPermChip(2) + '.')
                : ('All edges are colored: the two full permutations ' + knPermChip(1) + ' and ' + knPermChip(2) + ' emerged.');
            knDrawGrid(cols.left.grid, knPositionsAt(Q.packets, Q.qTraj, 0), n, half,
                Object.assign({ onHover: hoverWithPerm, getStyle: permStyle }, subOpts));
            permSection.style.display = 'block';
            selectPermView(0);
        }

        buildBtn.addEventListener('click', function () {
            edgesBuilt = true;
            drawCellGraph();
            buildBtn.style.display = 'none';
            stepColorBtn.style.display = '';
            skipBtn.style.display = '';
            statusLine.innerHTML = isGrLang()
                ? (Q.packets.length + ' πραγματικές ακμές + ' + (Q.split.edges.length - Q.packets.length) + ' dummy: το γράφημα είναι 2-regular και έτοιμο για χρωματισμό.')
                : (Q.packets.length + ' real edges + ' + (Q.split.edges.length - Q.packets.length) + ' dummy: the graph is 2-regular and ready for coloring.');
        });

        stepColorBtn.addEventListener('click', function () {
            if (revealed >= colorOrder.length) return;
            const o = colorOrder[revealed];
            revealed++;
            drawCellGraph();
            describeReveal(o);
            if (o.isLast) appendCycleLi(o.ci);
            if (revealed >= colorOrder.length) { finishColoring(); return; }
            const nxt = colorOrder[revealed];
            stepColorBtn.innerHTML = nxt.isFirst
                ? '<span lang="en">Start next cycle</span><span lang="gr">Έναρξη επόμενου κύκλου</span>'
                : '<span lang="en">Next edge</span><span lang="gr">Επόμενη ακμή</span>';
        });

        skipBtn.addEventListener('click', function () {
            while (revealed < colorOrder.length) {
                const o = colorOrder[revealed];
                revealed++;
                if (o.isLast) appendCycleLi(o.ci);
            }
            drawCellGraph();
            finishColoring();
        });

        /* ══ Ανάλυση ανά μετάθεση: [Μετάθεση Α] [Μετάθεση Β] [Οι δύο μαζί] ══ */
        const permSection = document.createElement('div');
        permSection.style.display = 'none';
        permSection.style.marginTop = '20px';
        permSection.style.borderTop = '1px dashed #cfd8e3';
        permSection.style.paddingTop = '16px';
        stepBody.appendChild(permSection);

        const permNav = document.createElement('div');
        permNav.style.display = 'flex';
        permNav.style.gap = '8px';
        permNav.style.flexWrap = 'wrap';
        permNav.style.marginBottom = '12px';
        permSection.appendChild(permNav);

        const permBody = document.createElement('div');
        permSection.appendChild(permBody);

        const permNavBtns = [];
        function makePermNavBtn(label, idx) {
            const b = document.createElement('button');
            b.className = 'btn-secondary';
            b.innerHTML = label;
            b.addEventListener('click', function () { selectPermView(idx); });
            permNav.appendChild(b);
            permNavBtns.push(b);
            return b;
        }
        makePermNavBtn('<span lang="en">' + KN_PERM[0].en + '</span><span lang="gr">' + KN_PERM[0].gr + '</span>', 0);
        makePermNavBtn('<span lang="en">' + KN_PERM[1].en + '</span><span lang="gr">' + KN_PERM[1].gr + '</span>', 1);
        makePermNavBtn('<span lang="en">Both together</span><span lang="gr">Οι δύο μαζί</span>', 2);

        function selectPermView(idx) {
            permNavBtns.forEach(function (b, i) {
                b.className = i === idx ? 'btn-primary' : 'btn-secondary';
                if (i < 2) {
                    if (i === idx) { b.style.background = KN_PERM[i].color; b.style.borderColor = KN_PERM[i].color; b.style.color = ''; }
                    else { b.style.background = ''; b.style.borderColor = KN_PERM[i].color; b.style.color = KN_PERM[i].color; }
                } else {
                    b.style.background = ''; b.style.borderColor = ''; b.style.color = '';
                }
            });
            if (idx === 2) renderBothView();
            else renderPermView(idx);
        }



        /* Προβολή μίας μετάθεσης: εξήγηση + routing graph (έτοιμο) + δρομολόγηση */
        function renderPermView(g) {
            permBody.innerHTML = '';
            const isA = g === 0;
            const scheme = isA ? 'column &rarr; row &rarr; column' : 'row &rarr; column &rarr; row';
            const schemeGr = isA ? 'στήλη &rarr; γραμμή &rarr; στήλη' : 'γραμμή &rarr; στήλη &rarr; γραμμή';

            const explain = document.createElement('div');
            explain.className = 'substep-explain deep';
            explain.innerHTML = isA
    ? ('<span lang="en"><strong>' + knPermChip(1) + '</strong> executes odd-even transposition per ' + scheme + '. The critical point is the <strong>middle (row) sub-phase</strong>: no two A-packets in the same row may want the same destination column, otherwise they collide and fill up the queue of that processor. So, with a <strong>second Hall matching</strong>, we assign every packet an <strong>intermediate row</strong>: in the routing graph below, the left nodes are the column where each packet currently is, the right nodes the column it is heading to, one edge per cell, and the <strong>color of its edge = its intermediate row</strong>. In practice: <strong>at the end of the first (column) step, every packet must be located at the row matching its color</strong>. The matching guarantees both requirements at once: inside each column all colors are different, and inside each color/row no destination column appears twice (no collision).</span>' +
       '<span lang="gr"><strong>' + knPermChip(1) + '</strong> εκτελεί odd-even transportation ανά ' + schemeGr + '. Το κρίσιμο σημείο είναι η <strong>μεσαία υπο-φάση (γραμμές)</strong>: δεν πρέπει δύο πακέτα της Α στην ίδια γραμμή να θέλουν την ίδια στήλη προορισμού, αλλιώς συγκρούονται και γεμίζουν την ουρά του εκάστοτε επεξεργαστή. Γι\' αυτό, με ένα <strong>δεύτερο Hall matching</strong>, αναθέτουμε σε κάθε πακέτο μια <strong>ενδιάμεση γραμμή</strong>: στο παρακάτω routing graph, οι αριστεροί κόμβοι είναι η στήλη όπου βρίσκεται κάθε πακέτο, οι δεξιοί η στήλη όπου πηγαίνει, μία ακμή ανά κελί, και το <strong>χρώμα της ακμής του = η ενδιάμεση γραμμή του</strong>. Πρακτικά: <strong>στο τέλος του πρώτου (column) βήματος, κάθε πακέτο πρέπει να βρεθεί στη γραμμή που αντιστοιχεί στο χρώμα του</strong>. Το matching εγγυάται και τα δύο ζητούμενα ταυτόχρονα: μέσα σε κάθε στήλη όλα τα χρώματα είναι διαφορετικά, και μέσα σε κάθε χρώμα/γραμμή καμία στήλη-προορισμός δεν εμφανίζεται δύο φορές (δεν συγκρούονται).</span>')
    : ('<span lang="en"><strong>' + knPermChip(2) + '</strong> executes odd-even transposition per ' + scheme + ' &mdash; the mirror image of A. The critical point is the <strong>middle (column) sub-phase</strong>: no two B-packets in the same column may want the same destination row, otherwise they collide and fill up the queue of that processor. So, with a <strong>second Hall matching</strong>, we assign every packet an <strong>intermediate column</strong>: in the routing graph below, the left nodes are the row where each packet currently is, the right nodes the row it is heading to, one edge per cell, and the <strong>color of its edge = its intermediate column</strong>. In practice: <strong>at the end of the first (row) step, every packet must be located at the column matching its color</strong>. The matching guarantees both requirements at once: inside each row all colors are different, and inside each color/column no destination row appears twice (no collision).</span>' +
       '<span lang="gr"><strong>' + knPermChip(2) + '</strong> εκτελεί odd-even transportation ανά ' + schemeGr + ' &mdash; ο καθρέφτης της Α. Το κρίσιμο σημείο είναι η <strong>μεσαία υπο-φάση (στήλες)</strong>: δεν πρέπει δύο πακέτα της Β στην ίδια στήλη να θέλουν την ίδια γραμμή προορισμού, αλλιώς συγκρούονται και γεμίζουν την ουρά του εκάστοτε επεξεργαστή. Γι\' αυτό, με ένα <strong>δεύτερο Hall matching</strong>, αναθέτουμε σε κάθε πακέτο μια <strong>ενδιάμεση στήλη</strong>: στο παρακάτω routing graph, οι αριστεροί κόμβοι είναι η γραμμή όπου βρίσκεται κάθε πακέτο, οι δεξιοί η γραμμή όπου πηγαίνει, μία ακμή ανά κελί, και το <strong>χρώμα της ακμής του = η ενδιάμεση στήλη του</strong>. Πρακτικά: <strong>στο τέλος του πρώτου (row) βήματος, κάθε πακέτο πρέπει να βρεθεί στη στήλη που αντιστοιχεί στο χρώμα του</strong>. Το matching εγγυάται και τα δύο ζητούμενα ταυτόχρονα: μέσα σε κάθε γραμμή όλα τα χρώματα είναι διαφορετικά, και μέσα σε κάθε χρώμα/στήλη καμία γραμμή-προορισμός δεν εμφανίζεται δύο φορές (δεν συγκρούονται).</span>');
        permBody.appendChild(explain);

            const pCols = makeTwoCols(permBody,
                isA ? KN_PERM[0].gr + ': routing graph στηλών' : KN_PERM[1].gr + ': routing graph γραμμών',
                isA ? KN_PERM[0].en + ': column routing graph' : KN_PERM[1].en + ': row routing graph',
                '', '');
            pCols.left.wrap.style.minWidth = '300px';
            pCols.left.wrap.style.flex = '0 0 320px';

            /* Routing graph, έτοιμο χρωματισμένο */
            const mColors = oaColorPalette(half);
            const labels = [];
            for (let i = 0; i < half; i++) {
                labels.push({ label: (isA ? 'C' + (i + 1 + Q.qCol0) : 'R' + (i + 1 + Q.qRow0)) });
            }
            const edges = Q.rgEdgesOf[g].map(function (e) {
                const pk = Q.cellPacket[g][e.u];
                const dummy = !pk;
                const title = dummy
                    ? (isGrLang() ? 'dummy (κενή θέση)' : 'dummy (empty slot)')
                    : ((isGrLang() ? 'Πακέτο ' : 'Packet ') + '(' + pk.destRow + ',' + pk.destCol + ')');
                return { li: e.left, ri: e.right, stroke: mColors[e.hallColor - 1], width: dummy ? 1.4 : 2.4, dash: dummy, title: title, packetId: dummy ? null : pk.id };
            });
            const capParts = [];
            for (let k = 1; k <= half; k++) {
                capParts.push('<span style="color:' + mColors[k - 1] + '; font-weight:700;">' +
                    (isGrLang()
                        ? (isA ? 'γραμμή ' + (k + Q.qRow0) : 'στήλη ' + (k + Q.qCol0))
                        : (isA ? 'row ' + (k + Q.qRow0) : 'column ' + (k + Q.qCol0))) + '</span>');
            }
            const cap = (isGrLang() ? 'χρώμα &rarr; ενδιάμεση θέση (διακεκομμένο/αχνό = dummy): ' : 'color &rarr; intermediate position (dashed/faint = dummy): ') + capParts.join(' , ');
            knDrawBipartite(pCols.left.grid, labels, labels, edges, cap);

            /* Δρομολόγηση ΜΟΝΟ αυτής της μετάθεσης, στο δικό της timeline */
            pCols.right.grid.remove();
            makeRoutingSection(pCols.right.wrap, Q.gPackets[g], Q.gTraj[g], Q.gS2[g], Q.gSubBoundaries[g], 'solo', g + 1, subOpts);
        }

        /* Προβολή "Οι δύο μαζί": ταυτόχρονη εκτέλεση Α + Β */
        function renderBothView() {
            permBody.innerHTML = '';
            const explain = document.createElement('div');
            explain.className = 'substep-explain deep';
            explain.innerHTML =
                '<span lang="en"><strong>Both permutations together:</strong> in every sub-phase, while ' + knPermChip(1) + ' moves along columns, ' + knPermChip(2) + ' moves along rows and vice versa &mdash; they never share an edge, and every cell holds at most 1 packet of each (queue &le; 2). Each sub-phase lasts as long as the slower of the two.</span>' +
                '<span lang="gr"><strong>Οι δύο μεταθέσεις μαζί:</strong> σε κάθε υπο-φάση, όσο η ' + knPermChip(1) + ' κινείται σε στήλες, η ' + knPermChip(2) + ' κινείται σε γραμμές και αντίστροφα &mdash; δεν μοιράζονται ποτέ ακμή, και κάθε κελί κρατά το πολύ 1 πακέτο από την καθεμία (ουρά &le; 2). Κάθε υπο-φάση διαρκεί όσο η αργότερη από τις δύο.</span>';
            permBody.appendChild(explain);

            makeRoutingSection(permBody, Q.packets, Q.qTraj, Q.qS2, Q.qSubBoundaries, 'combo', null, subOpts);
        }
    }

    /* ── Βήμα 3, προβολή όλων: όλο το πλέγμα, όλες οι υπο-φάσεις μαζί ── */
    function renderAllView() {
        stepBody.innerHTML = '';

        const head = document.createElement('div');
        head.className = 'substep-explain';
        head.innerHTML =
            '<span lang="en"><strong>Goal of Phase 3:</strong> here each intermediate sub-mesh operates separately. After Phase 2 every processor has 0, 1 or 2 packets, and after Phase 3 completes it will again have 0, 1 or 2 packets &mdash; the routing problem inside each sub-mesh is now a <strong>(2,2) mapping</strong>. We solve it by "running" <strong>2 permutations simultaneously</strong>: one that performs odd-even transposition per column &rarr; row &rarr; column (' + knPermChip(1) + ') and one row &rarr; column &rarr; row (' + knPermChip(2) + '). Using <strong>Hall\'s Matching Theorem</strong>, we split the packets into the permutations so that no processor ever has 2 packets of the same permutation. Then, using Hall again, we build permutations that guarantee neither of the 2 permutations will "fill up" a processor, leaving room for the other permutation to execute and keeping the processor queue bound &le; 2.</span>' +
            '<span lang="gr"><strong>Στόχος της Φάσης 3:</strong> εδώ κάθε intermediate sub-mesh λειτουργεί ξεχωριστά. Κάθε επεξεργαστής μετά τη Φάση 2 έχει 0, 1 ή 2 πακέτα και μετά την ολοκλήρωση της Φάσης 3 θα έχει 0, 1 ή 2 πακέτα &mdash; το πρόβλημα δρομολόγησης σε κάθε sub-mesh είναι πλέον ένα <strong>(2,2) mapping</strong>. Το λύνουμε &laquo;τρέχοντας&raquo; <strong>2 μεταθέσεις ταυτόχρονα</strong>: μία που εκτελεί odd-even transportation ανά στήλη &rarr; γραμμή &rarr; στήλη (' + knPermChip(1) + ') και μία γραμμή &rarr; στήλη &rarr; γραμμή (' + knPermChip(2) + '). Χρησιμοποιώντας το <strong>Θεώρημα Ταιριάσματος του Hall</strong>, χωρίζουμε τα πακέτα στις μεταθέσεις ώστε κανένας επεξεργαστής να μην έχει 2 πακέτα της ίδιας μετάθεσης. Έπειτα ξαναχρησιμοποιώντας Hall, δημιουργούμε μεταθέσεις τέτοιες που να εξασφαλίζουν ότι καμία από τις 2 μεταθέσεις δεν θα "γεμίσει" έναν επεξεργαστή, αφήνοντας χώρο για την εκτέλεση της άλλης μετάθεσης και διατηρώντας το όριο ουράς επεξεργαστή &le; 2.</span>';
        stepBody.appendChild(head);

        stepBody.appendChild(buildStep3NavRow('all'));

        const cols = makeTwoCols(stepBody, 'Πριν (μετά τη Φάση 2)', 'Before (after Phase 2)', '', '');
        knDrawGrid(cols.left.grid, knPositionsAt(packets, traj2, 0), n, half, { tint: true, onHover: hoverWithPerm, getStyle: permStyle });

        cols.right.grid.remove();
        makeRoutingSection(cols.right.wrap, packets, traj2, S2, globalSubBoundaries, 'global', null, { tint: true });
    }

    /* ════════════════════════ ΒΗΜΑ 4 : προς Τελικό Προορισμό ════════════════════════ */
    function renderStep4() {
        activateSubTab(3);
        stepBody.innerHTML = '';

        const explain = document.createElement('div');
        explain.className = 'substep-explain';
        explain.innerHTML =
            '<span lang="en"><strong>Goal of Phase 4:</strong> every packet is now at its <strong>virtual destination</strong>, which lies in the <strong>same row</strong> as its actual destination, at a distance of 0 or n/2 = ' + half + '. We move the packets per row to their final position. Since we route a permutation, every cell is the final destination of exactly one packet and no conflicts occur.</span>' +
            '<span lang="gr"><strong>Στόχος της Φάσης 4:</strong> πλέον κάθε πακέτο βρίσκεται στην <strong>ίδια γραμμή</strong> με τον τελικό του προορισμό και σε απόσταση 0 ή n/2 = ' + half + '. Μετακινούμε τα πακέτα ανά γραμμή στην τελική τους θέση. Αφού δρομολογούμε μετάθεση, κάθε κελί είναι τελικός προορισμός ακριβώς ενός πακέτου και δεν υπάρχουν συγκρούσεις.</span>';
        stepBody.appendChild(explain);

        const cols = makeTwoCols(stepBody, 'Πλέγμα μετά τη Φάση 3', 'Grid after Phase 3', 'Τελικό Πλέγμα', 'Final grid');
        cols.right.wrap.style.display = 'none';

        const vdPositions = {};
        packets.forEach(function (p) {
            const key = p.vdRow + ',' + p.vdCol;
            (vdPositions[key] = vdPositions[key] || []).push(p);
        });
        knDrawGrid(cols.left.grid, vdPositions, n, half, {
            tint: true, onHover: hoverFn,
            getDirection: function (p) {
                if (p.destCol === p.vdCol) return null;
                return { arrow: p.destCol > p.vdCol ? '\u2192' : '\u2190' };
            }
        });

        const stepsLine = document.createElement('div');
        stepsLine.style.fontWeight = '700';
        stepsLine.style.margin = '12px 0';
        stepBody.appendChild(stepsLine);

        const btnRow = document.createElement('div');
        const moveBtn = document.createElement('button');
        moveBtn.className = 'btn-primary';
        moveBtn.innerHTML = '<span lang="en">Move to final destination</span><span lang="gr">Μετακίνηση στον τελικό προορισμό</span>';
        btnRow.appendChild(moveBtn);
        stepBody.appendChild(btnRow);

        const finalSection = document.createElement('div');
        stepBody.appendChild(finalSection);

        moveBtn.addEventListener('click', function () {
            const finalPositions = {};
            packets.forEach(function (p) { finalPositions[p.destRow + ',' + p.destCol] = [p]; });
            cols.right.wrap.style.display = 'block';
            knDrawGrid(cols.right.grid, finalPositions, n, half, { tint: true, onHover: hoverFn });
            stepsLine.innerHTML = '<span lang="en">Steps = n/2 = ' + half + '</span><span lang="gr">Βήματα = n/2 = ' + half + '</span>';
            moveBtn.style.display = 'none';
            markSubTabDone(3);

            /* Αρχικό Πλέγμα, δεξιά από το Τελικό */
            const initCol = document.createElement('div');
            const initHead = document.createElement('div');
            initHead.style.fontWeight = '700'; initHead.style.marginBottom = '6px';
            initHead.innerHTML = '<span lang="en">Initial grid</span><span lang="gr">Αρχικό Πλέγμα</span>';
            initCol.appendChild(initHead);
            const initGrid = document.createElement('div');
            initCol.appendChild(initGrid);
            cols.layout.appendChild(initCol);
            const initPositions = {};
            packets.forEach(function (p) { initPositions[p.sourceRow + ',' + p.sourceCol] = [p]; });
            knDrawGrid(initGrid, initPositions, n, half, { plain: true });

            const total = half + S2 + half;
            const theoretical = 2.5 * n;
            const banner = document.createElement('div');
            banner.innerHTML =
                '<div class="result-banner">' +
                '<div class="result-stat"><div class="num">' + theoretical + '</div><div class="label"><span lang="en">Theoretical Max Step Bound = 2.5 &middot; &radic;N</span><span lang="gr">Θεωρητικό Μέγιστο Όριο Βημάτων = 2.5 &middot; &radic;N</span></div></div>' +
                '<div class="result-stat"><div class="num">' + total + '</div><div class="label"><span lang="en">Actual Number of Steps (Phase 2 = ' + half + ', Phase 3 = ' + S2 + ', Phase 4 = ' + half + ')</span><span lang="gr">Πραγματικός Αριθμός Βημάτων (Φάση 2 = ' + half + ', Φάση 3 = ' + S2 + ', Φάση 4 = ' + half + ')</span></div></div>' +
                '</div>';
            finalSection.appendChild(banner);
        });
    }

    renderers.push(renderStep1, renderStep2, renderStep3, renderStep4);
    renderStep1();
}