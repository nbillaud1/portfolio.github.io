const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const app = $('#app');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fineHover = matchMedia('(hover: hover) and (pointer: fine)').matches;

const T = TEXTES;
const SECTIONS = Object.entries(T.pageProjet.sections); // [clé, titre], dans l'ordre de data.js

// code AC -> { label, comp }
const AC_INDEX = new Map();
COMPETENCES.forEach(comp => comp.levels.forEach(level =>
    level.acs.forEach(([code, label]) => AC_INDEX.set(code, { label, comp }))
));
const projectsFor = code => PROJECTS.filter(p => p.acs.includes(code));

/* ---------- Fragments ---------- */

const stroke = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const ICONS = {
    sun: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" ${stroke}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`,
    moon: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" ${stroke}><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z"/></svg>`,
    // Logo GitHub (Octicons, licence MIT)
    github: `<svg class="icon" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.37A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/></svg>`
};
const linkIcon = url => url.includes('github.com') ? ICONS.github : '';

// Vidéo en boucle si fournie, sinon première capture, sinon le titre en grand
function media(p) {
    const poster = p.images[0];
    if (p.video) {
        return `<video src="${p.video}" ${poster ? `poster="${poster.src}"` : ''} muted loop playsinline preload="metadata" aria-label="Démonstration de ${p.title}"></video>`;
    }
    if (poster) return `<img src="${poster.src}" alt="${poster.alt}" loading="lazy">`;
    return `<div class="ph" role="img" aria-label="Vidéo de ${p.title} à venir">
        <span class="ph-title">${p.title}</span>
        <span class="ph-note">${T.projets.videoAVenir}</span>
    </div>`;
}

function placeholder(label) {
    return `<div class="ph" role="img" aria-label="${label}"><span class="ph-note">${label}</span></div>`;
}

function paragraphs(content) {
    return [].concat(content ?? LOREM).map(t => `<p>${t}</p>`).join('');
}

/* ---------- Accueil ---------- */

const DRUM_ROWS = [
    ['kick', T.passions.instruments.kick, [1, 0, 0, 0, 1, 0, 0, 0]],
    ['snare', T.passions.instruments.snare, [0, 0, 1, 0, 0, 0, 1, 0]],
    ['hat', T.passions.instruments.hat, [1, 1, 1, 1, 1, 1, 1, 1]]
];

function renderHome() {
    const bars = Array.from({ length: 72 }, (_, i) => {
        const h = 0.18 + 0.82 * Math.abs(Math.sin(i * 0.37) * Math.cos(i * 0.113 + 1));
        return `<i style="--h:${h.toFixed(2)};--i:${i}"></i>`;
    }).join('');

    const cards = PROJECTS.map(p => `
        <article class="project-card">
            <a class="pc-media" href="#/projets/${p.slug}" tabindex="-1" aria-hidden="true">${media(p)}</a>
            <div class="pc-text">
                <h3><a href="#/projets/${p.slug}">${p.title}</a></h3>
                <p>${p.tagline}</p>
                <ul class="stack" aria-label="Technologies">${p.stack.map(s => `<li>${s}</li>`).join('')}</ul>
                <a class="link" href="#/projets/${p.slug}" aria-label="${T.projets.voirProjet} ${p.title}">${T.projets.voirProjet}</a>
            </div>
        </article>`).join('');

    const xp = EXPERIENCES.map(e => `
        <li class="xp-row">
            <span class="xp-period">${e.period}</span>
            <div>
                <h3>${e.role}, ${e.org}</h3>
                <p>${e.text}</p>
            </div>
        </li>`).join('');

    const drum = DRUM_ROWS.map(([id, label, pattern]) => `
        <div class="drum-row" role="group" aria-label="${label}">
            <span>${label}</span>
            ${pattern.map((on, s) => `<button type="button" data-row="${id}" data-step="${s}" aria-pressed="${!!on}" aria-label="${label}, pas ${s + 1}"></button>`).join('')}
        </div>`).join('');

    const sportMedia = PASSIONS.sportImage
        ? `<img src="${PASSIONS.sportImage.src}" alt="${PASSIONS.sportImage.alt}" loading="lazy">`
        : placeholder(T.passions.photoAVenir);

    return `
        <section class="hero" aria-label="Présentation">
            <div class="hero-stage">
                <h1 tabindex="-1" aria-label="${PROFILE.name}"><svg class="hero-name" id="heroName" aria-hidden="true"><text></text></svg></h1>
                <p class="hero-typing">
                    <span class="sr-only">${T.hero.jeSuis} ${PROFILE.roles.join(' ')}</span>
                    <span aria-hidden="true">${T.hero.jeSuis} <span id="typed"></span><span class="caret"></span></span>
                </p>
                <div class="bars" id="bars" aria-hidden="true">${bars}</div>
                <div class="hero-foot">
                    <p>${PROFILE.intro}</p>
                    <div class="hero-actions">
                        <a class="btn btn-light" href="#/projets">${T.hero.voirProjets}</a>
                        ${PROFILE.email ? `<a class="btn btn-ghost" href="mailto:${PROFILE.email}">${T.hero.ecrire}</a>` : ''}
                        <a class="btn btn-ghost" href="${PROFILE.github}" target="_blank" rel="noopener">${ICONS.github}${T.hero.github}</a>
                    </div>
                </div>
            </div>
        </section>

        <section class="wrap section" id="projets" aria-labelledby="projets-title">
            <h2 class="section-title" id="projets-title">${T.projets.titre}</h2>
            <p class="section-intro">${T.projets.intro}</p>
            <div class="projects">${cards}</div>
        </section>

        <section class="wrap section" id="experience" aria-labelledby="xp-title">
            <h2 class="section-title" id="xp-title">${T.experience.titre}</h2>
            <ol class="xp-list">${xp}</ol>
        </section>

        <section class="wrap section" id="passions" aria-labelledby="passions-title">
            <h2 class="section-title" id="passions-title">${T.passions.titre}</h2>
            <p class="section-intro">${T.passions.intro}</p>
            <div class="passions">
                <div class="passion">
                    <h3>${T.passions.musique}</h3>
                    <p>${PASSIONS.music}</p>
                    <div class="drum" id="drum">${drum}</div>
                    <div class="drum-controls">
                        <button class="btn" type="button" id="drumPlay">${T.passions.lancer}</button>
                        <label class="tempo">${T.passions.tempo}
                            <input type="range" id="tempo" min="70" max="170" value="110">
                            <output id="tempoOut" for="tempo">110 BPM</output>
                        </label>
                    </div>
                    <p class="hint">${T.passions.astuce}</p>
                </div>
                <div class="passion">
                    <h3>${T.passions.sport}</h3>
                    <p>${PASSIONS.sport}</p>
                    <div class="passion-media">${sportMedia}</div>
                </div>
            </div>
        </section>`;
}

/* ---------- Page projet ---------- */

function renderSection(p, key) {
    if (key === 'preuves') {
        const gallery = p.images.length
            ? p.images.map(img => `<figure><img src="${img.src}" alt="${img.alt}" loading="lazy"><figcaption>${img.alt}</figcaption></figure>`).join('')
            : `<figure>${placeholder(T.pageProjet.captureAVenir)}</figure><figure>${placeholder(T.pageProjet.captureAVenir)}</figure>`;
        const links = p.links.length
            ? `<div class="links">${p.links.map(l => `<a class="btn" href="${l.url}" target="_blank" rel="noopener">${linkIcon(l.url)}${l.label}</a>`).join('')}</div>`
            : '';
        return `<div class="gallery">${gallery}</div>${links}`;
    }
    if (key === 'competences') {
        return `<ul class="ac-links">${p.acs.map(code => {
            const ac = AC_INDEX.get(code);
            return `<li><a href="#/competences/${code}">
                <span class="ac-code">${code}</span>
                <span>${ac.label}<small>${ac.comp.name}</small></span>
            </a></li>`;
        }).join('')}</ul>`;
    }
    return paragraphs(p.sections?.[key]);
}

function renderProject(slug) {
    const i = PROJECTS.findIndex(p => p.slug === slug);
    if (i < 0) return renderNotFound();
    const p = PROJECTS[i];
    const prev = PROJECTS[(i - 1 + PROJECTS.length) % PROJECTS.length];
    const next = PROJECTS[(i + 1) % PROJECTS.length];

    const toc = SECTIONS.map(([key, label]) =>
        `<li><a href="#/projets/${slug}" data-scroll="${key}">${label}</a></li>`).join('');
    const body = SECTIONS.map(([key, label]) => `
        <section id="${key}" class="p-section">
            <h2>${label}</h2>
            ${renderSection(p, key)}
        </section>`).join('');

    return `
        <article class="project">
            <header class="wrap project-head">
                <a class="back" href="#/projets">${T.pageProjet.retour}</a>
                <h1 tabindex="-1">${p.title}</h1>
                <p class="lead">${p.tagline}</p>
                <dl class="meta">
                    <div><dt>${T.pageProjet.type}</dt><dd>${p.kind}</dd></div>
                    <div><dt>${T.pageProjet.annee}</dt><dd>${p.year}</dd></div>
                    <div><dt>${T.pageProjet.equipe}</dt><dd>${p.team}</dd></div>
                    <div><dt>${T.pageProjet.technologies}</dt><dd>${p.stack.join(', ')}</dd></div>
                </dl>
            </header>
            <div class="wrap"><div class="cover">${media(p)}</div></div>
            <div class="wrap project-body">
                <aside class="toc" aria-label="Sommaire du projet"><ol>${toc}</ol></aside>
                <div class="p-content">${body}</div>
            </div>
            <nav class="wrap pager" aria-label="Autres projets">
                <a href="#/projets/${prev.slug}"><span>${T.pageProjet.precedent}</span><strong>${prev.title}</strong></a>
                <a href="#/projets/${next.slug}"><span>${T.pageProjet.suivant}</span><strong>${next.title}</strong></a>
            </nav>
        </article>`;
}

/* ---------- Compétences ---------- */

function renderSkills() {
    const overview = COMPETENCES.map(comp => {
        const codes = comp.levels.flatMap(l => l.acs.map(([code]) => code));
        const shown = codes.filter(c => projectsFor(c).length).length;
        const ticks = codes.map(c => `<i class="${projectsFor(c).length ? 'on' : ''}"></i>`).join('');
        return `
            <a class="ov-card" href="#/competences" data-scroll="comp-${comp.id}">
                <span class="ov-name">${comp.name}</span>
                <span class="ov-count">${shown} ${T.pageCompetences.acDemontrees} ${codes.length}</span>
                <span class="ticks" aria-hidden="true">${ticks}</span>
            </a>`;
    }).join('');

    const blocks = COMPETENCES.map(comp => `
        <section class="comp" id="comp-${comp.id}">
            <header class="comp-head">
                <h2>${comp.name}</h2>
                <span class="tag">${comp.level}</span>
                <p>${comp.desc}</p>
            </header>
            ${comp.levels.map((level, n) => `
                <div class="level">
                    <h3>${T.pageCompetences.niveau} ${n + 1} : ${level.title}</h3>
                    <ul>${level.acs.map(([code, label]) => {
                        const projs = projectsFor(code);
                        const chips = projs.length
                            ? projs.map(p => `<a class="chip" href="#/projets/${p.slug}">${p.title}</a>`).join('')
                            : `<span class="none">${T.pageCompetences.aucunProjet}</span>`;
                        return `<li class="ac-row${projs.length ? '' : ' is-empty'}" id="${code}">
                            <span class="ac-code">${code}</span>
                            <span class="ac-label">${label}</span>
                            <span class="chips">${chips}</span>
                        </li>`;
                    }).join('')}</ul>
                </div>`).join('')}
        </section>`).join('');

    return `
        <div class="wrap skills">
            <header class="skills-head">
                <h1 tabindex="-1">${T.pageCompetences.titre}</h1>
                <p class="lead">${T.pageCompetences.intro}</p>
            </header>
            <div class="overview">${overview}</div>
            <div class="toolbar">
                <button class="btn" type="button" id="filterToggle" aria-pressed="false">${T.pageCompetences.masquer}</button>
            </div>
            <div class="comps" id="comps">${blocks}</div>
        </div>`;
}

function renderNotFound() {
    return `
        <section class="wrap skills-head">
            <h1 tabindex="-1">${T.introuvable.titre}</h1>
            <p class="lead">${T.introuvable.texte} <a href="#/">${T.introuvable.retour}</a></p>
        </section>`;
}

/* ---------- Routeur ---------- */

function scrollToId(id, focus = false) {
    const el = id === 'top' ? document.body : document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ block: 'start' });
    if (focus) el.focus({ preventScroll: true });
}

function route() {
    const [page = '', param] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
    let target = null;
    stopDrum();

    if (page === '' || (page === 'projets' && !param) || page === 'passions') {
        app.innerHTML = renderHome();
        document.title = T.ongletAccueil;
        if (page) target = page;
        drawName();
        startTyping();
        setupBars();
        setupDrum();
    } else if (page === 'projets') {
        app.innerHTML = renderProject(param);
        const p = PROJECTS.find(p => p.slug === param);
        document.title = `${p ? p.title : T.introuvable.titre}, ${PROFILE.name}`;
        watchToc();
    } else if (page === 'competences') {
        app.innerHTML = renderSkills();
        document.title = T.ongletCompetences;
        setupFilter();
        target = param;
    } else {
        app.innerHTML = renderNotFound();
    }
    setupVideos();

    $$('[data-nav]').forEach(a => {
        a.dataset.nav === page ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
    });

    const el = target && document.getElementById(target);
    if (el) {
        scrollToId(target);
        if (el.classList.contains('ac-row')) el.classList.add('is-focus');
    } else {
        window.scrollTo(0, 0);
    }
    $('h1', app)?.focus({ preventScroll: true });
}

/* ---------- Accueil : nom dessiné, texte tapé et onde ---------- */

// Le nom est un texte SVG dont le contour se trace, puis se remplit (voir @keyframes draw).
// Le viewBox est calé sur le texte une fois la police chargée, pour qu'il occupe toute la largeur.
const twoLineName = matchMedia('(max-width: 600px)');
function drawName() {
    const svg = $('#heroName');
    const text = $('text', svg);
    const [first, ...rest] = PROFILE.name.split(' ');
    text.innerHTML = twoLineName.matches
        ? `<tspan x="0">${first}</tspan><tspan x="0" dy="1.02em">${rest.join(' ')}</tspan>`
        : PROFILE.name;
    document.fonts.load('600 100px Antonio').then(() => {
        if (!svg.isConnected) return;
        const box = text.getBBox();
        svg.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`);
        svg.classList.add('is-ready');
    });
}
twoLineName.addEventListener('change', () => { if ($('#heroName')) drawName(); });

