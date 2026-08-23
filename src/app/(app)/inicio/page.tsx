import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  ListChecks,
  Play,
} from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getCurriculum, getEnrolledCourse } from "@/lib/db/queries";
import { RESUME_AFTER_SECONDS, resolveContinueLesson } from "@/lib/progress";
import { formatDuration, formatLastAccess, firstName } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/app/empty-state";
import { progressTone } from "@/lib/progress-tone";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Início" };

export default async function DashboardPage() {
  const session = await requireSession();
  const course = await getEnrolledCourse(session.sub);

  if (!course) {
    return (
      <EmptyState
        title="Nenhum curso liberado ainda"
        description="Sua matrícula ainda não foi ativada. Assim que o acesso for liberado, seu curso aparece aqui."
      />
    );
  }

  const modules = await getCurriculum(session.sub, course.id);
  const next = resolveContinueLesson(modules, course.last_lesson_id);
  const finished = course.total_lessons > 0 && course.completed_lessons === course.total_lessons;
  const remaining = Math.max(0, course.total_seconds - course.completed_seconds);

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      {/* Cabeçalho ------------------------------------------------- */}
      <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Olá, {firstName(session.name)}
          </h1>
          <p className="text-muted-foreground text-[15px]">
            {finished
              ? "Você concluiu o curso inteiro. Revise quando quiser."
              : "Vamos retomar de onde você parou."}
          </p>
        </div>

        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <CalendarClock className="size-4" strokeWidth={1.75} />
          <span>
            Último acesso:{" "}
            <span className="text-foreground font-medium">
              {formatLastAccess(course.last_accessed_at)}
            </span>
          </span>
        </div>
      </header>

      {/* Continuar de onde parou ----------------------------------- */}
      {next && (
        <section
          aria-labelledby="continuar"
          className="bg-brand text-brand-foreground relative mb-6 overflow-hidden rounded-2xl"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-28 -right-16 size-96 rounded-full bg-white/10 blur-3xl"
          />

          <div className="relative z-10 flex flex-col gap-8 p-7 sm:p-9 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 space-y-3">
              <p
                id="continuar"
                className="text-[11px] font-semibold tracking-[0.14em] text-white/70 uppercase"
              >
                {finished ? "Revisar" : "Continuar de onde parou"}
              </p>

              <h2 className="text-xl leading-snug font-semibold tracking-tight text-balance sm:text-2xl">
                {next.lesson.title}
              </h2>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-white/75">
                <span className="truncate">
                  Módulo {next.module.position} · {next.module.title}
                </span>
                <span aria-hidden className="text-white/30">•</span>
                <span className="tabular">
                  Aula {next.index} de {next.total}
                </span>
                <span aria-hidden className="text-white/30">•</span>
                <span className="tabular">{formatDuration(next.lesson.duration_seconds)}</span>
              </div>

              {next.lesson.last_position_seconds >= RESUME_AFTER_SECONDS && (
                <p className="text-sm text-white/70">
                  Você parou em{" "}
                  <span className="tabular font-medium text-white">
                    {formatDuration(next.lesson.last_position_seconds)}
                  </span>
                  .
                </p>
              )}
            </div>

            <Button
              asChild
              size="lg"
              className="h-12 shrink-0 gap-2.5 bg-white px-7 text-[15px] font-semibold text-neutral-900 hover:bg-white/90"
            >
              <Link href={`/aula/${next.lesson.id}`}>
                <Play className="size-4 fill-current" />
                {next.lesson.last_position_seconds >= RESUME_AFTER_SECONDS ? "Retomar aula" : "Assistir aula"}
              </Link>
            </Button>
          </div>
        </section>
      )}

      {/* Progresso -------------------------------------------------- */}
      <section aria-labelledby="progresso" className="mb-12 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex h-full flex-col justify-center rounded-2xl border p-7">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 id="progresso" className="text-sm font-medium">
                Progresso do curso
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">{course.title}</p>
            </div>
            <p className="tabular text-3xl font-semibold tracking-tight">{course.percent}%</p>
          </div>

          <Progress value={course.percent} className={cn("h-2.5", progressTone(course.percent))} />

          <p className="text-muted-foreground mt-4 text-sm">
            <span className="text-foreground tabular font-medium">
              {course.completed_lessons}
            </span>{" "}
            de <span className="tabular">{course.total_lessons}</span> aulas concluídas
            {remaining > 0 && (
              <>
                {" "}
                · <span className="tabular">{formatDuration(remaining)}</span> restantes
              </>
            )}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <Stat
            icon={CheckCircle2}
            label="Aulas concluídas"
            value={`${course.completed_lessons}`}
            hint={`de ${course.total_lessons}`}
          />
          <Stat
            icon={Clock3}
            label="Tempo assistido"
            value={formatDuration(course.completed_seconds)}
            hint={`de ${formatDuration(course.total_seconds)}`}
          />
        </div>
      </section>

      {/* Módulos ---------------------------------------------------- */}
      <section aria-labelledby="modulos">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 id="modulos" className="text-sm font-medium">
            Seus módulos
          </h2>
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link href="/modulos">
              Ver todos
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2">
          {modules.map((module) => {
            const total = module.lessons.length;
            const percent = total ? Math.round((module.completed_lessons / total) * 100) : 0;
            const done = percent === 100;

            return (
              <li key={module.id}>
                <Link
                  href={`/modulos#modulo-${module.position}`}
                  className="hover:border-foreground/20 hover:bg-accent/40 group block h-full rounded-xl border p-5 transition-colors"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide">
                        MÓDULO {module.position}
                      </p>
                      <h3 className="truncate text-[15px] font-medium">{module.title}</h3>
                    </div>
                    {done && (
                      <Badge
                        variant="secondary"
                        className="bg-success-soft text-success shrink-0 gap-1 border-0"
                      >
                        <CheckCircle2 className="size-3" />
                        Concluído
                      </Badge>
                    )}
                  </div>

                  <Progress value={percent} className={cn("h-1.5", progressTone(percent))} />

                  <p className="text-muted-foreground mt-3 flex items-center gap-2 text-xs">
                    <ListChecks className="size-3.5" strokeWidth={1.75} />
                    <span className="tabular">
                      {module.completed_lessons}/{total} aulas
                    </span>
                    <span aria-hidden>·</span>
                    <span className="tabular">{formatDuration(module.total_seconds)}</span>
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border p-5">
      <div className="text-muted-foreground mb-2 flex items-center gap-2 text-xs font-medium">
        <Icon className="size-4" strokeWidth={1.75} />
        {label}
      </div>
      <p className="tabular text-xl font-semibold tracking-tight">
        {value}
        {hint && <span className="text-muted-foreground ml-1.5 text-sm font-normal">{hint}</span>}
      </p>
    </div>
  );
}
