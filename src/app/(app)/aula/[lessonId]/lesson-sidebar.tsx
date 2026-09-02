"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Play } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  const currentModuleId = modules.find((module) =>
    module.lessons.some((lesson) => lesson.id === currentLessonId),
  )?.id;

  // Ao abrir a aula, só o módulo dela vem expandido: a lista inteira aberta
  // empurra as aulas vizinhas para fora da área visível da barra.
  const [open, setOpen] = useState<string[]>(currentModuleId ? [currentModuleId] : []);

  // Navegar entre aulas não desmonta a barra: quando a aula muda de módulo,
  // ajustamos a abertura ainda na renderização (sem efeito, sem piscada).
  // O que a pessoa tiver aberto para dar uma olhada continua aberto.
  const [openedFor, setOpenedFor] = useState(currentModuleId);
  if (openedFor !== currentModuleId) {
    setOpenedFor(currentModuleId);
    if (currentModuleId && !open.includes(currentModuleId)) {
      setOpen([...open, currentModuleId]);
    }
  }

  return (
    <aside className="lg:sticky lg:top-24">
      <div className="overflow-hidden rounded-xl border">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3.5">
          <h2 className="text-sm font-medium">Conteúdo do curso</h2>
          <span className="tabular text-muted-foreground text-xs">{percent}% concluído</span>
        </div>

        <ScrollArea className="h-[min(60vh,34rem)] lg:h-[calc(100svh-13rem)]">
          <Accordion type="multiple" value={open} onValueChange={setOpen} className="p-2">
            {modules.map((module) => {
              const total = module.lessons.length;
              const isCurrent = module.id === currentModuleId;

              return (
                <AccordionItem key={module.id} value={module.id} className="border-none">
                  <AccordionTrigger
                    className={cn(
                      "hover:bg-accent/60 items-center gap-2 rounded-lg px-2.5 py-2 hover:no-underline",
                      "**:data-[slot=accordion-trigger-icon]:size-3.5",
                    )}
                  >
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-[11px] font-semibold tracking-[0.1em] uppercase",
                        isCurrent ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      Módulo {module.position} · {module.title}
                    </span>
                    <span className="tabular text-muted-foreground ml-auto shrink-0 text-[11px] font-normal">
                      {module.completed_lessons}/{total}
                    </span>
                  </AccordionTrigger>

                  <AccordionContent className="pt-0 pb-1">
                    <ol>
                      {module.lessons.map((lesson) => {
                        const active = lesson.id === currentLessonId;
                        return (
                          <li key={lesson.id}>
                            <Link
                              href={`/aula/${lesson.id}`}
                              aria-current={active ? "true" : undefined}
                              className={cn(
                                "group flex items-start gap-3 rounded-lg px-2.5 py-2.5 no-underline transition-colors",
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
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </ScrollArea>
      </div>
    </aside>
  );
}
