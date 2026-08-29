import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getCurriculum, getEnrolledCourse, touchEnrollment } from "@/lib/db/queries";
import { findLesson, neighbours } from "@/lib/progress";
import { resolveVideoSource } from "@/lib/video";
import { formatDuration } from "@/lib/format";
import { MaterialLink } from "@/components/app/material-link";
import { Button } from "@/components/ui/button";
import { LessonAudio } from "./lesson-audio";
import { LessonSidebar } from "./lesson-sidebar";
import { LessonStage } from "./lesson-stage";

type Props = { params: Promise<{ lessonId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const session = await requireSession();
  const { lessonId } = await params;
  const course = await getEnrolledCourse(session.sub);
  if (!course) return { title: "Aula" };
  const modules = await getCurriculum(session.sub, course.id);
  return { title: findLesson(modules, lessonId)?.lesson.title ?? "Aula" };
}

export default async function LessonPage({ params }: Props) {
  const session = await requireSession();
  const { lessonId } = await params;

  const course = await getEnrolledCourse(session.sub);
  if (!course) notFound();

  const modules = await getCurriculum(session.sub, course.id);
  const location = findLesson(modules, lessonId);
  if (!location) notFound();

  const { lesson, module, index, total } = location;
  const { previous, next } = neighbours(modules, lessonId);

  // Registra o acesso — alimenta "continuar de onde parou" e "último acesso".
  await touchEnrollment(session.sub, course.id, lessonId);

  const source = resolveVideoSource(lesson.video_provider, lesson.video_id, lesson.id);

  // Áudio não é anexo para baixar: é a mesma gravação em vozes diferentes,
  // que ganha o player logo abaixo dos materiais.
  const audios = lesson.materials.filter((m) => m.file_type === "audio");
  const attachments = lesson.materials.filter((m) => m.file_type !== "audio");

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground -ml-2 mb-5 gap-1.5">
        <Link href="/modulos">
          <ChevronLeft className="size-4" />
          Todos os módulos
        </Link>
      </Button>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10">
        {/* Coluna principal ------------------------------------------ */}
        <div className="min-w-0">
          <LessonStage
            lessonId={lesson.id}
            source={source}
            startAt={lesson.last_position_seconds}
            watchedSeconds={lesson.watched_seconds}
            durationSeconds={lesson.duration_seconds}
            completed={lesson.completed}
            previous={previous ? { href: `/aula/${previous.lesson.id}`, title: previous.lesson.title } : null}
            next={next ? { href: `/aula/${next.lesson.id}`, title: next.lesson.title } : null}
          />

          <header className="mt-8">
            <p className="text-muted-foreground text-xs font-medium tracking-[0.12em] uppercase">
              Módulo {module.position} · {module.title}
            </p>
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-balance sm:text-2xl">
              {lesson.title}
            </h1>
            <p className="text-muted-foreground tabular mt-2 text-sm">
              Aula {index} de {total} · {formatDuration(lesson.duration_seconds)}
            </p>
          </header>

          {lesson.description && (
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed">{lesson.description}</p>
          )}

          {/* Materiais ---------------------------------------------- */}
          <section className="mt-9">
            <h2 className="mb-3 text-sm font-medium">Material da aula</h2>
            {attachments.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {attachments.map((material) => (
                  <MaterialLink key={material.id} material={material} />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm">
                Esta aula não tem material anexo.
              </p>
            )}
          </section>

          {/* Áudio da aula ------------------------------------------- */}
          {audios.length > 0 && (
            <section className="mt-8">
              <h2 className="text-sm font-medium">Áudio da aula</h2>
              <p className="text-muted-foreground mt-1 mb-3 text-sm">
                A mesma história em {audios.length} vozes. Escolha com quem treinar.
              </p>
              <LessonAudio tracks={audios} lessonTitle={lesson.title} />
            </section>
          )}
        </div>

        {/* Lista lateral --------------------------------------------- */}
        <LessonSidebar
          modules={modules}
          currentLessonId={lesson.id}
          percent={course.percent}
        />
      </div>
    </div>
  );
}