let typingTimer;
function startTyping() {
    clearTimeout(typingTimer);
    const el = $('#typed');
    const roles = PROFILE.roles;
    if (reducedMotion) { el.textContent = roles[0]; return; }

    let r = 0, n = 0, deleting = false;
    const tick = () => {
        if (!el.isConnected) return;
        n += deleting ? -1 : 1;
        el.textContent = roles[r].slice(0, n);
        let wait = deleting ? 16 : 34;
        if (!deleting && n === roles[r].length) { deleting = true; wait = 1500; }
        else if (deleting && n === 0) { deleting = false; r = (r + 1) % roles.length; wait = 220; }
        typingTimer = setTimeout(tick, wait);
    };
    typingTimer = setTimeout(tick, 1600); // une fois le nom dessiné
}

// Les barres sous le curseur s'élèvent, comme un égaliseur
function setupBars() {
    const wrap = $('#bars');
    if (!fineHover) return;
    const bars = [...wrap.children];
    wrap.addEventListener('pointermove', e => {
        const r = wrap.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width * bars.length;
        bars.forEach((b, i) => b.style.setProperty('--boost', Math.max(0, 1 - Math.abs(i - x) / 7).toFixed(2)));
    });
    wrap.addEventListener('pointerleave', () => bars.forEach(b => b.style.setProperty('--boost', 0)));
}

