// Interface : contenu, défilement (Lenis + ScrollTrigger), platine, lecteur, apparitions, mobile et mouvement réduit.
// Réf. : docs/design/DA.md §5.
import Lenis from 'lenis';
import { GENRES } from './genres.js';

const { gsap, ScrollTrigger, SplitText, CustomEase } = window;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- Contenu (content.js) ----------
export function renderContent(content) {
  const $ = (sel) => document.querySelector(sel);
  const pres = content.presentation;
  document.querySelectorAll('[data-etiquette]').forEach((el) => {
    const g = GENRES[+el.closest('[data-genre]').dataset.genre];
    el.textContent = `${g.num} · ${g.label} · ${g.bpm} BPM`;
  });
  // Textes fixes de la page (TEXTES_V2 dans data.js)
  const T = content.textes;
  document.title = T.onglet;
  $('.entree-btn-txt').textContent = T.entree.bouton;
  $('#entree-note').textContent = T.entree.note;
  $('#btn-entrer-muet').textContent = T.entree.sansSon;
  $('.defiler .etiquette-txt').textContent = T.accueil.defiler;
  Object.entries(T.sections).forEach(([id, titre]) => { const h = $(`#t-${id}`); if (h && id !== 'accueil') h.textContent = titre; });
  $('.comp-note').textContent = T.competences.note;
  $('.technos .etiquette-txt').textContent = T.competences.technos;

  $('#entree-nom').textContent = pres.nom;
  $('[data-nom]').textContent = pres.nom;
  $('[data-accroche]').textContent = pres.accroche;
  $('[data-citation]').textContent = pres.citation;
  // Bloc de droite : le cursus, puis deux faits vérifiés déjà repris (content.presentation.faits), chacun avec son projet.
  const faits = (pres.faits || []).map((f) => {
    const p = content.projets.find((x) => x.id === f.projet);
    const texte = p && p.faits[f.fait] ? p.faits[f.fait].texte : '';
    return texte ? `<p class="fait"><b>${esc(p.titre)}</b>${esc(texte)}</p>` : '';
  }).join('');
  $('[data-pres]').innerHTML = `<p>${esc(pres.texte)}</p>` + faits + `<p class="meta">${esc(pres.lieu)}</p>`;

  $('[data-projets]').innerHTML = content.projets.map((p, i) => {
    const lien = p.liens[0];
    return `<li class="piste" data-app>
      <a href="${esc(lien.url)}" target="_blank" rel="noopener" aria-label="${esc(p.titre)} (${esc(lien.type)}, nouvel onglet)">
        <span class="piste-num">${String(i + 1).padStart(2, '0')}</span>
        <span class="piste-titre">${esc(p.titre)}</span>
        <span class="piste-types">${p.kinds.map(esc).join(' / ')}</span>
        <span class="piste-fleche" aria-hidden="true">→</span>
        <span class="piste-line">${esc(p.line)}</span>
      </a>
      <svg class="piste-onde" viewBox="0 0 300 8" preserveAspectRatio="none" aria-hidden="true"><path d="M0 4 Q25 0 50 4 T100 4 T150 4 T200 4 T250 4 T300 4"/></svg>
    </li>`;
  }).join('');

  $('[data-experiences]').innerHTML = content.experiences.map((e, i) => `
    <article class="marche" data-pas="${i % 3}" data-app>
      <p class="marche-meta">${esc(e.meta)}</p>
      <h3 class="marche-titre">${esc(e.titre)}</h3>
      <p class="marche-texte">${esc(e.line)}</p>
    </article>`).join('');

  $('[data-competences]').innerHTML = content.competences.liste.map((c) => `
    <li class="bac" data-app>
      <span class="bac-id">${esc(c.id)}</span>
      <div><h3 class="bac-court">${esc(c.court)}</h3><p class="bac-intitule">${esc(c.intitule)}</p></div>
      <p class="bac-def">${esc(c.definition)}</p>
    </li>`).join('');
  $('[data-technos]').innerHTML = content.competences.technos.map((t) => `<li>${esc(t.nom)}<b>${t.n}</b></li>`).join('');

  const mail = $('[data-mail]');
  mail.href = content.contact.email.url;
  mail.setAttribute('aria-label', `Écrire à ${content.contact.email.texte}`);
  mail.innerHTML = [...content.contact.email.texte].map((c) => `<span class="car" aria-hidden="true">${esc(c)}</span>`).join('');
  const c = content.contact;
  $('[data-liens]').innerHTML = [
    `<li><a href="${esc(c.github.url)}" target="_blank" rel="noopener">${esc(c.github.texte)}</a></li>`,
    `<li><a href="${esc(c.linkedin.url)}" target="_blank" rel="noopener">${esc(c.linkedin.texte)}</a></li>`,
  ].join('');

  // Éléments révélés à l'apparition
  document.querySelectorAll('.section .titre, .accueil-nom, .accueil-accroche, .pres-citation, .pres-texte, .contact-mail, .contact-liens, .technos, .comp-note')
    .forEach((el) => el.setAttribute('data-app', ''));
}

