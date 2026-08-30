function isGrLangUI() {
    return document.body.classList.contains('lang-gr');
}

/* Zoom / pan */
function makeZoomable(contentEl, opts) {
    opts = opts || {};
    if (!contentEl || contentEl.dataset.zoomified === '1') return;
    if (typeof Panzoom === 'undefined') return;

    const viewport = document.createElement('div');
    viewport.className = 'zoom-viewport';

    const parent = contentEl.parentNode;
    parent.insertBefore(viewport, contentEl);
    viewport.appendChild(contentEl);
    contentEl.dataset.zoomified = '1';

    const excludeEls = Array.from(contentEl.querySelectorAll('input, button, select, textarea, a'));

    const panzoom = Panzoom(contentEl, {
        maxScale: 20,
        minScale: 0.02,
        canvas: true,
        exclude: excludeEls
    });

    viewport.addEventListener('wheel', function (e) {
        panzoom.zoomWithWheel(e);
    }, { passive: false });

    const controls = document.createElement('div');
    controls.className = 'zoom-controls';
    controls.innerHTML =
        '<button type="button" class="zoom-btn zoom-in" title="Zoom in">+</button>' +
        '<button type="button" class="zoom-btn zoom-out" title="Zoom out">&minus;</button>' +
        '<button type="button" class="zoom-btn zoom-reset" title="Reset">&#8634;</button>';
    viewport.appendChild(controls);

    controls.querySelector('.zoom-in').addEventListener('click', () => panzoom.zoomIn({ force: true }));
    controls.querySelector('.zoom-out').addEventListener('click', () => panzoom.zoomOut({ force: true }));
    controls.querySelector('.zoom-reset').addEventListener('click', () => fitToViewport());

    let fitToken = 0;

    function centerContent() {
        const s = panzoom.getScale() || 1;
        const vpRect = viewport.getBoundingClientRect();
        const contentRect = contentEl.getBoundingClientRect();
        const dx = (vpRect.left + vpRect.width / 2) - (contentRect.left + contentRect.width / 2);
        const dy = (vpRect.top + vpRect.height / 2) - (contentRect.top + contentRect.height / 2);
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
        panzoom.pan(dx / s, dy / s, { animate: false, relative: true, force: true });
    }

    function fitToViewport() {
        const myToken = ++fitToken;

        const vw = viewport.clientWidth;
        if (!vw) return;

        const narrow = window.innerWidth <= 900;
        const maxVh = narrow
            ? Math.max(180, Math.min(window.innerHeight * 0.42, 420))
            : Math.max(200, Math.min(window.innerHeight * 0.68, 760));

        const cur = panzoom.getScale() || 1;
        const rect = contentEl.getBoundingClientRect();
        const cw = rect.width / cur;
        const ch = rect.height / cur;
        if (!cw || !ch) return;

        const maxUpscale = (typeof opts.maxUpscale === 'number') ? opts.maxUpscale : 2;

        const finalScale = Math.max(0.02, Math.min(maxUpscale, (vw - 70) / cw, (maxVh - 70) / ch));
        panzoom.zoom(finalScale, { animate: false, force: true });

        const vh = Math.max(180, Math.min(maxVh, ch * finalScale + 90));
        viewport.style.height = vh + 'px';

        const ox = contentEl.offsetLeft || 0;
        const oy = contentEl.offsetTop || 0;
        panzoom.pan(((vw - cw) / 2 - ox) / finalScale, ((vh - ch) / 2 - oy) / finalScale,
            { animate: false, force: true });

        requestAnimationFrame(function () {
            if (myToken !== fitToken) return;
            centerContent();
            requestAnimationFrame(function () { if (myToken === fitToken) centerContent(); });
        });
    }

    if (typeof ResizeObserver !== 'undefined') {

        let lastRo = { w: 0, h: 0 };
        let roQueued = false;
        new ResizeObserver((entries) => {
            const box = entries[0] && entries[0].contentRect;
            if (!box || !box.width || !box.height) return;
            if (Math.abs(box.width - lastRo.w) < 1.5 && Math.abs(box.height - lastRo.h) < 1.5) return;
            lastRo = { w: box.width, h: box.height };
            if (roQueued) return;
            roQueued = true;
            requestAnimationFrame(() => { roQueued = false; fitToViewport(); });
        }).observe(contentEl);
    }

    setTimeout(fitToViewport, 30);
    window.addEventListener('resize', () => fitToViewport());
}

function applyMeshZoom(container) {
    const table = container.querySelector('table');
    if (table) makeZoomable(table);
}

