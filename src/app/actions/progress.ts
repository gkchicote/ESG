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

  const completion = await saveProgress(session.sub, lessonId, seconds, completed);
  await touchEnrollment(session.sub, lesson.course_id, lessonId);

  if (completion?.ok) {
    revalidatePath("/inicio");
    revalidatePath("/modulos");
    revalidatePath("/progresso");
    revalidatePath(`/aula/${lessonId}`);
  }

  // `completion` só vem preenchido quando a conclusão foi pedida. Ele diz se
  // ela valeu (com a ofensiva do dia) ou quanto ainda falta assistir — a tela
  // da aula precisa dos dois casos, e sem uma segunda ida ao banco.
  return { ok: true as const, completion };
}

/** Marcar/desmarcar manualmente uma aula como concluída. */
export async function toggleLessonCompleted(lessonId: string, completed: boolean) {
  const session = await requireSession();

  const lesson = await getLessonForProfile(session.sub, lessonId);
  if (!lesson) return { ok: false as const };

  const completion = await setLessonCompleted(session.sub, lessonId, completed);
  await touchEnrollment(session.sub, lesson.course_id, lessonId);

  revalidatePath("/inicio");
  revalidatePath("/modulos");
  revalidatePath("/progresso");
  revalidatePath(`/aula/${lessonId}`);

  // Pedido de marcar que não passou na verificação: a aula continua em aberto,
  // e `completed` volta false para a tela desfazer o check otimista.
  const applied = completed ? (completion?.ok ?? false) : false;
  return { ok: true as const, completed: applied, completion };
}