// ---------- Interface ----------
export function createUI({ mobile, reduced, audio, onGenre, onRing }) {
  gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);
  CustomEase.create('onde', 'M0,0 C0.16,0.84 0.3,1 1,1');
  const root = document.documentElement;
  const main = document.getElementById('contenu');
  const sections = [...document.querySelectorAll('.section')];
  const platine = document.getElementById('platine');
  const lecteur = document.getElementById('lecteur');
  const disque = platine.querySelector('.platine-disque');
  const bras = platine.querySelector('.platine-bras');
  const secteursEl = platine.querySelector('[data-secteurs]');
  const genreTxt = lecteur.querySelector('[data-genre-txt]');
  const barresEl = lecteur.querySelector('[data-barres]');
  const volInput = lecteur.querySelector('[data-volume]');
  const btnPause = lecteur.querySelector('[data-pause]');
  const btnMuet = lecteur.querySelector('[data-muet]');
  let lenis = null;
  let current = 0;
  let jumping = false;
  let entered = false;
  const revealed = new Set();
  const splits = [];
  const triggers = [];
  const cleanups = [];
  const on = (el, ev, fn, opts) => { el.addEventListener(ev, fn, opts); cleanups.push(() => el.removeEventListener(ev, fn, opts)); };

  history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
  document.body.classList.add('verrou');

  // ----- Défilement -----
  if (!reduced) {
    lenis = new Lenis({ autoRaf: false, lerp: 0.1, syncTouch: false });
    lenis.on('scroll', ScrollTrigger.update);
    lenis.stop();
  }
  const lenisRaf = (time) => lenis && lenis.raf(time * 1000);
  gsap.ticker.add(lenisRaf);
  gsap.ticker.lagSmoothing(0);

  // Genre courant au scroll : hystérésis de 8 % de la hauteur d'écran (DA §3.1)
  sections.forEach((sec, i) => {
    triggers.push(ScrollTrigger.create({
      trigger: sec,
      start: 'top 42%',
      end: 'bottom 58%',
      onEnter: () => { if (!jumping && entered) onGenre(i, 'scroll'); },
      onEnterBack: () => { if (!jumping && entered) onGenre(i, 'scroll'); },
    }));
  });

  function scrollToSection(i, done) {
    const target = sections[i];
    jumping = true;
    const finish = () => { jumping = false; done && done(); };
    if (lenis) lenis.scrollTo(target, { duration: 1.6, onComplete: finish, force: true });
    else { target.scrollIntoView({ behavior: 'auto' }); setTimeout(finish, 50); }
    setTimeout(() => { if (jumping) finish(); }, 2200);
  }

  // ----- Platine -----
  // Secteurs AUTOUR du disque (rayon 140 px) : quart haut-gauche puis gauche, de 270° (haut) à 145°, libellés calés
  // à droite sur un rayon de 165 px : ni sur les sillons, ni sur le bras (à droite), ni sous le bas de l'écran.
  const R = 165;
  secteursEl.innerHTML = GENRES.map((g, i) => {
    const a = ((270 - i * 25) * Math.PI) / 180;
    return `<li><button type="button" class="secteur" data-i="${i}" style="--c:${g.palette.line};transform:translate(calc(-100% + ${(Math.cos(a) * R).toFixed(1)}px), calc(-50% + ${(Math.sin(a) * R).toFixed(1)}px))" aria-label="${esc(g.section)}, ${esc(g.label)}" tabindex="-1">${esc(g.section)}<small>${esc(g.label)}</small></button></li>`;
  }).join('');
  const secteurs = [...secteursEl.querySelectorAll('.secteur')];
  const ouvrir = document.createElement('button');
  ouvrir.type = 'button';
  ouvrir.className = 'platine-ouvrir';
  ouvrir.setAttribute('aria-label', `Ouvrir la platine (touches 1 à ${GENRES.length})`);
  ouvrir.setAttribute('aria-expanded', 'false');
  platine.querySelector('.platine-zone').prepend(ouvrir);
  let ouvert = false;
  let epingle = false; // ouverte par un clic : ne se ferme plus à la sortie de la souris
  let fermeture = 0;
  const setOuvert = (v) => {
    clearTimeout(fermeture);
    if (!v) epingle = false;
    if (ouvert === v) return;
    ouvert = v;
    platine.classList.toggle('ouvert', v);
    ouvrir.setAttribute('aria-expanded', String(v));
    secteurs.forEach((s) => (s.tabIndex = v ? 0 : -1));
    ouvrir.style.pointerEvents = v ? 'none' : '';
  };
  if (!mobile) {
    on(platine, 'mouseenter', () => setOuvert(true));
    // 400 ms de grâce : un écart de trajectoire vers un libellé ne referme plus la platine.
    on(platine, 'mouseleave', () => { if (!epingle && !platine.querySelector(':focus-visible')) fermeture = setTimeout(() => setOuvert(false), 400); });
  }
  on(ouvrir, 'click', () => { setOuvert(true); secteurs[current].focus(); });
  on(platine, 'click', (e) => { if (!e.target.closest('.secteur')) { setOuvert(true); epingle = true; } });
  on(platine, 'focusout', (e) => { if (!platine.contains(e.relatedTarget)) setOuvert(false); });
  on(document, 'pointerdown', (e) => { if (ouvert && !platine.contains(e.target)) setOuvert(false); });
  secteurs.forEach((s, i) => {
    on(s, 'click', (e) => {
      jumpTo(i);
      if (mobile) setOuvert(false);
      // detail 0 = clic au clavier : on ferme et le focus revient au disque
      else if (e.detail === 0) { if (epingle) { setOuvert(false); ouvrir.focus(); } }
      // À la souris : on lâche l'épingle, la sortie du curseur referme après le même délai de 400 ms
      else epingle = false;
    });
    on(s, 'mouseenter', () => audio.hint(i));
    on(s, 'focus', () => audio.hint(i));
    on(s, 'keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); secteurs[(i + 1) % GENRES.length].focus(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); secteurs[(i + GENRES.length - 1) % GENRES.length].focus(); }
      if (e.key === 'Escape') { setOuvert(false); ouvrir.focus(); }
    });
  });

  function jumpTo(i) {
    if (!entered) return;
    const dist = Math.abs(i - current);
    onGenre(i, dist > 0 ? 'platine' : 'scroll');
    scrollToSection(i);
  }

  // ----- Lecteur -----
  for (let i = 0; i < 24; i++) barresEl.appendChild(document.createElement('i'));
  const barres = [...barresEl.children];
  const specRow = new Uint8Array(256);
  volInput.value = String(Math.round(audio.volume * 100));
  on(volInput, 'input', () => audio.setVolume(volInput.value / 100));
  on(btnPause, 'click', () => audio.togglePause());
  on(btnMuet, 'click', () => audio.toggleMute());
  on(window, 'keydown', (e) => {
    if (!entered) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'Space' && !(t && t.tagName === 'BUTTON')) { e.preventDefault(); audio.togglePause(); }
    else if (e.key === 'm' || e.key === 'M') audio.toggleMute();
    else if (/^[1-9]$/.test(e.key) && +e.key <= GENRES.length) jumpTo(+e.key - 1);
  });

  function syncPlayer(st) {
    const paused = !st.enLecture;
    lecteur.classList.toggle('en-pause', paused);
    btnPause.setAttribute('aria-label', paused ? 'Lecture (Espace)' : 'Pause (Espace)');
    btnMuet.setAttribute('aria-pressed', String(!!st.muet));
    btnMuet.setAttribute('aria-label', st.muet ? 'Rétablir le son (M)' : 'Couper le son (M)');
    volInput.value = String(Math.round(st.volume * 100));
    volInput.setAttribute('aria-valuetext', `${Math.round(st.volume * 100)} %`);
  }

  // Sous 768 px, le lecteur n'a la place que pour le nom du genre.
  const narrow = window.matchMedia('(max-width: 767px)');
  function genreLabel(i) { const g = GENRES[i]; return narrow.matches ? g.label : `${g.label} · ${g.section} · ${g.bpm} BPM`; }
  genreTxt.textContent = genreLabel(0);
  const onNarrow = () => { genreTxt.textContent = genreLabel(current); };
  if (narrow.addEventListener) { narrow.addEventListener('change', onNarrow); cleanups.push(() => narrow.removeEventListener('change', onNarrow)); }

  // ----- Changement de genre côté interface -----
  function setGenre(i, dur) {
    const prev = current;
    current = i;
    const g = GENRES[i];
    secteurs.forEach((s, k) => s.setAttribute('aria-current', String(k === i)));
    bras.style.setProperty('--bras', `${18 + i * 6}deg`);
    root.style.setProperty('--g-ligne', g.palette.line);
    root.style.setProperty('--g-accent', g.palette.accent);
    if (prev !== i) exitSection(prev);
    gsap.delayedCall(dur / 2, () => {
      if (current !== i) return;
      if (reduced) { genreTxt.textContent = genreLabel(i); return; }
      const dir = i > prev ? -1 : 1;
      gsap.to(genreTxt, { yPercent: 100 * dir, duration: 0.15, ease: 'power2.in', onComplete: () => {
        genreTxt.textContent = genreLabel(i);
        gsap.fromTo(genreTxt, { yPercent: -100 * dir }, { yPercent: 0, duration: 0.15, ease: 'power2.out' });
      } });
    });
    gsap.delayedCall(reduced ? 0.1 : dur * 0.6, () => reveal(i));
  }

  // ----- Apparitions (DA §5.2) -----
  const split = (el, type) => {
    // « words,chars » : les mots restent insécables, seules les lettres s'animent.
    const s = SplitText.create(el, { type: type === 'chars' ? 'words,chars' : type, mask: type === 'chars' ? 'chars' : 'lines', linesClass: 'ligne-split' });
    splits.push(s);
    return s;
  };
  const show = (el) => gsap.set(el, { opacity: 1 });
  const titleChars = [];
  const TITLE_EASE = ['expo.out', 'power3.out', 'power4.out', 'steps(1)', 'back.out(1.6)', 'elastic.out(1, 0.6)'];
  const inView = (el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight; };

  // Sortie du texte de la section quittée (DA §3.3) : les blocs visibles montent et s'éteignent, 20 ms d'écart.
  function exitSection(k) {
    if (reduced || !revealed.has(k)) return;
    const els = [...sections[k].querySelectorAll('[data-app]')].filter((el) => inView(el));
    if (!els.length) return;
    gsap.to(els, { y: -18, opacity: 0, stagger: 0.02, duration: 0.3, ease: 'power2.in', overwrite: 'auto' });
  }

  // Retour dans une section déjà vue : le titre rejoue son entrée, le reste revient en place.
  function replay(i) {
    const sec = sections[i];
    const items = [...sec.querySelectorAll('[data-app]')];
    if (reduced) { gsap.to(items, { opacity: 1, y: 0, duration: 0.4, ease: 'none', overwrite: 'auto' }); return; }
    const titleEl = sec.querySelector(i === 0 ? '.accueil-nom' : '.titre');
    const visible = items.filter((el) => el !== titleEl && inView(el));
    const away = items.filter((el) => el !== titleEl && !inView(el));
    const hidden = visible.filter((el) => +getComputedStyle(el).opacity < 0.05);
    if (away.length) gsap.set(away, { opacity: 1, y: 0 });
    if (hidden.length) gsap.set(hidden, { y: 14 });
    if (visible.length) gsap.to(visible, { opacity: 1, y: 0, stagger: 0.04, duration: 0.5, ease: 'power3.out', delay: 0.15, overwrite: 'auto' });
    if (titleEl) {
      gsap.killTweensOf(titleEl);
      gsap.set(titleEl, { opacity: 1, y: 0 });
      const chars = titleChars[i];
      if (chars) {
        gsap.killTweensOf(chars);
        gsap.fromTo(chars, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, stagger: 0.018, duration: 0.7, ease: TITLE_EASE[i] });
      }
    }
  }

  function reveal(i) {
    if (revealed.has(i)) { replay(i); return; }
    revealed.add(i);
    const sec = sections[i];
    const items = [...sec.querySelectorAll('[data-app]')];
    if (reduced) {
      gsap.to(items, { opacity: 1, duration: 0.4, ease: 'none' });
      return;
    }
    const titre = sec.querySelector('.titre');
    const titleIn = (delay = 0, ease = 'onde') => {
      if (!titre) return;
      show(titre);
      const s = split(titre, 'chars');
      titleChars[i] = s.chars;
      gsap.from(s.chars, { yPercent: 110, opacity: 0, stagger: 0.018, duration: 0.7, ease, delay });
    };
    if (i === 0) {
      const nom = sec.querySelector('.accueil-nom');
      show(nom);
      const s = split(nom, 'chars');
      titleChars[0] = s.chars;
      gsap.from(s.chars, { yPercent: 110, stagger: 0.024, duration: 1.1, ease: 'expo.out' });
      const acc = sec.querySelector('.accueil-accroche');
      show(acc);
      const l = split(acc, 'lines');
      gsap.from(l.lines, { y: 16, opacity: 0, stagger: 0.09, duration: 0.9, ease: 'onde', delay: 0.35 });
    } else if (i === 1) {
      titleIn(0, 'power3.out');
      const cit = sec.querySelector('.pres-citation');
      const txt = sec.querySelector('.pres-texte');
      show(cit); show(txt);
      const lines = [...split(cit, 'lines').lines, ...[...txt.querySelectorAll('p:not(.meta)')].flatMap((p) => split(p, 'lines').lines), ...txt.querySelectorAll('p.meta')];
      // Sur les croches swinguées à 96 BPM : 375 ms puis 250 ms
      let t = 0.5;
      lines.forEach((ln, k) => {
        gsap.from(ln, { y: 20, opacity: 0, duration: 0.8, ease: 'power3.out', delay: t });
        t += k % 2 === 0 ? 0.375 : 0.25;
      });
      const mail = sec.querySelector('.contact-mail');
      show(mail);
      gsap.from(mail.querySelectorAll('.car'), { yPercent: 80, opacity: 0, stagger: 0.022, duration: 0.9, ease: 'elastic.out(1, 0.6)', delay: t });
      gsap.to(sec.querySelector('.contact-liens'), { opacity: 1, duration: 0.6, delay: t + 0.6 });
    } else if (i === 2) {
      titleIn(0, 'power4.out');
      const rows = [...sec.querySelectorAll('.piste')];
      rows.forEach((r, k) => {
        gsap.fromTo(r, { x: -24, opacity: 0 }, { x: 0, opacity: 1, duration: 0.35, ease: 'power4.out', delay: 0.4 + k * 0.121 });
      });
    } else if (i === 3) {
      titleIn(0, 'elastic.out(1, 0.6)');
      // Même geste que l'ancien Contact (soul/funk) : lettres élastiques, puis le reste en fondu
      [...sec.querySelectorAll('.marche')].forEach((m, k) => {
        const delay = 0.3 + k * 0.9;
        gsap.set(m, { opacity: 1 });
        gsap.from(split(m.querySelector('.marche-titre'), 'chars').chars, { yPercent: 80, opacity: 0, stagger: 0.022, duration: 0.9, ease: 'elastic.out(1, 0.6)', delay });
        gsap.fromTo([m.querySelector('.marche-meta'), m.querySelector('.marche-texte')], { opacity: 0 }, { opacity: 1, duration: 0.6, delay: delay + 0.9 });
      });
    } else if (i === 4) {
      titleIn(0, 'back.out(1.6)');
      gsap.to(sec.querySelector('.comp-note'), { opacity: 1, duration: 0.6, delay: 0.4 });
      [...sec.querySelectorAll('.bac')].forEach((b, k) => {
        gsap.fromTo(b, { y: -12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: 'back.out(2)', delay: 0.3 + k * 0.682 + 0.04 });
      });
      gsap.fromTo(sec.querySelector('.technos'), { opacity: 0 }, { opacity: 1, duration: 0.8, delay: 0.3 + 6 * 0.682 });
    }
    // Filet de sécurité : rien ne reste invisible
    gsap.delayedCall(5, () => { if (current === i) items.forEach((el) => { if (getComputedStyle(el).opacity === '0') gsap.to(el, { opacity: 1, duration: 0.4 }); }); });
  }

  // Survol d'une piste : un anneau part dans la nappe ; survol de l'e-mail : lettres slappées
  document.querySelectorAll('.piste a').forEach((a) => {
    on(a, 'mouseenter', (e) => onRing && onRing(Math.min(1, Math.max(0, e.clientX / window.innerWidth))));
  });
  const mail = document.querySelector('.contact-mail');
  if (mail && !reduced) {
    on(mail, 'mouseenter', () => {
      gsap.fromTo(mail.querySelectorAll('.car'), { y: 0 }, { y: -10, duration: 0.12, stagger: 0.015, ease: 'power2.out', yoyo: true, repeat: 1, overwrite: true,
        onComplete: () => gsap.to(mail.querySelectorAll('.car'), { y: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' }) });
    });
  }

  // ----- Entrée (DA §4.2) -----
  function playEntry({ onDone }) {
    entered = true;
    const entree = document.getElementById('entree');
    const btn = document.getElementById('btn-entrer');
    const fades = entree.querySelectorAll('.entree-nom, .entree-note, .entree-lien');
    const jauge = entree.querySelector('.entree-jauge');
    const point = document.createElement('span');
    point.className = 'entree-point';
    entree.appendChild(point);
    btn.blur();
    const finish = () => {
      entree.hidden = true;
      document.body.classList.remove('verrou');
      main.inert = false;
      main.removeAttribute('inert');
      if (lenis) lenis.start();
      ScrollTrigger.refresh();
      onDone && onDone();
    };
    if (reduced) {
      gsap.to(entree, { opacity: 0, duration: 0.8, onComplete: finish });
      platine.hidden = false; lecteur.hidden = false;
      gsap.fromTo([platine, lecteur], { opacity: 0 }, { opacity: 1, duration: 0.4, delay: 0.4 });
      gsap.delayedCall(0.8, () => reveal(0));
      return;
    }
    const s = SplitText.create(btn.querySelector('.entree-btn-txt'), { type: 'chars', mask: 'chars' });
    splits.push(s);
    gsap.to(s.chars, { yPercent: -100, stagger: 0.02, duration: 0.3, ease: 'power3.in' });
    gsap.to(fades, { opacity: 0, duration: 0.25 });
    gsap.to(jauge, { scaleX: 0, duration: 0.26, ease: 'expo.in', delay: 0.12 });
    gsap.fromTo(point, { opacity: 0 }, { opacity: 1, duration: 0.01, delay: 0.38 });
    gsap.to(point, { opacity: 0, duration: 0.3, delay: 0.39 });
    gsap.delayedCall(0.38, () => entree.classList.add('parti'));
    gsap.delayedCall(0.8, finish);
    gsap.delayedCall(2.6, () => {
      platine.hidden = false; lecteur.hidden = false;
      // clearProps : un transform laissé sur .platine piégerait la grille fixe des secteurs sur mobile.
      gsap.fromTo([platine, lecteur], { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6, ease: 'onde', clearProps: 'transform' });
    });
    gsap.delayedCall(3.1, () => reveal(0));
  }

  // ----- Image -----
  let angle = 0;
  let spin = 0;
  let frameN = 0;
  function update(dt, st) {
    const playing = st ? st.enLecture : false;
    // Plateau : 33 tours 1/3 (200°/s), arrêt en 600 ms à la pause
    const target = playing && !reduced ? 200 : 0;
    spin += (target - spin) * (1 - Math.exp(-dt / (target ? 0.25 : 0.2)));
    angle = (angle + spin * dt) % 360;
    disque.style.transform = `rotate(${angle.toFixed(2)}deg)`;
    // Barres du volume : spectre en direct
    frameN++;
    if (st && st.fillSpectrum && frameN % 2 === 0) {
      if (playing) st.fillSpectrum(specRow); else specRow.fill(0);
      const vol = st.muet ? 0 : st.volume;
      for (let k = 0; k < 24; k++) {
        const v = specRow[Math.min(255, 8 + Math.floor(k * 10))] / 255;
        barres[k].style.transform = `scaleY(${(0.12 + 0.88 * v).toFixed(3)})`;
        const onv = k < Math.round(vol * 24);
        if (barres[k].classList.contains('on') !== onv) barres[k].classList.toggle('on', onv);
      }
    }
  }

  function scrollVelocity() { return lenis ? lenis.velocity : 0; }

  function dispose() {
    gsap.ticker.remove(lenisRaf);
    triggers.forEach((t) => t.kill());
    splits.forEach((s) => s.revert());
    cleanups.forEach((fn) => fn());
    if (lenis) lenis.destroy();
  }

  return { playEntry, setGenre, syncPlayer, update, scrollVelocity, dispose, get current() { return current; } };
}
