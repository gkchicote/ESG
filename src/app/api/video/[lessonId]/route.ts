import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getLessonForProfile } from "@/lib/db/queries";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
};

/**
 * Streaming com suporte a Range dos MP4 locais (content/videos).
 * É o modo de desenvolvimento: em produção o vídeo sai do Bunny/Cloudflare,
 * e o app só entrega o embed com token.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const session = await getSession();
  if (!session) return new NextResponse("Não autenticado", { status: 401 });

  const { lessonId } = await params;
  const lesson = await getLessonForProfile(session.sub, lessonId);
  if (!lesson || lesson.video_provider !== "file" || !lesson.video_id) {
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
