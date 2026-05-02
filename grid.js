function generateTable() {
    document.getElementById('phaseContainer').innerHTML = '';

    n = parseInt(document.getElementById('sideN').value);
    if (isNaN(n)) {
        alert('Please enter √N');
        return;
    }

    N = n * n;
    blockSize = Math.max(2, Math.floor(Math.pow(N, 3 / 8)));
    sentinel = N + 1;

    const tableContainer = document.getElementById('tableContainer');
    tableContainer.innerHTML = '';

    const table = document.createElement('table');

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

    const headerRow = document.createElement('tr');
    headerRow.appendChild(document.createElement('th'));
    for (let i = 1; i <= n; i++) {
        const th = document.createElement('th');
        th.textContent = i;
        headerRow.appendChild(th);
    }
    table.appendChild(headerRow);

    let index = 0;
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
            const dest = assigned[index++];
            input.value = `${dest.r + 1},${dest.c + 1}`;
            input.oninput = () => { input.style.backgroundColor = ''; };
            cell.appendChild(input);
            row.appendChild(cell);
        }
        table.appendChild(row);
    }

    tableContainer.appendChild(table);

    const inputs = Array.from(document.querySelectorAll('#tableContainer input'));
    const toErase = Math.floor(inputs.length * Math.random());
    inputs.sort(() => Math.random() - 0.5).slice(0, toErase).forEach(input => input.value = '');
}


//validate if the mesh has any bad cells
function validateGrid() {
    const inputs = Array.from(document.querySelectorAll('#tableContainer input'));
    let valid = true;
    const seen = {};

    inputs.forEach(input => input.style.backgroundColor = '');

    inputs.forEach(input => {
        const val = input.value.trim();
        if (val === '') return;

        const parts = val.split(',');
        const a = parseInt(parts[0]);
        const b = parseInt(parts[1]);

        if (parts.length !== 2 || isNaN(a) || isNaN(b) || parts[0].trim() === '' || parts[1].trim() === '') {
            input.style.backgroundColor = '#ffaaaa';
            valid = false;
            return;
        }

        if (a < 1 || a > n || b < 1 || b > n) {
            input.style.backgroundColor = '#ffaaaa';
            valid = false;
            return;
        }

        const r = parseInt(input.dataset.row);
        const c = parseInt(input.dataset.col);
        if (a === r + 1 && b === c + 1) {
            input.style.backgroundColor = '#ffffaa';
        }

        const key = `${a},${b}`;
        if (seen[key]) {
            input.style.backgroundColor = '#aaaaff';
            seen[key].style.backgroundColor = '#aaaaff';
            valid = false;
        } else {
            seen[key] = input;
        }
    });

    const isGreek = document.body.classList.contains('lang-gr');
    if (!valid) {
        if (isGreek) {
            alert('Ο αλγόριθμος δεν μπορεί να ξεκινήσει γιατί το πλέγμα περιέχει μη αποδεκτές τιμές.\n\nΚάθε τιμή πρέπει να είναι της μορφής "x,y" και εντός ορίων του πλέγματος\n\nΚόκκινα κελιά - Κακή μορφή ή εκτός ορίων\n\nΜπλε κελιά - Διπλότυπες τιμές\n\nΚίτρινο κελί - Η τιμή του κελιού είναι η ίδια με την τελική διεύθυνση του\n\nΔιόρθωσε τις τιμές στα κόκκινα και μπλε κελιά και ξαναπάτα START.\nΤα κίτρινα κελιά δεν χρήζουν διόρθωσης απλά επισημαίνουν ότι δεν θα αλλάξουν θέση στο τελικό πλέγμα');
        } else {
            alert('The algorithm cannot start because the grid contains invalid values.\n\nEach value must be in the format "x,y" and within the grid bounds.\n\nRed cells - Bad format or out of bounds\n\nBlue cells - Duplicate destinations\n\nYellow cell - The cell\'s value matches its own position, meaning it won\'t move in the final grid\n\nFix the values in the red and blue cells and press START again.\nYellow cells do not need fixing, they simply indicate that the packet is already at its destination.');
        }
    }
    return valid;
}