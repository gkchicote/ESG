import type { Lesson, ModuleWithLessons } from "@/lib/db/queries";

/** Abaixo disso a aula conta como "não começada" — não faz sentido retomar. */
export const RESUME_AFTER_SECONDS = 10;

export type LessonLocation = {
  lesson: Lesson;
  module: ModuleWithLessons;
  /** Índice 1-based da aula dentro do curso inteiro. */
  index: number;
  total: number;
};

/** Achata o currículo preservando a ordem módulo → aula. */
export function flattenCurriculum(modules: ModuleWithLessons[]): LessonLocation[] {
  const flat: LessonLocation[] = [];
  for (const mod of modules) {
    for (const lesson of mod.lessons) {
      flat.push({ lesson, module: mod, index: flat.length + 1, total: 0 });
    }
  }
  return flat.map((item) => ({ ...item, total: flat.length }));
}

/**
 * Onde o aluno deve continuar:
 *   1. a última aula acessada, se ainda não concluída;
 *   2. senão, a primeira aula não concluída do curso;
 *   3. senão (curso completo), a última aula.
 */
export function resolveContinueLesson(
  modules: ModuleWithLessons[],
  lastLessonId: string | null,
): LessonLocation | null {
  const flat = flattenCurriculum(modules);
  if (flat.length === 0) return null;

  if (lastLessonId) {
    const last = flat.find((f) => f.lesson.id === lastLessonId);
    if (last && !last.lesson.completed) return last;
  }

  return flat.find((f) => !f.lesson.completed) ?? flat[flat.length - 1];
}

export function findLesson(
  modules: ModuleWithLessons[],
  lessonId: string,
): LessonLocation | null {
  return flattenCurriculum(modules).find((f) => f.lesson.id === lessonId) ?? null;
}

export function neighbours(modules: ModuleWithLessons[], lessonId: string) {
  const flat = flattenCurriculum(modules);
  const i = flat.findIndex((f) => f.lesson.id === lessonId);
  return {
    previous: i > 0 ? flat[i - 1] : null,
    next: i >= 0 && i < flat.length - 1 ? flat[i + 1] : null,
  };
}
