function parsePacketInput(raw) {
    const val = (raw || '').trim();
    if (val === '') return null;
    const m = val.match(/^(\d+)\s*[,.\-]\s*(\d+)$/);
    if (!m) return null;
    return { a: parseInt(m[1]), b: parseInt(m[2]) };
}

function normalizePacketInput(input) {
    const parsed = parsePacketInput(input.value);
    if (parsed) {
        input.value = `${parsed.a},${parsed.b}`;
    }
}

function buildEmptyGridTable(n) {
    const table = document.createElement('table');
    table.className = 'oa-table';

    const headerRow = document.createElement('tr');
    headerRow.appendChild(document.createElement('th'));
    for (let i = 1; i <= n; i++) {
        const th = document.createElement('th');
        th.textContent = i;
        headerRow.appendChild(th);
    }
    table.appendChild(headerRow);

    for (let i = 0; i < n; i++) {
        const row = document.createElement('tr');
        const rowHeader = document.createElement('th');
        rowHeader.textContent = i + 1;
        row.appendChild(rowHeader);
        for (let j = 0; j < n; j++) {
            const cell = document.createElement('td');
            const input = document.createElement('input');
            input.type = 'text';
            input.dataset.row = i;
            input.dataset.col = j;
            input.value = '';
            input.oninput = () => { input.style.backgroundColor = ''; };
            input.addEventListener('blur', () => normalizePacketInput(input));
            cell.appendChild(input);
            row.appendChild(cell);
        }
        table.appendChild(row);
    }

    return table;
}

function createEmptyGrid() {
    n = parseInt(document.getElementById('sideN').value);
    if (isNaN(n) || n < 2) {
        alert(document.body.classList.contains('lang-gr')
            ? 'Παρακαλώ εισάγετε έγκυρο μέγεθος πλέγματος.'
            : 'Please enter a valid mesh size.');
        return;
    }

    N = n * n;
    blockSize = Math.max(2, Math.floor(Math.pow(N, 3 / 8)));
    sentinel = N + 1;

    const tableContainer = document.getElementById('tableContainer');
    tableContainer.innerHTML = '';
    tableContainer.appendChild(buildEmptyGridTable(n));

    const randomizeBtn = document.getElementById('randomizeBtn');
    if (randomizeBtn) randomizeBtn.style.display = 'inline-block';
    const gridFootnote = document.getElementById('gridFootnote');
    if (gridFootnote) gridFootnote.style.display = 'block';

    if (typeof applyMeshZoom === 'function') applyMeshZoom(tableContainer);
}

function generateTable() {
    if (document.getElementById('tableContainer').children.length === 0) {
        createEmptyGrid();
    }

    n = parseInt(document.getElementById('sideN').value);
    N = n * n;

    let targets = [];
    for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++)
            targets.push({ r, c });
    targets.sort(() => Math.random() - 0.5);

    let assigned = new Array(n * n);

    for (let i = 0; i < n * n - 2; i++) {
        const srcRow = Math.floor(i / n);
        const srcCol = i % n;
        if (targets[0].r === srcRow && targets[0].c === srcCol)
            [targets[0], targets[1]] = [targets[1], targets[0]];
        assigned[i] = targets.shift();
    }

    const last = n * n;
    const r0 = Math.floor((last - 2) / n), c0 = (last - 2) % n;
    const r1 = Math.floor((last - 1) / n), c1 = (last - 1) % n;
    if (targets[0].r === r0 && targets[0].c === c0 ||
        targets[1].r === r1 && targets[1].c === c1)
        [targets[0], targets[1]] = [targets[1], targets[0]];
    assigned[last - 2] = targets[0];
    assigned[last - 1] = targets[1];

    const inputs = Array.from(document.querySelectorAll('#tableContainer input'));
    inputs.forEach(input => {
        const r = parseInt(input.dataset.row);
        const c = parseInt(input.dataset.col);
        const index = r * n + c;
        const dest = assigned[index];
        input.value = `${dest.r + 1},${dest.c + 1}`;
        input.style.backgroundColor = '';
    });
}

