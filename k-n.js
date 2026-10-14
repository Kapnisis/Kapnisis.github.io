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

/* Odd-even transposition */
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

    for (let steps = 1; steps <= len; steps++) {
        const start = (steps % 2 === 1) ? 0 : 1;
        for (let i = start; i + 1 < len; i += 2) {
            if (line[i].dest > line[i + 1].dest) {
                const tmp = line[i]; line[i] = line[i + 1]; line[i + 1] = tmp;
            }
        }
        for (let i = 0; i < len; i++) {
            if (line[i].real) traj[line[i].id].push(i);
        }
    }
    return { traj: traj, steps: len };
}

/* 2-regular split */
function knSplitIntoTwoPermutations(realEdges, m) {
    const cells = m * m;
    const degU = new Array(cells).fill(0);
    const degV = new Array(cells).fill(0);
    const edges = [];

    realEdges.forEach(function (e) {
        degU[e.u]++; degV[e.v]++;
        edges.push({ u: e.u, v: e.v, packet: e.packet, dummy: false, perm: 0 });
    });

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

const KN_P2_CHROME = 660;

/* Grid renderer */
function knDrawGrid(container, positions, n, half, options) {
    options = options || {};
    const r0 = options.rowStart || 1, r1 = options.rowEnd || n;
    const c0 = options.colStart || 1, c1 = options.colEnd || n;

    const reserve = options.reserve || 2;

    const cacheKey = r0 + '|' + r1 + '|' + c0 + '|' + c1 + '|' + reserve;

    let table = container._knTable;
    if (!table || container._knCacheKey !== cacheKey) {
        container.innerHTML = '';
        table = document.createElement('table');
        table.className = 'oa-table';

        const headerRow = document.createElement('tr');
        headerRow.appendChild(document.createElement('th'));
        for (let c = c0; c <= c1; c++) {
            const th = document.createElement('th'); th.textContent = c; headerRow.appendChild(th);
        }
        table.appendChild(headerRow);

        for (let r = r0; r <= r1; r++) {
            const tr = document.createElement('tr');
            const rh = document.createElement('th'); rh.textContent = r; tr.appendChild(rh);
            for (let c = c0; c <= c1; c++) {
                const td = document.createElement('td');
                td.dataset.row = r; td.dataset.col = c;
                if (reserve > 1) td.style.height = (reserve * 26 + 8) + 'px';
                tr.appendChild(td);
            }
            table.appendChild(tr);
        }
        container.appendChild(table);
        container._knTable = table;
        container._knCacheKey = cacheKey;

        table._tds = {};
        table.querySelectorAll('td[data-row]').forEach(function (td) {
            table._tds[td.dataset.row + ',' + td.dataset.col] = td;
        });
    }

    for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
            const oldTd = table._tds[r + ',' + c];
            const td = oldTd.cloneNode(false);
            oldTd.parentNode.replaceChild(td, oldTd);
            table._tds[r + ',' + c] = td;

            if (options.tint) {
                const qi = knQuadIndex(r, c, half);
                td.style.background = KN_QUADS[qi].tint;
                td.style.borderBottom = (r === half && r1 > half) ? '2px solid #7a8aa0' : '';
                td.style.borderRight = (c === half && c1 > half) ? '2px solid #7a8aa0' : '';
            } else {
                td.style.background = '';
                td.style.borderBottom = '';
                td.style.borderRight = '';
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
        }
    }
}

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

function knShortS(i, t, h) {
    var st = Math.min(t, h - t);
    return (i <= 2 * st) ? Math.ceil(i / 2) : i - st;
}

/* Phase 1 schedule */
function knBuildPhase2Traj(packets, n, half) {
    var traj = {};
    packets.forEach(function (p) {
        var arr = [];
        var isLong = (p.vsRow !== p.sourceRow);
        var dir = isLong ? (p.vsRow > p.sourceRow ? 1 : -1) : 0;
        for (var t = 0; t <= half; t++) {
            var r;
            if (isLong) {
                r = p.sourceRow + dir * t;
            } else {
                var row = p.sourceRow;
                if (row <= half) {
                    r = knShortS(row, t, half);
                } else {
                    var mi = n + 1 - row;
                    r = n + 1 - knShortS(mi, t, half);
                }
            }
            arr.push({ r: r, c: p.sourceCol });
        }
        traj[p.id] = arr;
    });
    return traj;
}

/* Phase 3 schedule */
function knBuildPhase4Traj(packets, n, half) {
    var traj = {};
    packets.forEach(function (p) {
        var arr = [];
        var isLong = (p.destCol !== p.vdCol);
        var dir = isLong ? (p.destCol > p.vdCol ? 1 : -1) : 0;
        for (var tau = 0; tau <= half; tau++) {
            var c;
            if (isLong) {
                c = p.vdCol + dir * tau;
            } else {
                var col = p.vdCol;
                if (col <= half) {
                    c = knShortS(col, tau, half);
                } else {
                    var mj = n + 1 - col;
                    c = n + 1 - knShortS(mj, tau, half);
                }
            }
            arr.push({ r: p.vdRow, c: c });
        }
        traj[p.id] = arr;
    });
    return traj;
}

const KN_C_COLOR = '#b8860b';
const KN_B_COLOR = '#1f9fe0';
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

/* Bipartite graph */
function knDrawBipartite(container, nodesLeft, nodesRight, edges, caption) {
    const ns = 'http://www.w3.org/2000/svg';
    const count = Math.max(nodesLeft.length, nodesRight.length);
    const spacing = Math.max(20, Math.min(34, 440 / count));
    const height = count * spacing + 40;
    const width = 300;
    const leftX = 80, rightX = width - 80;

    function yOf(i) { return 20 + i * spacing + spacing / 2; }

    const cacheKey = count + '|' + nodesLeft.map(function (nd) { return nd.label; }).join(',');
    const cached = container._knBp;
    if (cached && cached.key === cacheKey && cached.svg.isConnected) {
        while (cached.edgeLayer.firstChild) cached.edgeLayer.removeChild(cached.edgeLayer.firstChild);
        knBipartiteEdges(cached.edgeLayer, edges, yOf, leftX, rightX);
        knBipartiteSubLabels(cached, nodesLeft, nodesRight);
        cached.cap.innerHTML = caption || '';
        cached.cap.style.display = caption ? '' : 'none';
        return;
    }

    container.innerHTML = '';
    container._knBp = null;

    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    svg.classList.add('routing-graph-svg');

    const edgeLayer = document.createElementNS(ns, 'g');
    edgeLayer.setAttribute('class', 'bp-edge-layer');
    svg.appendChild(edgeLayer);

    knBipartiteEdges(edgeLayer, edges, yOf, leftX, rightX);

    const subLeft = [], subRight = [];
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
        const sub = document.createElementNS(ns, 'text');
        sub.setAttribute('x', leftX - 2); sub.setAttribute('y', y - 8);
        sub.setAttribute('text-anchor', 'end'); sub.classList.add('rg-path-label');
        svg.appendChild(sub);
        subLeft.push(sub);
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
        const sub = document.createElementNS(ns, 'text');
        sub.setAttribute('x', rightX + 2); sub.setAttribute('y', y - 8);
        sub.classList.add('rg-path-label');
        svg.appendChild(sub);
        subRight.push(sub);
    });

    container.appendChild(svg);
    const cap = document.createElement('div');
    cap.style.fontSize = '11.5px'; cap.style.color = '#888';
    cap.style.marginTop = '4px'; cap.style.textAlign = 'center';
    cap.innerHTML = caption || '';
    cap.style.display = caption ? '' : 'none';
    container.appendChild(cap);

    container._knBp = { key: cacheKey, svg: svg, edgeLayer: edgeLayer, cap: cap, subLeft: subLeft, subRight: subRight };
    knBipartiteSubLabels(container._knBp, nodesLeft, nodesRight);
}

function knBipartiteSubLabels(cache, nodesLeft, nodesRight) {
    if (!cache.subLeft) return;
    cache.subLeft.forEach(function (el, i) { el.textContent = (nodesLeft[i] && nodesLeft[i].sub) || ''; });
    cache.subRight.forEach(function (el, i) { el.textContent = (nodesRight[i] && nodesRight[i].sub) || ''; });
}

function knBipartiteEdges(layer, edges, yOf, leftX, rightX) {
    const ns = 'http://www.w3.org/2000/svg';
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
        layer.appendChild(path);
    });
}

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

function knSchemeAxes(permIdx) { return permIdx === 1 ? ['col', 'row', 'col'] : ['row', 'col', 'row']; }

