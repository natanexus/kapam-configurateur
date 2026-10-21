/*
 * Référence de non-régression : fonctions de calcul du prototype (prototype-logique.js, 28/09/2026),
 * recopiées sans modification. Seul l'emballage change : C, etat et parId sont injectés par creerReference().
 * Unique ajout : `id` sur les lignes d'options du devis, pour comparer ligne à ligne.
 */

export function creerReference(catalogue) {
  const C = structuredClone(catalogue)
  let etat = null
  const parId = new Map()

  /* ---------- copie du prototype ---------- */
  const SECTION_SERVICES = 'Services & montage'
  const ID = { rAtelier: '3e670bd669cd817f9fb5dfda562712b0' }
  const ID_BICOLORE = '3e370bd669cd81ca97bee98459905ce5'
  const REGLES_CORRIGEES = {}
  const MAJ_PAR_REVISION = { 'Corrigée': 'corrigee', 'Précisée': 'precisee', 'Reformulée': 'reformulee', 'Nouvelle': 'nouvelle', 'Tranchée': 'tranchee', 'Validée': 'validee' }

  function tarifAtelier() {
    const g = gabaritCourant()
    if (g === 'court') return { cle: 'L1', certain: true }
    if (g === 'long') return { cle: 'L2', certain: true }
    if (g === 'moyen') return { cle: 'L1', certain: true }
    return { cle: 'L1', certain: false }
  }
  function lignesImposees() {
    if (etat.montage !== 'atelier') return []
    const t = tarifAtelier()
    return C.options
      .filter((o) => o.impose_atelier && o.statut !== 'Retiré')
      .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))
      .map((o) => ({ nom: o.nom, montant: t.cle === 'L2' && typeof o.prix_l2 === 'number' ? o.prix_l2 : o.prix_ttc, cle: t.cle, certain: t.certain }))
  }

  function preparer(C) {
    C.vehicules = C.vehicules.filter((v) => v.statut !== 'Retiré')
    for (const v of C.vehicules) v.universel = !!v.kit_universel
    for (const o of C.options) {
      o.montage_requis = o.montage === 'Atelier uniquement' ? 'atelier' : null
      o.inclus_atelier = o.montage === 'Inclus en atelier'
      o.impose_atelier = o.montage === 'Imposé en atelier'
      o.motif_inclus = o.motif_si_inclus || null
      o.alerte = o.note_client || null
      if (typeof o.prix_best === 'number') o.prix_finition = { ST: o.prix_ttc, BT: o.prix_best }
      if (o.versions_multiples) {
        o.multi = o.versions_multiples.split('|').map((x) => x.trim()).filter(Boolean).map((x) => {
          const m = x.match(/^(.*?)\s*=\s*([\d.,]+)\s*(?:\[(si|hors):([^\]]+)\])?\s*$/)
          if (!m) return null
          const val = { v: m[1].trim(), prix: Number(m[2].replace(',', '.')) }
          if (m[3]) val[m[3]] = m[4].trim()
          return val
        }).filter(Boolean)
      }
      if (o.variantes && o.variantes.includes('|')) {
        const valeurs = o.variantes.split('|').map((x) => x.trim()).filter(Boolean).map((x) => {
          const m = x.match(/^(.*?)\s*=\s*([\d.,]+)\s*(?:\/\s*([\d.,]+))?\s*$/)
          if (!m) return { v: x }
          const val = { v: m[1].trim(), prix: Number(m[2].replace(',', '.')) }
          if (m[3]) val.prix_bt = Number(m[3].replace(',', '.'))
          return val
        })
        o.choix = { cle: 'v_' + o.id.slice(-8), libelle: o.choix_titre || 'Version', valeurs }
        o.nom_court = o.nom.split(' (')[0]
        o.variantes = ''
      }
    }
    for (const r of C.regles) {
      r.maj = MAJ_PAR_REVISION[r.revision] || null
      if (r.ancienne_formulation && ['corrigee', 'tranchee', 'reformulee'].includes(r.maj)) REGLES_CORRIGEES[r.id] = r.ancienne_formulation
      r.statut = r.statut === 'Validé' ? (r.maj === 'tranchee' ? 'Tranché Willy' : 'Validé Willy') : 'À revalider Willy'
    }
    for (const o of C.options) o.kits_compatibles = (o.kits_compatibles || []).map((k) => k === 'Combi T2-T3' ? 'Combi' : k)
    C.grillePrix = {}
    for (const g of C.grille || []) {
      if (g.statut === 'Retiré') continue
      const groupe = g.groupe === 'Kit universel' ? 'universel' : g.groupe
      const gab = g.longueur === 'Court' ? 'court' : g.longueur === 'Toutes' ? 'toutes' : 'long'
      ;(((C.grillePrix[groupe] ??= {})[gab] ??= {})[g.kit] ??= {})[g.finition] = g.prix_ttc
    }
  }

  function grilleKit() {
    const v = vehicule(), g = gabaritCourant()
    if (!v || !C.grillePrix) return null
    if (v.universel) return C.grillePrix.universel?.[g] || null
    if (v.kits.includes('Combi')) return C.grillePrix.Combi?.toutes || null
    return v.plateforme_code === 'X82' ? (C.grillePrix.X82?.[g] || null) : null
  }
  function prixKit(codeKit, codeFinition) {
    const gr = grilleKit()
    if (gr) {
      const p = gr[codeKit]?.[codeFinition]
      return { prix: typeof p === 'number' ? p : null, source: 'boutique', dispo: typeof p === 'number' }
    }
    const f = C.finitions.find((x) => x.code === codeFinition)
    return { prix: f ? f.prix_ttc : null, source: 'maquette', dispo: true }
  }

  function prixOption(o) {
    const best = etat.finition === 'Best'
    const long = gabaritCourant() === 'long'
    const vh = vehicule()
    if (o.multi) {
      const dispo = versionsMulti(o)
      const sel = dispo.filter((x) => (etat.attributs['m_' + o.id] || []).includes(x.v))
      return sel.length ? sel.reduce((t, x) => t + x.prix, 0) : Math.min(...dispo.map((x) => x.prix))
    }
    if (typeof o.prix_vw_t5 === 'number' && vh && /T5/.test(vh.modele)) return o.prix_vw_t5
    const prixChoix = o.choix ? o.choix.valeurs.filter((x) => typeof x.prix === 'number') : []
    if (prixChoix.length) {
      const prixDe = (x) => (best && typeof x.prix_bt === 'number') ? x.prix_bt : x.prix
      const sel = prixChoix.find((x) => x.v === etat.attributs[o.choix.cle])
      return sel ? prixDe(sel) : Math.min(...prixChoix.map(prixDe))
    }
    const num = (x) => typeof x === 'number'
    if (best && long && num(o.prix_best_l2)) return o.prix_best_l2
    if (best && num(o.prix_best)) return o.prix_best
    if (long && num(o.prix_l2)) return o.prix_l2
    return o.prix_ttc
  }
  function versionsMulti(o) {
    const vh = vehicule()
    const est = (tag) => vh && (tag === 'Ford' ? vh.marque === 'Ford' : tag === 'T5' ? /T5/.test(vh.modele) : false)
    return (o.multi || []).filter((x) => (!x.si || est(x.si)) && (!x.hors || !est(x.hors)))
  }

  const euros = (n) => (typeof n === 'number' && isFinite(n))
    ? n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
    : null

  const vehicule = () => C.vehicules.find((v) => v.id === etat.vehiculeId) ?? null
  const finition = () => C.finitions.find((f) => f.code === etat.finition) ?? null
  const kit = () => C.kits.find((k) => k.code === etat.kit) ?? null
  const nomKit = (x) => x ? (vehicule()?.universel ? `${x.nom} universel` : x.nom) : ''

  function gabaritCourant() {
    const v = vehicule()
    if (!v || !etat.longueur) return null
    return v.longueurs.find((l) => l.etiquette === etat.longueur)?.gabarit ?? null
  }
  const optionService = (ordre) =>
    C.options.find((o) => o.section === SECTION_SERVICES && o.ordre === ordre) ?? null
  const optMontage = () => optionService(1)
  const optVasp = () => optionService(2)

  function disponibilite(o) {
    const v = vehicule()
    const g = gabaritCourant()
    if (o.kits_compatibles.length && etat.kit && !o.kits_compatibles.includes(etat.kit)) {
      return { etat: 'masque' }
    }
    if (o.finitions_requises.length && etat.finition && !o.finitions_requises.includes(etat.finition)) {
      return { etat: 'bloque', motif: o.motif_si_non_disponible || `Nécessite la finition ${o.finitions_requises.join(' ou ')}.`, regles: o.regles }
    }
    if (o.longueurs_compatibles.length && g && !o.longueurs_compatibles.includes(g)) {
      const base = o.motif_si_non_disponible || 'Cette option demande une autre longueur de véhicule.'
      return { etat: 'bloque', motif: `${base} Votre véhicule est un ${etat.longueur}.`, regles: o.regles }
    }
    if (o.plateformes_requises.length) {
      const code = v?.plateforme_code
      if (!code || !o.plateformes_requises.includes(code)) {
        const base = o.motif_si_non_disponible || `Réservé aux plateformes ${o.plateformes_requises.join(', ')}.`
        const dit = v ? ` Votre véhicule est sur ${v.plateforme || 'une plateforme non tracée'}.` : ''
        return { etat: 'bloque', motif: base + dit, regles: o.regles }
      }
    }
    for (const idDep of o.depend_de) {
      if (!etat.options[idDep]) {
        const dep = parId.get(idDep)
        const base = o.motif_si_non_disponible || 'Une autre option est nécessaire avant celle-ci.'
        return { etat: 'bloque', motif: `${base} (${dep ? dep.nom : 'option inconnue'} n'est pas coché.)`, regles: o.regles }
      }
    }
    if (o.montage_requis === 'atelier' && etat.montage !== 'atelier') {
      return { etat: 'bloque', motif: "Posée uniquement par l'atelier Kapam : disponible avec la formule clé en main, en bas de page.", regles: o.regles }
    }
    if (o.inclus_atelier && etat.montage === 'atelier') {
      return { etat: 'inclus', motif: o.motif_inclus || "Déjà compris dans les postes ajoutés d'office avec le montage à l'atelier.", regles: o.motif_inclus ? o.regles : [ID.rAtelier] }
    }
    for (const idInc of o.incompatible_avec) {
      if (etat.options[idInc]) {
        const inc = parId.get(idInc)
        const base = o.motif_si_non_disponible || 'Cette option est incompatible avec une option déjà retenue.'
        return { etat: 'bloque', motif: `${base} (${inc ? inc.nom : 'option inconnue'} est coché.)`, regles: o.regles }
      }
    }
    return { etat: 'ok' }
  }

  function nettoyerSelections() {
    if (etat.kit && etat.finition && vehicule() && !prixKit(etat.kit, etat.finition).dispo) etat.finition = null
    if (etat.finition !== 'Best' && /^DESIGN [234]$/.test(etat.attributs.stratifie || '')) etat.attributs.stratifie = ''
    if (etat.montage !== 'atelier') etat.vasp = false
    if (!etat.options[ID_BICOLORE] || etat.finition !== 'Best') etat.attributs.stratifie2 = ''
    let change
    do {
      change = false
      for (const id of Object.keys(etat.options)) {
        const o = parId.get(id)
        if (!o) { delete etat.options[id]; change = true; continue }
        if (['bloque', 'masque'].includes(disponibilite(o).etat)) { delete etat.options[id]; change = true }
      }
    } while (change)
  }

  function paliersMontage() {
    const m = optMontage()
    if (!m || !m.paliers_de_prix) return []
    return m.paliers_de_prix.split('|').map((x) => x.trim()).map((x) => {
      const r = x.match(/^(\d+)\s*(?:-\s*(\d+)|\+)\s*=\s*([\d.,]+)$/)
      return r ? { min: Number(r[1]), max: r[2] ? Number(r[2]) : Infinity, prix: Number(r[3].replace(',', '.')) } : null
    }).filter(Boolean)
  }
  function palierMontage(base) {
    const paliers = paliersMontage()
    const p = paliers.find((x) => base <= x.max) || paliers[paliers.length - 1]
    if (!p) return { prix: optMontage().prix_ttc, libelle: 'à partir de' }
    const libelle = p.max === Infinity ? `commande au-delà de ${euros(p.min)}` : p.min === 0 ? `commande jusqu'à ${euros(p.max)}` : `commande de ${euros(p.min)} à ${euros(p.max)}`
    return { prix: p.prix, libelle }
  }

  function devis() {
    const lignes = []
    const f = finition(), k = kit()
    if (k && f) {
      lignes.push({ libelle: `Prix du kit — ${nomKit(k)} · ${f.nom}${etat.longueur ? ' · ' + etat.longueur : ''}`, montant: prixKit(k.code, f.code).prix })
    }
    let indexMontage = -1
    if (etat.montage === 'atelier') {
      if (optMontage()) { indexMontage = lignes.length; lignes.push(null) }
    }
    if (etat.vasp) {
      const w = optVasp()
      if (w) lignes.push({ libelle: w.nom, montant: w.prix_ttc })
    }
    for (const o of C.options) {
      if (o.section === SECTION_SERVICES) continue
      if (!etat.options[o.id]) continue
      if (['bloque', 'masque', 'inclus'].includes(disponibilite(o).etat)) continue
      const multi = o.multi ? versionsMulti(o).filter((x) => (etat.attributs['m_' + o.id] || []).includes(x.v)).map((x) => x.v) : []
      const variante = multi.length ? ` — ${multi.join(', ')}`
        : o.choix && etat.attributs[o.choix.cle] ? ` — ${etat.attributs[o.choix.cle]}` : ''
      lignes.push({ libelle: (variante && o.nom_court ? o.nom_court : o.nom) + variante, montant: prixOption(o), id: o.id })
    }
    const strat = etat.attributs.stratifie || ''
    if (/^DESIGN [234]$/.test(strat)) lignes.push({ libelle: `Stratifié ${strat} — supplément`, montant: null })
    const strat2 = etat.attributs.stratifie2 || ''
    if (/^DESIGN [234]$/.test(strat2)) lignes.push({ libelle: `Deuxième stratifié ${strat2} — supplément`, montant: null })
    if (etat.attributs.literie === 'Velours') lignes.push({ libelle: 'Housses literie velours', montant: 100 })
    if (indexMontage >= 0) {
      const vasp = etat.vasp && optVasp() ? optVasp().prix_ttc : 0
      const finitions = lignesImposees().reduce((t, x) => t + x.montant, 0)
      const base = lignes.reduce((s, l) => s + (l && typeof l.montant === 'number' ? l.montant : 0), 0) - vasp + finitions
      const p = palierMontage(base)
      lignes[indexMontage] = {
        libelle: `Pose atelier clé en main — montage ${euros(p.prix)} (${p.libelle}) + finitions comprises ${euros(finitions)}`,
        montant: p.prix + finitions,
      }
    }
    const total = lignes.reduce((s, l) => s + (typeof l.montant === 'number' ? l.montant : 0), 0)
    const incomplet = lignes.some((l) => typeof l.montant !== 'number')
    return { lignes, total, incomplet }
  }
  /* ---------- fin de la copie ---------- */

  preparer(C)
  for (const o of C.options) parId.set(o.id, o)

  return {
    C,
    /** Applique nettoyerSelections() puis devis(), comme rendre() dans le prototype. */
    calculer(etatProto) {
      etat = structuredClone(etatProto)
      nettoyerSelections()
      return { etat, devis: devis(), grille: !!grilleKit() }
    },
  }
}
