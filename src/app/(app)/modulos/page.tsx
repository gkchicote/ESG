import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { getCurriculum, getEnrolledCourse } from "@/lib/db/queries";
import { resolveContinueLesson } from "@/lib/progress";
import { formatDuration } from "@/lib/format";
import { Progress } from "@/components/ui/progress";
import { progressTone } from "@/lib/progress-tone";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/app/empty-state";
import { CurriculumAccordion } from "./curriculum-accordion";

export const metadata: Metadata = { title: "Módulos" };

export default async function ModulesPage() {
  const session = await requireSession();
  const course = await getEnrolledCourse(session.sub);

  if (!course) {
    return (
      <EmptyState
        title="Nenhum curso liberado ainda"
        description="Assim que sua matrícula for ativada, os módulos aparecem aqui."
      />
    );
  }

  const modules = await getCurriculum(session.sub, course.id);
  const current = resolveContinueLesson(modules, course.last_lesson_id);

  // Abre por padrão o módulo onde o aluno está.
  const defaultOpen = current ? [current.module.id] : modules.slice(0, 1).map((m) => m.id);

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
      <header className="mb-9">
        <p className="text-muted-foreground mb-2 text-xs font-medium tracking-[0.14em] uppercase">
          {course.level ? `Nível ${course.level}` : "Trilha completa"}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{course.title}</h1>
        {course.description && (
          <p className="text-muted-foreground mt-3 max-w-2xl text-[15px] leading-relaxed">
            {course.description}
          </p>
        )}

        <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex min-w-56 flex-1 items-center gap-3">
            <Progress value={course.percent} className={cn("h-2", progressTone(course.percent))} />
            <span className="tabular w-10 text-right text-sm font-medium">{course.percent}%</span>
          </div>
          <p className="text-muted-foreground text-sm">
            <span className="tabular text-foreground font-medium">{modules.length}</span> módulos ·{" "}
            <span className="tabular text-foreground font-medium">{course.total_lessons}</span>{" "}
            aulas · <span className="tabular">{formatDuration(course.total_seconds)}</span>
          </p>
        </div>
      </header>

      <CurriculumAccordion
        modules={modules}
        currentLessonId={current?.lesson.id ?? null}
        defaultOpen={defaultOpen}
      />
    </div>
  );
}
