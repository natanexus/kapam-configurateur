/**
 * Modale « Demander un devis » : hub des formules, aide au choix, présentation,
 * formulaire par formule, confirmation. Vit dans le composant Footer (toutes les pages).
 *
 * Données : collection Formules + listes Config · (marques, véhicules, longueurs, kits,
 * finitions) publiées dans la zone cachée [data-devis-donnees] du composant.
 * La page porte la structure et les gabarits ; le script clone, remplit les [data-champ]
 * et pose les états (hidden, classe selectionne). Contrat : voir webflow/devis-structure.md.
 */
import { nombre } from './lecture-cms.js'
import { slugifier } from './catalogue.js'
import { euros } from './format.js'
import { num } from './regles.js'

const $ = (sel, r) => r.querySelector(sel)
const $$ = (sel, r) => Array.from(r.querySelectorAll(sel))
const montrer = (el, oui) => { if (el) el.hidden = !oui }
const texte = (r, champ, t) => { for (const el of $$(`[data-champ="${champ}"]`, r)) el.textContent = t ?? '' }
const vider = (el) => { while (el.firstChild) el.removeChild(el.firstChild) }
const lignes = (s) => String(s ?? '').split('\n').map((x) => x.trim()).filter(Boolean)

export const VUES = ['hub', 'q1', 'q2', 'reco', 'presentation', 'formulaire', 'confirmation']
export const SELECTEUR_OUVERTURE = '.btn-devis-nav, [data-devis-ouvrir]'
const FOCUSABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/* ------------------------------------------------------------- règles --- */

/** Recommandation : pas de van → Clé en main ; van + pose soi-même → Kit DIY ; van + pose Kapam → Atelier. */
export function recommander({ van, pose }) {
  if (van === 'non') return 'cle-en-main'
  if (van === 'oui' && pose === 'soi-meme') return 'kit-diy'
  if (van === 'oui' && pose === 'kapam') return 'atelier'
  return null
}

/** « À partir de 25 000 € · 6 à 12 semaines » (prix vide → pas de montant). */
export function ligneTarif(f) {
  return [num(f.prix) ? `À partir de ${euros(f.prix)}` : null, f.delai || null].filter(Boolean).join(' · ')
}

/* ------------------------------------------------------- lecture du CMS --- */

/** Lit la liste CMS cachée des formules (data-item="formules"). Les textes multi-lignes sont dans des enfants [data-champ]. */
export function lireFormules(zone) {
  return $$('[data-item="formules"]', zone).map((el) => {
    const d = el.dataset
    const enfant = (n) => $(`:scope > [data-champ="${n}"]`, el)?.textContent ?? ''
    const lien = $(':scope > a[data-champ="calcom"]', el)
    const href = lien && !lien.classList.contains('w-dyn-bind-empty') ? lien.getAttribute('href') : null
    return {
      slug: d.slug, nom: d.nom ?? '', ordre: nombre(d.ordre) ?? 0,
      etiquette: d.etiquette ?? '', accroche: d.accroche ?? '', description: enfant('description').trim(),
      prix: nombre(d.prix), delai: (d.delai ?? '').trim(),
      inclus: lignes(enfant('inclus')), exclus: lignes(enfant('exclus')), etapes: lignes(enfant('etapes')),
      bouton: (d.bouton ?? '').trim() || 'Demander un devis', confirmation: enfant('confirmation').trim(),
      duree: nombre(d.duree), calcom: href && href !== '#' ? href : null,
      statut: slugifier(d.statut) === 'valide' ? 'valide' : 'a-valider',
    }
  }).filter((f) => f.slug).sort((a, b) => a.ordre - b.ordre)
}

/* --------------------------------------------------------------- vues --- */

/**
 * @param {{ document:Document, racine:Element, formules:object[], catalogue:object, configuration?:object|null }} p
 *   configuration : état du configurateur (localStorage) pour pré-remplir et joindre le récapitulatif.
 */
