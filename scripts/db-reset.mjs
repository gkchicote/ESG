/** Apaga o banco local (PGlite). O próximo `npm run dev` recria e popula. */
import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), ".data", "pglite");
fs.rmSync(dir, { recursive: true, force: true });
console.log("✓ Banco local removido. Rode `npm run dev` para recriar com os dados de exemplo.");
