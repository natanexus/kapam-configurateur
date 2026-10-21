/**
 * Vues : la page Webflow porte la structure et les gabarits cachés ([data-gabarits]),
 * le script clone les gabarits, remplit les [data-champ] et pose les états par classes
 * (selectionne, bloque, inclus) et par l'attribut hidden. Aucun HTML n'est écrit ici.
 *
 * Contrat des sélecteurs : voir README « Contrat avec la page Webflow ».
 */
import * as R from './regles.js'
import { euros, eurosOu, pluriel, libelleLigne, phrasePaliers, recapTexte } from './format.js'
import { ETAPES, TEXTES, SLUG_BICOLORE, GAMMES_STRATIFIE, HOUSSES, TEINTES_FINITION } from './config.js'

/* ------------------------------------------------------------ outils DOM --- */

const $ = (sel, r) => r.querySelector(sel)
const $$ = (sel, r) => Array.from(r.querySelectorAll(sel))
const montrer = (el, oui) => { if (el) el.hidden = !oui }
const texte = (r, champ, t) => { for (const el of $$(`[data-champ="${champ}"]`, r)) el.textContent = t ?? '' }
/** Remplit un champ texte, ou le masque s'il est vide. */
const texteOuRien = (r, champ, t) => { for (const el of $$(`[data-champ="${champ}"]`, r)) { el.textContent = t ?? ''; el.hidden = !t } }
const vider = (el) => { while (el.firstChild) el.removeChild(el.firstChild) }
const publiable = (o) => o.statut !== 'retire' && o.statut !== 'a-creer' && o.montage !== 'impose'

/** Image d'un clone : src + alt, ou masquage de son conteneur (span visuel) si aucune image. */
function image(conteneur, src, alt = '') {
  if (!conteneur) return
  const img = conteneur.tagName === 'IMG' ? conteneur : $('img', conteneur)
  if (src && img) { img.src = src; img.alt = alt; img.loading = 'lazy'; conteneur.hidden = false }
  else conteneur.hidden = true
}

/** États d'un élément cliquable : classes combo + ARIA. */
function etatChoix(el, { selectionne = false, bloque = false, inclus = false } = {}) {
  el.classList.toggle('selectionne', selectionne)
  el.classList.toggle('bloque', bloque)
  el.classList.toggle('inclus', inclus)
  if (el.hasAttribute('aria-pressed')) el.setAttribute('aria-pressed', String(selectionne))
  if (el.hasAttribute('aria-checked')) el.setAttribute('aria-checked', String(selectionne || inclus))
  if ('disabled' in el) el.disabled = bloque || inclus
}

/* ------------------------------------------------------------ application --- */

/**
 * @param {{ document: Document, catalogue: object, etat: object, sauver?: (etat) => void }} o
 */
