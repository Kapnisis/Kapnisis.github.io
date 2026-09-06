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

/* Animation launcher */
function appendAnimationLauncher(body, getConfig) {
    const wrap = document.createElement('div');
    wrap.className = 'anim-launcher';
    body.appendChild(wrap);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-primary anim-open-btn';
    wrap.appendChild(btn);

    const slot = document.createElement('div');
    slot.style.display = 'none';
    wrap.appendChild(slot);

    let ctrl = null;
    let open = false;

    function label() {
        btn.innerHTML = open
            ? '<span lang="en">Hide the routing</span><span lang="gr">Κρύψε τη δρομολόγηση</span>'
            : '<span lang="en">&#9654; See the whole routing</span><span lang="gr">&#9654; Δες όλη τη δρομολόγηση</span>';
    }
    label();

    btn.addEventListener('click', function () {
        open = !open;
        slot.style.display = open ? '' : 'none';
        if (open && !ctrl) ctrl = buildRoutingAnimation(slot, getConfig());
        else if (open && ctrl) ctrl.reset();
        else if (ctrl) ctrl.stop();
        label();
        if (open) requestAnimationFrame(function () { window.dispatchEvent(new Event('resize')); });
    });
}

/* Frame labels */
function animFrameLabel(gr, en) {
    return '<span lang="en">' + en + '</span><span lang="gr">' + gr + '</span>';
}

function animPhaseLabel(phase, step) {
    return animFrameLabel('Φάση ' + phase + ' &mdash; Βήμα ' + step, 'Phase ' + phase + ' &mdash; Step ' + step);
}
