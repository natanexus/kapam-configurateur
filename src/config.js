/* Ce qui n'est pas (encore) dans le CMS. Tout le reste vient des collections Config ·. */

/** Slugs d'options lus par le code (signalés « ne pas modifier » dans le CMS). */
export const SLUG_MONTAGE = 'montage-atelier'
export const SLUG_VASP = 'homologation-vasp'
export const SLUG_BICOLORE = 'mobilier-bicolore'
export const SLUG_DECO_SOL = 'decoration-plancher'

/** Plateforme dont le prix « Prix VW T5-T6 » s'applique. */
export const PLATEFORME_VW_T5 = 'vw-t5'

/** Sections de l'étape 2.1, dans l'ordre (clé = nom de l'option CMS « Section » en slug). */
export const SECTION_SERVICES = 'services-montage'
export const SECTIONS = [
  'options-du-kit',
  'vitrage-isolation-aeration',
  'parois-plafond-plancher',
  'electricite',
  'mise-en-eau',
  'wc-electromenager',
  'chauffage',
  'accessoires',
]

/**
 * Nuanciers (en attendant une collection quand Willy fournira références et photos).
 * prix : 0 = inclus, nombre = supplément, null = prix inconnu → gamme masquée.
 */
export const GAMMES_STRATIFIE = [
  { slug: 'design-1', nom: 'DESIGN 1', prix: 0, teinte: '#e9e4da' },
  { slug: 'design-2', nom: 'DESIGN 2', prix: null, teinte: '#cdbba0' },
  { slug: 'design-3', nom: 'DESIGN 3', prix: null, teinte: '#8f8577' },
  { slug: 'design-4', nom: 'DESIGN 4', prix: null, teinte: '#4b4843' },
]
export const HOUSSES = [
  { slug: 'tissu', nom: 'Tissu', prix: 0, teinte: '#b9b3a8' },
  { slug: 'velours', nom: 'Velours', prix: 100, teinte: '#6f5f59' },
]

/** Étapes de la page Webflow, dans l'ordre (valeur de data-etape). */
export const ETAPES = ['1.1', '1.2', '1.3', '2.1', '3.1', '3.2']

/** Textes de l'interface qui dépendent de l'état (le reste est écrit dans le Designer). */
export const TEXTES = {
  situations: { 'je-lai-deja': 'Véhicule déjà acheté', 'je-sais-lequel': 'Véhicule choisi, pas encore acheté', 'pas-encore': 'Pas encore de véhicule' },
  demandes: { conseil: 'Conseil (pas encore de véhicule)', 'sur-mesure': 'Étude sur mesure (véhicule hors liste)', devis: 'Devis de configuration' },
  contact: {
    devis: ['Vos coordonnées.', "Votre configuration est enregistrée. Dites-nous où vous joindre : l'atelier vous répond sous 48 h ouvrées avec un devis chiffré."],
    conseil: ['Parlons de votre projet.', "Dites-nous où vous joindre : un conseiller Kapam vous aide à choisir le véhicule et l'aménagement adaptés à votre usage."],
    'sur-mesure': ['Étude de votre véhicule.', "Dites-nous où vous joindre, et précisez le modèle et l'année dans le message : l'atelier étudie votre véhicule et revient vers vous avec les kits possibles."],
  },
  prixACompleter: 'prix à compléter',
  mention: 'Prix indicatif. Devis personnalisé sous 48h.',
}

/** Teintes de secours si le champ CMS « Teinte » est vide (valeurs du prototype). */
export const TEINTES_FINITION = { soft: '#dcb584', triply: '#cfa163', best: '#8e6c4b' }

/** Clé localStorage (partagée avec le drawer « Mon devis »). Changer la version invalide les anciens états. */
export const CLE_STOCKAGE = 'kapam.config.v1'
export const DUREE_STOCKAGE_JOURS = 30