export function creerApp({ document: doc, catalogue: cat, etat: etat0, sauver = () => {} }) {
  const racine = $('[data-configurateur]', doc) ?? doc.body
  const gabarits = $('[data-gabarits]', doc)
  const form = $('#demande-devis', doc) ?? $('form', doc)
  let etat = etat0
  let etapeAffichee = null
  const texteSuivant = $('[data-action="suivant"]', racine)?.textContent ?? 'Suivant'

  const gab = (nom) => {
    const g = $(`[data-gabarit="${nom}"]`, gabarits)
    if (!g) throw new Error(`Gabarit « ${nom} » introuvable dans [data-gabarits]`)
    const c = g.cloneNode(true)
    c.removeAttribute('data-gabarit')
    return c
  }
  const listes = (nom) => $$(`[data-liste="${nom}"]`, doc)
  const remplir = (nom, elements) => { for (const l of listes(nom)) { vider(l); for (const el of elements) l.appendChild(el.cloneNode(true)) } }

  const v = () => R.vehicule(etat, cat)
  const marqueDe = (x) => cat.par.marques.get(x.marque)?.nom ?? x.marque
  const nomVehicule = (x) => `${marqueDe(x)} ${x.modele}`
  const vehiculesActifs = () => cat.vehicules.filter((x) => x.statut !== 'retire')

  /* ---------------------------------------------------------- gabarits --- */

  function carte({ cle, valeur, titre, sous, photo, logo, selectionne }) {
    const c = gab('carte')
    c.dataset[cle] = valeur
    texte(c, 'titre', titre); texteOuRien(c, 'sous', sous)
    image($('.config_carte_photo', c), photo, titre)
    image($('.config_carte_logo', c), logo, titre)
    etatChoix(c, { selectionne })
    return c
  }

  function choix({ cle, valeur, titre, sous, detail, prix, visuel, teinte, selectionne, bloque }) {
    const c = gab('choix')
    if (cle) c.dataset[cle] = valeur
    texte(c, 'titre', titre); texteOuRien(c, 'sous', sous); texteOuRien(c, 'detail', detail); texteOuRien(c, 'prix', prix)
    const zone = $('[data-champ="visuel"]', c)
    if (teinte && zone && !visuel) { zone.hidden = false; const img = $('img', zone); if (img) img.hidden = true; zone.style.backgroundColor = teinte }
    else image(zone, visuel, titre)
    etatChoix(c, { selectionne, bloque })
    return c
  }

  function ligneRecap(libelle, montant) {
    const c = gab('ligne-recap')
    texte(c, 'libelle', libelle); texte(c, 'montant', montant)
    return c
  }

  function pastille({ cle, valeur, titre, sous, teinte, selectionne }) {
    const c = gab('pastille')
    c.dataset.nuance = cle; c.dataset.valeur = valeur
    texte(c, 'titre', titre); texteOuRien(c, 'sous', sous)
    const ech = $('[data-champ="teinte"]', c); if (ech) ech.style.backgroundColor = teinte ?? ''
    etatChoix(c, { selectionne })
    return c
  }

  /** Groupe de versions (choix unique ou cases) ou nuancier : gabarit select-versions + boutons dans [data-zone=choix]. */
  function groupe(titre, boutons) {
    const g = gab('select-versions')
    texte(g, 'titre', titre)
    const zone = $('[data-zone="choix"]', g)
    for (const b of boutons) zone.appendChild(b)
    return g
  }

  function caseVersion({ cle, valeur, titre, prix, selectionne, radio }) {
    const c = gab('case-version')
    c.dataset[cle] = valeur
    if (radio) { c.setAttribute('role', 'radio') }
    texte(c, 'titre', titre); texteOuRien(c, 'prix', prix)
    etatChoix(c, { selectionne })
    return c
  }

  function nuancier(cle, titre, gammes) {
    const dispo = R.gammesProposees(gammes)
    if (!dispo.length) return null
    return groupe(titre, dispo.map((g) => pastille({
      cle, valeur: g.slug, titre: g.nom, sous: g.prix ? `+ ${euros(g.prix)}` : 'inclus', teinte: g.teinte,
      selectionne: etat.attributs[cle] === g.slug,
    })))
  }

  /** Ligne d'option (gabarit ligne-option), avec ses versions quand elle est retenue. */
  function ligneOption(o, d = R.disponibilite(o, etat, cat)) {
    const c = gab('ligne-option')
    c.dataset.option = o.slug
    const selectionne = !!etat.options[o.slug]
    const bloque = d.etat === 'bloque', inclus = d.etat === 'inclus'
    texte(c, 'titre', o.nom); texteOuRien(c, 'sous', o.sousLibelle)
    image($('.config_ligne_visuel', c), o.visuel, o.nom)
    texteOuRien(c, 'note', o.noteClient)
    texteOuRien(c, 'motif', bloque || inclus ? d.motif : '')
    texteOuRien(c, 'badge', inclus ? 'Inclus atelier' : bloque ? 'Non compatible' : '')
    const a = R.affichagePrix(o, etat, cat)
    texteOuRien(c, 'prix', inclus ? '' : a.prefixe === 'inclus' ? 'inclus' : `${a.prefixe} ${eurosOu(a.montant)}`)
    montrer($('[data-action="detail-option"]', c), false)   // tiroir « détails » : lot suivant
    const caseBtn = $('[data-champ="case"]', c)
    if (caseBtn) etatChoix(caseBtn, { selectionne, bloque, inclus })
    c.classList.toggle('selectionne', selectionne); c.classList.toggle('bloque', bloque); c.classList.toggle('inclus', inclus)

    const zone = $('[data-zone="versions"]', c)
    if (zone) {
      vider(zone)
      if (selectionne && !bloque) {
        const best = etat.finition === 'best'
        const choixU = R.versionsChoix(o, etat, cat)
        const cases = R.versionsCases(o, etat, cat)
        if (choixU.length) {
          zone.appendChild(groupe(o.titreVersions || 'Version', choixU.map((x) => caseVersion({
            cle: 'version', valeur: x.slug, titre: x.nom, radio: true,
            prix: euros(best && R.num(x.prixBest) ? x.prixBest : x.prixTtc), selectionne: etat.versions[o.slug] === x.slug,
          }))))
        }
        if (cases.length) {
          const choisies = etat.cases[o.slug] ?? []
          zone.appendChild(groupe(o.titreVersions || 'Versions', cases.map((x) => caseVersion({
            cle: 'case', valeur: x.slug, titre: x.nom, prix: euros(x.prixTtc), selectionne: choisies.includes(x.slug),
          }))))
        }
      }
      zone.hidden = !zone.children.length
    }
    return c
  }

  /* --------------------------------------------------------------- étapes --- */

  function rendreEtapes() {
    const i = etat.etape
    $$('[data-etape]', doc).forEach((s, _, tous) => {
      const n = ETAPES.indexOf(s.dataset.etape)
      montrer(s, n === i || (i === 5 && n === 4))   // 3.2 vit dans le bloc de confirmation du formulaire, à l'intérieur de 3.1
      texte(s, 'compteur', `${n + 1} sur ${ETAPES.length}`)
    })
    montrer($('[data-zone="layout"]', racine), i < 4)
    montrer($('[data-zone="contact"]', racine), i >= 4)
    const scene = $(`[data-etape="${ETAPES[i]}"]`, doc)?.dataset.scene ?? null
    for (const el of $$('[data-zone="stage"] [data-scene]', racine)) montrer(el, el.dataset.scene === scene)
  }

  function rendre11() {
    for (const b of $$('[data-situation]', racine)) etatChoix(b, { selectionne: etat.situation === b.dataset.situation })
    montrer($('[data-bloc="pas-encore"]', racine), etat.situation === 'pas-encore')
    remplir('recommandes', vehiculesActifs().filter((x) => x.recommande).map((x) => choix({
      cle: 'vehicule', valeur: x.slug, titre: nomVehicule(x), sous: x.argument, visuel: x.photo, selectionne: etat.vehicule === x.slug,
    })))
    const actifs = vehiculesActifs()
    // Photo de la marque : son modèle le plus représentatif qui a une photo (recommandé, puis millésime récent), comme le prototype.
    const rang = (x) => (x.recommande ? 0 : /\+|post|202[4-9]/.test(x.millesime || '') ? 1 : 2)
    const photoMarque = (m) => actifs.filter((x) => x.marque === m.slug && x.photo).sort((a, b) => rang(a) - rang(b))[0]?.photo
    remplir('marques', cat.marques.filter((m) => actifs.some((x) => x.marque === m.slug)).map((m) => {
      const n = actifs.filter((x) => x.marque === m.slug).length
      return carte({ cle: 'marque', valeur: m.slug, titre: m.nom, sous: pluriel(n, 'modèle'), logo: m.logo, photo: photoMarque(m), selectionne: etat.marque === m.slug })
    }))
  }

  function rendre12() {
    const modeles = vehiculesActifs().filter((x) => x.marque === etat.marque)
    texte(racine, 'nom-marque', cat.par.marques.get(etat.marque)?.nom ?? '')
    texte(racine, 'nb-modeles', pluriel(modeles.length, 'modèle'))
    remplir('modeles', modeles.map((x) => carte({
      cle: 'vehicule', valeur: x.slug, titre: x.modele, sous: x.millesime, photo: x.photo, selectionne: etat.vehicule === x.slug,
    })))
    remplir('modeles-liste', modeles.map((x) => choix({
      cle: 'vehicule', valeur: x.slug, titre: x.modele,
      sous: [x.millesime, x.longueurs.map((l) => l.etiquette).join(' · ')].filter(Boolean).join(' · '),
      detail: x.kits.length ? 'Kits : ' + x.kits.map((k) => cat.par.kits.get(k)?.nom ?? k).join(' · ') : '',
      visuel: x.photo, selectionne: etat.vehicule === x.slug, bloque: x.statut === 'a-creer',
    })))
    for (const b of $$('[data-action="hors-liste"]', racine)) etatChoix(b, { selectionne: etat.horsListe })
  }

  function rendre13() {
    const x = v()
    texte(racine, 'nom-vehicule', x ? `${nomVehicule(x)}${x.millesime ? ' · ' + x.millesime : ''}` : '')
    image($('[data-zone="stage"] [data-scene="vehicule"] img', racine), x?.photo, x ? nomVehicule(x) : '')
    remplir('longueurs', (x?.longueurs ?? []).map((l) => choix({
      cle: 'longueur', valeur: l.slug, titre: l.etiquette, selectionne: etat.longueur === l.slug,
    })))
    texte(racine, 'kits-compatibles', x?.kits.length ? x.kits.map((k) => cat.par.kits.get(k)?.nom ?? k).join(' · ') : '—')
  }

  function rendre21(d) {
    const x = v()
    const k = R.kit(etat, cat), f = R.finition(etat, cat)
    const grille = R.grilleKit(etat, cat)
    const pret = !!(k && f)

    texte(racine, 'kit-compatible', x ? `Compatible ${nomVehicule(x)}` : '')
    remplir('kits', (x?.kits ?? []).map((slug) => cat.par.kits.get(slug)).filter((kk) => kk && kk.statut !== 'retire').map((kk) => {
      const mini = R.prixKitMini(etat, cat, kk.slug)
      return choix({
        cle: 'kit', valeur: kk.slug, titre: R.nomKit(kk, etat, cat),
        sous: cat.par.groupes.get(x?.groupe)?.sousLibelleKits || kk.sousLibelle,
        prix: grille ? (R.num(mini) ? `à partir de ${euros(mini)}` : TEXTES.prixACompleter) : TEXTES.prixACompleter,
        visuel: kk.visuel, selectionne: etat.kit === kk.slug,
      })
    }))
    const finitions = cat.finitions.filter((ff) => ff.statut !== 'retire')
    texte(racine, 'nb-finitions', pluriel(finitions.length, 'disponible'))
    remplir('finitions', finitions.map((ff) => {
      const pk = k ? R.prixKit(etat, cat, k.slug, ff.slug) : null
      const prix = pk ? (pk.aCompleter ? TEXTES.prixACompleter : pk.dispo ? `${euros(pk.prix)} TTC` : 'non proposée avec ce kit')
        : (grille ? 'selon le kit' : TEXTES.prixACompleter)
      return choix({
        cle: 'finition', valeur: ff.slug, titre: ff.nom, sous: ff.sousLibelle, prix, visuel: ff.texture,
        teinte: ff.teinte ?? TEINTES_FINITION[ff.slug], selectionne: etat.finition === ff.slug, bloque: !!pk && !pk.dispo,
      })
    }))

    // Couleurs et tissus
    const blocCouleurs = $('[data-bloc="couleurs"]', racine)
    montrer(blocCouleurs, pret)
    if (pret) {
      const best = etat.finition === 'best'
      texte(racine, 'couleurs-chapo', `${best ? 'Le stratifié DESIGN 1 et les housses tissu sont inclus.' : 'Les housses tissu sont incluses.'} Certaines gammes ajoutent un supplément.`)
      const groupes = []
      if (best) groupes.push(nuancier('stratifie', etat.options[SLUG_BICOLORE] ? 'Stratifié principal' : 'Stratifié', GAMMES_STRATIFIE))
      if (best && etat.options[SLUG_BICOLORE]) groupes.push(nuancier('stratifie2', 'Deuxième stratifié', GAMMES_STRATIFIE))
      groupes.push(nuancier('literie', 'Housses de literie', HOUSSES))
      remplir('nuanciers', groupes.filter(Boolean))
    }

    // Upsell : options qui requièrent la finition choisie
    const upsells = pret ? cat.options.filter((o) => publiable(o) && o.finitions.length && o.finitions.includes(etat.finition)) : []
    remplir('upsell', upsells.map((o) => {
      const c = gab('upsell')
      c.dataset.option = o.slug
      const sel = !!etat.options[o.slug]
      const a = R.affichagePrix(o, etat, cat)
      texte(c, 'titre', `Avec la finition ${f.nom} : ${o.nom}`)
      texte(c, 'sous', `${o.sousLibelle || 'Recommandé pour sublimer cette finition.'} ${a.prefixe === 'inclus' ? 'Inclus.' : `${a.prefixe} ${eurosOu(a.montant)}.`}`)
      image($('.config_ligne_visuel', c), o.visuel, o.nom)
      const b = $('[data-action="ajouter"]', c)
      if (b) { b.textContent = sel ? 'Retirer de mon devis' : 'Ajouter à mon devis'; etatChoix(b, { selectionne: sel }) }
      c.classList.toggle('selectionne', sel)
      return c
    }))

    // Sections d'options
    texte(racine, 'nom-kit', k?.nom ?? 'kit')
    for (const s of $$('[data-section]', racine)) {
      const lignes = pret ? cat.options
        .filter((o) => o.section === s.dataset.section && publiable(o) && o.montage !== 'inclus')
        .filter((o) => !(o.finitions.length && o.finitions.includes(etat.finition)))
        .map((o) => [o, R.disponibilite(o, etat, cat)])
        .filter(([, dd]) => dd.etat !== 'masque') : []
      montrer(s, lignes.length > 0)
      for (const l of $$('[data-liste="options"]', s)) { vider(l); for (const [o, dd] of lignes) l.appendChild(ligneOption(o, dd)) }
    }

    // Montage, postes imposés, VASP
    montrer($('[data-bloc="montage"]', racine), pret)
    if (pret) {
      const kitSeul = R.estimation('soi-meme', etat, cat), cle = R.estimation('atelier', etat, cat)
      const w = R.optVasp(cat)
      const vasp = etat.vasp && w ? w.prixTtc : 0
      texte(racine, 'total-soi-meme', eurosOu(kitSeul.total))
      texte(racine, 'total-atelier', eurosOu(cle.total - vasp))
      for (const b of $$('[data-montage]', racine)) etatChoix(b, { selectionne: etat.montage === b.dataset.montage })
      const lm = cle.lignes.find((l) => l?.type === 'montage')
      const detail = $('[data-bloc="detail-pose"]', racine)
      if (detail && 'open' in detail) detail.open = etat.montage === 'atelier'
      texte(racine, 'montant-pose', lm ? eurosOu(lm.montant) : TEXTES.prixACompleter)
      texte(racine, 'paliers', phrasePaliers(R.paliersMontage(cat)))
      const postes = lm ? [ligneRecap(`${lm.nom} — selon le montant de l'aménagement`, eurosOu(lm.montantPose)),
        ...lm.postes.map((p) => ligneRecap(`${p.nom} · tarif ${p.cle}${p.certain ? '' : ' (à confirmer)'}`, eurosOu(p.montant)))] : []
      remplir('postes-imposes', postes)
      montrer($('[data-bloc="vasp"]', racine), etat.montage === 'atelier' && !!w)
      remplir('vasp', w ? [(() => {
        const c = ligneOption(w, { etat: 'ok' })
        delete c.dataset.option; c.dataset.vasp = ''
        etatChoix($('[data-champ="case"]', c), { selectionne: etat.vasp }); c.classList.toggle('selectionne', etat.vasp)
        texteOuRien(c, 'prix', `+ ${eurosOu(w.prixTtc)}`)
        return c
      })()] : [])
    }

    // Préparer le fourgon soi-même
    const prep = pret && etat.montage === 'soi-meme' ? cat.options.filter((o) => o.montage === 'inclus' && publiable(o))
      .map((o) => [o, R.disponibilite(o, etat, cat)]).filter(([, dd]) => dd.etat !== 'masque') : []
    montrer($('[data-bloc="preparation"]', racine), prep.length > 0)
    remplir('preparation', prep.map(([o, dd]) => ligneOption(o, dd)))

    // Récapitulatif
    montrer($('[data-bloc="recap"]', racine), pret && !!etat.montage)
    rendreRecap(d)
  }

  function rendreRecap(d) {
    remplir('recap', d.lignes.map((l) => ligneRecap(libelleLigne(l), eurosOu(l.montant))))
    for (const r of $$('[data-liste="recap"]', doc)) {
      const bloc = r.closest('[data-bloc], aside, section') ?? r.parentElement
      texte(bloc, 'total', eurosOu(d.total) + (d.incomplet ? ' (incomplet)' : ''))
    }
  }

  function rendre31(d) {
    const type = etat.demande ?? 'devis'
    const [titre, chapo] = TEXTES.contact[type]
    texte(racine, 'titre-contact', titre); texte(racine, 'chapo-contact', chapo)
    const x = v()
    const lignes = [['Type de demande', TEXTES.demandes[type]], ['Situation', TEXTES.situations[etat.situation] ?? 'non renseignée']]
    if (type === 'sur-mesure') lignes.push(['Véhicule', [etat.vehiculeLibre?.marque ?? cat.par.marques.get(etat.marque)?.nom, etat.vehiculeLibre?.modele].filter(Boolean).join(' ') || 'à préciser'])
    if (type === 'devis' && x) lignes.push(['Véhicule', `${nomVehicule(x)}${R.longueur(etat, cat) ? ' · ' + R.longueur(etat, cat).etiquette : ''}`])
    if (type === 'devis' && etat.situation === 'pas-encore' && x) lignes.push(['Simulation', `sur ${nomVehicule(x)} (véhicule recommandé)`])
    remplir('resume-demande', lignes.map(([a, b]) => ligneRecap(a, b)))
    for (const r of $$('[data-zone="contact"] [data-liste="recap"]', racine)) montrer(r.closest('[data-bloc]') ?? r, type === 'devis')
    for (const t of $$('[data-zone="contact"] [data-champ="total"]', racine)) montrer(t.closest('[data-bloc]') ?? t.parentElement, type === 'devis')

    if (!form) return
    if (etat.etape >= 4 && !etat.reference) etat.reference = reference()
    const champ = (nom, val) => { const el = $(`[data-champ-form="${nom}"]`, form); if (el) el.value = val ?? '' }
    champ('type', TEXTES.demandes[type])
    champ('reference', etat.reference)
    champ('vehicule', x ? `${nomVehicule(x)}${R.longueur(etat, cat) ? ' · ' + R.longueur(etat, cat).etiquette : ''}` : (etat.vehiculeLibre?.marque ?? ''))
    champ('total', type === 'devis' ? eurosOu(d.total) : '')
    champ('recap', type === 'devis' ? recapTexte(d) : '')
    champ('config', JSON.stringify({ ...etat, coordonnees: undefined }))
    texte(racine, 'reference', etat.reference ?? '')
    for (const el of $$('[data-coord]', form)) {
      const val = etat.coordonnees?.[el.dataset.coord]
      if (val == null) continue
      if (el.type === 'checkbox') el.checked = !!val
      else if (el.type === 'radio') el.checked = el.value === val
      else el.value = val
    }
  }

  function rendreBarre(d) {
    const i = etat.etape
    const prec = $('[data-action="precedent"]', racine), suiv = $('[data-action="suivant"]', racine)
    if (prec) { prec.disabled = i <= 0 || i >= 5; montrer(prec, i < 5) }
    if (suiv) {
      montrer(suiv, i < 5)
      suiv.disabled = !R.etapeComplete(etat, cat)
      suiv.textContent = i === 4 ? 'Envoyer ma demande' : texteSuivant
    }
    const suivante = $(`[data-etape="${ETAPES[i]}"]`, doc)?.dataset.suivante
    texte($('.config_bottombar', racine) ?? racine, 'etape-suivante', suivante ? `Étape suivante : ${suivante}` : '')
    for (const t of $$('.config_bottombar [data-champ="total"], [data-zone="barre"] [data-champ="total"]', racine)) {
      t.textContent = etat.demande ? '—' : d.lignes.length ? eurosOu(d.total) : '—'
    }
    montrer($('[data-action="ouvrir-resume"]', racine), i === 3)
  }

  /* ---------------------------------------------------------------- rendu --- */

  function rendre() {
    if (etat.etape === 1 && !etat.marque) etat.etape = 0
    if (etat.etape === 2 && !v()) etat.etape = etat.marque ? 1 : 0
    if (etat.etape === 3 && !(v() && R.longueur(etat, cat))) etat.etape = v() ? 2 : etat.marque ? 1 : 0
    if (etat.etape === 4 && !etat.demande && !R.etapeComplete({ ...etat, etape: 3 }, cat)) etat.etape = 3
    etat = R.nettoyer(etat, cat)
    sauver(etat)
    const d = R.devis(etat, cat)
    const focus = cleFocus(doc.activeElement)
    rendreEtapes(); rendre11(); rendre12(); rendre13(); rendre21(d); rendre31(d); rendreBarre(d)
    if (focus) $(focus, racine)?.focus?.({ preventScroll: true })
    if (etapeAffichee !== null && etapeAffichee !== etat.etape) defilerEnHaut()
    etapeAffichee = etat.etape
    racine.dispatchEvent(new doc.defaultView.CustomEvent('kapam:configuration', { detail: { etat: structuredClone(etat), devis: d } }))
  }

  function defilerEnHaut() {
    doc.documentElement.scrollTop = 0; doc.body.scrollTop = 0
    const panel = $('[data-zone="panel"]', racine); if (panel) panel.scrollTop = 0
  }

  const CLES_FOCUS = ['marque', 'vehicule', 'longueur', 'kit', 'finition', 'version', 'case', 'situation', 'montage']
  function cleFocus(el) {
    if (!el || !racine.contains(el)) return null
    for (const k of CLES_FOCUS) if (el.dataset[k] !== undefined) return `[data-${k}="${el.dataset[k]}"]`
    if (el.dataset.nuance) return `[data-nuance="${el.dataset.nuance}"][data-valeur="${el.dataset.valeur}"]`
    if (el.dataset.champ === 'case') {
      const o = el.closest('[data-option]'); if (o) return `[data-option="${o.dataset.option}"] [data-champ="case"]`
      if (el.closest('[data-vasp]')) return '[data-vasp] [data-champ="case"]'
    }
    if (el.dataset.action) return `[data-action="${el.dataset.action}"]`
    return null
  }

  function reference() {
    const n = Math.floor((Date.now() / 1000) % 9000) + 1000
    return `KP-${new Date().getFullYear()}-${n}`
  }

  /* ----------------------------------------------------------- évènements --- */

  function allerA(i) { etat.etape = Math.max(0, Math.min(ETAPES.length - 1, i)); rendre() }

  function choisirVehicule(slug) {
    const x = cat.par.vehicules.get(slug)
    if (!x || x.statut === 'a-creer') return
    etat.marque = x.marque; etat.horsListe = false; etat.demande = null
    if (etat.vehicule !== slug) {
      etat.vehicule = slug; etat.longueur = x.longueurs.length === 1 ? x.longueurs[0].slug : null
      etat.kit = null; etat.finition = null; etat.options = {}; etat.versions = {}; etat.cases = {}
    }
    allerA(2)
  }

  const ACTIONS = {
    precedent() {
      if (etat.etape === 4 && etat.demande) { const r = etat.etapeDemande ?? 0; etat.demande = null; allerA(r); return }
      allerA(etat.etape - 1)
    },
    suivant() {
      if (!R.etapeComplete(etat, cat)) return
      if (etat.etape === 4) { form?.requestSubmit ? form.requestSubmit() : form?.submit(); return }
      allerA(etat.etape + 1)
    },
    'hors-liste'() {
      etat.horsListe = true; etat.vehiculeLibre = { ...etat.vehiculeLibre, marque: cat.par.marques.get(etat.marque)?.nom ?? etat.marque }
      etat.demande = 'sur-mesure'; etat.etapeDemande = etat.etape; allerA(4)
    },
    'changer-vehicule'() { allerA(1) },
    'demander-devis'() { etat.demande = null; allerA(4) },
    'ouvrir-resume'() { $('[data-bloc="recap"]', racine)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }) },
    'comparer-kits'() { racine.dispatchEvent(new doc.defaultView.CustomEvent('kapam:comparer-kits')) },
    'detail-option'(t) { racine.dispatchEvent(new doc.defaultView.CustomEvent('kapam:detail-option', { detail: { option: t.closest('[data-option]')?.dataset.option } })) },
    ajouter(t) { basculerOption(t.closest('[data-option]')?.dataset.option) },
  }

  function basculerOption(slug) {
    if (!slug || !cat.par.options.get(slug)) return
    if (etat.options[slug]) { delete etat.options[slug]; delete etat.versions[slug]; delete etat.cases[slug] }
    else etat.options[slug] = true
    rendre()
  }

  function surClic(ev) {
    const t = ev.target.closest('[data-action],[data-situation],[data-montage],[data-demande],[data-marque],[data-vehicule],[data-longueur],[data-kit],[data-finition],[data-version],[data-case],[data-nuance],[data-vasp],[data-option]')
    if (!t || !racine.contains(t) || t.disabled) return
    const ds = t.dataset
    if (ds.action) { ACTIONS[ds.action]?.(t); return }
    if (ds.situation !== undefined) { etat.situation = ds.situation; if (etat.situation !== 'pas-encore') etat.demande = null; rendre(); return }
    if (ds.demande !== undefined) { etat.demande = ds.demande; etat.etapeDemande = etat.etape; allerA(4); return }
    if (ds.marque !== undefined) {
      if (etat.marque !== ds.marque) { Object.assign(etat, { marque: ds.marque, vehicule: null, longueur: null, kit: null, finition: null, options: {}, versions: {}, cases: {} }) }
      etat.horsListe = false; etat.demande = null; allerA(1); return
    }
    if (ds.vehicule !== undefined) { choisirVehicule(ds.vehicule); return }
    if (ds.longueur !== undefined) { etat.longueur = ds.longueur; rendre(); return }
    if (ds.kit !== undefined) { if (etat.kit !== ds.kit) { etat.kit = ds.kit; etat.options = {}; etat.versions = {}; etat.cases = {} } rendre(); return }
    if (ds.finition !== undefined) { etat.finition = ds.finition; rendre(); return }
    if (ds.montage !== undefined) { etat.montage = ds.montage; rendre(); return }
    if (ds.version !== undefined) { const o = t.closest('[data-option]')?.dataset.option; if (o) { etat.versions[o] = ds.version; rendre() } return }
    if (ds.case !== undefined) {
      const o = t.closest('[data-option]')?.dataset.option; if (!o) return
      const l = new Set(etat.cases[o] ?? []); l.has(ds.case) ? l.delete(ds.case) : l.add(ds.case); etat.cases[o] = [...l]; rendre(); return
    }
    if (ds.nuance !== undefined) { etat.attributs[ds.nuance] = ds.valeur; rendre(); return }
    if (ds.vasp !== undefined) { etat.vasp = !etat.vasp; rendre(); return }
    if (ds.option !== undefined) {
      if (ev.target.closest('[data-zone="versions"]') || t.classList.contains('bloque') || t.classList.contains('inclus')) return
      basculerOption(ds.option)
    }
  }

  function surSaisie(ev) {
    const el = ev.target.closest?.('[data-coord]')
    if (!el) return
    etat.coordonnees ??= {}
    etat.coordonnees[el.dataset.coord] = el.type === 'checkbox' ? el.checked : el.value
    sauver(etat)
  }

  /** Webflow affiche le bloc de confirmation après l'envoi : on passe à l'étape 3.2. */
  function surveillerEnvoi() {
    const conf = $('[data-zone="confirmation"]', doc)
    const MO = doc.defaultView?.MutationObserver
    if (!conf || !MO) return
    new MO(() => {
      const visible = conf.style.display && conf.style.display !== 'none'
      if (visible && etat.etape !== 5) { etat.envoye = etat.reference; allerA(5) }
    }).observe(conf, { attributes: true, attributeFilter: ['style', 'class'] })
  }

  racine.addEventListener('click', surClic)
  form?.addEventListener('input', surSaisie)
  form?.addEventListener('change', surSaisie)
  surveillerEnvoi()

  return {
    rendre,
    etat: () => etat,
    /** Remplace l'état (autre onglet) et redessine. */
    remplacer(e) { etat = e; rendre() },
    modifier(fn) { fn(etat); rendre() },
    allerA,
  }
}