/* ---------- Boîte à rythmes ---------- */

let audioCtx, noiseBuffer;
const seq = { timer: null, step: 0 };

function audio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.5, audioCtx.sampleRate);
        const d = noiseBuffer.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    audioCtx.resume();
    return audioCtx;
}

function noise(t, duration, highpass, volume) {
    const src = audioCtx.createBufferSource();
    const filter = audioCtx.createBiquadFilter();
    const gain = audioCtx.createGain();
    src.buffer = noiseBuffer;
    filter.type = 'highpass';
    filter.frequency.value = highpass;
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(filter).connect(gain).connect(audioCtx.destination);
    src.start(t);
    src.stop(t + duration);
}

function tone(t, type, from, to, duration, volume) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + duration * 0.3);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + duration);
}

const SOUNDS = {
    kick: t => tone(t, 'sine', 150, 40, 0.4, 0.9),
    snare: t => { noise(t, 0.18, 1200, 0.5); tone(t, 'triangle', 190, 160, 0.1, 0.35); },
    hat: t => noise(t, 0.05, 7000, 0.22)
};

function setupDrum() {
    const drum = $('#drum');
    const tempo = $('#tempo');

    drum.addEventListener('click', e => {
        const cell = e.target.closest('button[data-row]');
        if (!cell) return;
        const on = cell.getAttribute('aria-pressed') !== 'true';
        cell.setAttribute('aria-pressed', on);
        if (on && !seq.timer) SOUNDS[cell.dataset.row](audio().currentTime);
    });
    $('#drumPlay').addEventListener('click', () => seq.timer ? stopDrum() : startDrum());
    tempo.addEventListener('input', () => {
        $('#tempoOut').textContent = `${tempo.value} BPM`;
        if (seq.timer) { clearInterval(seq.timer); startDrum(); }
    });
}

