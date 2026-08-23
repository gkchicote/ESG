import Link from "next/link";
import { Check, Play } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDuration } from "@/lib/format";
import type { ModuleWithLessons } from "@/lib/db/queries";
import { cn } from "@/lib/utils";

export function LessonSidebar({
  modules,
  currentLessonId,
  percent,
}: {
  modules: ModuleWithLessons[];
  currentLessonId: string;
  percent: number;
}) {
  return (
    <aside className="lg:sticky lg:top-24">
      <div className="overflow-hidden rounded-xl border">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3.5">
          <h2 className="text-sm font-medium">Conteúdo do curso</h2>
          <span className="tabular text-muted-foreground text-xs">{percent}% concluído</span>
        </div>

        <ScrollArea className="h-[min(60vh,34rem)] lg:h-[calc(100svh-13rem)]">
          <div className="p-2">
            {modules.map((module) => (
              <section key={module.id} className="mb-1">
                <h3 className="text-muted-foreground px-2.5 pt-3 pb-1.5 text-[11px] font-semibold tracking-[0.1em] uppercase">
                  Módulo {module.position} · {module.title}
                </h3>

                <ol>
                  {module.lessons.map((lesson) => {
                    const active = lesson.id === currentLessonId;
                    return (
                      <li key={lesson.id}>
                        <Link
                          href={`/aula/${lesson.id}`}
                          aria-current={active ? "true" : undefined}
                          className={cn(
                            "group flex items-start gap-3 rounded-lg px-2.5 py-2.5 transition-colors",
                            active ? "bg-brand-soft" : "hover:bg-accent/60",
                          )}
                        >
                          <span
                            className={cn(
                              "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border text-[10px]",
                              lesson.completed
                                ? "border-success bg-success text-white"
                                : active
                                  ? "border-brand text-brand"
                                  : "text-muted-foreground border-dashed",
                            )}
                            aria-hidden
                          >
                            {lesson.completed ? (
                              <Check className="size-3" strokeWidth={3} />
                            ) : (
                              <Play className="size-2 fill-current" />
                            )}
                          </span>

                          <span className="min-w-0 flex-1">
                            <span
                              className={cn(
                                "block text-[13px] leading-snug",
                                active
                                  ? "text-brand font-medium"
                                  : lesson.completed
                                    ? "text-muted-foreground"
                                    : "text-foreground",
                              )}
                            >
                              {lesson.title}
                            </span>
                            <span className="tabular text-muted-foreground mt-0.5 block text-[11px]">
                              {formatDuration(lesson.duration_seconds)}
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>
        </ScrollArea>
      </div>
    </aside>
  );
}