function initAutoZoom(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const observer = new MutationObserver(() => {
        el.querySelectorAll('table:not([data-zoomified]), svg:not([data-zoomified])').forEach(node => {

            makeZoomable(node);
        });
    });
    observer.observe(el, { childList: true, subtree: true });
}

/* Theory modal */
function openTheoryModal(contentHtml) {
    const overlay = document.createElement('div');
    overlay.className = 'theory-modal-overlay';
    overlay.innerHTML =
        '<div class="theory-modal">' +
        '  <button type="button" class="theory-modal-close">&times;</button>' +
        '  <div class="theory-modal-body">' + contentHtml + '</div>' +
        '</div>';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('.theory-modal-close').addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);

    dedupeGlossaryTerms(overlay.querySelector('.theory-modal-body'));
}

/* Glossary */
const GLOSSARY_TERMS = {
    'greedy': {
        en: 'In a <strong>greedy</strong> routing algorithm, all packets move toward their final destination at every step, making a locally optimal decision without examining past or future states.',
        gr: 'Σε έναν <strong>άπληστο</strong> αλγόριθμο δρομολόγησης, όλα τα πακέτα μετακινούνται σε κάθε βήμα προς τον τελικό προορισμό τους, παίρνοντας μια τοπική και βέλτιστη απόφαση, χωρίς να εξετάζουν προηγούμενες ή επόμενες καταστάσεις.'
    },
    'offline': {
        en: 'In an <strong>offline</strong> routing, all packet paths are computed in advance, before communication begins. This allows packets to move simultaneously through mesh nodes according to a strict schedule, avoiding conflicts without real-time decision-making.',
        gr: 'Σε μια <strong>offline</strong> δρομολόγηση όλες οι διαδρομές των πακέτων υπολογίζονται εκ των προτέρων, πριν ξεκινήσει η επικοινωνία. Αυτό επιτρέπει στα πακέτα να κινούνται ταυτόχρονα μέσω των κόμβων του πλέγματος βάσει ενός αυστηρού χρονοδιαγράμματος, αποφεύγοντας τις συγκρούσεις χωρίς να χρειάζεται λήψη αποφάσεων σε πραγματικό χρόνο.'
    },
    'hall': {
        en: 'A bipartite graph with two vertex sets U and V has a perfect matching covering all of U if and only if, for every subset S of U, the neighborhood |N(S)| ≥ |S|. When the graph is <strong>regular</strong> (every vertex has the same degree), Hall\'s theorem guarantees the edges decompose fully into independent perfect matchings. <a href="https://en.wikipedia.org/wiki/Hall%27s_marriage_theorem" target="_blank" rel="noopener">Wikipedia</a>',
        gr: 'Ένα διμερές γράφημα με δύο σύνολα κορυφών U και V διαθέτει τέλειο ταίριασμα που καλύπτει όλο το U αν και μόνο αν, για κάθε υποσύνολο S του U, |N(S)| ≥ |S|. Στην ειδική περίπτωση που το γράφημα είναι <strong>κανονικό</strong> (κάθε κορυφή έχει τον ίδιο ακριβώς αριθμό γειτόνων), το θεώρημα εγγυάται ότι οι ακμές μπορούν να αναλυθούν πλήρως σε ανεξάρτητα τέλεια ταιριάσματα. <a href="https://en.wikipedia.org/wiki/Hall%27s_marriage_theorem" target="_blank" rel="noopener">Wikipedia</a>'
    },
    'odd-even': {
        en: 'With the <strong>odd-even transposition sort</strong> algorithm, packets are compared in pairs and forwarded towards their destination. On <strong>odd</strong> steps the pairs (1,2), (3,4), … are compared, and on <strong>even</strong> steps the pairs (2,3), (4,5), …. The algorithm routes a (1,1) permutation of &radic;N processors in &radic;N steps.',
        gr: 'Με τον αλγόριθμο <strong>odd-even transposition sort</strong> τα πακέτα συγκρίνονται ανά ζεύγη και προωθούνται προς τον προορισμό τους. Στα <strong>περιττά/odd</strong> βήματα του αλγορίθμου συγκρίνονται τα ζεύγη (1,2) (3,4) κ.ο.κ. και στα <strong>ζυγά/even</strong> βήματα τα ζεύγη (2,3) (4,5) κ.ο.κ. Ο αλγόριθμος δρομολογεί μια (1,1) μετάθεση &radic;N επεξεργαστών σε &radic;N βήματα.'
    },
    'step': {
        en: 'Each packet can move along one edge between processors exactly once in each <strong>step</strong>.',
        gr: 'Κάθε πακέτο μπορεί να μετακινηθεί πάνω σε μια ακμή μεταξύ επεξεργαστών μια φορά σε κάθε <strong>βήμα</strong>.'
    },
    'mesh': {
        en: 'We consider a <strong>mesh</strong> of processors connected by bidirectional edges to their neighbors (left, right, up, down), except those at the boundary — there is no wrap-around. At most 1 packet can be forwarded along any edge per step. A processor, however, may hold more than one packet between steps — that maximum is its queue size and depends on the algorithm.',
        gr: 'Θεωρούμε <strong>πλέγμα</strong> επεξεργαστών, που συνδέονται με ακμές διπλής κατεύθυνσης με τους γείτονές τους αριστερά, δεξιά, πάνω και κάτω, εκτός αυτών που βρίσκονται στις άκρες (δεν υπάρχει αναδίπλωση). Στις ακμές, σε κάθε βήμα, μπορεί να προωθηθεί το πολύ 1 πακέτο πληροφορίας. Ένας επεξεργαστής όμως μπορεί να κρατά περισσότερα από ένα πακέτα ανάμεσα στα βήματα — το μέγιστο πλήθος τους είναι το μέγεθος της ουράς του και εξαρτάται από τον αλγόριθμο.'
    },
    'packet': {
        en: 'A <strong>packet</strong> is a message that a processor wants to send to another. The properties relevant to routing are its initial position (a,b) and its destination (c,d). In this application packets are identified by their destination (c,d).',
        gr: 'Ως <strong>πακέτο</strong> πληροφορίας θεωρούμε ένα μήνυμα που θέλει να στείλει ένας επεξεργαστής σε έναν άλλον. Οι ιδιότητες που μας αφορούν για τη δρομολόγησή του είναι η αρχική του θέση (a,b) και ο προορισμός του (c,d). Τα πακέτα στην εφαρμογή μας αναγνωρίζονται από τον προορισμό τους (c,d).'
    },
    'mapping-22': {
        en: 'A <strong>(2,2)-mapping</strong> is a routing problem in which every processor is the source of at most 2 packets and the destination of at most 2 packets.',
        gr: 'Ένα <strong>(2,2)-mapping</strong> είναι ένα πρόβλημα δρομολόγησης στο οποίο κάθε επεξεργαστής είναι αφετηρία το πολύ 2 πακέτων και προορισμός το πολύ 2 πακέτων.'
    },
    'ism': {
        en: 'For a packet at position (a, b) with destination (c, d), its <strong>Intermediate Sub-Mesh (ISM)</strong> is the unique sub-mesh containing the node (c, b).',
        gr: 'Για πακέτο στη θέση (a, b) με προορισμό (c, d), το <strong>Intermediate Sub-Mesh (ISM)</strong> του είναι το μοναδικό sub-mesh που περιέχει τον κόμβο (c, b).'
    },
    'permutation': {
        en: 'A <strong>permutation</strong> is a routing problem where every processor is the source of at most one packet and the destination of at most one packet — a (1,1) problem. It can be routed with queue size 1.',
        gr: 'Ως <strong>μετάθεση</strong> εννοούμε ένα πρόβλημα δρομολόγησης όπου κάθε επεξεργαστής είναι αφετηρία το πολύ ενός πακέτου και προορισμός το πολύ ενός πακέτου — δηλαδή ένα (1,1) πρόβλημα. Δρομολογείται με ουρά μεγέθους 1.'
    },
    'virtual-source': {
        en: 'For a packet at position (a,b) with destination (c,d), the <strong>virtual source</strong> is the position corresponding to (a,b) inside its ISM — same column b, row mapped to the ISM\'s row zone. The packet travels within its column to the virtual source in Phase 1.',
        gr: 'Για πακέτο στη θέση (a,b) με προορισμό (c,d), το <strong>virtual source</strong> είναι η θέση που αντιστοιχεί στην (a,b) μέσα στο ISM του — ίδια στήλη b, γραμμή χαρτογραφημένη στη ζώνη γραμμών του ISM. Το πακέτο κινείται στη στήλη του προς το virtual source στη Φάση 1.'
    }
};