function validateGrid() {
    const inputs = Array.from(document.querySelectorAll('#tableContainer input'));
    const msgEl = document.getElementById('validationMsg');
    let valid = true;
    const seen = {};

    inputs.forEach(input => input.style.backgroundColor = '');

    let hasEmpty = false;
    inputs.forEach(input => {
        if (input.value.trim() === '') { hasEmpty = true; input.style.backgroundColor = '#ffaaaa'; valid = false; return; }
        normalizePacketInput(input);
        const val = input.value.trim();
        const parsed = parsePacketInput(val);
        if (!parsed) { input.style.backgroundColor = '#ffaaaa'; valid = false; return; }
        const a = parsed.a, b = parsed.b;
        if (a < 1 || a > n || b < 1 || b > n) { input.style.backgroundColor = '#ffaaaa'; valid = false; return; }
        const r = parseInt(input.dataset.row), c = parseInt(input.dataset.col);
        if (a === r + 1 && b === c + 1) input.style.backgroundColor = '#ffffaa';
        const key = `${a},${b}`;
        if (seen[key]) { input.style.backgroundColor = '#aaaaff'; seen[key].style.backgroundColor = '#aaaaff'; valid = false; }
        else seen[key] = input;
    });

    const isGreek = document.body.classList.contains('lang-gr');
    const validationText = isGreek
        ? '<strong>Ο αλγόριθμος δεν μπορεί να ξεκινήσει γιατί το πλέγμα περιέχει μη αποδεκτές τιμές.</strong><br><br>' +
          'Κάθε τιμή πρέπει να είναι της μορφής <code>x,y</code> (δεκτές μορφές εισαγωγής: x,y &nbsp; x.y &nbsp; x-y) και εντός ορίων του πλέγματος.<br><br>' +
          '<span style="color:#c0392b">■</span> <strong>Κόκκινα κελιά</strong> — κακή μορφή ή εκτός ορίων<br>' +
          '<span style="color:#2255c0">■</span> <strong>Μπλε κελιά</strong> — διπλότυπες τιμές<br><br>' +
          'Παρακαλώ διόρθωσε το στιγμιότυπο και πάτησε Συνέχεια.'
        : '<strong>The algorithm cannot start because the mesh contains invalid values.</strong><br><br>' +
          'Each value must be in the format <code>x,y</code> (accepted formats: x,y &nbsp; x.y &nbsp; x-y) and within the mesh bounds.<br><br>' +
          '<span style="color:#c0392b">■</span> <strong>Red cells</strong> — wrong format or out of bounds<br>' +
          '<span style="color:#2255c0">■</span> <strong>Blue cells</strong> — duplicate destinations<br><br>' +
          'Please fix the highlighted cells and press Continue.';

    if (msgEl) {
        if (!valid) {
            msgEl.style.display = 'block';
            msgEl.innerHTML = validationText;
        } else {
            msgEl.style.display = 'none';
        }
    }
    return valid;
}

let _meshCardBuiltEl = null;
function resetMeshCard() { _meshCardBuiltEl = null; }

