import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getMaterialForProfile } from "@/lib/db/queries";
import { MATERIAL_MIME, contentFilePath } from "@/lib/content-files";

export const runtime = "nodejs";

/**
 * Entrega o material só para quem tem matrícula ativa no curso da aula.
 *
 * O áudio da aula passa por aqui como qualquer outro anexo, com uma diferença:
 * o player precisa poder arrastar a linha do tempo antes do arquivo inteiro
 * chegar, e o Safari só toca o que responde a `Range`. Daí o streaming parcial
 * abaixo, no mesmo formato da rota de vídeo.
 *
 * No Supabase, troque a leitura de disco por:
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
