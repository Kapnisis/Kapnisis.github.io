/* Routing animation */
function buildRoutingAnimation(hostEl, config) {
    const frames = config.frames || [];
    const totalSteps = config.totalSteps || 0;
    if (!frames.length) return null;

    hostEl.innerHTML = '';

    const panel = document.createElement('div');
    panel.className = 'anim-panel';
    hostEl.appendChild(panel);

    const bar = document.createElement('div');
    bar.className = 'anim-bar';
    panel.appendChild(bar);

    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.className = 'btn-primary anim-btn anim-play';
    bar.appendChild(playBtn);

    const restartBtn = document.createElement('button');
    restartBtn.type = 'button';
    restartBtn.className = 'btn-secondary anim-btn';
    restartBtn.innerHTML = '&#9198;';
    restartBtn.title = isGrLangUI() ? 'Από την αρχή' : 'Restart';
    bar.appendChild(restartBtn);

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'btn-secondary anim-btn';
    prevBtn.innerHTML = '&larr;';
    bar.appendChild(prevBtn);

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'btn-secondary anim-btn';
    nextBtn.innerHTML = '&rarr;';
    bar.appendChild(nextBtn);

    const speedWrap = document.createElement('label');
    speedWrap.className = 'anim-speed';
    speedWrap.innerHTML = '<span lang="en">Speed</span><span lang="gr">Ταχύτητα</span>';
    const speedSel = document.createElement('select');
    [['0.8', '0.8s'], ['0.5', '0.5s'], ['0.2', '0.2s'], ['0.1', '0.1s'], ['0.05', '0.05s']]
        .forEach(function (o) {
            const opt = document.createElement('option');
            opt.value = o[0];
            opt.textContent = o[1];
            speedSel.appendChild(opt);
        });
    speedSel.value = '0.2';
    speedWrap.appendChild(speedSel);
    bar.appendChild(speedWrap);

    const headRow = document.createElement('div');
    headRow.className = 'anim-head';
    panel.appendChild(headRow);

    const labelEl = document.createElement('div');
    labelEl.className = 'anim-label';
    headRow.appendChild(labelEl);

    const counterEl = document.createElement('div');
    counterEl.className = 'anim-counter';
    headRow.appendChild(counterEl);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'anim-slider';
    slider.min = '0';
    slider.max = String(frames.length - 1);
    slider.value = '0';
    panel.appendChild(slider);

    const gridSlot = document.createElement('div');
    gridSlot.className = 'anim-grid';
    panel.appendChild(gridSlot);

    let idx = -1;
    let timer = null;
    let playing = false;

    function delay() { return Math.round(parseFloat(speedSel.value) * 1000); }

    function playLabel() {
        playBtn.innerHTML = playing
            ? '<span lang="en">&#10074;&#10074; Pause</span><span lang="gr">&#10074;&#10074; Παύση</span>'
            : '<span lang="en">&#9654; Play</span><span lang="gr">&#9654; Αναπαραγωγή</span>';
    }

    function refreshChrome() {
        const f = frames[idx];
        labelEl.innerHTML = f.label + (f.offline ? ' <span class="anim-offline-tag">offline</span>' : '');
        counterEl.innerHTML = '<span lang="en">Step ' + f.step + ' / ' + totalSteps + '</span>' +
            '<span lang="gr">Βήμα ' + f.step + ' / ' + totalSteps + '</span>';
        slider.value = String(idx);
        prevBtn.disabled = idx <= 0;
        nextBtn.disabled = idx >= frames.length - 1;
        playLabel();
    }

    function show(i) {
        const clamped = Math.max(0, Math.min(frames.length - 1, i));
        if (clamped === idx) { refreshChrome(); return; }
        idx = clamped;
        frames[idx].draw(gridSlot);
        refreshChrome();
    }

    function stop() {
        playing = false;
        if (timer) { clearTimeout(timer); timer = null; }
        playLabel();
    }

    function tick() {
        if (idx >= frames.length - 1) { stop(); return; }
        show(idx + 1);
        if (idx >= frames.length - 1) { stop(); return; }
        timer = setTimeout(tick, delay());
    }

    function play() {
        if (idx >= frames.length - 1) show(0);
        playing = true;
        playLabel();
        if (timer) clearTimeout(timer);
        timer = setTimeout(tick, delay());
    }

    playBtn.addEventListener('click', function () { if (playing) stop(); else play(); });
    restartBtn.addEventListener('click', function () { stop(); show(0); });
    prevBtn.addEventListener('click', function () { stop(); show(idx - 1); });
    nextBtn.addEventListener('click', function () { stop(); show(idx + 1); });
    slider.addEventListener('input', function () { stop(); show(parseInt(slider.value)); });
    speedSel.addEventListener('change', function () {
        if (!playing) return;
        if (timer) clearTimeout(timer);
        timer = setTimeout(tick, delay());
    });

    show(0);

    return { stop: stop, reset: function () { stop(); show(0); } };
}

/* Reuse the current instance with the other algorithm */
function appendTransferButton(parent, targetAlgo, n, values) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-primary';
    btn.innerHTML =
        '<span lang="en">Try the same instance with the other algorithm too</span>' +
        '<span lang="gr">Δοκίμασε το ίδιο στιγμιότυπο και με τον άλλο αλγόριθμο</span>';
    btn.addEventListener('click', function () {
        window._oaTransferToKN = { n: n, values: values };
        resetMeshCard();
        document.getElementById('algoSelectScreen').style.display = 'block';
        document.getElementById('flowContainer').style.display = 'none';
        document.querySelectorAll('.algo-card').forEach(function (c) { c.classList.remove('selected'); });
        const card = document.querySelector('.algo-card[data-algo="' + targetAlgo + '"]');
        if (!card) return;
        card.classList.add('selected');
        document.getElementById('selectedAlgo').value = targetAlgo;
        const startBtn = document.getElementById('startFlowBtn');
        startBtn.disabled = false;
        startBtn.click();
    });
    parent.appendChild(btn);
    return btn;
}

/* Animation launcher */
function openAnimationModal(getConfig) {
    const overlay = document.createElement('div');
    overlay.className = 'theory-modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'anim-modal';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'theory-modal-close';
    closeBtn.innerHTML = '&times;';
    modal.appendChild(closeBtn);
    const host = document.createElement('div');
    modal.appendChild(host);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const zoomObserver = new MutationObserver(function () {
        host.querySelectorAll('table:not([data-zoomified])').forEach(function (t) { makeZoomable(t); });
    });
    zoomObserver.observe(host, { childList: true, subtree: true });

    const ctrl = buildRoutingAnimation(host, getConfig());

    function close() {
        if (ctrl) ctrl.stop();
        zoomObserver.disconnect();
        overlay.remove();
    }
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
}

function appendAnimationLauncher(parent, getConfig) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-primary anim-open-btn';
    btn.innerHTML = '<span lang="en">&#9654; See the whole routing</span><span lang="gr">&#9654; Δες όλη τη δρομολόγηση</span>';
    btn.addEventListener('click', function () { openAnimationModal(getConfig); });
    parent.appendChild(btn);
    return btn;
}

/* Frame labels */
function animFrameLabel(gr, en) {
    return '<span lang="en">' + en + '</span><span lang="gr">' + gr + '</span>';
}

function animPhaseLabel(phase, step) {
    return animFrameLabel('Φάση ' + phase + ' &mdash; Βήμα ' + step, 'Phase ' + phase + ' &mdash; Step ' + step);
}