export function creerDevis({ document: doc, racine, formules, catalogue, configuration = null }) {
  const boite = $('[data-devis-boite]', racine) ?? racine
  const gabarits = $('[data-gabarits]', racine)
  const gabarit = (nom) => $(`[data-gabarit="${nom}"]`, gabarits)?.cloneNode(true)
  const parSlug = new Map(formules.map((f) => [f.slug, f]))

  let etat = { ouverte: false, vue: 'hub', formule: null, van: null, pose: null }
  let declencheur = null

  /* ---- hub ---- */
  function carte(f) {
    const el = gabarit('carte-formule'); if (!el) return null
    el.removeAttribute('data-gabarit'); el.dataset.formule = f.slug
    texte(el, 'etiquette', f.etiquette); texte(el, 'nom', f.nom); texte(el, 'accroche', f.accroche)
    texte(el, 'tarif', ligneTarif(f)); montrer($('[data-champ="tarif"]', el), !!ligneTarif(f))
    montrer($('[data-champ="mention"]', el), f.statut !== 'valide')
    return el
  }
  function remplirCartes(liste, items) {
    const conteneur = $(`[data-liste="${liste}"]`, boite); if (!conteneur) return
    vider(conteneur)
    for (const f of items) { const c = carte(f); if (c) conteneur.appendChild(c) }
  }
  function rendreHub() { remplirCartes('formules', formules) }

  /* ---- aide à choisir ---- */
  function rendreQuestions() {
    for (const b of $$('[data-reponse]', boite)) {
      const [cle, val] = b.dataset.reponse.split(':')
      b.classList.toggle('selectionne', etat[cle] === val)
      b.setAttribute('aria-pressed', String(etat[cle] === val))
    }
    const reco = parSlug.get(recommander(etat))
    remplirCartes('recommandee', reco ? [reco] : [])
    remplirCartes('autres', formules.filter((f) => f !== reco))
  }

  /* ---- présentation ---- */
  function remplirLignes(section, liste, items, numerote = false) {
    const conteneur = $(`[data-liste="${liste}"]`, section); if (!conteneur) return
    vider(conteneur)
    items.forEach((t, i) => {
      const li = gabarit('ligne'); if (!li) return
      li.removeAttribute('data-gabarit')
      texte(li, 'titre', t); if (numerote) texte(li, 'numero', `${i + 1}.`)
      conteneur.appendChild(li)
    })
  }
  function rendrePresentation(f) {
    const s = $('[data-vue="presentation"]', boite); if (!s || !f) return
    texte(s, 'etiquette', f.etiquette); texte(s, 'nom', f.nom); texte(s, 'description', f.description)
    texte(s, 'tarif', ligneTarif(f)); montrer($('[data-champ="tarif"]', s), !!ligneTarif(f))
    montrer($('[data-champ="mention"]', s), f.statut !== 'valide')
    remplirLignes(s, 'inclus', f.inclus)
    remplirLignes(s, 'exclus', f.exclus); montrer($('[data-bloc="exclus"]', s), f.exclus.length > 0)
    remplirLignes(s, 'etapes', f.etapes, true)
    texte(s, 'nb-etapes', String(f.etapes.length))
    const cta = $('[data-action="formulaire"]', s); if (cta) cta.textContent = f.bouton
  }

  /* ---- formulaires ---- */
  const cfg = configuration
  const vehiculeCfg = cfg?.vehicule ? catalogue.par.vehicules.get(cfg.vehicule) : null
  const marquesActives = () => catalogue.marques.filter((m) => catalogue.vehicules.some((x) => x.marque === m.slug && x.statut !== 'retire'))
  const nomVehicule = (x) => `${catalogue.par.marques.get(x.marque)?.nom ?? ''} ${x.modele}`.trim()

  function option(select, valeur, libelle, selected = false) {
    const o = doc.createElement('option'); o.value = valeur; o.textContent = libelle; o.selected = selected
    select.appendChild(o)
  }
  function remplirSelectMarques(form) {
    const sel = $('[data-champ="select-marque"]', form); if (!sel) return
    const garde = sel.firstElementChild?.value === '' ? sel.firstElementChild.cloneNode(true) : null
    vider(sel); if (garde) sel.appendChild(garde)
    for (const m of marquesActives()) option(sel, m.slug, m.nom, m.slug === (vehiculeCfg?.marque ?? ''))
    option(sel, 'autre', 'Autre marque')
  }
  function remplirSelectModeles(form) {
    const marque = $('[data-champ="select-marque"]', form)?.value ?? ''
    const sel = $('[data-champ="select-modele"]', form); if (!sel) return
    const garde = sel.firstElementChild?.value === '' ? sel.firstElementChild.cloneNode(true) : null
    vider(sel); if (garde) sel.appendChild(garde)
    const modeles = catalogue.vehicules.filter((x) => x.marque === marque && x.statut !== 'retire')
    for (const x of modeles) option(sel, x.slug, `${x.modele}${x.millesime ? ' · ' + x.millesime : ''}`, x.slug === (vehiculeCfg?.slug ?? ''))
    option(sel, 'autre', 'Autre modèle')
    sel.disabled = !marque
  }
  function chip(nom, valeur, libelle, type = 'radio', coche = false) {
    const el = gabarit('chip'); if (!el) return null
    el.removeAttribute('data-gabarit'); el.dataset.chip = ''
    const input = $('input', el); if (input) { input.type = type; input.name = nom; input.value = valeur; input.checked = coche }
    texte(el, 'titre', libelle); el.classList.toggle('selectionne', coche)
    return el
  }
  function remplirChips(form, liste, nom, items, choisi, inconnu) {
    const conteneur = $(`[data-liste="${liste}"]`, form); if (!conteneur) return
    vider(conteneur)
    for (const it of items) { const c = chip(nom, it.slug, it.nom, 'radio', it.slug === choisi); if (c) conteneur.appendChild(c) }
    if (inconnu) { const c = chip(nom, 'je-ne-sais-pas', inconnu, 'radio', false); if (c) conteneur.appendChild(c) }
    montrer(conteneur.closest('[data-bloc]') ?? conteneur, items.length > 0)
  }
  function remplirLongueurs(form) {
    const slug = $('[data-champ="select-modele"]', form)?.value ?? ''
    const x = catalogue.par.vehicules.get(slug)
    const items = (x?.longueurs ?? []).map((l) => ({ slug: l.slug, nom: l.etiquette }))
    remplirChips(form, 'longueurs', 'longueur', items, cfg?.vehicule === slug ? cfg.longueur : null, 'Je ne sais pas')
  }
  function etatChips(form) {
    for (const c of $$('[data-chip]', form)) { const i = $('input', c); c.classList.toggle('selectionne', !!i?.checked) }
  }
  function champCache(form, nom, val) { const el = $(`[data-champ-form="${nom}"]`, form); if (el) el.value = val ?? '' }
  function rendreFormulaire(f) {
    const s = $('[data-vue="formulaire"]', boite); if (!s || !f) return
    texte(s, 'etiquette', f.etiquette); texte(s, 'nom', f.nom)
    for (const bloc of $$('[data-formulaire]', s)) montrer(bloc, bloc.dataset.formulaire === f.slug)
    const bloc = $(`[data-formulaire="${f.slug}"]`, s); if (!bloc || bloc.dataset.pret) return
    bloc.dataset.pret = '1'
    const form = $('form', bloc) ?? bloc
    champCache(form, 'formule', f.nom)
    remplirSelectMarques(form); remplirSelectModeles(form); remplirLongueurs(form)
    const kits = catalogue.kits.filter((k) => k.statut !== 'retire').map((k) => ({ slug: k.slug, nom: k.nom }))
    remplirChips(form, 'kits', 'kit', kits, cfg?.kit ?? null, 'Je ne sais pas encore')
    const finitions = catalogue.finitions.filter((k) => k.statut !== 'retire').map((k) => ({ slug: k.slug, nom: `${k.nom}${k.sousLibelle ? ' — ' + k.sousLibelle : ''}` }))
    remplirChips(form, 'finitions', 'finition', finitions, cfg?.finition ?? null, 'Je ne sais pas')
    const envisage = $('[data-champ="vehicule-envisage"]', form)
    if (envisage && vehiculeCfg && !envisage.value) envisage.value = nomVehicule(vehiculeCfg)
    // Configuration du configurateur : jointe par défaut, case décochable.
    const joindre = $('[data-champ-form="joindre"]', form)
    const resume = cfg?.resume?.recap ? cfg.resume : null
    montrer(joindre?.closest('[data-bloc="joindre"]') ?? joindre, !!resume)
    if (joindre) joindre.checked = !!resume
    texte(form, 'config-vehicule', vehiculeCfg ? nomVehicule(vehiculeCfg) : '')
    texte(form, 'config-total', resume && num(resume.total) ? euros(resume.total) : '')
    majRecap(form)
    etatChips(form)
  }
  function majRecap(form) {
    const joindre = $('[data-champ-form="joindre"]', form)
    const joint = cfg?.resume?.recap && (!joindre || joindre.checked)
    champCache(form, 'recap', joint ? cfg.resume.recap : '')
    champCache(form, 'configuration', joint ? JSON.stringify({ ...cfg, coordonnees: undefined, resume: undefined }) : '')
  }

  /* ---- confirmation ---- */
  function rendreConfirmation(f) {
    const s = $('[data-vue="confirmation"]', boite); if (!s || !f) return
    texte(s, 'message', f.confirmation)
    texte(s, 'duree', f.duree != null ? `${f.duree} min` : '')
    const lien = $('[data-action="calcom"]', s); if (lien) lien.setAttribute('href', f.calcom ?? '#')
    montrer($('[data-bloc="rdv"]', s), !!f.calcom)
  }

  /* ---- rendu ---- */
  function rendre() {
    montrer(racine, etat.ouverte)
    racine.classList.toggle('est-ouverte', etat.ouverte)   // combo Webflow : la classe de base est display:none (invisible dans le Designer)
    doc.documentElement.classList.toggle('devis-ouverte', etat.ouverte)
    for (const s of $$('[data-vue]', boite)) montrer(s, s.dataset.vue === etat.vue)
    const f = parSlug.get(etat.formule) ?? null
    const titre = $('[data-vue]:not([hidden]) [data-champ="nom"], [data-vue]:not([hidden]) h2, [data-vue]:not([hidden]) h3', boite)
    if (titre) { titre.id ||= 'devis-titre'; boite.setAttribute('aria-labelledby', titre.id) }
    switch (etat.vue) {
      case 'hub': rendreHub(); break
      case 'q1': case 'q2': case 'reco': rendreQuestions(); break
      case 'presentation': rendrePresentation(f); break
      case 'formulaire': rendreFormulaire(f); break
      case 'confirmation': rendreConfirmation(f); break
    }
    racine.dispatchEvent(new doc.defaultView.CustomEvent('kapam:devis', { detail: { ...etat } }))
  }

  function allerA(vue, formule = etat.formule) {
    etat.vue = vue; etat.formule = formule; rendre()
    if (etat.ouverte) ($('[data-vue]:not([hidden])', boite) ?? boite).scrollTop = 0
    if (etat.ouverte) focaliser()
  }
  function focaliser() {
    const cible = $('[data-vue]:not([hidden]) h2, [data-vue]:not([hidden]) h3, [data-vue]:not([hidden]) [data-champ="nom"]', boite) ?? $(FOCUSABLES, boite)
    if (cible && !cible.hasAttribute('tabindex')) cible.setAttribute('tabindex', '-1')
    cible?.focus?.({ preventScroll: true })
  }

  function ouvrir({ formule = null, vue = null, declencheur: d = null } = {}) {
    declencheur = d ?? doc.activeElement
    etat.ouverte = true
    if (formule && parSlug.has(formule)) allerA(vue ?? 'presentation', formule)
    else allerA('hub', null)
  }
  function fermer() {
    if (!etat.ouverte) return
    etat.ouverte = false; rendre()
    declencheur?.focus?.(); declencheur = null
  }
  /** Après envoi : on revient au hub la prochaine fois et on réinitialise le formulaire envoyé. */
  function apresEnvoi(f) {
    etat.van = null; etat.pose = null
    allerA('confirmation', f.slug)
    racine.dispatchEvent(new doc.defaultView.CustomEvent('kapam:devis-envoye', { detail: { formule: f.slug } }))
    doc.defaultView.dataLayer?.push?.({ event: 'demande_devis_envoyee', formule: f.slug })
  }

  /* ---- événements ---- */
  function surClic(ev) {
    const t = ev.target.closest('[data-action], [data-reponse], [data-formule]')
    if (!t || !boite.contains(t)) { if (ev.target === racine) fermer(); return }
    const { action, reponse } = t.dataset
    if (reponse) {
      const [cle, val] = reponse.split(':'); etat[cle] = val
      if (cle === 'van') allerA(val === 'oui' ? 'q2' : 'reco')
      else allerA('reco')
      return
    }
    const formule = t.closest('[data-formule]')?.dataset.formule ?? etat.formule
    switch (action) {
      case 'fermer': fermer(); break
      case 'aide': etat.van = null; etat.pose = null; allerA('q1'); break
      case 'hub': allerA('hub'); break
      case 'presentation': allerA('presentation', formule); break
      case 'formulaire': allerA('formulaire', formule); break
      case 'precedent': allerA(etat.vue === 'q2' ? 'q1' : etat.vue === 'reco' ? (etat.van === 'oui' ? 'q2' : 'q1') : etat.vue === 'formulaire' ? 'presentation' : 'hub'); break
      default: if (t.dataset.formule && !action) allerA('presentation', formule)
    }
  }
  function surChangement(ev) {
    const form = ev.target.closest('form'); if (!form || !boite.contains(form)) return
    const champ = ev.target.dataset.champ
    if (champ === 'select-marque') { remplirSelectModeles(form); remplirLongueurs(form) }
    if (champ === 'select-modele') remplirLongueurs(form)
    if (ev.target.dataset.champForm === 'joindre') majRecap(form)
    etatChips(form)
  }
  function surTouche(ev) {
    if (!etat.ouverte) return
    if (ev.key === 'Escape') { ev.preventDefault(); fermer(); return }
    if (ev.key !== 'Tab') return
    const f = $$(FOCUSABLES, boite).filter((el) => !el.closest('[hidden]'))
    if (!f.length) return
    const premier = f[0], dernier = f[f.length - 1]
    if (ev.shiftKey && doc.activeElement === premier) { ev.preventDefault(); dernier.focus() }
    else if (!ev.shiftKey && doc.activeElement === dernier) { ev.preventDefault(); premier.focus() }
  }
  /** Webflow affiche .w-form-done après un envoi réussi : on passe à la confirmation. */
  function surveillerEnvois() {
    const MO = doc.defaultView?.MutationObserver; if (!MO) return
    for (const bloc of $$('[data-formulaire]', boite)) {
      const done = $('.w-form-done', bloc); if (!done) continue
      new MO(() => {
        const visible = done.style.display && done.style.display !== 'none'
        if (visible && etat.vue === 'formulaire') { const f = parSlug.get(bloc.dataset.formulaire); if (f) apresEnvoi(f) }
      }).observe(done, { attributes: true, attributeFilter: ['style'] })
    }
  }

  racine.addEventListener('click', surClic)
  racine.addEventListener('change', surChangement)
  doc.addEventListener('keydown', surTouche)
  doc.addEventListener('click', (ev) => {
    const b = ev.target.closest(SELECTEUR_OUVERTURE); if (!b || racine.contains(b)) return
    ev.preventDefault()
    ouvrir({ formule: b.dataset.devisFormule ?? null, vue: b.dataset.devisVue ?? null, declencheur: b })
  })
  surveillerEnvois()

  return { ouvrir, fermer, allerA, rendre, etat: () => ({ ...etat }), formules }
}
