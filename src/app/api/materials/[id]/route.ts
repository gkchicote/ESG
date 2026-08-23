import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getMaterialForProfile } from "@/lib/db/queries";

export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  zip: "application/zip",
  audio: "audio/mpeg",
};

/**
 * Entrega o material só para quem tem matrícula ativa no curso da aula.
 *
 * No Supabase, troque a leitura de disco por:
 *   supabase.storage.from("materials").createSignedUrl(storage_path, 60)
 * e devolva um redirect para a URL assinada.
 */
export async function GET(
  _request: Request,
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

  // Impede path traversal: só o nome do arquivo é aproveitado.
  const safeName = path.basename(material.storage_path);
  const filePath = path.join(process.cwd(), "content", "pdfs", safeName);

  if (!fs.existsSync(filePath)) {
    return new NextResponse("Arquivo indisponível", { status: 404 });
  }

  const file = await fs.promises.readFile(filePath);
  const downloadName = `${material.title}.${safeName.split(".").pop() ?? "pdf"}`;

  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": CONTENT_TYPES[material.file_type] ?? "application/octet-stream",
      "Content-Length": String(file.byteLength),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
