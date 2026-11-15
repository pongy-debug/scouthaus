// Run with Node's TypeScript stripping: node --experimental-strip-types scripts/export-ruth-model.mjs
import { writeFile } from "node:fs/promises";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { buildRuthHouse } from "../src/lib/hh/ruthModel.ts";

// GLTFExporter uses FileReader for binary buffers; no browser or textures are needed here.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => { this.result = buffer; this.onloadend?.(); });
  }
};
const { root } = buildRuthHouse();
const binary = await new GLTFExporter().parseAsync(root, { binary: true });
await writeFile(new URL("../public/tours/first-ruth-house/first-ruth-house.glb", import.meta.url), Buffer.from(binary));
console.log(`Exported First Ruth House: ${binary.byteLength} bytes`);