function walkAndWrap(root, text, key) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const targets = [];
    let node;
    while ((node = walker.nextNode())) {
        if (node.parentElement && node.parentElement.closest('.glossary-term')) continue;
        const idx = node.nodeValue.toLowerCase().indexOf(text.toLowerCase());
        if (idx !== -1) targets.push(node);
    }
    targets.forEach(node => {
        const idx = node.nodeValue.toLowerCase().indexOf(text.toLowerCase());
        const before = node.nodeValue.slice(0, idx);
        const match = node.nodeValue.slice(idx, idx + text.length);
        const after = node.nodeValue.slice(idx + text.length);
        const span = document.createElement('span');
        span.className = 'glossary-term';
        span.dataset.term = key;
        span.textContent = match;
        const frag = document.createDocumentFragment();
        frag.appendChild(document.createTextNode(before));
        frag.appendChild(span);
        frag.appendChild(document.createTextNode(after));
        node.parentNode.replaceChild(frag, node);
    });
}

function glossaryLangScope(el) {
    const langEl = el.closest ? el.closest('[lang]') : null;
    return langEl ? (langEl.getAttribute('lang') || '*') : '*';
}

function dedupeGlossaryTerms(root) {
    if (!root || !root.querySelectorAll) return;
    const seen = new Set();
    root.querySelectorAll('.glossary-term[data-term]').forEach(function (el) {
        const key = glossaryLangScope(el) + '|' + el.dataset.term;
        if (seen.has(key)) {

            el.classList.remove('glossary-term');
            el.classList.add('glossary-term-repeat');
            el.removeAttribute('data-term');
        } else {
            seen.add(key);
        }
    });
}

