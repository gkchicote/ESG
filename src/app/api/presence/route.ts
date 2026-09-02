import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { updatePresence } from "@/lib/db/queries";

export const runtime = "nodejs";

const Body = z.object({ status: z.enum(["available", "busy", "offline"]) });

/**
 * Batimento de presença: "ainda estou aqui, e é isto que estou fazendo".
 *
 * Rota, e não Server Action, pelo mesmo motivo de /api/progress: o aviso de
 * saída sai por `navigator.sendBeacon` quando a aba fecha, e uma action seria
 * abortada junto com a página.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return new NextResponse(null, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 400 });

  await updatePresence(session.sub, parsed.data.status);

  return new NextResponse(null, { status: 204 });
}
