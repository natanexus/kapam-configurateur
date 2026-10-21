# Modèles 3D

| Fichier | Source | Traitement |
|---|---|---|
| `kit-travel.glb` | GLB incorporé dans le prototype HTML (kit de Willy, Blender 4.2, 4,1 Mo, sans texture) | `gltf-transform dedup → prune → weld → meshopt --level medium` (765 Ko) |

URL servie : `https://cdn.jsdelivr.net/gh/natanexus/kapam-configurateur@<commit>/assets/kit-travel.glb`, à renseigner dans le champ « GLB » du kit (CMS Webflow).
Les pièces des options sont encore reliées par nom (voir `src/3d-correspondance.js`) : à regrouper dans Blender sous des vides `opt-<slug>`.