(function bindGlossaryDelegation() {
    function findTermEl(e) {
        return e.target && e.target.closest ? e.target.closest('.glossary-term') : null;
    }
    document.addEventListener('mouseenter', function (e) {
        const t = findTermEl(e);
        if (!t) return;
        const entry = GLOSSARY_TERMS[t.dataset.term];
        if (!entry) return;
        const html = isGrLangUI() ? entry.gr : entry.en;
        if (typeof showTooltip === 'function') {
            showTooltip(e.clientX, e.clientY, html);
        } else {
            showGlossaryTipFallback(t, html);
        }
    }, true);
    document.addEventListener('mousemove', function (e) {
        const t = findTermEl(e);
        if (!t) return;
        const entry = GLOSSARY_TERMS[t.dataset.term];
        if (!entry) return;
        if (typeof showTooltip === 'function') {
            showTooltip(e.clientX, e.clientY, isGrLangUI() ? entry.gr : entry.en);
        }
    }, true);
    document.addEventListener('mouseleave', function (e) {
        const t = findTermEl(e);
        if (!t) return;
        if (typeof hideTooltip === 'function') hideTooltip();
        hideGlossaryTipFallback();
    }, true);
})();

let _glossaryFallbackEl = null;
function showGlossaryTipFallback(termEl, html) {
    hideGlossaryTipFallback();
    const tip = document.createElement('div');
    tip.className = 'oa-tooltip glossary-tip-fallback';
    tip.style.display = 'block';
    tip.innerHTML = html;
    document.body.appendChild(tip);
    const rect = termEl.getBoundingClientRect();
    tip.style.left = Math.max(8, rect.left) + 'px';
    tip.style.top = (rect.bottom + 6) + 'px';
    _glossaryFallbackEl = tip;
}
function hideGlossaryTipFallback() {
    if (_glossaryFallbackEl) { _glossaryFallbackEl.remove(); _glossaryFallbackEl = null; }
}

/* Step bounds */
function formatBound(kind, n) {
    const N = n * n;
    let boundValue, formulaInstance;

    if (kind === 'krizanc') {
        boundValue = 2.5 * n;
        formulaInstance = '2.5&middot;&radic;' + N + ' = ' + boundValue;
        return '<span lang="en">Number of Steps ' + formulaInstance + '</span>' +
            '<span lang="gr">Αριθμός Βημάτων ' + formulaInstance + '</span>';
    }
    boundValue = 3 * n - 3;
    formulaInstance = '3&middot;&radic;' + N + ' &minus; 3 = ' + boundValue;
    return '<span lang="en">Theoretical Upper Bound ' + formulaInstance + '</span>' +
        '<span lang="gr">Θεωρητικό Άνω Φράγμα ' + formulaInstance + '</span>';
}

