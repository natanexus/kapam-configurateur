/**
 * Correspondance de secours entre les options et les objets du GLB actuel (kit de Willy, nommage Blender d'origine).
 * Reprise du prototype (28/09/2026). Elle ne sert que si le modèle n'a pas d'objet vide « opt-<slug> » :
 * dès que les pièces sont regroupées dans Blender sous ces vides, cette table devient inutile.
 *
 * Clé = nom de l'option tel qu'il est dans le CMS ; « =Nom » impose un nom exact, sinon c'est un préfixe.
 */
export const CORRESPONDANCE_PAR_NOM = {
  'Frigo Vitrifrigo c51i': ['=Frigo'],
  'Frigo WAECO NRX50': ['WAECO'],
  'Plaque induction 1 foyer': ['Plaque a induction'],
  'Évier bol rond + bonde': ['Evier'],
  'Pack douchette 40L': ['Pommeau de douche', 'Support douche'],
  'WC Chimique': ['PoWC', 'Porte WC'],
  'Pack Éclairage LED': ['Spot Led'],
  'Pack Prise EXT 230V': ['Prise camping'],
  'Pack Convertisseur 12v→220v': ['12V-24V'],
  'Meuble haut 2 placards': ['porte Meuble Haut', '=M1', '=M2#1', '=M5', '=M6#1', '=M7',
    ...[141, 145, 146, 147, 151, 152, 153, 154, 156, 157, 159, 160, 161, 163, 164, 165, 167, 168, 169, 170, 172, 173, 174, 175,
      177, 178, 180, 181, 182, 184, 185, 186, 188, 189, 190, 191, 193, 195, 196, 197, 198, 200, 201, 203, 204, 205, 207, 208, 209,
      211, 212, 213, 214, 216, 217, 218, 219, 221, 222, 224, 225, 226, 228, 229, 230, 232, 233, 234, 235, 237, 238, 239, 240, 242,
      243, 245, 246, 247, 249, 250, 251, 253, 254, 255, 256, 258, 260, 261, 262, 263, 265, 266, 268, 269, 270, 272, 273, 274, 276,
      277, 278, 279].map((n) => `=G-No Name ${n}`)],
  'Tablette cuisine': ['Coupelle de table', '=Barre'],
  'Plancher Superpan H-Deck 12mm': ['=Plancher'],
}

/**
 * Matériaux du GLB dont la couleur suit la finition choisie (bois).
 * Le prototype ne teintait que « bois », « 1er strat » et « brut blender » (2 pièces dans le GLB actuel) ;
 * « brut » (119 pièces, tout le mobilier) y restait beige. Ici le mobilier entier suit la finition : à valider avec Willy.
 */
export const MATERIAUX_BOIS = ['bois', '1er strat', 'brut blender', 'brut']

/** Couleurs à plat des autres matériaux (le modèle est livré sans texture). */
export const TEINTES_MATERIAUX = {
  Fabric074_4K_Color: '#b3ad52',        // coussins
  'ceramic_53_basecolor-4K': '#9c958a', // sol
}