/* Mesh creation card */
function buildMeshCard() {
    return {
        id: 'mesh-creation',
        navLabel: '<span lang="en">Mesh</span><span lang="gr">Πλέγμα</span>',
        kind: 'action',
        theory: '<span lang="en">Pick a mesh size, create it, and either fill it randomly or type in your own packet destinations for each processor.</span><span lang="gr">Επίλεξε μέγεθος πλέγματος, δημιούργησέ το, και είτε συμπλήρωσέ το τυχαία είτε γράψε τους δικούς σου προορισμούς πακέτων για κάθε επεξεργαστή.</span>',
        interactive: true,
        render: function (body, api) {
            if (_meshCardBuiltEl) {
                body.appendChild(_meshCardBuiltEl);
                if (api.topSlot && _meshCardBuiltEl._continueBtn) api.topSlot.appendChild(_meshCardBuiltEl._continueBtn);
                return;
            }

            const wrap = document.createElement('div');
            _meshCardBuiltEl = wrap;

            const nStep = (document.getElementById('selectedAlgo') && document.getElementById('selectedAlgo').value === 'krizanc') ? 2 : 1;
            const inputRow = document.createElement('div');
            inputRow.className = 'input-row';
            inputRow.style.textAlign = 'center';
            inputRow.innerHTML =
                '<span lang="en">Mesh</span><span lang="gr">Πλέγμα</span> ' +
                '<input class="mesh-input" type="number" id="n1" value="4" min="2" step="' + nStep + '"> &times; ' +
                '<input class="mesh-input" type="number" id="n2" value="4" min="2" step="' + nStep + '"> ' +
                '<span lang="en">for a total of N = <strong id="totalN">16</strong> processors.</span>' +
                '<span lang="gr">για σύνολο N = <strong id="totalN2">16</strong> επεξεργαστών.</span>';
            wrap.appendChild(inputRow);

            const n1 = inputRow.querySelector('#n1');
            const n2 = inputRow.querySelector('#n2');
            function syncN(el) {
                const v = parseInt(el.value);
                if (isNaN(v) || v < 2) return;
                n1.value = v; n2.value = v;
                inputRow.querySelector('#totalN').textContent = v * v;
                inputRow.querySelector('#totalN2').textContent = v * v;
                document.getElementById('sideN').value = v;
            }
            let typedN = parseInt(n1.value);
            n1.addEventListener('input', function () { typedN = parseInt(n1.value); syncN(n1); updateMeshButtons(); });
            n2.addEventListener('input', function () { typedN = parseInt(n2.value); syncN(n2); updateMeshButtons(); });

            const btnRow = document.createElement('div');
            btnRow.className = 'mesh-btn-row';
            btnRow.style.textAlign = 'left';
            btnRow.style.marginTop = '16px';
            const createBtn = document.createElement('button');
            createBtn.className = 'btn-primary';
            createBtn.innerHTML = '<span lang="en">Create mesh</span><span lang="gr">Δημιουργία πλέγματος</span>';
            btnRow.appendChild(createBtn);

            const randomizeBtn = document.createElement('button');
            randomizeBtn.className = 'btn-secondary';
            randomizeBtn.style.marginLeft = '8px';
            randomizeBtn.style.display = 'none';
            randomizeBtn.innerHTML = '<span lang="en">Fill randomly</span><span lang="gr">Συμπλήρωσε τυχαία</span>';
            btnRow.appendChild(randomizeBtn);
            wrap.appendChild(btnRow);

            const meshMsg = document.createElement('div');
            meshMsg.className = 'mesh-hint';
            meshMsg.style.display = 'none';
            wrap.appendChild(meshMsg);

            const validationMsg = document.createElement('div');
            validationMsg.id = 'validationMsg';
            validationMsg.style.cssText = 'display:none; margin-top:10px; padding:10px 14px; border-radius:6px; background:#fff3f3; border:1px solid #f5b7b7; font-size:12.5px; line-height:1.7; color:#6a1a1a;';
            wrap.appendChild(validationMsg);

            const tableContainer = document.createElement('div');
            tableContainer.id = 'tableContainer';
            tableContainer.style.marginTop = '10px';
            wrap.appendChild(tableContainer);

            const footnote = document.createElement('div');
            footnote.className = 'grid-footnote';
            footnote.id = 'gridFootnote';
            footnote.style.display = 'none';
            footnote.innerHTML =
                '<span lang="en">You can enter/edit the packet of any processor. Accepted formats: <code>x,y</code>, <code>x.y</code> or <code>x-y</code> — we\'ll display it as <code>x,y</code>.</span>' +
                '<span lang="gr">Μπορείς να εισάγεις/αλλάξεις το πακέτο κάθε επεξεργαστή. Δεκτές μορφές: <code>x,y</code>, <code>x.y</code> ή <code>x-y</code> — θα εμφανίζεται ως <code>x,y</code>.</span>';
            wrap.appendChild(footnote);

            const continueBtn = document.createElement('button');
            continueBtn.type = 'button';
            continueBtn.className = 'btn-primary';
            continueBtn.innerHTML = '<span lang="en">Continue &rarr;</span><span lang="gr">Συνέχεια &rarr;</span>';
            wrap._continueBtn = continueBtn;
            if (api.topSlot) api.topSlot.appendChild(continueBtn);
            else wrap.appendChild(continueBtn);

            const isKN = nStep === 2;
            let builtN = null;

            const CELL_ERRORS_HTML =
                '<span lang="en"><strong>The algorithm cannot start because the mesh contains invalid values.</strong><br>' +
                'Each value must be in the format <code>x,y</code> (accepted formats: x,y &nbsp; x.y &nbsp; x-y) and within the mesh bounds.<br>' +
                '<span style="color:#c0392b">■</span> <strong>Red cells</strong> — wrong format or out of bounds<br>' +
                '<span style="color:#2255c0">■</span> <strong>Blue cells</strong> — duplicate destinations</span>' +
                '<span lang="gr"><strong>Ο αλγόριθμος δεν μπορεί να ξεκινήσει γιατί το πλέγμα περιέχει μη αποδεκτές τιμές.</strong><br>' +
                'Κάθε τιμή πρέπει να είναι της μορφής <code>x,y</code> (δεκτές μορφές εισαγωγής: x,y &nbsp; x.y &nbsp; x-y) και εντός ορίων του πλέγματος.<br>' +
                '<span style="color:#c0392b">■</span> <strong>Κόκκινα κελιά</strong> — κακή μορφή ή εκτός ορίων<br>' +
                '<span style="color:#2255c0">■</span> <strong>Μπλε κελιά</strong> — διπλότυπες τιμές</span>';

            function setMsg(html, ok) {
                meshMsg.innerHTML = html || '';
                meshMsg.className = 'mesh-hint' + (ok ? ' mesh-hint--ok' : '');
                meshMsg.style.display = html ? 'block' : 'none';
            }

            function analyzeGrid(side) {
                const inputs = Array.from(tableContainer.querySelectorAll('input'));
                const status = new Map();
                const groups = {};
                inputs.forEach(function (inp) {
                    const v = inp.value.trim();
                    if (v === '') { status.set(inp, 'empty'); return; }
                    const p = parsePacketInput(v);
                    if (!p || p.a < 1 || p.a > side || p.b < 1 || p.b > side) { status.set(inp, 'bad'); return; }
                    status.set(inp, 'ok');
                    const key = p.a + ',' + p.b;
                    (groups[key] = groups[key] || []).push(inp);
                });
                const dupGroups = [];
                Object.keys(groups).forEach(function (k) {
                    if (groups[k].length > 1) {
                        groups[k].forEach(function (inp) { status.set(inp, 'dup'); });
                        dupGroups.push(groups[k]);
                    }
                });
                return { inputs: inputs, status: status, dupGroups: dupGroups };
            }

            function isSettled(inp) { return !!inp._touched && !inp._dirty; }

            function markAllTouched() {
                tableContainer.querySelectorAll('input').forEach(function (inp) { inp._touched = true; inp._dirty = false; });
            }

            function updateMeshButtons() {
                const v = typedN;
                const sizeValid = !isNaN(v) && v >= 2;
                const sizeOk = sizeValid && !(isKN && v % 2 !== 0);
                createBtn.disabled = !sizeOk;

                const hasMesh = builtN !== null && tableContainer.querySelector('input') !== null;
                const stale = hasMesh && v !== builtN;
                randomizeBtn.disabled = stale;

                let anyEmpty = false, anyInvalid = false, shownErrors = false;
                if (hasMesh && !stale) {
                    const a = analyzeGrid(builtN);
                    a.inputs.forEach(function (inp) {
                        const st = a.status.get(inp);
                        if (st === 'empty') anyEmpty = true;
                        else if (st !== 'ok') anyInvalid = true;
                        inp.style.backgroundColor = (st === 'bad' && isSettled(inp)) ? '#ffaaaa' : '';
                    });
                    a.dupGroups.forEach(function (g) {
                        if (g.every(isSettled)) g.forEach(function (inp) { inp.style.backgroundColor = '#aaaaff'; });
                    });
                    shownErrors = a.inputs.some(function (inp) { return inp.style.backgroundColor !== ''; });
                } else if (hasMesh) {
                    tableContainer.querySelectorAll('input').forEach(function (inp) { inp.style.backgroundColor = ''; });
                }

                const ready = hasMesh && !stale && !anyEmpty && !anyInvalid;
                continueBtn.disabled = !ready;

                validationMsg.style.display = 'none';
                if (!sizeValid) {
                    setMsg('<span lang="en">&radic;N must be at least 2.</span>' +
                        '<span lang="gr">Το &radic;N πρέπει να είναι τουλάχιστον 2.</span>');
                } else if (!sizeOk) {
                    setMsg('<span lang="en">The algorithm requires an even &radic;N, since the mesh is split into 4 sub-meshes.</span>' +
                        '<span lang="gr">Ο αλγόριθμος απαιτεί άρτιο &radic;N, γιατί το πλέγμα χωρίζεται σε 4 υποπλέγματα.</span>');
                } else if (!hasMesh) {
                    setMsg('<span lang="en">Create the mesh first.</span>' +
                        '<span lang="gr">Δημιούργησε πρώτα το πλέγμα.</span>');
                } else if (stale) {
                    setMsg('<span lang="en">You changed the size — press «Create mesh».</span>' +
                        '<span lang="gr">Άλλαξες το μέγεθος — πάτησε «Δημιουργία πλέγματος».</span>');
                } else if (shownErrors) {
                    setMsg(null);
                    validationMsg.innerHTML = CELL_ERRORS_HTML;
                    validationMsg.style.display = 'block';
                } else if (anyEmpty) {
                    setMsg('<span lang="en">Fill in every processor to continue.</span>' +
                        '<span lang="gr">Συμπλήρωσε όλους τους επεξεργαστές για να συνεχίσεις.</span>');
                } else if (ready) {
                    setMsg('<span lang="en">Press Continue to proceed</span>' +
                        '<span lang="gr">Πάτησε Συνέχεια για να προχωρήσεις</span>', true);
                } else {
                    setMsg(null);
                }
            }

            tableContainer.addEventListener('input', function (e) {
                if (e.target && e.target.tagName === 'INPUT') e.target._dirty = true;
                updateMeshButtons();
            });
            tableContainer.addEventListener('focusout', function (e) {
                const inp = e.target;
                if (!inp || inp.tagName !== 'INPUT') return;
                normalizePacketInput(inp);
                if (inp._dirty || inp.value.trim() !== '') inp._touched = true;
                inp._dirty = false;
                updateMeshButtons();
            });

            if (window._oaTransferToKN) {
                const t = window._oaTransferToKN;
                window._oaTransferToKN = null;
                n1.value = t.n; n2.value = t.n;
                syncN(n1);

                tableContainer.innerHTML = '';
                tableContainer.appendChild(buildEmptyGridTable(t.n));
                randomizeBtn.style.display = 'inline-block';
                footnote.style.display = 'block';
                t.values.forEach(function (v) {
                    const inp = tableContainer.querySelector('input[data-row="' + (v.row - 1) + '"][data-col="' + (v.col - 1) + '"]');
                    if (inp) inp.value = v.val;
                });
                builtN = t.n;
                typedN = t.n;
                markAllTouched();
            }

            createBtn.addEventListener('click', function () {
                if (createBtn.disabled) return;
                document.getElementById('sideN').value = n1.value;
                createEmptyGrid();
                builtN = parseInt(n1.value);
                randomizeBtn.style.display = 'inline-block';
                footnote.style.display = 'block';
                updateMeshButtons();
            });
            randomizeBtn.addEventListener('click', function () {
                if (randomizeBtn.disabled) return;
                document.getElementById('sideN').value = n1.value;
                generateTable();
                markAllTouched();
                updateMeshButtons();
            });
            continueBtn.addEventListener('click', function () {
                if (continueBtn.disabled || tableContainer.children.length === 0) return;
                const msgEl = document.getElementById('validationMsg');
                if (msgEl) msgEl.style.display = 'none';
                if (!validateGrid()) return;
                api.complete();
                api.next();
            });

            updateMeshButtons();
            body.appendChild(wrap);
        }
    };
}
