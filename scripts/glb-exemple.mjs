/* Fabrique un petit GLB de test : un meuble « bois » + un objet vide opt-frigo contenant une boîte. Usage : node scripts/glb-exemple.mjs sortie.glb */
import { Document, NodeIO } from '@gltf-transform/core'
import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export async function fabriquer(nomVide = 'opt-frigo') {
const doc = new Document()
const buffer = doc.createBuffer()
const scene = doc.createScene('kit')
function boite(nom, matNom, [sx, sy, sz], [x, y, z]) {
  const p = [], idx = []
  const c = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]
  for (const [a, b, d] of c) p.push(a * sx / 2 + x, b * sy / 2 + y, d * sz / 2 + z)
  idx.push(0,1,2, 0,2,3, 4,6,5, 4,7,6, 0,4,5, 0,5,1, 1,5,6, 1,6,2, 2,6,7, 2,7,3, 3,7,4, 3,4,0)
  const pos = doc.createAccessor().setType('VEC3').setArray(new Float32Array(p)).setBuffer(buffer)
  const ind = doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(idx)).setBuffer(buffer)
  const mat = doc.createMaterial(matNom).setBaseColorFactor([1, 1, 1, 1])
  const prim = doc.createPrimitive().setAttribute('POSITION', pos).setIndices(ind).setMaterial(mat)
  return doc.createNode(nom).setMesh(doc.createMesh(nom).addPrimitive(prim))
}
scene.addChild(boite('Meuble', 'bois', [2, 1, 0.6], [0, 0.5, 0]))
const frigo = doc.createNode(nomVide)
frigo.addChild(boite('Frigo corps', 'brut', [0.5, 0.5, 0.5], [0.6, 0.25, 0.4]))
scene.addChild(frigo)
scene.addChild(boite('Evier', 'ceramic_53_basecolor-4K', [0.4, 0.1, 0.4], [-0.6, 1.05, 0]))
return new NodeIO().writeBinary(doc)
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && process.argv[2]) writeFileSync(process.argv[2], await fabriquer())
