"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import {
  getLessonForProfile,
  saveProgress,
  setLessonCompleted,
  touchEnrollment,
} from "@/lib/db/queries";

/** Salva a posição do vídeo. Chamada periodicamente pelo player. */
export async function saveLessonProgress(
  lessonId: string,
  seconds: number,
  completed?: boolean,
) {
  const session = await requireSession();

  // Confirma que a aula pertence a um curso em que o aluno está matriculado.
  const lesson = await getLessonForProfile(session.sub, lessonId);
  if (!lesson) return { ok: false as const };

  const streak = await saveProgress(session.sub, lessonId, seconds, completed);
  await touchEnrollment(session.sub, lesson.course_id, lessonId);

  if (completed) {
    revalidatePath("/inicio");
    revalidatePath("/modulos");
    revalidatePath("/progresso");
    revalidatePath(`/aula/${lessonId}`);
  }

  // `streak` só vem preenchido na conclusão — é o que a tela da aula usa para
  // celebrar a primeira aula do dia sem precisar de uma segunda ida ao banco.
  return { ok: true as const, streak };
}

/** Marcar/desmarcar manualmente uma aula como concluída. */
export async function toggleLessonCompleted(lessonId: string, completed: boolean) {
  const session = await requireSession();

  const lesson = await getLessonForProfile(session.sub, lessonId);
  if (!lesson) return { ok: false as const };

  const streak = await setLessonCompleted(session.sub, lessonId, completed);
  await touchEnrollment(session.sub, lesson.course_id, lessonId);

  revalidatePath("/inicio");
  revalidatePath("/modulos");
  revalidatePath("/progresso");
  revalidatePath(`/aula/${lessonId}`);

  return { ok: true as const, completed, streak };
}