function startDrum() {
    audio();
    const tick = () => {
        $$('#drum .is-now').forEach(c => c.classList.remove('is-now'));
        $$(`#drum button[data-step="${seq.step}"]`).forEach(c => {
            c.classList.add('is-now');
            if (c.getAttribute('aria-pressed') === 'true') SOUNDS[c.dataset.row](audioCtx.currentTime);
        });
        seq.step = (seq.step + 1) % 8;
    };
    tick();
    seq.timer = setInterval(tick, 60000 / +$('#tempo').value / 2);
    $('#drumPlay').textContent = T.passions.arreter;
}

function stopDrum() {
    clearInterval(seq.timer);
    seq.timer = null;
    seq.step = 0;
    $$('#drum .is-now').forEach(c => c.classList.remove('is-now'));
    const btn = $('#drumPlay');
    if (btn) btn.textContent = T.passions.lancer;
}

/* ---------- Autres interactions ---------- */

// Les vidéos ne tournent que lorsqu'elles sont visibles
function setupVideos() {
    const videos = $$('video', app);
    if (reducedMotion) { videos.forEach(v => { v.controls = true; }); return; }
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
        entry.isIntersecting ? entry.target.play().catch(() => {}) : entry.target.pause();
    }), { threshold: 0.35 });
    videos.forEach(v => observer.observe(v));
}

