/* Formats d'affichage : euros, pluriels, libellés des lignes du devis. */
import { num } from './regles.js'
import { TEXTES } from './config.js'

/** 2495 → « 2 495 € », 49.9 → « 49,90 € », null → null. */
export const euros = (n) => (num(n)
  ? n.toLocaleString('fr-FR', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }).replace(/[\u202f\u00a0 ]/g, '\u00a0') + '\u00a0€'
  : null)

/** Même chose, avec le texte « prix à compléter » quand le montant est inconnu. */
export const eurosOu = (n) => euros(n) ?? TEXTES.prixACompleter

export const pluriel = (n, mot, pl = mot + 's') => `${n} ${n > 1 ? pl : mot}`

/** Libellé d'un palier de montage : « pour un aménagement jusqu'à 6 000 € ». */
export function libellePalier(p) {
  if (!p || p.min == null) return 'selon le montant de l\'aménagement'
  if (p.max === Infinity || p.max == null) return `pour un aménagement au-delà de ${euros(p.min)}`
  if (!p.min) return `pour un aménagement jusqu'à ${euros(p.max)}`
  return `pour un aménagement de ${euros(p.min)} à ${euros(p.max)}`
}

/** Phrase des paliers : « Montage 1 850 € jusqu'à 6 000 €, 2 000 € jusqu'à 8 000 €, 2 200 € au-delà. » */
export function phrasePaliers(paliers) {
  if (!paliers.length) return ''
  const bouts = paliers.map((p, i) => (i === paliers.length - 1 && p.max === Infinity
    ? `${euros(p.prix)} au-delà` : `${euros(p.prix)} jusqu'à ${euros(p.max)}`))
  return `Montage ${bouts.join(', ')} d'aménagement.`
}

/** Libellé d'une ligne du devis (regles.devis renvoie des lignes structurées). */
export function libelleLigne(l) {
  switch (l.type) {
    case 'kit': return `Prix du kit — ${l.nomKit} · ${l.nomFinition}${l.longueur ? ' · ' + l.longueur : ''}`
    case 'montage': return `Pose atelier clé en main — montage ${eurosOu(l.montantPose)} (${libellePalier(l.palier)}) + finitions comprises ${eurosOu(l.montantPostes)}`
    case 'vasp': return l.nom
    case 'option': return l.nom + (l.versions?.length ? ` — ${l.versions.join(', ')}` : '')
    case 'stratifie': return `Stratifié ${l.nom} — supplément`
    case 'stratifie2': return `Deuxième stratifié ${l.nom} — supplément`
    case 'literie': return `Housses literie ${l.nom.toLowerCase()}`
    default: return l.nom ?? ''
  }
}

/** Récapitulatif en texte, pour le champ caché du formulaire et l'e-mail. */
export function recapTexte(d) {
  const lignes = d.lignes.map((l) => `${libelleLigne(l)} : ${eurosOu(l.montant)}`)
  lignes.push(`Total indicatif TTC : ${eurosOu(d.total)}${d.incomplet ? ' (incomplet)' : ''}`)
  return lignes.join('\n')
}