/* Step sequence */
function renderStepSequence(hostEl, cards, opts) {
    opts = opts || {};
    hostEl.innerHTML = '';

    const cardShell = document.createElement('div');
    cardShell.className = 'step-seq-card';
    const helpBtn = document.createElement('button');
    helpBtn.type = 'button';
    helpBtn.className = 'step-seq-help-btn';
    helpBtn.title = 'Θεωρία / Theory';
    helpBtn.textContent = '?';
    cardShell.appendChild(helpBtn);
    const cardBody = document.createElement('div');
    cardBody.className = 'step-seq-card-body';
    cardShell.appendChild(cardBody);
    hostEl.appendChild(cardShell);

    if (typeof MutationObserver !== 'undefined') {
        let dedupeQueued = false;
        new MutationObserver(function () {
            if (dedupeQueued) return;
            dedupeQueued = true;
            requestAnimationFrame(function () {
                dedupeQueued = false;
                dedupeGlossaryTerms(cardBody);
            });
        }).observe(cardBody, { childList: true, subtree: true });
    }

    const navRow = document.createElement('div');
    navRow.className = 'step-seq-nav';
    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'btn-secondary step-seq-prev';
    prevBtn.innerHTML = '<span lang="en">&larr; Previous</span><span lang="gr">&larr; Προηγούμενο</span>';
    const dotsWrap = document.createElement('div');
    dotsWrap.className = 'step-seq-dots';
    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'btn-primary step-seq-next';
    nextBtn.innerHTML = '<span lang="en">Next &rarr;</span><span lang="gr">Επόμενο &rarr;</span>';
    navRow.appendChild(prevBtn);
    navRow.appendChild(dotsWrap);
    navRow.appendChild(nextBtn);
    hostEl.appendChild(navRow);

    let currentIndex = 0;
    let maxUnlocked = 0;
    const completedSet = new Set();

    function isLocked(i) { return i > maxUnlocked; }

    function markReachable(i) { if (i > maxUnlocked) maxUnlocked = i; }

    function cardApi(forIndex) {
        return {
            complete: function () {
                completedSet.add(forIndex);
                markReachable(forIndex + 1);
                refreshChrome();
            },
            next: function () { stepDelta(1); },
            prev: function () { stepDelta(-1); },
            goTo: function (i) { goTo(i); },
            isSkip: !!window.skipTutorials
        };
    }

    function goTo(i) {
        if (i < 0) return;
        if (i >= cards.length) {
            if (typeof opts.onFinish === 'function') opts.onFinish();
            return;
        }
        if (isLocked(i)) return;
        currentIndex = i;
        renderCurrent();
    }

    function hopTarget(dir) {
        let i = currentIndex + dir;
        while (i >= 0 && i < cards.length && window.skipTutorials && cards[i].kind === 'theory') i += dir;
        return i;
    }

    function navLabelFor(i, dir) {
        const card = cards[i];
        const fallback = dir < 0
            ? '<span lang="en">Previous</span><span lang="gr">Προηγούμενο</span>'
            : '<span lang="en">Next</span><span lang="gr">Επόμενο</span>';
        const label = (card && card.navLabel) ? card.navLabel : fallback;
        return dir < 0 ? ('&larr; ' + label) : (label + ' &rarr;');
    }

    function stepDelta(dir) {
        let i = currentIndex + dir;

        while (i >= 0 && i < cards.length && window.skipTutorials && cards[i].kind === 'theory') {
            i += dir;
        }
        goTo(i);
    }

    function renderCurrent() {
        cardBody.innerHTML = '';
        const card = cards[currentIndex];
        helpBtn.style.visibility = card.theory ? 'visible' : 'hidden';
        helpBtn.onclick = function () { openTheoryModal(card.theory); };
        card.render(cardBody, cardApi(currentIndex));
        dedupeGlossaryTerms(cardBody);
        if (!card.interactive) {
            completedSet.add(currentIndex);
            markReachable(currentIndex + 1);
        }
        refreshChrome();
        if (typeof cardShell.scrollIntoView === 'function') {
            try { cardShell.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) {  }
        }
    }

    function refreshChrome() {

        dotsWrap.innerHTML = '';
        cards.forEach(function (c, i) {
            if (window.skipTutorials && c.kind === 'theory') return;
            const dot = document.createElement('button');
            dot.type = 'button';
            dot.className = 'step-seq-dot' +
                (i === currentIndex ? ' current' : '') +
                (completedSet.has(i) ? ' done' : '') +
                (isLocked(i) ? ' locked' : '');
            dot.disabled = isLocked(i);
            dot.addEventListener('click', function () { goTo(i); });
            dotsWrap.appendChild(dot);
        });

        prevBtn.disabled = currentIndex <= 0;
        const isLastCard = currentIndex >= cards.length - 1;
        nextBtn.disabled = isLastCard || (isLocked(currentIndex + 1) && currentIndex + 1 < cards.length);
        nextBtn.style.visibility = isLastCard ? 'hidden' : 'visible';

        prevBtn.innerHTML = navLabelFor(hopTarget(-1), -1);
        nextBtn.innerHTML = navLabelFor(hopTarget(1), 1);
    }

    prevBtn.addEventListener('click', function () { stepDelta(-1); });
    nextBtn.addEventListener('click', function () { stepDelta(1); });

    goTo(0);
}