function watchToc() {
    const links = $$('.toc a');
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            links.forEach(a => a.classList.toggle('is-active', a.dataset.scroll === entry.target.id));
        });
    }, { rootMargin: '-30% 0px -60% 0px' });
    $$('.p-section').forEach(s => observer.observe(s));
}

function setupFilter() {
    const btn = $('#filterToggle');
    btn.addEventListener('click', () => {
        const on = btn.getAttribute('aria-pressed') !== 'true';
        btn.setAttribute('aria-pressed', on);
        $('#comps').classList.toggle('only-shown', on);
    });
}

function setupTheme() {
    const root = document.documentElement;
    const btn = $('#themeToggle');
    const isDark = () => root.dataset.theme
        ? root.dataset.theme === 'dark'
        : matchMedia('(prefers-color-scheme: dark)').matches;
    const label = () => {
        btn.innerHTML = isDark() ? ICONS.sun : ICONS.moon;
        btn.setAttribute('aria-label', isDark() ? 'Passer en mode clair' : 'Passer en mode sombre');
    };

    btn.addEventListener('click', () => {
        root.dataset.theme = isDark() ? 'light' : 'dark';
        try { localStorage.setItem('theme', root.dataset.theme); } catch (e) {}
        label();
    });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', label);
    label();
}

document.addEventListener('click', e => {
    const link = e.target.closest('[data-scroll]');
    if (!link) return;
    e.preventDefault();
    scrollToId(link.dataset.scroll, link.dataset.scroll === 'app');
});

// Textes fixes de index.html, remplis depuis data.js
$('.skip-link').textContent = T.allerAuContenu;
$('#brandName').textContent = PROFILE.name;
$$('[data-nav]').forEach(a => { a.textContent = T.menu[a.dataset.nav]; });
$('#footerName').textContent = PROFILE.name;
$('#footerGithub').href = PROFILE.github;
$('#footerGithub').textContent = T.piedDePage.github;
$('#footerTop').textContent = T.piedDePage.hautDePage;
$('#year').textContent = new Date().getFullYear();
setupTheme();
window.addEventListener('hashchange', route);
route();
