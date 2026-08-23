"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { setUserEnrollment } from "@/lib/db/queries";
import { syncCurriculum } from "@/lib/db/sync-curriculum";

export type ContentActionState = { error?: string; success?: string };

/**
 * Publica o catálogo (src/lib/db/catalog.ts) no banco desta instalação.
 *
 * O seed só popula banco criado do zero, então num deploy com DATABASE_URL o
 * curso precisa ser publicado uma vez por aqui — e de novo a cada módulo ou
 * aula que você acrescentar ao catálogo.
 */
export async function publishCatalog(): Promise<ContentActionState> {
  await requireAdmin();

  try {
    const summary = await syncCurriculum();
    revalidatePath("/admin");
    revalidatePath("/modulos");
    revalidatePath("/inicio");

    const parts = [
      `${summary.modules} módulos e ${summary.lessons} aulas em "${summary.courseTitle}"`,
      summary.courseCreated ? "curso criado" : null,
      summary.created ? `${summary.created} aulas novas` : null,
      summary.removed ? `${summary.removed} removidas` : null,
    ].filter(Boolean);

    return { success: `Catálogo publicado: ${parts.join(" · ")}.` };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível publicar o catálogo.",
    };
  }
}

/** Matricula o aluno no curso — ou tira o acesso, quando `courseId` é null. */
export async function setUserCourse(
  userId: string,
  courseId: string | null,
): Promise<ContentActionState> {
  await requireAdmin();

  try {
    await setUserEnrollment(userId, courseId);
    revalidatePath("/admin");
    return { success: courseId ? "Curso liberado." : "Acesso removido." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível salvar a matrícula.",
    };
  }
}
