"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, CirclePlay, Paperclip, Play } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { MaterialLink } from "@/components/app/material-link";
import { formatDuration } from "@/lib/format";
import type { ModuleWithLessons } from "@/lib/db/queries";
import { progressTone } from "@/lib/progress-tone";
import { cn } from "@/lib/utils";

export function CurriculumAccordion({
  modules,
  currentLessonId,
  defaultOpen,
}: {
  modules: ModuleWithLessons[];
  currentLessonId: string | null;
  defaultOpen: string[];
}) {
  const [open, setOpen] = useState<string[]>(defaultOpen);

  // Abre e rola até o módulo indicado na âncora (#modulo-2), vindo do Início.
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash.startsWith("modulo-")) return;
    const position = Number(hash.split("-")[1]);
    const target = modules.find((m) => m.position === position);
    if (!target) return;
    requestAnimationFrame(() => {
      setOpen((prev) => (prev.includes(target.id) ? prev : [...prev, target.id]));
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [modules]);

  return (
    <Accordion type="multiple" value={open} onValueChange={setOpen} className="space-y-3">
      {modules.map((module) => {
        const total = module.lessons.length;
        const percent = total ? Math.round((module.completed_lessons / total) * 100) : 0;
        const done = percent === 100 && total > 0;

        return (
          <AccordionItem
            key={module.id}
            value={module.id}
            id={`modulo-${module.position}`}
            className="overflow-hidden rounded-xl border scroll-mt-24 last:border-b"
          >
            <AccordionTrigger className="items-center gap-4 px-5 py-4 hover:no-underline sm:px-6">
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <span
                  className={cn(
                    "tabular grid size-9 shrink-0 place-items-center rounded-lg text-sm font-semibold",
                    done
                      ? "bg-success-soft text-success"
                      : percent > 0
                        ? "bg-brand-soft text-brand"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-4" strokeWidth={2.5} /> : module.position}
                </span>

                <div className="min-w-0 flex-1 text-left">
                  <h3 className="truncate text-[15px] font-medium">{module.title}</h3>
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    <span className="tabular">
                      {module.completed_lessons}/{total} aulas
                    </span>
                    <span aria-hidden> · </span>
                    <span className="tabular">{formatDuration(module.total_seconds)}</span>
                  </p>
                </div>

                <div className="hidden w-32 shrink-0 items-center gap-3 sm:flex">
                  <Progress value={percent} className={cn("h-1.5", progressTone(percent))} />
                  <span className="tabular text-muted-foreground w-9 text-right text-xs">
                    {percent}%
                  </span>
                </div>
              </div>
            </AccordionTrigger>

            <AccordionContent className="px-5 pb-5 sm:px-6 [&_a]:no-underline">
              {module.description && (
                <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
                  {module.description}
                </p>
              )}

              <ol className="divide-y border-y">
                {module.lessons.map((lesson) => {
                  const active = lesson.id === currentLessonId;

                  return (
                    <li key={lesson.id} className="py-1">
                      <Link
                        href={`/aula/${lesson.id}`}
                        className={cn(
                          "group hover:bg-accent/50 -mx-2 flex items-center gap-3.5 rounded-lg px-2 py-2.5 transition-colors",
                          active && "bg-brand-soft hover:bg-brand-soft",
                        )}
                      >
                        <span
                          className={cn(
                            "grid size-6 shrink-0 place-items-center rounded-full border transition-colors",
                            lesson.completed
                              ? "border-success bg-success text-white"
                              : "text-muted-foreground group-hover:border-foreground/30 border-dashed",
                          )}
                          aria-hidden
                        >
                          {lesson.completed ? (
                            <Check className="size-3.5" strokeWidth={3} />
                          ) : (
                            <Play className="size-2.5 fill-current" />
                          )}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "block truncate text-sm",
                              active ? "text-brand font-medium" : "font-normal",
                              lesson.completed && !active && "text-muted-foreground",
                            )}
                          >
                            {module.position}.{lesson.position} {lesson.title}
                          </span>
                          {lesson.materials.length > 0 && (
                            <span className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
                              <Paperclip className="size-3" strokeWidth={1.75} />
                              {lesson.materials.length} material
                              {lesson.materials.length > 1 ? "is" : ""}
                            </span>
                          )}
                        </span>

                        <span className="tabular text-muted-foreground shrink-0 text-xs">
                          {formatDuration(lesson.duration_seconds)}
                        </span>

                        <CirclePlay
                          className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-colors"
                          strokeWidth={1.75}
                        />
                      </Link>
                    </li>
                  );
                })}
              </ol>

              {module.lessons.some((l) => l.materials.length > 0) && (
                <div className="mt-5">
                  <p className="text-muted-foreground mb-2.5 text-xs font-medium tracking-wide uppercase">
                    Materiais do módulo
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {module.lessons.flatMap((l) =>
                      l.materials.map((m) => <MaterialLink key={m.id} material={m} />),
                    )}
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
