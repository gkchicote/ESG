import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getLessonForProfile } from "@/lib/db/queries";
import { presignR2Get } from "@/lib/r2";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
};

/**
 * Entrega o vídeo da aula depois de conferir a matrícula do aluno.
 *
 * Dois caminhos, decididos por `video_provider`:
 *
 * - `r2` (produção) — devolve 302 para uma URL assinada e de vida curta. O MP4
 *   viaja do Cloudflare direto para o aluno, sem consumir banda do servidor. O
 *   navegador reemite o `Range` na URL de destino, então arrastar a linha do
 *   tempo continua funcionando.
 * - `file` (desenvolvimento) — lê de content/videos e faz o streaming aqui
 *   mesmo, implementando `Range` na mão.
 *
 * A checagem de acesso é a mesma nos dois: `getLessonForProfile` só devolve a
 * aula se houver matrícula, e é ela que autoriza a assinatura.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const session = await getSession();
  if (!session) return new NextResponse("Não autenticado", { status: 401 });

  const { lessonId } = await params;
  const lesson = await getLessonForProfile(session.sub, lessonId);
  if (!lesson || !lesson.video_id) {
    return new NextResponse("Vídeo não encontrado", { status: 404 });
  }

  if (lesson.video_provider === "r2") {
    const signed = presignR2Get(lesson.video_id);
    if (!signed) {
      return new NextResponse("Hospedagem de vídeo não configurada", { status: 503 });
    }
    // O link é assinado a cada requisição; guardá-lo em cache o faria vazar
    // para outro aluno e ainda expirar no meio da aula.
    return NextResponse.redirect(signed, {
      status: 302,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  if (lesson.video_provider !== "file") {
    return new NextResponse("Vídeo não encontrado", { status: 404 });
  }

  const safeName = path.basename(lesson.video_id);
  const filePath = path.join(process.cwd(), "content", "videos", safeName);
  if (!fs.existsSync(filePath)) {
    return new NextResponse("Arquivo de vídeo indisponível", { status: 404 });
  }

  const { size } = await fs.promises.stat(filePath);
  const contentType = MIME[path.extname(safeName).toLowerCase()] ?? "application/octet-stream";
  const range = request.headers.get("range");

  const baseHeaders = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=0, no-store",
  };

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