/* Cards */
function buildKrizancAlgorithmCards() {
    const n = parseInt(document.getElementById('sideN').value);
    if (isNaN(n) || n < 2) {
        alert(isGrLang() ? 'Παρακαλώ εισάγετε έγκυρο μέγεθος πλέγματος.' : 'Please enter a valid mesh size.');
        return null;
    }
    if (n % 2 !== 0) {
        return null;
    }
    const half = n / 2;

    const packets = [];
    let idCounter = 0;
    for (let r = 1; r <= n; r++) {
        for (let c = 1; c <= n; c++) {
            const input = _meshCardBuiltEl.querySelector('input[data-row="' + (r - 1) + '"][data-col="' + (c - 1) + '"]');
            const v = input.value.trim();
            if (v === '') { alert('Cell (' + r + ',' + c + ') is empty. Please fill all cells.'); return null; }
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

    const quadInfo = [];
    for (let qi = 0; qi < 4; qi++) {
        const qRow0 = qi >= 2 ? half : 0;
        const qCol0 = (qi % 2) ? half : 0;
        const qPackets = packets.filter(function (p) { return p.quad === qi; });

        const toLocalIdx = function (r, c) { return (r - 1 - qRow0) * half + (c - 1 - qCol0); };
        const realEdges = qPackets.map(function (p) {
            return { packet: p, u: toLocalIdx(p.vsRow, p.vsCol), v: toLocalIdx(p.vdRow, p.vdCol) };
        });

        const split = knSplitIntoTwoPermutations(realEdges, half);
        split.edges.forEach(function (e) { if (e.packet) e.packet.permGroup = e.perm; });

        const midOf = [{}, {}];
        const rgEdgesOf = [null, null];
        const rgTraceOf = [null, null];
        for (let g = 0; g < 2; g++) {
            const perm = split.permOfCell[g];
            const rgEdges = [];
            for (let u = 0; u < half * half; u++) {
                const v = perm[u];
                rgEdges.push(g === 0
                    ? { left: u % half, right: v % half, u: u }
                    : { left: Math.floor(u / half), right: Math.floor(v / half), u: u });
            }

            rgTraceOf[g] = oaColorRegularBipartiteTraced(rgEdges, half);
            rgEdges.forEach(function (e) { midOf[g][e.u] = e.hallColor - 1; });
            rgEdgesOf[g] = rgEdges;
        }

        const cellPacket = [{}, {}];
        qPackets.forEach(function (p) {
            const u = toLocalIdx(p.vsRow, p.vsCol);
            const g = p.permGroup - 1;
            cellPacket[g][u] = p;
            if (g === 0) p.midRow = midOf[0][u] + 1 + qRow0;
            else p.midCol = midOf[1][u] + 1 + qCol0;
        });

        quadInfo.push({ qi: qi, key: KN_QUADS[qi].key, qRow0: qRow0, qCol0: qCol0, packets: qPackets, split: split, midOf: midOf, rgEdgesOf: rgEdgesOf, rgTraceOf: rgTraceOf, cellPacket: cellPacket });
    }

    quadInfo.forEach(function (Q) {
        Q.gSegs = [[], []];
        Q.gPackets = [null, null];
        for (let g = 0; g < 2; g++) {
            const groupPk = Q.packets.filter(function (p) { return p.permGroup === g + 1; });
            Q.gPackets[g] = groupPk;
            const cur = {};
            groupPk.forEach(function (p) { cur[p.id] = { r: p.vsRow, c: p.vsCol }; });
            for (let s = 0; s < 3; s++) {
                const axisCols = (g === 0) ? (s !== 1) : (s === 1);
                const lineRuns = [];
                const byLine = {};
                groupPk.forEach(function (p) {
                    const u = (p.vsRow - 1 - Q.qRow0) * half + (p.vsCol - 1 - Q.qCol0);
                    const vd = { lr: p.vdRow - 1 - Q.qRow0, lc: p.vdCol - 1 - Q.qCol0 };
                    const mid = Q.midOf[g][u];
                    const curL = { lr: cur[p.id].r - 1 - Q.qRow0, lc: cur[p.id].c - 1 - Q.qCol0 };
                    let lineKey, curPos, destPos;
                    if (axisCols) {
                        lineKey = 'c' + curL.lc;
                        curPos = curL.lr;
                        destPos = (g === 0) ? (s === 0 ? mid : vd.lr) : vd.lr;
                    } else {
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

        Q.qTraj = {};
        Q.packets.forEach(function (p) { Q.qTraj[p.id] = [{ r: p.vsRow, c: p.vsCol }]; });
        Q.segs.forEach(function (seg) {
            for (let t = 0; t < seg.len; t++) {
                Q.packets.forEach(function (p) { Q.qTraj[p.id].push(seg.pos[p.id][t]); });
            }
        });
    });

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

    packets.forEach(function (p) {
        const last = traj2[p.id][traj2[p.id].length - 1];
        if (last.r !== p.vdRow || last.c !== p.vdCol) console.error('KN phase-2 verification failed', p, last);
        if (p.vdRow !== p.destRow) console.error('KN vd row mismatch', p);
    });

    const hoverFn = function (p) { return knHoverBasic(p); };
    const hoverWithPerm = function (p) {
        const gr = isGrLang();
        let html = hoverFn(p) + '<br>' + (gr ? 'Ομάδα: ' : 'Group: ') + knPermChip(p.permGroup) +
            '<br>' + (gr ? 'Διαδρομή: ' : 'Route: ') + (p.permGroup === 1 ? 'col &rarr; row &rarr; col' : 'row &rarr; col &rarr; row');
        if (p.permGroup === 1) html += '<br>' + (gr ? 'Γραμμή για την αναδιάταξη: ' : 'Row for the rearrangement: ') + p.midRow;
        else html += '<br>' + (gr ? 'Στήλη για την αναδιάταξη: ' : 'Column for the rearrangement: ') + p.midCol;
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

    function makeTwoCols(parent, titleGrL, titleEnL, titleGrR, titleEnR) {
        const layout = document.createElement('div');
        layout.className = 'matching-layout';
        parent.appendChild(layout);
        function col(titleGr, titleEn, colClass) {
            const div = document.createElement('div');
            div.className = colClass;
            const h = document.createElement('div');
            h.className = 'kn-col-head';
            const title = document.createElement('span');
            title.innerHTML = '<span lang="en">' + titleEn + '</span><span lang="gr">' + titleGr + '</span>';
            h.appendChild(title);
            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'kn-col-toggle';
            h.appendChild(toggle);
            div.appendChild(h);
            const grid = document.createElement('div');
            div.appendChild(grid);
            layout.appendChild(div);
            let hidden = false;
            function apply() {
                grid.style.display = hidden ? 'none' : '';
                div.classList.toggle('is-collapsed', hidden);
                toggle.textContent = hidden ? '+' : '\u2212';
                toggle.title = hidden
                    ? (isGrLang() ? 'Εμφάνιση' : 'Show')
                    : (isGrLang() ? 'Απόκρυψη' : 'Hide');
                requestAnimationFrame(function () { window.dispatchEvent(new Event('resize')); });
            }
            toggle.addEventListener('click', function () { hidden = !hidden; apply(); });
            apply();
            return { wrap: div, grid: grid, head: h };
        }
        return {
            left: col(titleGrL, titleEnL, 'matching-grid-col'),
            right: col(titleGrR, titleEnR, 'matching-graph-col'),
            layout: layout
        };
    }

/* Compared pairs */
function knHighlightOddEvenPairs(routeGrid, t, boundaries, permIdx, mode, gridOpts, half) {
    var table = routeGrid._knTable || routeGrid.querySelector('table');
    if (!table) return;

    table.querySelectorAll('.oe-pair-circle').forEach(function (el) { el.remove(); });
    if (t <= 0) return;

    var s = knSubphaseIndex(t, boundaries);
    var relT = t - boundaries[s];
    var isOdd = (relT % 2 === 1);

    function circle(hostTh, w, h, color) {
        if (!hostTh) return;
        hostTh.style.position = 'relative';
        var el = document.createElement('div');
        el.className = 'oe-pair-circle';
        el.style.position = 'absolute';
        el.style.left = '1px';
        el.style.top = '1px';
        el.style.width = Math.max(6, w - 4) + 'px';
        el.style.height = Math.max(6, h - 4) + 'px';
        el.style.border = '2px solid ' + color;
        el.style.borderRadius = '50%';
        el.style.pointerEvents = 'none';
        el.style.boxSizing = 'border-box';
        hostTh.appendChild(el);
    }

    function highlightForPerm(perm) {
        var axis = knSchemeAxes(perm)[s];
        var color = KN_PERM[perm - 1].color;
        var r0 = gridOpts.rowStart || 1, r1 = gridOpts.rowEnd || (half * 2);
        var c0 = gridOpts.colStart || 1, c1 = gridOpts.colEnd || (half * 2);
        var startIdx = isOdd ? 0 : 1;

        if (axis === 'col') {
            var rows = table.querySelectorAll('tr');
            var size = r1 - r0 + 1;
            for (var i = startIdx; i < size - 1; i += 2) {
                var thA = rows[i + 1] && rows[i + 1].querySelector('th');
                var thB = rows[i + 2] && rows[i + 2].querySelector('th');
                if (thA && thB) circle(thA, thA.offsetWidth, thA.offsetHeight + thB.offsetHeight, color);
            }
        } else {
            var headerRow = table.querySelector('tr');
            if (!headerRow) return;
            var ths = headerRow.querySelectorAll('th');
            var sizeC = c1 - c0 + 1;
            for (var j = startIdx; j < sizeC - 1; j += 2) {
                var thL = ths[j + 1], thR = ths[j + 2];
                if (thL && thR) circle(thL, thL.offsetWidth + thR.offsetWidth, thL.offsetHeight, color);
            }
        }
    }

    if (mode === 'solo' && permIdx) {
        highlightForPerm(permIdx);
    } else {
        highlightForPerm(1);
        highlightForPerm(2);
    }
}

    const bigIdeaHtml =
        '<span lang="en">We route a mesh of processors in 2.5&radic;N <span class="glossary-term" data-term="step">steps</span> without creating queues, where at every step the processors hold no more than 2 <span class="glossary-term" data-term="packet">packets</span>. We start by splitting the mesh into four sub-meshes &radic;N/2 &times; &radic;N/2 and initially moving each packet to the appropriate sub-mesh. This way, instead of solving one large routing problem over the whole mesh, smaller local problems are created that can be routed in parallel. After the first movement each processor holds at most two packets and, inside each sub-mesh, a <span class="glossary-term" data-term="mapping-22">(2,2)-mapping</span> arises, which can be decomposed into two separate routing problems solved in parallel. Finally, the packets move from the intermediate position to their real destination.</span>' +
        '<span lang="gr">Δρομολογούμε ένα πλέγμα επεξεργαστών σε 2.5&radic;N <span class="glossary-term" data-term="step">βήματα</span>, χωρίς τη δημιουργία ουρών, όπου σε κάθε βήμα οι επεξεργαστές δεν κρατούν περισσότερα από 2 <span class="glossary-term" data-term="packet">πακέτα</span>. Ξεκινάμε χωρίζοντας το πλέγμα σε τέσσερα υποπλέγματα &radic;N/2 &times; &radic;N/2 και μεταφέροντας αρχικά κάθε πακέτο στο κατάλληλο υπο-πλέγμα. Έτσι, αντί να λυθεί ένα μεγάλο πρόβλημα δρομολόγησης σε ολόκληρο το πλέγμα, δημιουργούνται μικρότερα τοπικά προβλήματα που μπορούν να δρομολογηθούν παράλληλα. Μετά την πρώτη μετακίνηση κάθε επεξεργαστής περιέχει το πολύ δύο πακέτα και, μέσα σε κάθε υποπλέγμα, προκύπτει ένα <span class="glossary-term" data-term="mapping-22">(2,2)-mapping</span>, το οποίο μπορεί να αποσυντεθεί σε δύο ξεχωριστά προβλήματα δρομολόγησης που επιλύονται παράλληλα. Τέλος, τα πακέτα μετακινούνται από την ενδιάμεση θέση στον πραγματικό τους προορισμό.</span>' +
        '<div class="algo-source"><span lang="en">Source:</span><span lang="gr">Πηγή:</span> <span class="algo-source-text">D. Krizanc, L. Narayanan. Off-line routing with small queues on a mesh-connected processor array. In Proc. of the 3rd IEEE Symposium on Parallel and Distributed Processing (SPDP 91), IEEE Computer Society, pp. 301 - 304, 1991.</span></div>';
    const bigIdeaCard = {
        id: 'kn-bigidea', navLabel: '<span lang="en">Big idea</span><span lang="gr">Βασική ιδέα</span>', kind: 'theory', theory: null, interactive: false,
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

    const p1Theory =
        '<span lang="en">We split the &radic;N &times; &radic;N <span class="glossary-term" data-term="mesh">mesh</span> into 4 sub-meshes of side h = &radic;N/2, colored ' +
        knQuadChip(0) + ' (top-left), ' + knQuadChip(1) + ' (top-right), ' + knQuadChip(2) + ' (bottom-left) and ' + knQuadChip(3) + ' (bottom-right).<br><br>' +
        '<strong>Definition — ISM:</strong> for a <span class="glossary-term" data-term="packet">packet</span> at position (a,&thinsp;b) with destination (c,&thinsp;d), its <strong><span class="glossary-term" data-term="ism">Intermediate Sub-Mesh (ISM)</span></strong> is the unique sub-mesh that contains the node <strong>(c,&thinsp;b)</strong> — the row zone of the destination combined with the column zone of the source.<br><br>' +
        '<strong>Definition — <span class="glossary-term" data-term="virtual-source">Virtual source</span>:</strong> the position corresponding to (a,&thinsp;b) inside the ISM (same column b). This is where the packet must arrive after Phase 1.<br><br>' +
        '<strong>Definition — Virtual destination:</strong> the position corresponding to (c,&thinsp;d) inside the ISM (same row c). This is where the packet lands after Phase 2, in the same row as its true destination.<br><br>' +
        'A <span class="glossary-term" data-term="packet">packet</span> is already inside its ISM ("<strong>Short</strong>") when source and destination share the same row half; otherwise it must travel h = &radic;N/2 <span class="glossary-term" data-term="step">steps</span> vertically ("<strong>Long</strong>").</span>' +
        '<span lang="gr">Χωρίζουμε το <span class="glossary-term" data-term="mesh">πλέγμα</span> &radic;N &times; &radic;N σε 4 sub-mesh με πλευρά h = &radic;N/2, χρωματισμένα ' +
        knQuadChip(0) + ' (πάνω-αριστερά), ' + knQuadChip(1) + ' (πάνω-δεξιά), ' + knQuadChip(2) + ' (κάτω-αριστερά) και ' + knQuadChip(3) + ' (κάτω-δεξιά).<br><br>' +
        '<strong>Ορισμός — ISM:</strong> για <span class="glossary-term" data-term="packet">πακέτο</span> στη θέση (a,&thinsp;b) με προορισμό (c,&thinsp;d), το <strong><span class="glossary-term" data-term="ism">Intermediate Sub-Mesh (ISM)</span></strong> του είναι το μοναδικό sub-mesh που περιέχει τον κόμβο <strong>(c,&thinsp;b)</strong> — η ζώνη γραμμών του προορισμού σε συνδυασμό με τη ζώνη στηλών της πηγής.<br><br>' +
        '<strong>Ορισμός — <span class="glossary-term" data-term="virtual-source">Virtual source</span>:</strong> η θέση που αντιστοιχεί στην (a,&thinsp;b) μέσα στο ISM (ίδια στήλη b). Εκεί πρέπει να φτάσει το πακέτο μετά τη Φάση 1.<br><br>' +
        '<strong>Ορισμός — Virtual destination:</strong> η θέση που αντιστοιχεί στην (c,&thinsp;d) μέσα στο ISM (ίδια γραμμή c). Εκεί βρίσκεται το πακέτο μετά τη Φάση 2, στην ίδια γραμμή με τον πραγματικό του προορισμό.<br><br>' +
        'Ένα <span class="glossary-term" data-term="packet">πακέτο</span> βρίσκεται ήδη στο ISM του ("<strong>Short</strong>") όταν πηγή και προορισμός ανήκουν στο ίδιο ήμισυ γραμμών· αλλιώς πρέπει να διανύσει h = &radic;N/2 <span class="glossary-term" data-term="step">βήματα</span> κατακόρυφα ("<strong>Long</strong>").</span>';

    function buildKnNavRow(max, onStep) {
        var cur = 0;
        var row = document.createElement('div');
        row.className = 'coloring-ball-row';
        row.style.marginTop = '10px';
        var prevBtn = document.createElement('button');
        prevBtn.className = 'btn-secondary coloring-nav-btn';
        prevBtn.innerHTML = '&larr;';
        var stepLabel = document.createElement('div');
        stepLabel.className = 'step-nav-label';
        var dotsWrap = document.createElement('div');
        dotsWrap.className = 'coloring-balls-inner';
        var nextBtn = document.createElement('button');
        nextBtn.className = 'btn-primary coloring-nav-btn';
        nextBtn.innerHTML = '&rarr;';
        var skipBtn = document.createElement('button');
        skipBtn.className = 'btn-pale';
        skipBtn.style.marginLeft = '6px';
        skipBtn.innerHTML = '&rarr;&rarr;';
        skipBtn.title = isGrLang() ? 'Παράλειψη ως το τέλος' : 'Skip to the end';
        row.appendChild(prevBtn); row.appendChild(stepLabel); row.appendChild(dotsWrap); row.appendChild(nextBtn); row.appendChild(skipBtn);

        function renderLabel() {
            stepLabel.innerHTML = (cur === 0)
                ? '<span lang="en">Initial</span><span lang="gr">Αρχικό</span>'
                : ('<span lang="en">Step ' + cur + '</span><span lang="gr">Βήμα ' + cur + '</span>');
        }
        function renderDots() {
            dotsWrap.innerHTML = '';
            for (var i = 0; i <= max; i++) {
                var dot = document.createElement('button');
                dot.type = 'button';
                dot.className = 'coloring-ball' + (i === cur ? ' current' : '');
                dot.style.background = i === cur ? '#1a6bbd' : '#cdd5e0';
                (function(step) { dot.addEventListener('click', function() { goTo(step); }); })(i);
                dotsWrap.appendChild(dot);
            }
        }
        function goTo(n) {
            cur = Math.max(0, Math.min(max, n));
            renderLabel();
            renderDots();
            prevBtn.disabled = cur <= 0;
            nextBtn.disabled = cur >= max;
            skipBtn.disabled = cur >= max;
            onStep(cur);
        }
        prevBtn.addEventListener('click', function() { goTo(cur - 1); });
        nextBtn.addEventListener('click', function() { goTo(cur + 1); });
        skipBtn.addEventListener('click', function() { goTo(max); });
        row._goTo = goTo;
        return row;
    }

    const p1TheoryCard = {
        id: 'kn-p1-theory', kind: 'theory', theory: p1Theory, interactive: false,
        render: function (body) {
            const div = document.createElement('div');
            div.className = 'substep-explain';
            div.innerHTML = p1Theory;
            body.appendChild(div);
        }
    };

    const p1ActionCard = {
        id: 'kn-p1-action', navLabel: '<span lang="en">ISM</span><span lang="gr">ISM</span>', kind: 'action', theory: p1Theory, interactive: true,
        render: function (body, api) {
            const desc = document.createElement('p');
            desc.className = 'substep-explain';
            desc.innerHTML =
                '<span lang="en">Compute the <span class="glossary-term" data-term="ism">intermediate sub-mesh</span> for all packets.</span>' +
                '<span lang="gr">Υπολογίζουμε το <span class="glossary-term" data-term="ism">intermediate sub-mesh</span> όλων των πακέτων.</span>';
            body.appendChild(desc);

            const positions0 = {};
            packets.forEach(function (p) { positions0[p.sourceRow + ',' + p.sourceCol] = [p]; });

            const gridSlot = document.createElement('div');
            gridSlot.style.marginTop = '12px';
            body.appendChild(gridSlot);

            knDrawGrid(gridSlot, positions0, n, half, { plain: true, reserve: 1 });

            const computeBtn = document.createElement('button');
            computeBtn.className = 'btn-primary';
            computeBtn.style.marginTop = '12px';
            computeBtn.innerHTML = '<span lang="en">Compute intermediate sub-meshes</span><span lang="gr">Υπολογισμός intermediate sub-mesh</span>';
            body.appendChild(computeBtn);

            const footnote = document.createElement('div');
            footnote.style.fontSize = '11px';
            footnote.style.color = '#888';
            footnote.style.marginTop = '8px';
            footnote.style.display = 'none';
            footnote.innerHTML =
                '<span lang="en">Division into sub-meshes by color and computation of each ISM (hover for details).</span>' +
                '<span lang="gr">Διαχωρισμός σε sub-mesh ανά χρώμα και υπολογισμός των ISM (hover για λεπτομέρειες).</span>';
            body.appendChild(footnote);

            computeBtn.addEventListener('click', function () {

                knDrawGrid(gridSlot, positions0, n, half, { tint: true, reserve: 1, onHover: hoverFn });
                footnote.style.display = 'block';
                computeBtn.style.display = 'none';
                api.complete();
            });
        }
    };

    const p2Theory =
        '<span lang="en"><strong>Goal of Phase 1:</strong> every <span class="glossary-term" data-term="packet">packet</span> moves within its column at distance 0 or h = &radic;N/2 to reach its <span class="glossary-term" data-term="virtual-source">virtual source</span> after h <span class="glossary-term" data-term="step">steps</span>. To do this while maintaining the constraint of at most 2 packets per processor at every step, we compute each packet\'s path as follows:<br><br>' +
        'Let each column have size 2h. If the packet is <strong>not</strong> in its ISM, we call it a <strong>Long</strong> packet and compute its position (L<sub>i</sub>(t),&thinsp;col) at step t as:<br>' +
        '&emsp;L<sub>i</sub>(t) = i + t &nbsp; for 1 &le; i &le; h &nbsp;&nbsp; (top half: moves down)<br>' +
        '&emsp;L<sub>i</sub>(t) = i &minus; t &nbsp; for h &lt; i &le; 2h &nbsp;&nbsp; (bottom half: moves up)<br><br>' +
        'If the packet is <strong>already</strong> in its ISM it must end at the same position (distance = 0). We call it a <strong>Short</strong> packet. Due to the queue constraint, Short packets temporarily move toward the edges to make room for passing Long packets. The position (S<sub>i</sub>(t),&thinsp;col) at step t is given by, for 1 &le; i &le; h where s(t) = min(t, h&minus;t):<br>' +
        '&emsp;S<sub>i</sub>(t) = &lceil;i/2&rceil; &ensp; if i &le; 2s(t)<br>' +
        '&emsp;S<sub>i</sub>(t) = i &minus; s(t) &ensp; if i &gt; 2s(t)<br>' +
        'For h &lt; i &le; 2h (bottom half), with the same s(t):<br>' +
        '&emsp;S<sub>i</sub>(t) = i + s(t) &ensp; if i &le; 2h &minus; 2s(t)<br>' +
        '&emsp;S<sub>i</sub>(t) = &lfloor;(2h+1+i)/2&rfloor; &ensp; if i &gt; 2h &minus; 2s(t)</span>' +
        '<span lang="gr"><strong>Στόχος της Φάσης 1:</strong> κάθε <span class="glossary-term" data-term="packet">πακέτο</span> κινείται στη στήλη του σε απόσταση 0 ή h = &radic;N/2 ώστε να φτάσει στη <span class="glossary-term" data-term="virtual-source">virtual source</span> του μετά από h <span class="glossary-term" data-term="step">βήματα</span>. Για να γίνει αυτό διατηρώντας τον περιορισμό των 2 πακέτων ανά επεξεργαστή σε κάθε βήμα, υπολογίζουμε το μονοπάτι κάθε πακέτου ως εξής:<br><br>' +
        'Έστω κάθε στήλη μεγέθους 2h. Αν το πακέτο <strong>δεν</strong> βρίσκεται στο ISM του, το χαρακτηρίζουμε <strong>Long</strong> και υπολογίζουμε τη θέση (L<sub>i</sub>(t),&thinsp;col) στο βήμα t ως:<br>' +
        '&emsp;L<sub>i</sub>(t) = i + t &nbsp; για 1 &le; i &le; h &nbsp;&nbsp; (άνω ήμισυ: κατεβαίνει)<br>' +
        '&emsp;L<sub>i</sub>(t) = i &minus; t &nbsp; για h &lt; i &le; 2h &nbsp;&nbsp; (κάτω ήμισυ: ανεβαίνει)<br><br>' +
        'Αν το πακέτο βρίσκεται <strong>ήδη</strong> στο ISM του, πρέπει στο τέλος να είναι στον ίδιο επεξεργαστή (απόσταση = 0). Το χαρακτηρίζουμε <strong>Short</strong>. Λόγω του περιορισμού ουράς, τα Short πακέτα κινούνται προσωρινά προς τα άκρα για να «δημιουργήσουν χώρο» στα διερχόμενα Long. Η θέση (S<sub>i</sub>(t),&thinsp;col) στο βήμα t δίνεται, για 1 &le; i &le; h όπου s(t) = min(t, h&minus;t), από:<br>' +
        '&emsp;S<sub>i</sub>(t) = &lceil;i/2&rceil; &ensp; αν i &le; 2s(t)<br>' +
        '&emsp;S<sub>i</sub>(t) = i &minus; s(t) &ensp; αν i &gt; 2s(t)<br>' +
        'Για h &lt; i &le; 2h (κάτω ήμισυ), με το ίδιο s(t):<br>' +
        '&emsp;S<sub>i</sub>(t) = i + s(t) &ensp; αν i &le; 2h &minus; 2s(t)<br>' +
        '&emsp;S<sub>i</sub>(t) = &lfloor;(2h+1+i)/2&rfloor; &ensp; αν i &gt; 2h &minus; 2s(t)</span>'
    const p2TheoryCard = {
        id: 'kn-p2-theory', kind: 'theory', theory: p2Theory, interactive: false,
        render: function (body) {
            const div = document.createElement('div');
            div.className = 'substep-explain';
            div.innerHTML = p2Theory;
            body.appendChild(div);
        }
    };

    const p2ActionCard = {
        id: 'kn-p2-action', navLabel: '<span lang="en">Phase 1</span><span lang="gr">Φάση 1</span>', kind: 'action', theory: p2Theory, interactive: true,
        render: function (body, api) {
            const desc = document.createElement('p');
            desc.className = 'substep-explain';
            desc.innerHTML =
                '<span lang="en">Goal of Phase 1: every <span class="glossary-term" data-term="packet">packet</span> moves within its column to reach its <span class="glossary-term" data-term="virtual-source">virtual source</span>.</span>' +
                '<span lang="gr">Στόχος της Φάσης 1: κάθε <span class="glossary-term" data-term="packet">πακέτο</span> κινείται στη στήλη ώστε να φτάσει στη <span class="glossary-term" data-term="virtual-source">virtual source</span> του.</span>';
            body.appendChild(desc);

            const startPositions = {};
            packets.forEach(function (p) { startPositions[p.sourceRow + ',' + p.sourceCol] = [p]; });

            const gridSlot = document.createElement('div');
            gridSlot.style.marginTop = '12px';
            body.appendChild(gridSlot);
            knDrawGrid(gridSlot, startPositions, n, half, {
                tint: true, onHover: hoverFn,
                getDirection: function (p) {
                    if (p.vsRow === p.sourceRow) return null;
                    return { arrow: p.vsRow > p.sourceRow ? '↓' : '↑' };
                }
            });

            const moveBtn = document.createElement('button');
            moveBtn.className = 'btn-primary';
            moveBtn.style.marginTop = '12px';
            moveBtn.innerHTML = '<span lang="en">Move to virtual source</span><span lang="gr">Μετακίνηση στο virtual source</span>';
            body.appendChild(moveBtn);

            const navRow = buildKnNavRow(half, function (t) {
                const p2traj = body._p2traj;
                if (!p2traj) return;
                const gr = isGrLang();
                knDrawGrid(gridSlot, knPositionsAt(packets, p2traj, t), n, half, {
                    tint: true,
                    onHover: function (p, r, c) {
                        const isLong = (p.vsRow !== p.sourceRow);
                        const typeLabel = isLong
                            ? (gr ? '<strong>Long</strong> — μετακινείται προς το ISM του' : '<strong>Long</strong> — moving to its ISM')
                            : (gr ? '<strong>Short</strong> — βρίσκεται ήδη στο ISM του' : '<strong>Short</strong> — already in its ISM');
                        return hoverFn(p, r, c) + '<br>' + typeLabel;
                    },
                    getDirection: function (p) {
                        const arr = p2traj[p.id];
                        if (!arr || t >= arr.length - 1) return null;
                        const cur = arr[t], nxt = arr[t + 1];
                        if (nxt.r > cur.r) return { arrow: '\u2193' };
                        if (nxt.r < cur.r) return { arrow: '\u2191' };
                        return null;
                    }
                });
            });
            navRow.style.display = 'none';
            body.appendChild(navRow);

            const stepToggleBtn = document.createElement('button');
            stepToggleBtn.className = 'btn-secondary';
            stepToggleBtn.style.marginTop = '10px';
            stepToggleBtn.style.display = 'none';
            stepToggleBtn.innerHTML = '<span lang="en">Show step by step</span><span lang="gr">Δείξε βήμα-βήμα</span>';
            body.appendChild(stepToggleBtn);

            moveBtn.addEventListener('click', function () {
                const p2traj = knBuildPhase2Traj(packets, n, half);
                body._p2traj = p2traj;
                knDrawGrid(gridSlot, knPositionsAt(packets, p2traj, half), n, half, { tint: true, onHover: hoverFn });
                moveBtn.style.display = 'none';
                stepToggleBtn.style.display = 'inline-block';
                api.complete();
            });

            let shown = false;
            stepToggleBtn.addEventListener('click', function () {
                shown = !shown;
                navRow.style.display = shown ? '' : 'none';
                stepToggleBtn.innerHTML = shown
                    ? '<span lang="en">Hide step by step</span><span lang="gr">Κρύψε βήμα-βήμα</span>'
                    : '<span lang="en">Show step by step</span><span lang="gr">Δείξε βήμα-βήμα</span>';
                if (shown) {
                    navRow._goTo(0);
                } else {
                    const p2traj = body._p2traj;
                    if (p2traj) knDrawGrid(gridSlot, knPositionsAt(packets, p2traj, half), n, half, { tint: true, onHover: hoverFn });
                }
            });
        }
    };

    const p3Theory =
        '<span lang="en">After Phase 1, every processor is the <span class="glossary-term" data-term="virtual-source">virtual source</span> of 0, 1 or 2 <span class="glossary-term" data-term="packet">packets</span> and the virtual destination of 0, 1 or 2 packets. So within each sub-mesh we get a <strong><span class="glossary-term" data-term="mapping-22">(2,2)-mapping</span></strong>. The routing of the (2,2)-mapping can be decomposed into two (1,1) routing problems, which we turn into <span class="glossary-term" data-term="permutation">permutation</span> problems by inserting dummy packets where needed. The 2 permutations are routed in parallel without ever using the same edges, with at most 2 packets per processor at every step.<br><br>' +
        'We build a bipartite graph with one red node per processor of the sub-mesh (N/4 in total) as a virtual source and the same number of blue nodes as virtual destinations. For every packet we add an edge from the red node of its virtual source to the blue node of its virtual destination. Since each processor is the virtual source of 0, 1 or 2 packets and the virtual destination of 0, 1 or 2, every node has degree at most 2: we add dummy edges until every node has exactly 2, that is, until the graph is <strong>2-regular</strong>.<br><br>' +
        'A 2-regular graph decomposes into disjoint <strong>cycles</strong>, and since it is bipartite every cycle has even length. Walking each cycle and coloring its edges alternately, no node ends up with two edges of the same color. Each color is therefore a <strong>permutation</strong>. With packets split into permutations A and B, we route them in parallel. Permutation A is routed with 3 executions of <span class="glossary-term" data-term="odd-even">odd-even transposition sort</span> (column – row – column) and Permutation B with 3 executions (row – column – row). The permutations complete in 3 &times; &radic;N/2 <span class="glossary-term" data-term="step">steps</span> and run in parallel, since they never use the same edges at any step.</span>' +
        '<span lang="gr">Μετά την ολοκλήρωση της Φάσης 1, κάθε επεξεργαστής αποτελεί <span class="glossary-term" data-term="virtual-source">virtual source</span> για 0, 1 ή 2 <span class="glossary-term" data-term="packet">πακέτα</span> και virtual destination για 0, 1 ή 2 πακέτα. Επομένως, μέσα σε κάθε υποπλέγμα προκύπτει ένα <strong><span class="glossary-term" data-term="mapping-22">(2,2)-mapping</span></strong>. Η δρομολόγηση του (2,2)-mapping μπορεί να αποσυντεθεί σε δύο προβλήματα (1,1) δρομολόγησης, τα οποία μετατρέπουμε σε προβλήματα <span class="glossary-term" data-term="permutation">μετάθεσης</span> με την εισαγωγή εικονικών πακέτων όπου χρειάζεται. Οι 2 μεταθέσεις δρομολογούνται παράλληλα χωρίς να χρησιμοποιούν τις ίδιες ακμές, με το πολύ 2 πακέτα ανά επεξεργαστή σε κάθε βήμα.<br><br>' +
        'Φτιάχνουμε ένα διμερές γράφημα με έναν κόκκινο κόμβο ανά επεξεργαστή του υποπλέγματος (N/4 συνολικά) ως virtual source και ισάριθμους μπλε κόμβους ως virtual destination. Για κάθε πακέτο προσθέτουμε μια ακμή από τον κόκκινο κόμβο του virtual source του προς τον μπλε κόμβο του virtual destination του. Επειδή κάθε επεξεργαστής είναι virtual source για 0, 1 ή 2 πακέτα και virtual destination για 0, 1 ή 2, κάθε κόμβος έχει βαθμό το πολύ 2: συμπληρώνουμε με dummy ακμές μέχρι κάθε κόμβος να έχει ακριβώς 2, δηλαδή μέχρι το γράφημα να γίνει <strong>2-κανονικό</strong>.<br><br>' +
        'Ένα 2-κανονικό γράφημα διασπάται σε ξένους μεταξύ τους <strong>κύκλους</strong>, και επειδή είναι διμερές κάθε κύκλος έχει άρτιο μήκος. Ακολουθώντας κάθε κύκλο και χρωματίζοντας τις ακμές του εναλλάξ, κανένας κόμβος δεν καταλήγει με δύο ακμές ίδιου χρώματος. Κάθε χρώμα είναι έτσι μια <strong>μετάθεση</strong>. Με τα πακέτα χωρισμένα σε μεταθέσεις Α και Β, τα δρομολογούμε παράλληλα. Η Μετάθεση Α δρομολογείται με 3 εκτελέσεις του <span class="glossary-term" data-term="odd-even">odd-even transposition sort</span> (στήλη – γραμμή – στήλη) και η Μετάθεση Β με 3 εκτελέσεις (γραμμή – στήλη – γραμμή). Οι μεταθέσεις ολοκληρώνονται σε 3 &times; &radic;N/2 <span class="glossary-term" data-term="step">βήματα</span> και εκτελούνται παράλληλα, αφού δεν χρησιμοποιούν σε κανένα βήμα τις ίδιες ακμές.</span>'
    const p3TheoryCard = {
        id: 'kn-p3-theory', kind: 'theory', theory: p3Theory, interactive: false,
        render: function (body) {
            const div = document.createElement('div');
            div.className = 'substep-explain';
            div.innerHTML = p3Theory;
            body.appendChild(div);
        }
    };

    const KN_AXIS_COLOR = { col: '#1a6bbd', row: '#c26a1a' };
    function knAxisWord(axis) {
        const gr = isGrLang();
        return axis === 'col' ? (gr ? 'στήλη' : 'column') : (gr ? 'γραμμή' : 'row');
    }

    function knAxisWordGr(axis) { return axis === 'col' ? 'στήλη' : 'γραμμή'; }
    function knOddEvenLabel(axis) {
        return '<span lang="en">Odd-even per ' + (axis === 'col' ? 'column' : 'row') + '</span>' +
            '<span lang="gr">Odd-even ανά ' + knAxisWordGr(axis) + '</span>';
    }

    function knPermIntroText(permIdx) {
        const isA = permIdx === 1;
        const scheme = isA ? 'column &rarr; row &rarr; column' : 'row &rarr; column &rarr; row';
        const schemeGr = isA ? 'στήλη &rarr; γραμμή &rarr; στήλη' : 'γραμμή &rarr; στήλη &rarr; γραμμή';
        const oddEven = '<span class="glossary-term" data-term="odd-even">odd-even transposition sort</span>';
        if (isA) {
            return '<span lang="en"><strong>' + knPermChip(1) + '</strong> is routed with three executions of ' + oddEven + ', in the order ' + scheme + '. In the first execution, we rearrange the packets within each column so that each row ends up with packets having different virtual-destination columns. We then route each row, and finally each column, so that every packet of A reaches its virtual destination.<br><br>' +
                'The rearrangement of the first execution is computed with a bipartite graph and a <strong>Hall matching</strong>: left nodes are the column each packet is currently in, right nodes are the column of its virtual destination (one edge per processor), colored so that no node has two edges of the same color. The color of each packet is the <strong>intermediate row</strong> it must reach by the end of the first execution.</span>' +
                '<span lang="gr"><strong>' + knPermChip(1) + '</strong> δρομολογείται με τρεις εκτελέσεις του ' + oddEven + ', με τη σειρά ' + schemeGr + '. Στην πρώτη εκτέλεση, αναδιατάσσουμε τα πακέτα σε κάθε στήλη με τρόπο τέτοιο ώστε σε κάθε γραμμή να βρεθούν πακέτα με διαφορετική στήλη virtual destination. Στη συνέχεια δρομολογούμε κάθε γραμμή και τέλος κάθε στήλη, ώστε όλα τα πακέτα της Α να βρεθούν στο virtual destination τους.<br><br>' +
                'Ο υπολογισμός της αναδιάταξης της πρώτης εκτέλεσης γίνεται με ένα διμερές γράφημα και <strong>ταίριασμα Hall</strong>: αριστερά η στήλη στην οποία βρίσκεται κάθε πακέτο, δεξιά η στήλη του virtual destination του (μία ακμή ανά επεξεργαστή), χρωματισμένο ώστε κανένας κόμβος να μην έχει δύο ακμές ίδιου χρώματος. Το χρώμα κάθε πακέτου είναι η <strong>ενδιάμεση γραμμή</strong> στην οποία πρέπει να βρεθεί μέχρι το τέλος της πρώτης εκτέλεσης.</span>';
        }
        return '<span lang="en"><strong>' + knPermChip(2) + '</strong> is routed with three executions of ' + oddEven + ', in the order ' + scheme + '. In the first execution, we rearrange the packets within each row so that each column ends up with packets having different virtual-destination rows. We then route each column, and finally each row, so that every packet of B reaches its virtual destination.<br><br>' +
            'The rearrangement of the first execution is computed with a bipartite graph and a <strong>Hall matching</strong>: left nodes are the row each packet is currently in, right nodes are the row of its virtual destination (one edge per processor), colored so that no node has two edges of the same color. The color of each packet is the <strong>intermediate column</strong> it must reach by the end of the first execution.</span>' +
            '<span lang="gr"><strong>' + knPermChip(2) + '</strong> δρομολογείται με τρεις εκτελέσεις του ' + oddEven + ', με τη σειρά ' + schemeGr + '. Στην πρώτη εκτέλεση, αναδιατάσσουμε τα πακέτα σε κάθε γραμμή με τρόπο τέτοιο ώστε σε κάθε στήλη να βρεθούν πακέτα με διαφορετική γραμμή virtual destination. Στη συνέχεια δρομολογούμε κάθε στήλη και τέλος κάθε γραμμή, ώστε όλα τα πακέτα της Β να βρεθούν στο virtual destination τους.<br><br>' +
            'Ο υπολογισμός της αναδιάταξης της πρώτης εκτέλεσης γίνεται με ένα διμερές γράφημα και <strong>ταίριασμα Hall</strong>: αριστερά η γραμμή στην οποία βρίσκεται κάθε πακέτο, δεξιά η γραμμή του virtual destination του (μία ακμή ανά επεξεργαστή), χρωματισμένο ώστε κανένας κόμβος να μην έχει δύο ακμές ίδιου χρώματος. Το χρώμα κάθε πακέτου είναι η <strong>ενδιάμεση στήλη</strong> στην οποία πρέπει να βρεθεί μέχρι το τέλος της πρώτης εκτέλεσης.</span>';
    }

    function knBothIntroText() {
        return '<span lang="en"><strong>Both permutations together:</strong> in every sub-phase, while ' + knPermChip(1) + ' moves along columns, ' + knPermChip(2) + ' moves along rows and vice versa &mdash; they never share an edge, and every processor holds at most 1 packet of each (queue &le; 2). Each sub-phase lasts as long as the slower of the two.</span>' +
            '<span lang="gr"><strong>Οι δύο μεταθέσεις μαζί:</strong> σε κάθε υπο-φάση, όσο η ' + knPermChip(1) + ' κινείται σε στήλες, η ' + knPermChip(2) + ' κινείται σε γραμμές και αντίστροφα &mdash; δεν μοιράζονται ποτέ ακμή, και κάθε επεξεργαστής κρατά το πολύ 1 πακέτο από την καθεμία (ουρά &le; 2). Κάθε υπο-φάση διαρκεί όσο η αργότερη από τις δύο.</span>';
    }

    function knOddEvenStepText(t, boundaries, mode, permIdx) {
        const gr = isGrLang();
        const s = knSubphaseIndex(t, boundaries);
        const relT = t - boundaries[s];
        const segLen = boundaries[s + 1] - boundaries[s];
        const oddEven = '<span class="glossary-term" data-term="odd-even">odd-even transposition</span>';
        const stepTxt = (gr ? 'Βήμα ' : 'Step ') + relT + '/' + segLen;
        const tail = ' <span style="color:#888;">(' + (gr ? 'υπο-φάση ' : 'sub-phase ') + (s + 1) + '/3)</span>';
        function line(pi) {
            const axis = knSchemeAxes(pi)[s];
            return knPermChip(pi) + ' &rarr; ' + oddEven + (gr ? ' σε κάθε ' : ' per ') + knAxisWord(axis);
        }
        if (mode === 'solo') {
            return line(permIdx) + ' &mdash; <strong>' + stepTxt + '</strong>' + tail;
        }
        return line(1) + '<br>' + line(2) + '<br><strong>' + stepTxt + '</strong>' + tail;
    }

    /* Step timeline */
    function knMakeTimeline(steps, opts) {
        opts = opts || {};
        const box = document.createElement('div');
        box.className = 'coloring-control-box';
        box.style.marginTop = '12px';

        const ballRow = document.createElement('div');
        ballRow.className = 'coloring-ball-row';
        const prevBtn = document.createElement('button');
        prevBtn.className = 'btn-secondary coloring-nav-btn';
        prevBtn.innerHTML = '&larr;';
        const stepLabel = document.createElement('div');
        stepLabel.className = 'step-nav-label';
        const ballsInner = document.createElement('div');
        ballsInner.className = 'coloring-balls-inner';
        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn-primary coloring-nav-btn';
        nextBtn.innerHTML = '&rarr;';
        ballRow.appendChild(prevBtn);
        ballRow.appendChild(stepLabel);
        ballRow.appendChild(ballsInner);
        ballRow.appendChild(nextBtn);
        box.appendChild(ballRow);

        const descBox = document.createElement('div');
        descBox.className = 'coloring-desc-text';
        box.appendChild(descBox);

        const skipRow = document.createElement('div');
        skipRow.className = 'coloring-skip-row';

        // Skip to the end of the current group. opts.groupSkip is its label, or
        // false when the groups of this timeline are not worth skipping over.
        const skipGroupBtn = document.createElement('button');
        skipGroupBtn.className = 'btn-pale';
        if (opts.groupSkip) skipGroupBtn.innerHTML = opts.groupSkip;

        // Optional middle jump, e.g. past the whole Hall coloring.
        const skipMidBtn = document.createElement('button');
        skipMidBtn.className = 'btn-pale';
        if (opts.midSkip) skipMidBtn.innerHTML = opts.midSkip.label;

        const skipAllBtn = document.createElement('button');
        skipAllBtn.className = 'btn-pale';
        skipAllBtn.innerHTML = '<span lang="en">Skip to the end</span><span lang="gr">Παράλειψη ως το τέλος</span>';

        if (opts.groupSkip) skipRow.appendChild(skipGroupBtn);
        if (opts.midSkip) skipRow.appendChild(skipMidBtn);
        skipRow.appendChild(skipAllBtn);
        box.appendChild(skipRow);

        const groups = [];
        steps.forEach(function (s, i) {
            const last = groups[groups.length - 1];
            if (last && last.g === s.group) last.end = i;
            else groups.push({ g: s.group, start: i, end: i, color: s.color });
        });
        function groupOf(i) {
            for (let k = 0; k < groups.length; k++) if (i >= groups[k].start && i <= groups[k].end) return groups[k];
            return groups[0];
        }

        let idx = 0;

        function renderBalls() {
            ballsInner.innerHTML = '';
            groups.forEach(function (gr) {
                if (idx < gr.start) return;   // reveal bookmarks as they are reached
                const dot = document.createElement('button');
                dot.type = 'button';
                dot.className = 'coloring-ball' + (idx >= gr.start && idx <= gr.end ? ' current' : '');
                dot.style.background = gr.color || '#cdd5e0';
                dot.addEventListener('click', function () { goTo(gr.start); });
                ballsInner.appendChild(dot);
            });
        }

        function goTo(i) {
            idx = Math.max(0, Math.min(steps.length - 1, i));
            steps[idx].draw(idx);
            descBox.innerHTML = steps[idx].text(idx);

            stepLabel.innerHTML = steps[idx].label || '';
            renderBalls();
            prevBtn.disabled = idx <= 0;
            nextBtn.disabled = idx >= steps.length - 1;
            const gr = groupOf(idx);
            if (opts.groupSkip) {
                skipGroupBtn.style.display = (idx < gr.end) ? 'inline-block' : 'none';
                skipGroupBtn.onclick = function () { goTo(gr.end); };
            }
            if (opts.midSkip) {
                skipMidBtn.style.display = (idx < opts.midSkip.index) ? 'inline-block' : 'none';
                skipMidBtn.onclick = function () { goTo(opts.midSkip.index); };
            }
            skipAllBtn.style.display = (idx >= steps.length - 1) ? 'none' : 'inline-block';

            if (idx >= steps.length - 1 && typeof opts.onEnd === 'function') opts.onEnd();
        }

        prevBtn.addEventListener('click', function () { goTo(idx - 1); });
        nextBtn.addEventListener('click', function () { goTo(idx + 1); });
        skipAllBtn.addEventListener('click', function () { goTo(steps.length - 1); });

        return {
            el: box,
            goTo: goTo,
            redraw: function () { goTo(idx); },
            goToEnd: function () { goTo(steps.length - 1); },
            isAtEnd: function () { return idx >= steps.length - 1; }
        };
    }

    function knPhase2CanvasHeight() {
        const h = window.innerHeight;
        if (window.innerWidth <= 900) return Math.round(Math.max(220, Math.min(h * 0.42, 420)));
        return Math.round(Math.max(280, Math.min(620, h - KN_P2_CHROME)));
    }

    const p3ActionCard = {
        id: 'kn-p3-action', navLabel: '<span lang="en">Phase 2</span><span lang="gr">Φάση 2</span>', kind: 'action', theory: p3Theory, interactive: true,
        render: function (body, api) {

            const markRouted = function () { api.complete(); };
            const content = document.createElement('div');
            content.dataset.zoomHeight = knPhase2CanvasHeight();
            body.appendChild(content);

            // A sub-mesh view is far taller than the menu, and opening one does
            // not re-render the card, so bring the card back into view here.
            const refitCard = function () {
                if (typeof scrollCardIntoView === 'function') scrollCardIntoView(body.parentElement);
            };

            function buildStep3NavRow(activeKey) {
                const btnRow = document.createElement('div');
                btnRow.style.marginBottom = '14px';
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

                return btnRow;
            }

            function buildSubphaseRow(onSelect) {
                const row = document.createElement('div');
                row.className = 'kn-subphase-row';
                const label = document.createElement('span');
                label.className = 'kn-subphase-label';
                label.innerHTML = '<span lang="en">Sub-phase</span><span lang="gr">Υπο-φάση</span>';
                row.appendChild(label);
                const btns = [];
                [
                    '<span lang="en">1. Decomposition</span><span lang="gr">1. Αποσύνθεση</span>',
                    '<span lang="en">2. Routing</span><span lang="gr">2. Δρομολόγηση</span>'
                ].forEach(function (labelHtml, i) {
                    const b = document.createElement('button');
                    b.className = 'btn-secondary';
                    b.innerHTML = labelHtml;
                    b.addEventListener('click', function () { onSelect(i); });
                    row.appendChild(b);
                    btns.push(b);
                });
                row._setActive = function (i) {
                    btns.forEach(function (b, k) { b.className = k === i ? 'btn-primary' : 'btn-secondary'; });
                };
                row._setEnabled = function (i, enabled) { btns[i].disabled = !enabled; };
                return row;
            }

            function renderMenu() {
                content.innerHTML = '';

                const pickNote = document.createElement('div');
                pickNote.className = 'substep-explain';
                pickNote.style.marginBottom = '12px';
                pickNote.innerHTML =
                    '<span lang="en">Goal of Phase 2: solve the routing problem separately in each sub-mesh.</span>' +
                    '<span lang="gr">Στόχος της Φάσης 2: λύνουμε το πρόβλημα δρομολόγησης ξεχωριστά σε κάθε sub-mesh.</span>';
                content.appendChild(pickNote);

                content.appendChild(buildStep3NavRow(null));

                const overviewGrid = document.createElement('div');
                content.appendChild(overviewGrid);
                knDrawGrid(overviewGrid, knPositionsAt(packets, traj2, 0), n, half, { tint: true, onHover: hoverFn });
            }

            function renderQuadView(Q) {
                content.innerHTML = '';

                if (Q._view) { content.appendChild(Q._view); refitCard(); return; }
                const view = document.createElement('div');
                Q._view = view;
                content.appendChild(view);

                const rowStart = Q.qRow0 + 1, rowEnd = Q.qRow0 + half;
                const colStart = Q.qCol0 + 1, colEnd = Q.qCol0 + half;
                const subOpts = { tint: true, rowStart: rowStart, rowEnd: rowEnd, colStart: colStart, colEnd: colEnd };

                knAttachLinkHighlighting(view);

                const head = document.createElement('div');
                head.className = 'substep-explain';
                head.innerHTML =
                    '<span lang="en">Phase 2 is split into 2 sub-phases: 1. Decomposition of the <span class="glossary-term" data-term="mapping-22">(2,2)-mapping</span> into 2 <span class="glossary-term" data-term="permutation">permutations</span> and 2. Parallel routing of the permutations.</span>' +
                    '<span lang="gr">Η Φάση 2 χωρίζεται σε 2 υπο-φάσεις: 1. Αποσύνθεση του <span class="glossary-term" data-term="mapping-22">(2,2)-mapping</span> σε 2 <span class="glossary-term" data-term="permutation">μεταθέσεις</span> και 2. Παράλληλη δρομολόγηση των μεταθέσεων.</span>';
                view.appendChild(head);

                view.appendChild(buildStep3NavRow(Q.key));

                const subphaseRow = buildSubphaseRow(function (i) { selectSubphase(i); });
                subphaseRow._setEnabled(1, !!Q._decompDone);
                view.appendChild(subphaseRow);

                const permNav = document.createElement('div');
                permNav.className = 'kn-subphase-row';
                permNav.style.display = 'none';
                const permNavBtns = [];
                [
                    '<span lang="en">' + KN_PERM[0].en + '</span><span lang="gr">' + KN_PERM[0].gr + '</span>',
                    '<span lang="en">' + KN_PERM[1].en + '</span><span lang="gr">' + KN_PERM[1].gr + '</span>',
                    '<span lang="en">Both together</span><span lang="gr">Οι δύο μαζί</span>'
                ].forEach(function (labelHtml, i) {
                    const b = document.createElement('button');
                    b.className = 'btn-secondary';
                    b.innerHTML = labelHtml;
                    b.addEventListener('click', function () { selectPermView(i); });
                    permNav.appendChild(b);
                    permNavBtns.push(b);
                });
                view.appendChild(permNav);

                const cols = makeTwoCols(view,
                    'Sub-mesh', 'Sub-mesh',
                    'Γράφημα', 'Graph');
                const gridHolder = cols.left.grid;
                const graphDecomp = document.createElement('div');
                const graphA = document.createElement('div');
                const graphB = document.createElement('div');
                [graphDecomp, graphA, graphB].forEach(function (g) { cols.right.grid.appendChild(g); });

                const ctrlHolder = document.createElement('div');
                view.appendChild(ctrlHolder);

                function showGraph(which) {
                    graphDecomp.style.display = which === 'decomp' ? '' : 'none';
                    graphA.style.display = which === 'A' ? '' : 'none';
                    graphB.style.display = which === 'B' ? '' : 'none';
                    cols.right.wrap.style.display = which ? '' : 'none';
                }

                function cellLabel(idx) {
                    const lr = Math.floor(idx / half), lc = idx % half;
                    return '(' + (lr + 1 + Q.qRow0) + ',' + (lc + 1 + Q.qCol0) + ')';
                }

                const nodeLabels = [];
                for (let i = 0; i < half * half; i++) nodeLabels.push({ label: cellLabel(i) });

                const colorOrder = [];
                Q.split.cyclesLog.forEach(function (cyc, ci) {
                    cyc.forEach(function (e, j) {
                        colorOrder.push({ e: e, ci: ci, isFirst: j === 0, isLast: j === cyc.length - 1 });
                    });
                });
                const mEdges = colorOrder.length;

                function decompCaption(withColors) {
                    const gr = isGrLang();
                    const base = gr
                        ? '<span style="color:#c0392b">&#9679;</span> επεξεργαστής ως virtual source &nbsp;&nbsp; <span style="color:#2255c0">&#9679;</span> επεξεργαστής ως virtual destination'
                        : '<span style="color:#c0392b">&#9679;</span> processor as virtual source &nbsp;&nbsp; <span style="color:#2255c0">&#9679;</span> processor as virtual destination';
                    if (!withColors) return base;
                    return base + '<br>' + knPermChip(1) + ' &nbsp;&nbsp; ' + knPermChip(2) + ' &nbsp;&nbsp; ' +
                        (gr ? '<span style="color:#999;">γκρι = άχρωμη ακόμα</span> (διακεκομμένες = dummy)'
                            : '<span style="color:#999;">gray = not colored yet</span> (dashed = dummy)');
                }

                function drawDecompGraph(revealed, edgesBuilt) {
                    if (!edgesBuilt) {
                        knDrawBipartite(graphDecomp, nodeLabels, nodeLabels, [], decompCaption(false));
                        return;
                    }
                    const done = new Set();
                    for (let i = 0; i < revealed; i++) done.add(colorOrder[i].e);
                    const lastEdge = revealed > 0 ? colorOrder[revealed - 1].e : null;
                    const edges = Q.split.edges.map(function (e) {
                        const colored = done.has(e);
                        return {
                            li: e.u, ri: e.v,
                            stroke: colored ? KN_PERM[e.perm - 1].color : null,
                            dash: e.dummy,
                            width: (e === lastEdge) ? 3.6 : (e.dummy ? 1.4 : 2.4),
                            title: e.dummy
                                ? (isGrLang() ? 'dummy ακμή' : 'dummy edge')
                                : ((isGrLang() ? 'Πακέτο ' : 'Packet ') + '(' + e.packet.destRow + ',' + e.packet.destCol + '): vs ' + cellLabel(e.u) + ' \u2192 vd ' + cellLabel(e.v)),
                            packetId: e.dummy ? null : e.packet.id
                        };
                    });
                    knDrawBipartite(graphDecomp, nodeLabels, nodeLabels, edges, decompCaption(true));
                }

                function drawDecompGrid(colored) {
                    knDrawGrid(gridHolder, knPositionsAt(Q.packets, Q.qTraj, 0), n, half,
                        Object.assign(colored
                            ? { onHover: hoverWithPerm, getStyle: permStyle }
                            : { onHover: hoverFn }, subOpts));
                }

                function describeReveal(o) {
                    const e = o.e;
                    const permTxt = knPermChip(e.perm);
                    const edgeTxt = cellLabel(e.u) + ' &rarr; ' + cellLabel(e.v) + (e.dummy ? ' (dummy)' : '');
                    if (o.isFirst) {
                        return isGrLang()
                            ? ('<strong>Κύκλος ' + (o.ci + 1) + ':</strong> ξεκινάμε από άχρωμη ακμή ' + edgeTxt + ' και τη χρωματίζουμε ' + permTxt + '.')
                            : ('<strong>Cycle ' + (o.ci + 1) + ':</strong> we start from uncolored edge ' + edgeTxt + ' and color it ' + permTxt + '.');
                    } else if (o.isLast) {
                        return isGrLang()
                            ? ('Ακολουθούμε την άλλη ακμή του κόμβου: ' + edgeTxt + ' &rarr; ' + permTxt + '. Ο <strong>Κύκλος ' + (o.ci + 1) + ' έκλεισε</strong> &mdash; επιστρέψαμε στην αρχική ακμή.')
                            : ('We follow the node\'s other edge: ' + edgeTxt + ' &rarr; ' + permTxt + '. <strong>Cycle ' + (o.ci + 1) + ' closed</strong> &mdash; we returned to the starting edge.');
                    }
                    return isGrLang()
                        ? ('Ακολουθούμε την άλλη (άχρωμη) ακμή του κόμβου: ' + edgeTxt + ' &rarr; τη χρωματίζουμε ' + permTxt + '.')
                        : ('We follow the node\'s other (uncolored) edge: ' + edgeTxt + ' &rarr; we color it ' + permTxt + '.');
                }

                const decompIntro =
                    '<span lang="en"><strong>' + knQuadChip(Q.qi) + ' sub-mesh</strong> (rows ' + rowStart + '-' + rowEnd + ', columns ' + colStart + '-' + colEnd + '): ' + Q.packets.length + ' packets. ' +
                    'We build a graph with one <span style="color:#c0392b; font-weight:700;">red</span> node per processor of the sub-mesh as a virtual source and one <span style="color:#2255c0; font-weight:700;">blue</span> node per processor as a virtual destination. Then, for every packet we create an edge between its virtual source and its virtual destination. Finally we add empty/dummy edges (dashed) so that the graph becomes <strong>2-regular</strong> (every node has exactly 2 edges). Starting from an uncolored edge we then color edges alternately ' + knPermChip(1) + ' / ' + knPermChip(2) + ', so that no processor ever holds 2 packets of the same permutation.</span>' +
                    '<span lang="gr"><strong>' + knQuadChip(Q.qi) + ' sub-mesh</strong> (γραμμές ' + rowStart + '-' + rowEnd + ', στήλες ' + colStart + '-' + colEnd + '): ' + Q.packets.length + ' πακέτα. ' +
                    'Φτιάχνουμε γράφημα με έναν <span style="color:#c0392b; font-weight:700;">κόκκινο</span> κόμβο ανά επεξεργαστή του sub-mesh ως virtual source και έναν <span style="color:#2255c0; font-weight:700;">μπλε</span> κόμβο ανά επεξεργαστή ως virtual destination. Έπειτα, για κάθε πακέτο δημιουργούμε ακμή μεταξύ virtual source και virtual destination του. Στο τέλος προσθέτουμε κενές/dummy ακμές (διακεκομμένες) ώστε το γράφημα να γίνει <strong>2-regular</strong> (κάθε κόμβος με ακριβώς 2 ακμές). Ξεκινώντας από μια άχρωμη ακμή χρωματίζουμε εναλλάξ ' + knPermChip(1) + ' / ' + knPermChip(2) + ', ώστε κανένας επεξεργαστής να μην έχει ποτέ 2 πακέτα της ίδιας μετάθεσης.</span>';

                const decompSteps = [];
                decompSteps.push({
                    group: 'intro', color: '#9aa5b5',
                    label: '<span lang="en">Creating nodes</span><span lang="gr">Δημιουργία κόμβων</span>',
                    text: function () { return decompIntro; },
                    draw: function () { drawDecompGrid(false); drawDecompGraph(0, false); }
                });
                decompSteps.push({
                    group: 'edges', color: '#9aa5b5',
                    label: '<span lang="en">Creating edges</span><span lang="gr">Δημιουργία ακμών</span>',
                    text: function () {
                        return isGrLang()
                            ? (Q.packets.length + ' πραγματικές ακμές + ' + (Q.split.edges.length - Q.packets.length) + ' dummy: το γράφημα είναι 2-regular και έτοιμο για χρωματισμό.')
                            : (Q.packets.length + ' real edges + ' + (Q.split.edges.length - Q.packets.length) + ' dummy: the graph is 2-regular and ready for coloring.');
                    },
                    draw: function () { drawDecompGrid(false); drawDecompGraph(0, true); }
                });
                colorOrder.forEach(function (o, i) {
                    decompSteps.push({
                        group: 'cycle' + o.ci, color: KN_PERM[o.e.perm - 1].color,
                        label: '<span lang="en">Cycle ' + (o.ci + 1) + '</span><span lang="gr">Κύκλος ' + (o.ci + 1) + '</span>',
                        text: function () { return describeReveal(o); },
                        draw: function () { drawDecompGrid(false); drawDecompGraph(i + 1, true); }
                    });
                });
                decompSteps.push({
                    group: 'final', color: '#9aa5b5',
                    label: '<span lang="en">Done</span><span lang="gr">Ολοκλήρωση</span>',
                    text: function () {
                        return isGrLang()
                            ? ('Όλες οι ακμές χρωματίστηκαν: προέκυψαν οι δύο μεταθέσεις ' + knPermChip(1) + ' και ' + knPermChip(2) + '. Συνέχισε πλέον στο δεύτερο σκέλος «2. Δρομολόγηση».')
                            : ('All edges are colored: the two permutations ' + knPermChip(1) + ' and ' + knPermChip(2) + ' emerged. Continue with the second part, "2. Routing".');
                    },
                    draw: function () { drawDecompGrid(true); drawDecompGraph(mEdges, true); }
                });

                const decompTl = knMakeTimeline(decompSteps, {
                    groupSkip: '<span lang="en">Skip to the end of this cycle</span>' +
                        '<span lang="gr">Παράλειψη ως το κλείσιμο του κύκλου</span>',
                    onEnd: function () { Q._decompDone = true; subphaseRow._setEnabled(1, true); }
                });

                const permTls = [null, null, null];

                function buildPermTimeline(g) {
                    const isA = g === 0;
                    const permIdx = g + 1;
                    const graphEl = isA ? graphA : graphB;
                    const mColors = oaColorPalette(half);
                    const boundaries = Q.gSubBoundaries[g];
                    const pkts = Q.gPackets[g];
                    const traj = Q.gTraj[g];
                    const rgEdges = Q.rgEdgesOf[g];
                    const trace = Q.rgTraceOf[g];
                    const ms = trace.masterSteps;

                    function baseLabel(i) { return isA ? ('C' + (i + 1 + Q.qCol0)) : ('R' + (i + 1 + Q.qRow0)); }
                    function kName(K) { return baseLabel(K - 1); }
                    function mName(M) { return baseLabel(M - 1); }

                    function capFor(colorsShown) {
                        const parts = [];
                        for (let k = 1; k <= colorsShown; k++) {
                            parts.push('<span style="color:' + mColors[k - 1] + '; font-weight:700;">' +
                                (isGrLang()
                                    ? (isA ? 'γραμμή ' + (k + Q.qRow0) : 'στήλη ' + (k + Q.qCol0))
                                    : (isA ? 'row ' + (k + Q.qRow0) : 'column ' + (k + Q.qCol0))) + '</span>');
                        }
                        const base = isGrLang()
                            ? 'χρώμα &rarr; ενδιάμεση θέση (διακεκομμένο/αχνό = dummy): '
                            : 'color &rarr; intermediate position (dashed/faint = dummy): ';
                        return parts.length ? (base + parts.join(' , ')) : base + '&mdash;';
                    }
                    function edgeTitle(e) {
                        const pk = Q.cellPacket[g][e.u];
                        return pk
                            ? ((isGrLang() ? 'Πακέτο ' : 'Packet ') + '(' + pk.destRow + ',' + pk.destCol + ')')
                            : (isGrLang() ? 'dummy (κενή θέση)' : 'dummy (empty slot)');
                    }

                    function drawHallGraph(msIdx) {
                        const rep = oaComputeColoringOverlay(ms, msIdx);
                        const nodesL = [], nodesR = [];
                        for (let i = 0; i < half; i++) {
                            nodesL.push({ label: baseLabel(i), sub: rep.labels['K' + (i + 1)] || '' });
                            nodesR.push({ label: baseLabel(i), sub: rep.labels['M' + (i + 1)] || '' });
                        }
                        let colorsShown = 0;
                        Object.keys(rep.overlay).forEach(function (k) {
                            const v = rep.overlay[k];
                            if (typeof v === 'number' && v > colorsShown) colorsShown = v;
                        });
                        if (msIdx === 0) { knDrawBipartite(graphEl, nodesL, nodesR, [], capFor(0)); return; }
                        const edges = rgEdges.map(function (e, i) {
                            const pk = Q.cellPacket[g][e.u];
                            const dummy = !pk;
                            const ov = rep.overlay[i];
                            let stroke = null;
                            let width = dummy ? 1.4 : 2.4;
                            if (typeof ov === 'number') stroke = mColors[ov - 1];
                            else if (ov === 'yellow-pending') { stroke = '#e0b400'; width = 3.5; }
                            return {
                                li: e.left, ri: e.right, stroke: stroke, dash: dummy, width: width,
                                title: edgeTitle(e), packetId: dummy ? null : pk.id
                            };
                        });
                        knDrawBipartite(graphEl, nodesL, nodesR, edges, capFor(colorsShown));
                    }

                    function drawRouteGrid(t, round) {
                        knDrawGrid(gridHolder, knPositionsAt(pkts, traj, t), n, half,
                            Object.assign({
                                onHover: makeHoverWithPerm(t, boundaries), getStyle: permStyle,
                                getDirection: function (p) {
                                    const arr = traj[p.id];
                                    if (!arr || t >= arr.length - 1) return null;
                                    const cur = arr[t], nxt = arr[t + 1];
                                    if (nxt.r > cur.r) return { arrow: '\u2193' };
                                    if (nxt.r < cur.r) return { arrow: '\u2191' };
                                    if (nxt.c > cur.c) return { arrow: '\u2192' };
                                    if (nxt.c < cur.c) return { arrow: '\u2190' };
                                    return null;
                                }
                            }, subOpts));
                        knHighlightOddEvenPairs(gridHolder, round || 0, boundaries, permIdx, 'solo', subOpts, half);
                    }

                    const describeCtx = {
                        colors: mColors,
                        kName: kName, mName: mName,
                        initNodes: '<span lang="en">We build the graph. On the left we create &radic;N/2 red nodes representing the ' + (isA ? 'column' : 'row') + ' each packet is currently in, and on the right &radic;N/2 blue nodes representing the ' + (isA ? 'column' : 'row') + ' it is heading to.</span>' +
                            '<span lang="gr">Δημιουργούμε το γράφημα. Στην αριστερή πλευρά φτιάχνουμε &radic;N/2 κόκκινους κόμβους που αντιπροσωπεύουν τη ' + (isA ? 'στήλη' : 'γραμμή') + ' θέσης των πακέτων και στη δεξιά &radic;N/2 μπλε κόμβους που αντιπροσωπεύουν τη ' + (isA ? 'στήλη' : 'γραμμή') + ' προορισμού όλων των πακέτων.</span>',
                        initEdges: '<span lang="en">We create the edges: one edge per processor, from the ' + (isA ? 'column' : 'row') + ' it is in to the ' + (isA ? 'column' : 'row') + ' it is heading to (dashed = dummy, empty slot). The graph is &radic;N/2-regular.</span>' +
                            '<span lang="gr">Δημιουργούμε τις ακμές: μία ακμή ανά επεξεργαστή, από τη ' + (isA ? 'στήλη' : 'γραμμή') + ' θέσης του προς τη ' + (isA ? 'στήλη' : 'γραμμή') + ' προορισμού του (διακεκομμένη = dummy, κενή θέση). Το γράφημα είναι &radic;N/2-κανονικό.</span>',
                        final: '<span lang="en">Coloring is complete for all colors. Each color is the intermediate ' + (isA ? 'row' : 'column') + ' a packet must reach by the end of the first sub-phase.</span>' +
                            '<span lang="gr">Ο χρωματισμός ολοκληρώθηκε για όλα τα χρώματα. Κάθε χρώμα είναι η ενδιάμεση ' + (isA ? 'γραμμή' : 'στήλη') + ' στην οποία πρέπει να βρεθεί το πακέτο στο τέλος της πρώτης υπο-φάσης.</span>'
                    };

                    const steps = [];
                    steps.push({
                        group: 'intro', color: KN_PERM[g].color,
                        label: '<span lang="en">Intro</span><span lang="gr">Εισαγωγή</span>',
                        text: function () { return knPermIntroText(permIdx); },
                        draw: function () { drawRouteGrid(0); drawHallGraph(0); }
                    });

                    function groupForMs(i) {
                        if (i <= 1) return { g: 'setup', color: '#9aa5b5', label: i === 0
                            ? '<span lang="en">Creating nodes</span><span lang="gr">Δημιουργία κόμβων</span>'
                            : '<span lang="en">Creating edges</span><span lang="gr">Δημιουργία ακμών</span>' };
                        for (let k = 0; k < trace.roundRanges.length; k++) {
                            const r = trace.roundRanges[k];
                            if (i >= r.start && i <= r.end) {
                                return {
                                    g: 'hall' + r.color, color: mColors[r.color - 1],
                                    label: '<span lang="en">Color ' + r.color + '</span><span lang="gr">Χρώμα ' + r.color + '</span>'
                                };
                            }
                        }
                        return { g: 'hallfinal', color: '#9aa5b5', label: '<span lang="en">Done</span><span lang="gr">Ολοκλήρωση</span>' };
                    }
                    ms.forEach(function (ev, i) {
                        const gi = groupForMs(i);
                        steps.push({
                            group: (i <= 1) ? ('setup' + i) : gi.g, color: gi.color, label: gi.label,
                            text: function () {
                                const rep = oaComputeColoringOverlay(ms, i);
                                return oaDescribeColoringStep(ev, rep.currentLabel, describeCtx);
                            },
                            draw: function () { drawRouteGrid(0); drawHallGraph(i); }
                        });
                    });

                    for (let t = 1; t <= Q.gS2[g]; t++) {
                        (function (tt) {
                            const s = knSubphaseIndex(tt, boundaries);
                            const axis = knSchemeAxes(permIdx)[s];
                            steps.push({
                                group: 'oe' + s, color: KN_AXIS_COLOR[axis],
                                label: knOddEvenLabel(axis),
                                text: function () { return knOddEvenStepText(tt, boundaries, 'solo', permIdx); },
                                draw: function () { drawRouteGrid(tt - 1, tt); drawHallGraph(ms.length - 1); }
                            });
                        })(t);
                    }
                    steps.push({
                        group: 'oedone', color: '#9aa5b5',
                        label: '<span lang="en">Done</span><span lang="gr">Ολοκλήρωση</span>',
                        text: function () {
                            return isGrLang()
                                ? ('Η ' + knPermChip(permIdx) + ' ολοκληρώθηκε: κάθε πακέτο βρίσκεται στο virtual destination του.')
                                : (knPermChip(permIdx) + ' is complete: every packet is at its virtual destination.');
                        },
                        draw: function () { drawRouteGrid(Q.gS2[g], 0); drawHallGraph(ms.length - 1); }
                    });
                    return knMakeTimeline(steps, {
                        groupSkip: '<span lang="en">Skip this color</span>' +
                            '<span lang="gr">Παράλειψη χρώματος</span>',
                        midSkip: {
                            index: ms.length,   // last step of the Hall coloring
                            label: '<span lang="en">Skip the whole coloring</span>' +
                                '<span lang="gr">Παράλειψη όλου του χρωματισμού</span>'
                        },
                        onEnd: markRouted
                    });
                }

                function buildBothTimeline() {
                    const boundaries = Q.qSubBoundaries;
                    function drawBoth(t, round) {
                        knDrawGrid(gridHolder, knPositionsAt(Q.packets, Q.qTraj, t), n, half,
                            Object.assign({
                                onHover: makeHoverWithPerm(t, boundaries), getStyle: permStyle,
                                getDirection: function (p) {
                                    const arr = Q.qTraj[p.id];
                                    if (!arr || t >= arr.length - 1) return null;
                                    const cur = arr[t], nxt = arr[t + 1];
                                    if (nxt.r > cur.r) return { arrow: '\u2193' };
                                    if (nxt.r < cur.r) return { arrow: '\u2191' };
                                    if (nxt.c > cur.c) return { arrow: '\u2192' };
                                    if (nxt.c < cur.c) return { arrow: '\u2190' };
                                    return null;
                                }
                            }, subOpts));
                        knHighlightOddEvenPairs(gridHolder, round || 0, boundaries, null, 'combo', subOpts, half);
                    }
                    const steps = [{
                        group: 'intro', color: '#9aa5b5',
                        label: '<span lang="en">Intro</span><span lang="gr">Εισαγωγή</span>',
                        text: function () { return knBothIntroText(); },
                        draw: function () { drawBoth(0); }
                    }];
                    for (let t = 1; t <= Q.qS2; t++) {
                        (function (tt) {
                            const s = knSubphaseIndex(tt, boundaries);
                            const axis = knSchemeAxes(1)[s];
                            steps.push({
                                group: 'oe' + s, color: KN_AXIS_COLOR[axis],
                                label: knOddEvenLabel(axis),
                                text: function () { return knOddEvenStepText(tt, boundaries, 'combo', null); },
                                draw: function () { drawBoth(tt - 1, tt); }
                            });
                        })(t);
                    }
                    steps.push({
                        group: 'oedone', color: '#9aa5b5',
                        label: '<span lang="en">Done</span><span lang="gr">Ολοκλήρωση</span>',
                        text: function () {
                            return isGrLang()
                                ? 'Η Φάση 2 ολοκληρώθηκε για αυτό το sub-mesh: κάθε πακέτο βρίσκεται στο virtual destination του.'
                                : 'Phase 2 is complete for this sub-mesh: every packet is at its virtual destination.';
                        },
                        draw: function () { drawBoth(Q.qS2, 0); }
                    });
                    return knMakeTimeline(steps, { onEnd: markRouted });
                }

                let currentPerm = -1;
                function selectPermView(i) {
                    currentPerm = i;
                    permNavBtns.forEach(function (b, k) {
                        b.className = k === i ? 'btn-primary' : 'btn-secondary';
                        if (k < 2) {
                            if (k === i) { b.style.background = KN_PERM[k].color; b.style.borderColor = KN_PERM[k].color; b.style.color = ''; }
                            else { b.style.background = ''; b.style.borderColor = KN_PERM[k].color; b.style.color = KN_PERM[k].color; }
                        } else { b.style.background = ''; b.style.borderColor = ''; b.style.color = ''; }
                    });
                    showGraph(i === 0 ? 'A' : (i === 1 ? 'B' : null));
                    if (!permTls[i]) permTls[i] = (i === 2) ? buildBothTimeline() : buildPermTimeline(i);
                    ctrlHolder.innerHTML = '';
                    ctrlHolder.appendChild(permTls[i].el);
                    permTls[i].redraw();
                }

                let subphase = -1;
                function selectSubphase(i) {
                    subphase = i;
                    subphaseRow._setActive(i);
                    permNav.style.display = i === 1 ? '' : 'none';
                    if (i === 0) {
                        showGraph('decomp');
                        ctrlHolder.innerHTML = '';
                        ctrlHolder.appendChild(decompTl.el);
                        decompTl.redraw();
                    } else {

                        decompTl.goToEnd();
                        selectPermView(currentPerm < 0 ? 2 : currentPerm);
                    }
                }

                decompTl.goTo(0);
                selectSubphase(0);
                refitCard();
            }

            let allView = null;
            function renderAllView() {
                content.innerHTML = '';
                if (allView) { content.appendChild(allView); refitCard(); return; }
                const view = document.createElement('div');
                allView = view;
                content.appendChild(view);

                view.appendChild(buildStep3NavRow('all'));

                const subphaseRow = buildSubphaseRow(function (i) { selectSubphase(i); });
                view.appendChild(subphaseRow);

                const gridHolder = document.createElement('div');
                view.appendChild(gridHolder);

                const ctrlHolder = document.createElement('div');
                view.appendChild(ctrlHolder);

                const decompSteps = [{
                    group: 'intro', color: '#9aa5b5',
                    label: '<span lang="en">Decomposition</span><span lang="gr">Αποσύνθεση</span>',
                    text: function () {
                        return isGrLang()
                            ? ('Σε καθένα από τα 4 sub-mesh λύθηκε ξεχωριστά το (2,2)-mapping: κάθε πακέτο ανήκει πλέον στη ' + knPermChip(1) + ' (συνεχές περίγραμμα) ή στη ' + knPermChip(2) + ' (διακεκομμένο). Οι δύο μεταθέσεις δρομολογούνται παράλληλα στην υπο-φάση 2.')
                            : ('In each of the 4 sub-meshes the (2,2)-mapping was solved separately: every packet now belongs to ' + knPermChip(1) + ' (solid border) or ' + knPermChip(2) + ' (dashed). The two permutations are routed in parallel in sub-phase 2.');
                    },
                    draw: function () {
                        knDrawGrid(gridHolder, knPositionsAt(packets, traj2, 0), n, half,
                            { tint: true, onHover: hoverWithPerm, getStyle: permStyle });
                    }
                }];
                subphaseRow._setEnabled(1, false);
                const decompTl = knMakeTimeline(decompSteps, {
                    onEnd: function () { subphaseRow._setEnabled(1, true); }
                });

                function drawAll(t) {
                    knDrawGrid(gridHolder, knPositionsAt(packets, traj2, t), n, half, {
                        tint: true, onHover: makeHoverWithPerm(t, globalSubBoundaries), getStyle: permStyle,
                        getDirection: function (p) {
                            const arr = traj2[p.id];
                            if (!arr || t >= arr.length - 1) return null;
                            const cur = arr[t], nxt = arr[t + 1];
                            if (nxt.r > cur.r) return { arrow: '\u2193' };
                            if (nxt.r < cur.r) return { arrow: '\u2191' };
                            if (nxt.c > cur.c) return { arrow: '\u2192' };
                            if (nxt.c < cur.c) return { arrow: '\u2190' };
                            return null;
                        }
                    });

                }
                const routeSteps = [{
                    group: 'intro', color: '#9aa5b5',
                    label: '<span lang="en">Intro</span><span lang="gr">Εισαγωγή</span>',
                    text: function () { return knBothIntroText(); },
                    draw: function () { drawAll(0); }
                }];
                for (let t = 1; t <= S2; t++) {
                    (function (tt) {
                        const s = knSubphaseIndex(tt, globalSubBoundaries);
                        const axis = knSchemeAxes(1)[s];
                        routeSteps.push({
                            group: 'oe' + s, color: KN_AXIS_COLOR[axis],
                            label: knOddEvenLabel(axis),
                            text: function () { return knOddEvenStepText(tt, globalSubBoundaries, 'combo', null); },
                            draw: function () { drawAll(tt - 1); }
                        });
                    })(t);
                }
                routeSteps.push({
                    group: 'oedone', color: '#9aa5b5',
                    label: '<span lang="en">Done</span><span lang="gr">Ολοκλήρωση</span>',
                    text: function () {
                        return isGrLang()
                            ? 'Η Φάση 2 ολοκληρώθηκε: κάθε πακέτο βρίσκεται στο virtual destination του.'
                            : 'Phase 2 is complete: every packet is at its virtual destination.';
                    },
                    draw: function () { drawAll(S2); }
                });
                const routeTl = knMakeTimeline(routeSteps, { onEnd: markRouted });

                function selectSubphase(i) {
                    subphaseRow._setActive(i);
                    ctrlHolder.innerHTML = '';
                    ctrlHolder.appendChild(i === 0 ? decompTl.el : routeTl.el);
                    (i === 0 ? decompTl : routeTl).redraw();
                }
                selectSubphase(0);
                refitCard();
            }

            renderMenu();
        }
    };

    const p4Theory =
        '<span lang="en"><strong>Goal of Phase 3:</strong> every <span class="glossary-term" data-term="packet">packet</span> moves within its row at distance 0 or h = &radic;N/2 to reach its final destination after h <span class="glossary-term" data-term="step">steps</span>. To do this while maintaining the constraint of at most 2 packets per processor at every step, we compute each packet\'s path as follows:<br><br>' +
        'Let each row have size 2h, and let j be the column a packet currently occupies. If the packet is <strong>not</strong> in the column half of its destination, we call it a <strong>Long</strong> packet and compute its position (row,&thinsp;L<sub>j</sub>(&tau;)) at step &tau; as:<br>' +
        '&emsp;L<sub>j</sub>(&tau;) = j + &tau; &nbsp; for 1 &le; j &le; h &nbsp;&nbsp; (left half: moves right)<br>' +
        '&emsp;L<sub>j</sub>(&tau;) = j &minus; &tau; &nbsp; for h &lt; j &le; 2h &nbsp;&nbsp; (right half: moves left)<br><br>' +
        'If the packet is <strong>already</strong> in the column of its destination it must end at the same position (distance = 0). We call it a <strong>Short</strong> packet. Due to the queue constraint, Short packets temporarily move toward the edges to make room for passing Long packets. The position (row,&thinsp;S<sub>j</sub>(&tau;)) at step &tau; is given by, for 1 &le; j &le; h where s(&tau;) = min(&tau;, h&minus;&tau;):<br>' +
        '&emsp;S<sub>j</sub>(&tau;) = &lceil;j/2&rceil; &ensp; if j &le; 2s(&tau;)<br>' +
        '&emsp;S<sub>j</sub>(&tau;) = j &minus; s(&tau;) &ensp; if j &gt; 2s(&tau;)<br>' +
        'For h &lt; j &le; 2h (right half), with the same s(&tau;):<br>' +
        '&emsp;S<sub>j</sub>(&tau;) = j + s(&tau;) &ensp; if j &le; 2h &minus; 2s(&tau;)<br>' +
        '&emsp;S<sub>j</sub>(&tau;) = &lfloor;(2h+1+j)/2&rfloor; &ensp; if j &gt; 2h &minus; 2s(&tau;)</span>' +
        '<span lang="gr"><strong>Στόχος της Φάσης 3:</strong> κάθε <span class="glossary-term" data-term="packet">πακέτο</span> κινείται στη γραμμή του σε απόσταση 0 ή h = &radic;N/2 ώστε να φτάσει στον τελικό του προορισμό μετά από h <span class="glossary-term" data-term="step">βήματα</span>. Για να γίνει αυτό διατηρώντας τον περιορισμό των 2 πακέτων ανά επεξεργαστή σε κάθε βήμα, υπολογίζουμε το μονοπάτι κάθε πακέτου ως εξής:<br><br>' +
        'Έστω κάθε γραμμή μεγέθους 2h, και j η στήλη στην οποία βρίσκεται το πακέτο. Αν το πακέτο <strong>δεν</strong> βρίσκεται στο ήμισυ στηλών του προορισμού του, το χαρακτηρίζουμε <strong>Long</strong> και υπολογίζουμε τη θέση (row,&thinsp;L<sub>j</sub>(&tau;)) στο βήμα &tau; ως:<br>' +
        '&emsp;L<sub>j</sub>(&tau;) = j + &tau; &nbsp; για 1 &le; j &le; h &nbsp;&nbsp; (αριστερό ήμισυ: κινείται δεξιά)<br>' +
        '&emsp;L<sub>j</sub>(&tau;) = j &minus; &tau; &nbsp; για h &lt; j &le; 2h &nbsp;&nbsp; (δεξί ήμισυ: κινείται αριστερά)<br><br>' +
        'Αν το πακέτο βρίσκεται <strong>ήδη</strong> στη στήλη του προορισμού του, πρέπει στο τέλος να είναι στον ίδιο επεξεργαστή (απόσταση = 0). Το χαρακτηρίζουμε <strong>Short</strong>. Λόγω του περιορισμού ουράς, τα Short πακέτα κινούνται προσωρινά προς τα άκρα για να «δημιουργήσουν χώρο» στα διερχόμενα Long. Η θέση (row,&thinsp;S<sub>j</sub>(&tau;)) στο βήμα &tau; δίνεται, για 1 &le; j &le; h όπου s(&tau;) = min(&tau;, h&minus;&tau;), από:<br>' +
        '&emsp;S<sub>j</sub>(&tau;) = &lceil;j/2&rceil; &ensp; αν j &le; 2s(&tau;)<br>' +
        '&emsp;S<sub>j</sub>(&tau;) = j &minus; s(&tau;) &ensp; αν j &gt; 2s(&tau;)<br>' +
        'Για h &lt; j &le; 2h (δεξί ήμισυ), με το ίδιο s(&tau;):<br>' +
        '&emsp;S<sub>j</sub>(&tau;) = j + s(&tau;) &ensp; αν j &le; 2h &minus; 2s(&tau;)<br>' +
        '&emsp;S<sub>j</sub>(&tau;) = &lfloor;(2h+1+j)/2&rfloor; &ensp; αν j &gt; 2h &minus; 2s(&tau;)</span>';

    const p4TheoryCard = {
        id: 'kn-p4-theory', kind: 'theory', theory: p4Theory, interactive: false,
        render: function (body) {
            const div = document.createElement('div');
            div.className = 'substep-explain';
            div.innerHTML = p4Theory;
            body.appendChild(div);
        }
    };

    function buildKrizancAnimationConfig() {
        const p1traj = knBuildPhase2Traj(packets, n, half);
        const p4traj = knBuildPhase4Traj(packets, n, half);
        const total = half + S2 + half;

        const fullTraj = {};
        packets.forEach(function (p) {
            fullTraj[p.id] = p1traj[p.id].concat(traj2[p.id].slice(1), p4traj[p.id].slice(1));
        });

        function directionAt(k) {
            return function (p) {
                const arr = fullTraj[p.id];
                if (k >= arr.length - 1) return null;
                const cur = arr[k], nxt = arr[k + 1];
                if (nxt.r > cur.r) return { arrow: '\u2193' };
                if (nxt.r < cur.r) return { arrow: '\u2191' };
                if (nxt.c > cur.c) return { arrow: '\u2192' };
                if (nxt.c < cur.c) return { arrow: '\u2190' };
                return null;
            };
        }

        const frames = [];
        for (let k = 0; k <= total; k++) {
            (function (k) {
                let label;
                if (k === 0) label = animFrameLabel('Αρχικό πλέγμα', 'Initial mesh');
                else if (k <= half) label = animPhaseLabel(1, k);
                else if (k <= half + S2) label = animPhaseLabel(2, k - half);
                else label = animPhaseLabel(3, k - half - S2);
                const inPhase2 = k > half && k <= half + S2;
                frames.push({
                    label: label, step: k, offline: false,
                    draw: function (slot) {
                        knDrawGrid(slot, knPositionsAt(packets, fullTraj, k), n, half, {
                            tint: true,
                            getStyle: inPhase2 ? permStyle : null,
                            getDirection: directionAt(k)
                        });
                    }
                });
            })(k);
        }
        return { frames: frames, totalSteps: total };
    }

    const p4ActionCard = {
        id: 'kn-p4-action', navLabel: '<span lang="en">Phase 3</span><span lang="gr">Φάση 3</span>', kind: 'action', theory: p4Theory, interactive: true,
        render: function (body, api) {
            const desc = document.createElement('p');
            desc.className = 'substep-explain';
            desc.innerHTML =
                '<span lang="en">Goal of Phase 3: every <span class="glossary-term" data-term="packet">packet</span> moves within its row from its virtual destination to its final destination in exactly h = ' + half + ' <span class="glossary-term" data-term="step">steps</span>. Arrows show the direction of movement for Long packets.</span>' +
                '<span lang="gr">Στόχος της Φάσης 3: κάθε <span class="glossary-term" data-term="packet">πακέτο</span> κινείται εντός της γραμμής του από το virtual destination στον τελικό προορισμό σε ακριβώς h = ' + half + ' <span class="glossary-term" data-term="step">βήματα</span>. Τα βελάκια δείχνουν την κατεύθυνση κίνησης των Long πακέτων.</span>';
            body.appendChild(desc);

            const vdPositions = {};
            packets.forEach(function (p) {
                const key = p.vdRow + ',' + p.vdCol;
                (vdPositions[key] = vdPositions[key] || []).push(p);
            });

            const gridSlot = document.createElement('div');
            gridSlot.style.marginTop = '12px';
            body.appendChild(gridSlot);
            knDrawGrid(gridSlot, vdPositions, n, half, {
                tint: true, onHover: hoverFn,
                getDirection: function (p) {
                    if (p.destCol === p.vdCol) return null;
                    return { arrow: p.destCol > p.vdCol ? '→' : '←' };
                }
            });

            const moveBtn = document.createElement('button');
            moveBtn.className = 'btn-primary';
            moveBtn.style.marginTop = '12px';
            moveBtn.innerHTML = '<span lang="en">Move to final destination</span><span lang="gr">Μετακίνηση στον τελικό προορισμό</span>';
            body.appendChild(moveBtn);

            const bannerSlot = document.createElement('div');

            const navRow = buildKnNavRow(half, function (t) {
                const p4traj = body._p4traj;
                if (!p4traj) return;
                knDrawGrid(gridSlot, knPositionsAt(packets, p4traj, t), n, half, {
                    tint: true, onHover: hoverFn,
                    getDirection: function (p) {
                        const arr = p4traj[p.id];
                        if (!arr || t >= arr.length - 1) return null;
                        const cur = arr[t], nxt = arr[t + 1];
                        if (nxt.c > cur.c) return { arrow: '→' };
                        if (nxt.c < cur.c) return { arrow: '←' };
                        return null;
                    }
                });
            });
            navRow.style.display = 'none';
            body.appendChild(navRow);

            const stepToggleBtn = document.createElement('button');
            stepToggleBtn.className = 'btn-secondary';
            stepToggleBtn.style.marginTop = '10px';
            stepToggleBtn.style.display = 'none';
            stepToggleBtn.innerHTML = '<span lang="en">Show step by step</span><span lang="gr">Δείξε βήμα-βήμα</span>';
            body.appendChild(stepToggleBtn);
            body.appendChild(bannerSlot);

            moveBtn.addEventListener('click', function () {
                const p4traj = knBuildPhase4Traj(packets, n, half);
                body._p4traj = p4traj;
                knDrawGrid(gridSlot, knPositionsAt(packets, p4traj, half), n, half, { tint: true, onHover: hoverFn });
                moveBtn.style.display = 'none';
                stepToggleBtn.style.display = 'inline-block';

                const total = half + S2 + half;
                bannerSlot.innerHTML =
                    '<div class="result-banner result-banner--green" style="margin-top:18px;">' +
                    '<div class="result-stat" style="flex-basis:100%;"><div class="label" style="font-size:15px;font-weight:700;">' +
                    '<span lang="en">The algorithm terminates. All packets have reached their final destination.</span>' +
                    '<span lang="gr">Ο αλγόριθμος τερματίζει. Όλα τα πακέτα έφτασαν στον τελικό τους προορισμό.</span></div></div>' +
                    '<div class="result-stat"><div class="num">' + total + '</div><div class="label">' + formatBound('krizanc', n) +
                    '<br><span lang="en">Phase 1 = ' + half + ', Phase 2 = ' + S2 + ', Phase 3 = ' + half + '</span>' +
                    '<span lang="gr">Φάση 1 = ' + half + ', Φάση 2 = ' + S2 + ', Φάση 3 = ' + half + '</span></div></div>' +
                    '</div>';
                const resultActions = document.createElement('div');
                resultActions.className = 'result-actions';
                bannerSlot.querySelector('.result-banner').appendChild(resultActions);
                appendAnimationLauncher(resultActions, buildKrizancAnimationConfig);
                appendTransferButton(resultActions, 'basic', n, packets.map(function (p) {
                    return { row: p.sourceRow, col: p.sourceCol, val: p.destRow + ',' + p.destCol };
                }));
                api.complete();
            });

            let shown = false;
            stepToggleBtn.addEventListener('click', function () {
                shown = !shown;
                navRow.style.display = shown ? '' : 'none';
                stepToggleBtn.innerHTML = shown
                    ? '<span lang="en">Hide step by step</span><span lang="gr">Κρύψε βήμα-βήμα</span>'
                    : '<span lang="en">Show step by step</span><span lang="gr">Δείξε βήμα-βήμα</span>';
                if (shown) {
                    navRow._goTo(0);
                } else {
                    const p4traj = body._p4traj;
                    if (p4traj) knDrawGrid(gridSlot, knPositionsAt(packets, p4traj, half), n, half, { tint: true, onHover: hoverFn });
                }
            });
        }
    };

    return [
        bigIdeaCard,
        p1ActionCard,
        p2ActionCard,
        p3ActionCard,
        p4ActionCard
    ];
}