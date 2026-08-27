import fs from "node:fs";
import path from "node:path";

/**
 * Arquivos de material servidos do disco (content/).
 *
 * `materials.storage_path` guarda o caminho **relativo a content/** —
 * "materials/jack-hannaford-01/texto.pdf". Um nome solto, sem barra, é o
 * formato antigo (só PDF) e continua valendo como content/pdfs/<nome>.
 */

const CONTENT_DIR = path.join(process.cwd(), "content");

/** Tipo de conteúdo por extensão — o `file_type` do banco é grosso demais. */
export const MATERIAL_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".apkg": "application/octet-stream", // baralho do Anki
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".txt": "text/plain; charset=utf-8",
};

/**
 * Caminho absoluto do arquivo. Devolve null quando o `storage_path` tenta
 * sair de content/ — a linha vem do banco, mas o caminho nunca é confiável.
 */
export function contentFilePath(storagePath: string): string | null {
  const relative = storagePath.includes("/") ? storagePath : path.join("pdfs", storagePath);
  const full = path.resolve(CONTENT_DIR, relative);
  if (full !== CONTENT_DIR && !full.startsWith(`${CONTENT_DIR}${path.sep}`)) return null;
  return full;
}

/** Tamanho em bytes, ou null se o arquivo ainda não está no lugar. */
export function contentFileSize(storagePath: string): number | null {
  const full = contentFilePath(storagePath);
  if (!full || !fs.existsSync(full)) return null;
  return fs.statSync(full).size;
}
