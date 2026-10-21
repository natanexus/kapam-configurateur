/* État persistant : localStorage, 30 jours, synchronisé entre onglets. */
import { CLE_STOCKAGE, DUREE_STOCKAGE_JOURS } from './config.js'
import { etatVide } from './regles.js'

const stockage = () => { try { return globalThis.localStorage } catch { return null } }

/** Lit l'état enregistré, ou un état vide s'il manque, est périmé ou illisible. */
export function charger(maintenant = Date.now()) {
  try {
    const brut = stockage()?.getItem(CLE_STOCKAGE)
    if (!brut) return etatVide()
    const { etat, maj } = JSON.parse(brut)
    if (!etat || !maj || maintenant - maj > DUREE_STOCKAGE_JOURS * 86400e3) return etatVide()
    return { ...etatVide(), ...etat, attributs: { ...etatVide().attributs, ...(etat.attributs ?? {}) } }
  } catch {
    return etatVide()
  }
}

export function sauver(etat, maintenant = Date.now()) {
  try { stockage()?.setItem(CLE_STOCKAGE, JSON.stringify({ etat, maj: maintenant })) } catch { /* stockage indisponible */ }
}

export function effacer() {
  try { stockage()?.removeItem(CLE_STOCKAGE) } catch { /* ignoré */ }
}

/** Appelle `cb(etat)` quand un autre onglet modifie la configuration. Renvoie la fonction de désabonnement. */
export function surChangement(cb) {
  const f = (ev) => { if (ev.key === CLE_STOCKAGE) cb(charger()) }
  globalThis.addEventListener?.('storage', f)
  return () => globalThis.removeEventListener?.('storage', f)
}
