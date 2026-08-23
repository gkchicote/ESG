import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { getLessonForProfile, saveProgress, touchEnrollment } from "@/lib/db/queries";

export const runtime = "nodejs";

const Body = z.object({
  lessonId: z.string().uuid(),
  seconds: z.number().min(0).max(60 * 60 * 24),
});

/**
 * Gravação final da posição do vídeo.
 *
 * Existe separado das Server Actions porque é chamado via `navigator.sendBeacon`
 * quando a aba é fechada ou o aluno navega para outra aula — nesse momento uma
 * Server Action seria abortada junto com a página.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return new NextResponse(null, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 400 });

  const lesson = await getLessonForProfile(session.sub, parsed.data.lessonId);
  if (!lesson) return new NextResponse(null, { status: 404 });

  await saveProgress(session.sub, parsed.data.lessonId, parsed.data.seconds);
  await touchEnrollment(session.sub, lesson.course_id, parsed.data.lessonId);

  return new NextResponse(null, { status: 204 });
}
