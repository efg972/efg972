// ==UserScript==
// @name         Page de con
// @namespace    efg972
// @version      1.0.0
// @description  Remplit automatiquement les formulaires de candidature (SuccessFactors & co) à partir d'un profil.
// @match        *://*.successfactors.com/*
// @match        *://*.successfactors.eu/*
// @match        *://*.sapsf.com/*
// @match        *://*.sapsf.eu/*
// @match        *://*.myworkdayjobs.com/*
// @match        *://*.taleo.net/*
// @match        *://*.smartrecruiters.com/*
// @match        *://*.essilorluxottica.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  // ===========================================================================
  // PROFIL — la seule partie à modifier.
  //
  // Chaque règle = [regex sur le libellé du champ, valeur].
  //   - Le libellé est normalisé : minuscules, sans accents, sans "*", espaces réduits.
  //   - Valeur = texte, ou liste de candidats pour les listes déroulantes
  //     (le premier qui existe dans la liste gagne).
  //   - Valeur null ou '' = champ ignoré (il apparaîtra dans le rapport s'il est obligatoire).
  // ===========================================================================
  const PROFIL = {
    // Champs hors sections répétables.
    champs: [
      [/^prenom$/, 'Génaël'],
      [/^nom$/, 'MORIOT'],
      [/^(e-?mail|adresse e-?mail)/, 'genael.moriot@gmail.com'],
      [/^indicatif telephonique/, ['+33', 'France (+33)', 'France']],
      [/^telephone principal/, '661346013'],
      [/^ligne d.adresse principale, ligne 1/, '21 Rue Claude Bernard'],
      [/^ville principale/, 'LIMEIL-BREVANNES'],
      [/^pays principal/, 'France'],
      [/^etat\/province primaire/, 'Val-de-Marne'],
      [/^code postal primaire/, '94450'],

      // Questions "maison" — VÉRIFIE ces réponses.
      [/deja travaille chez/, 'Non'],
      [/deja ete en processus de recrutement/, 'Non'],
      [/membre de votre famille/, 'Non'],

      // Informations propres au poste.
      [/^handicap/, null], // choix personnel : mets 'Non' / 'Oui' / 'Ne souhaite pas répondre' si tu veux
      [/^comment avez-vous (pris connaissance|entendu parler)/, ['LinkedIn', 'Site carrière', 'Site Internet', 'Internet', 'Job board', 'Autre']],
      [/^source detail/, ['LinkedIn', 'Autre', 'Other']],
      [/^devise/, ['EUR', 'Euro', 'EUR - Euro']],
      [/mobile a l.international/, null], // 'Oui' ou 'Non'
    ],

    // Sections répétables : clé = titre de la section (normalisé), valeur = liste de lignes.
    // Si tu mets plus de lignes que la page n'en a, le script clique sur "Ajouter".
    sections: {
      // Dates laissées vides : le CV ne donne que les années et les champs date sont facultatifs.
      'experience professionnelle actuelle': [
        [
          [/^nom de l.entreprise/, 'UPS'],
          [/^date de debut/, ''],
          [/^famille d.emploi/, ['Project Management', 'Gestion de projet', 'Engineering', 'Ingénierie', 'Operations', 'Others']],
          [/^titre/, 'Alternant ingénieur projet'],
          [/^pays/, 'France'],
          [/^etat\/province/, 'Val-de-Marne'],
          [/^ville/, 'Charenton-le-Pont'],
        ],
      ],
      'experience professionnelle precedente': [
        [
          [/^nom de l.entreprise/, 'TERREAL'],
          [/^famille d.emploi/, ['Maintenance', 'Engineering', 'Ingénierie', 'Manufacturing', 'Others']],
          [/^titre/, 'Alternant ingénieur méthode maintenance'],
          [/^pays/, 'France'],
          [/^etat\/province/, 'Yvelines'],
          [/^ville/, 'Les Mureaux'],
        ],
        [
          [/^nom de l.entreprise/, 'BMI MONIER'],
          [/^famille d.emploi/, ['Project Management', 'Gestion de projet', 'Engineering', 'Manufacturing', 'Others']],
          [/^titre/, 'Alternant technicien projet'],
          [/^pays/, 'France'],
          [/^etat\/province/, 'Vosges'],
          [/^ville/, 'Saint-Nabord'],
        ],
      ],
      "niveau d'education": [
        [
          [/^ecole\/universite/, 'Université Paris-Est Créteil'],
          [/^niveau de formation/, ['Master', 'Bac+5', 'Bac +5', 'Graduate']],
          [/^field of study/, ['Industrial Engineering', 'Génie industriel', 'Engineering', 'Ingénierie', 'Maintenance']],
          [/^pays/, 'France'],
        ],
        [
          [/^ecole\/universite/, 'IUT Hubert Curien Epinal'],
          [/^niveau de formation/, ['Licence', 'Bachelor', 'Bac+3', 'Bac +3']],
          [/^field of study/, ['Maintenance', 'Industrial Engineering', 'Engineering', 'Ingénierie']],
          [/^pays/, 'France'],
        ],
      ],
      'certifications et licences': [],
      langues: [
        [
          [/^langue/, ['Français', 'French']],
          [/^niveau/, ['Langue maternelle', 'Natif', 'Native', 'Bilingue']],
        ],
        [
          [/^langue/, ['Anglais', 'English']],
          [/^niveau/, ['B2', 'Intermédiaire supérieur', 'Upper intermediate', 'Courant', 'Avancé', 'Intermédiaire']],
        ],
      ],
    },

    // Titres de blocs NON répétables : ils ferment la section répétable précédente.
    autresBlocs: ['mes documents', 'informations sur le profil', 'informations propres au poste', 'informations sur le poste'],

    // false = ne touche pas à un champ déjà rempli.
    ecraser: false,
  };

  // Marqueurs de ligne dans les sections répétables ("Numéro de ligne 1").
  const ROW_MARKER = /^(numero de ligne|row number|ligne n°?)\s*\d+$/;
  const EMPTY_VALUE = /^(|aucune selection|no selection|selectionner|select|choisir|--.*--|-)$/;

  // ===========================================================================
  // Utilitaires
  // ===========================================================================
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) =>
    (s || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[’‘]/g, "'")
      .replace(/\*/g, '')
      .replace(/\b(obligatoire|required)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

  const visible = (el) => {
    if (!el.getClientRects().length) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
  };

  // Parcourt le DOM dans l'ordre du document, shadow DOM ouverts compris.
  function walk(root, out = []) {
    for (const el of root.children || []) {
      out.push(el);
      if (el.shadowRoot) walk(el.shadowRoot, out);
      walk(el, out);
    }
    return out;
  }

  const CONTROL_SEL = [
    'input:not([type=hidden]):not([type=file]):not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]):not([type=image])',
    'textarea',
    'select',
    '[role=combobox]',
    'button[aria-haspopup]',
  ].join(',');

  const isControl = (el) => el.matches(CONTROL_SEL) && !el.querySelector(CONTROL_SEL);

  function textById(root, id) {
    const n = root.getElementById ? root.getElementById(id) : document.getElementById(id);
    return n ? n.textContent : '';
  }

  function labelOf(el) {
    const root = el.getRootNode();
    const lb = el.getAttribute('aria-labelledby');
    if (lb) {
      const t = lb.split(/\s+/).map((id) => textById(root, id)).join(' ');
      if (norm(t)) return t;
    }
    if (el.id) {
      const l = root.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (l && norm(l.textContent)) return l.textContent;
    }
    const wrap = el.closest('label');
    if (wrap && norm(wrap.textContent)) return wrap.textContent;
    if (norm(el.getAttribute('aria-label'))) return el.getAttribute('aria-label');
    // Repli : premier texte d'un ancêtre proche, sans la valeur du champ.
    let a = el.parentElement;
    for (let i = 0; a && i < 4; i++, a = a.parentElement) {
      const t = (a.innerText || '').replace(currentValue(el), '');
      if (norm(t) && t.length < 250) return t.split('\n').find((x) => norm(x)) || t;
    }
    return el.getAttribute('title') || el.getAttribute('placeholder') || el.name || '';
  }

  function currentValue(el) {
    if (el.tagName === 'SELECT') return el.selectedOptions[0]?.textContent || '';
    if ('value' in el && el.tagName !== 'BUTTON') return el.value || '';
    const inner = el.querySelector && el.querySelector('input');
    if (inner) return inner.value || '';
    return el.innerText || el.textContent || '';
  }

  const isEmpty = (el) => EMPTY_VALUE.test(norm(currentValue(el)));

  // ===========================================================================
  // Scan : liste des champs avec section, ligne, libellé, obligatoire.
  // ===========================================================================
  function scan() {
    const sectionTitles = Object.keys(PROFIL.sections).map(norm);
    const others = PROFIL.autresBlocs.map(norm);
    const fields = [];
    let section = null;
    let row = -1;
    for (const el of walk(document)) {
      const t = el.childElementCount <= 2 ? norm(el.textContent) : '';
      if (t && others.includes(t)) {
        section = null;
        continue;
      }
      if (t && sectionTitles.includes(t) && t !== section) {
        section = t;
        row = -1;
        continue;
      }
      if (t && ROW_MARKER.test(t)) {
        // Un même marqueur peut apparaître sur plusieurs éléments imbriqués.
        if (!el.parentElement || !ROW_MARKER.test(norm(el.parentElement.textContent))) row++;
        continue;
      }
      if (!isControl(el) || !visible(el) || el.disabled) continue;
      const raw = labelOf(el);
      fields.push({
        el,
        section,
        row: section ? Math.max(row, 0) : null,
        label: norm(raw),
        required: /\*/.test(raw) || el.required || el.getAttribute('aria-required') === 'true',
      });
    }
    return fields;
  }

  // ===========================================================================
  // Remplissage
  // ===========================================================================
  function setNative(el, v) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function click(el) {
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    }
  }

  function bestMatch(items, getText, candidates) {
    const list = items.map((it) => [it, norm(getText(it))]).filter(([, t]) => !EMPTY_VALUE.test(t));
    for (const c of candidates.map(norm)) {
      const hit =
        list.find(([, t]) => t === c) ||
        list.find(([, t]) => t.startsWith(c)) ||
        list.find(([, t]) => t.includes(c));
      if (hit) return hit[0];
    }
    return null;
  }

  function visibleOptions() {
    return walk(document).filter(
      (el) =>
        (el.matches('[role=option], [role=listbox] li, ul.ui-autocomplete li, .sapMSelectListItem') && visible(el))
    );
  }

  async function waitOptions(timeout = 2500) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const o = visibleOptions();
      if (o.length) return o;
      await sleep(150);
    }
    return [];
  }

  async function fillDropdown(el, candidates) {
    // <select> natif
    if (el.tagName === 'SELECT') {
      const opt = bestMatch([...el.options], (o) => o.textContent, candidates);
      if (!opt) return false;
      el.value = opt.value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    const input = el.tagName === 'INPUT' ? el : el.querySelector('input');
    const typeable = input && !input.readOnly;

    for (const c of candidates) {
      el.focus();
      if (typeable) {
        setNative(input, c);
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keyup', { key: c.slice(-1), bubbles: true }));
      } else {
        click(el);
      }
      const opts = await waitOptions();
      const opt = bestMatch(opts, (o) => o.innerText || o.textContent, typeable ? [c] : candidates);
      if (opt) {
        opt.scrollIntoView({ block: 'nearest' });
        click(opt);
        await sleep(300);
        el.dispatchEvent(new Event('change', { bubbles: true }));
        input?.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
        return true;
      }
      // Ferme la liste avant d'essayer le candidat suivant.
      (input || el).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      if (typeable) setNative(input, '');
      await sleep(150);
      if (!typeable) return false; // tous les candidats ont déjà été testés sur la liste ouverte
    }
    return false;
  }

  const isDropdown = (el) =>
    el.tagName === 'SELECT' ||
    el.getAttribute('role') === 'combobox' ||
    el.hasAttribute('aria-haspopup') ||
    el.hasAttribute('aria-autocomplete') ||
    !!el.closest('[role=combobox]');

  async function fillField(f, value) {
    const el = f.el;
    const candidates = (Array.isArray(value) ? value : [value]).filter((v) => v != null && v !== '');
    if (!candidates.length) return 'skip';
    if (!PROFIL.ecraser && !isEmpty(el)) return 'deja';
    el.scrollIntoView({ block: 'center' });
    if (isDropdown(el)) return (await fillDropdown(el, candidates)) ? 'ok' : 'introuvable';
    el.focus();
    setNative(el, String(candidates[0]));
    el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    return 'ok';
  }

  function ruleFor(f) {
    if (f.section) {
      const rows = PROFIL.sections[Object.keys(PROFIL.sections).find((k) => norm(k) === f.section)] || [];
      const rules = rows[f.row] || [];
      return rules.find(([re]) => re.test(f.label));
    }
    return PROFIL.champs.find(([re]) => re.test(f.label));
  }

  // Ajoute des lignes dans les sections répétables si le profil en contient plus.
  async function ensureRows(log) {
    for (const [title, rows] of Object.entries(PROFIL.sections)) {
      const key = norm(title);
      for (let guard = 0; guard < 10; guard++) {
        const fields = scan().filter((f) => f.section === key);
        const have = fields.length ? Math.max(...fields.map((f) => f.row)) + 1 : 0;
        if (have >= rows.length) break;
        const btn = addButtonFor(key);
        if (!btn) {
          log(`⚠ Bouton "Ajouter" introuvable pour « ${title} »`);
          break;
        }
        click(btn);
        await sleep(1200);
      }
    }
  }

  function addButtonFor(sectionKey) {
    let inSection = false;
    const titles = Object.keys(PROFIL.sections).map(norm).concat(PROFIL.autresBlocs.map(norm));
    for (const el of walk(document)) {
      const t = el.childElementCount <= 2 ? norm(el.textContent) : '';
      if (t && titles.includes(t)) inSection = t === sectionKey;
      if (inSection && el.matches('button, a, [role=button]') && /^(\+ ?)?(ajouter|add)$/.test(norm(el.textContent)) && visible(el))
        return el;
    }
    return null;
  }

  async function run(log) {
    log('Ajout des lignes manquantes…');
    await ensureRows(log);

    let filled = 0;
    // Deux passes : certains champs (État/Province, Source Detail) dépendent d'un autre.
    for (let pass = 1; pass <= 2; pass++) {
      for (const f of scan()) {
        if (!f.el.isConnected) continue;
        const rule = ruleFor(f);
        if (!rule) continue;
        const r = await fillField(f, rule[1]);
        if (r === 'ok') {
          filled++;
          log(`✔ ${f.section ? `[${f.section} #${f.row + 1}] ` : ''}${f.label}`);
        } else if (r === 'introuvable' && pass === 2) {
          log(`✖ valeur absente de la liste : ${f.label} (${[].concat(rule[1]).join(' | ')})`);
        }
        await sleep(120);
      }
      await sleep(800);
    }

    const missing = scan().filter((f) => f.required && isEmpty(f.el));
    log(`\n${filled} champ(s) rempli(s).`);
    if (missing.length) {
      log(`⚠ ${missing.length} champ(s) obligatoire(s) encore vide(s) :`);
      for (const f of missing) {
        log(`  • ${f.section ? `[${f.section} #${f.row + 1}] ` : ''}${f.label}`);
        f.el.style.outline = '3px solid #e5484d';
      }
    } else {
      log('Tout est rempli. Vérifie, puis clique toi-même sur « Postuler ».');
    }
  }

  // ===========================================================================
  // Interface : bouton flottant + journal
  // ===========================================================================
  function ui() {
    if (document.getElementById('pdc-root')) return;
    const box = document.createElement('div');
    box.id = 'pdc-root';
    box.innerHTML = `
      <style>
        #pdc-root{position:fixed;right:16px;bottom:16px;z-index:2147483647;font:13px/1.4 system-ui,sans-serif}
        #pdc-root button{background:#111;color:#fff;border:0;border-radius:6px;padding:8px 12px;margin-left:6px;cursor:pointer}
        #pdc-root button:hover{background:#333}
        #pdc-log{display:none;max-width:420px;max-height:50vh;overflow:auto;white-space:pre-wrap;background:#fff;color:#111;
          border:1px solid #ccc;border-radius:6px;padding:8px;margin-bottom:8px;box-shadow:0 4px 16px rgba(0,0,0,.2)}
      </style>
      <div id="pdc-log"></div>
      <div style="text-align:right">
        <button id="pdc-scan" title="Liste les champs détectés dans la console">Scan</button>
        <button id="pdc-run">Page de con</button>
      </div>`;
    document.body.appendChild(box);
    const logEl = box.querySelector('#pdc-log');
    const log = (m) => {
      logEl.style.display = 'block';
      logEl.textContent += m + '\n';
      logEl.scrollTop = logEl.scrollHeight;
      console.log('[page de con]', m);
    };
    box.querySelector('#pdc-run').onclick = async (e) => {
      e.target.disabled = true;
      logEl.textContent = '';
      try {
        await run(log);
      } catch (err) {
        log('Erreur : ' + err.message);
        console.error(err);
      } finally {
        e.target.disabled = false;
      }
    };
    box.querySelector('#pdc-scan').onclick = () => {
      const rows = scan().map((f) => ({
        section: f.section || '',
        ligne: f.section ? f.row + 1 : '',
        libelle: f.label,
        obligatoire: f.required,
        valeur: currentValue(f.el).trim().slice(0, 60),
        regle: ruleFor(f) ? 'oui' : '—',
      }));
      console.table(rows);
      logEl.textContent = '';
      log(`${rows.length} champ(s) détecté(s), dont ${rows.filter((r) => r.regle === '—').length} sans règle. Détail : console (F12).`);
    };
  }

  ui();
})();
