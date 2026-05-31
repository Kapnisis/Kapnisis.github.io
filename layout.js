window.addEventListener('load', () => {
    const v = 4;
    document.getElementById('n1').value = v;
    document.getElementById('n2').value = v;
    document.getElementById('total').textContent = v * v;      
    document.getElementById('sideN').value = v;
    generateTable();
});


function syncN(el) {
    const v = parseInt(el.value);
    if (isNaN(v) || v < 2) return;
    document.getElementById('n1').value = v;
    document.getElementById('n2').value = v;
    document.getElementById('total').textContent = v * v;
    document.getElementById('total2').textContent = v * v;
    document.getElementById('shortParam').textContent = v + ' × ' + v;
    if (document.getElementById('sideN')) document.getElementById('sideN').value = v;
    generateTable();
}


function toggleRow(row) {
    const isActive = row.classList.contains('active');
    document.querySelectorAll('.row').forEach(r => r.classList.remove('active'));
    if (!isActive) row.classList.add('active');
}

function runAlgorithm() {
    const algo = document.querySelector('input[name="algo"]:checked').value;
    if (algo === 'krizanc') {
        krizancAlgorithm();
    } else {
        startAlgorithm();
    }
}
