import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getMaterialForProfile } from "@/lib/db/queries";
import { MATERIAL_MIME, contentFilePath } from "@/lib/content-files";
import { presignR2Get } from "@/lib/r2";

export const runtime = "nodejs";

/**
 * Entrega o material só para quem tem matrícula ativa no curso da aula.
 *
 * Dois caminhos, decididos por `storage_provider` (mesma ideia do vídeo em
 * src/app/api/video/[lessonId]/route.ts):
 *
 * - `r2` — 302 para uma URL assinada e de vida curta. `storage_path` é a
 *   chave completa do objeto no bucket, na mesma pasta do vídeo da aula.
 * - `file` (padrão) — lê de content/ e faz o streaming aqui mesmo,
 *   implementando `Range` na mão.
 *
 * O áudio da aula passa por aqui como qualquer outro anexo, com uma diferença:
 * o player precisa poder arrastar a linha do tempo antes do arquivo inteiro
 * chegar, e o Safari só toca o que responde a `Range`. No provider `file` é
 * o streaming parcial abaixo; no `r2`, o navegador reemite o `Range` na URL
 * assinada de destino, então também funciona.
 *
 * No Supabase, troque a leitura de disco (branch `file`) por:
 *   supabase.storage.from("materials").createSignedUrl(storage_path, 60)
 * e devolva um redirect para a URL assinada.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return new NextResponse("Não autenticado", { status: 401 });

  const { id } = await params;
  const material = await getMaterialForProfile(session.sub, id);
  if (!material) return new NextResponse("Material não encontrado", { status: 404 });

  if (material.file_type === "link") {
    return NextResponse.redirect(material.storage_path);
  }

  if (material.storage_provider === "r2") {
    const extension = path.extname(material.storage_path).toLowerCase();
    const downloadName = `${material.title}${extension}`;
    const signed = presignR2Get(material.storage_path, {
      responseContentType: MATERIAL_MIME[extension] ?? "application/octet-stream",
      responseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
    });
    if (!signed) {
      return new NextResponse("Hospedagem de material não configurada", { status: 503 });
    }
    // Assinado a cada requisição: guardá-lo em cache vazaria para outro
    // aluno e ainda expiraria no meio do download ou da escuta.
    return NextResponse.redirect(signed, {
      status: 302,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const filePath = contentFilePath(material.storage_path);
  if (!filePath || !fs.existsSync(filePath)) {
    return new NextResponse("Arquivo indisponível", { status: 404 });
  }

  const extension = path.extname(filePath).toLowerCase();
  const { size } = await fs.promises.stat(filePath);
  const downloadName = `${material.title}${extension}`;

  const baseHeaders = {
    "Content-Type": MATERIAL_MIME[extension] ?? "application/octet-stream",
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
  };

  const range = request.headers.get("range");
  if (!range) {
    const stream = Readable.toWeb(fs.createReadStream(filePath)) as ReadableStream;
    return new NextResponse(stream, {
      headers: { ...baseHeaders, "Content-Length": String(size) },
    });
  }

  const match = /bytes=(\d*)-(\d*)/.exec(range);
  const start = match?.[1] ? Number(match[1]) : 0;
  const end = match?.[2] ? Math.min(Number(match[2]), size - 1) : size - 1;

  if (Number.isNaN(start) || start >= size || start > end) {
    return new NextResponse("Range inválido", {
      status: 416,
      headers: { "Content-Range": `bytes */${size}` },
    });
  }

  const stream = Readable.toWeb(fs.createReadStream(filePath, { start, end })) as ReadableStream;

  return new NextResponse(stream, {
    status: 206,
    headers: {
      ...baseHeaders,
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": String(end - start + 1),
    },
  });
}
