"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CircleCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveLessonProgress, toggleLessonCompleted } from "@/app/actions/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SAVE_EVERY_SECONDS = 10;
const RESUME_AFTER_SECONDS = 10;
const COMPLETE_AT = 0.9; // 90% assistido conclui a aula

type Neighbour = { href: string; title: string } | null;

export function LessonStage({
  lessonId,
  source,
  startAt,
  completed: initialCompleted,
  previous,
  next,
}: {
  lessonId: string;
  source: { kind: "video"; url: string } | { kind: "embed"; url: string } | { kind: "missing" };
  startAt: number;
  completed: boolean;
  previous: Neighbour;
  next: Neighbour;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSavedAt = useRef(0);
  const completedRef = useRef(initialCompleted);
  const [completed, setCompleted] = useState(initialCompleted);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    completedRef.current = completed;
  }, [completed]);

  const markCompleted = useCallback(
    (position: number) => {
      if (completedRef.current) return;
      completedRef.current = true;
      setCompleted(true);
      void saveLessonProgress(lessonId, position, true).then(() => router.refresh());
      toast.success("Aula concluída", {
        description: next ? `Próxima: ${next.title}` : "Você chegou ao fim do módulo.",
        action: next ? { label: "Ir", onClick: () => router.push(next.href) } : undefined,
      });
    },
    [lessonId, next, router],
  );

  /* Retoma no ponto salvo -------------------------------------------- */
  // O <video> é renderizado no servidor e começa a carregar antes da
  // hidratação: quando o React assume, o "loadedmetadata" pode já ter
  // passado. Por isso checamos readyState em vez de confiar só no evento.
  const resumedRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || startAt < RESUME_AFTER_SECONDS) return;

    const applyResume = () => {
      if (resumedRef.current) return;
      if (!video.duration || startAt >= video.duration - 5) return; // estava no fim: recomeça
      resumedRef.current = true;
      video.currentTime = startAt;
      lastSavedAt.current = startAt;
      toast("Retomando de onde você parou", {
        description: formatClock(startAt),
        action: {
          label: "Do início",
          onClick: () => {
            video.currentTime = 0;
            void video.play();
          },
        },
      });
    };

    if (video.readyState >= 1) applyResume();
    else video.addEventListener("loadedmetadata", applyResume, { once: true });

    return () => video.removeEventListener("loadedmetadata", applyResume);
  }, [startAt]);

  /* Salva progresso a cada 10s de reprodução -------------------------- */
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.duration) return;

    const now = video.currentTime;
    if (Math.abs(now - lastSavedAt.current) >= SAVE_EVERY_SECONDS) {
      lastSavedAt.current = now;
      void saveLessonProgress(lessonId, now);
    }

    if (now / video.duration >= COMPLETE_AT) markCompleted(now);
  }, [lessonId, markCompleted]);

  /* Ao sair da página, grava a posição exata ------------------------- */
  // sendBeacon sobrevive ao unload; uma Server Action seria cancelada.
  useEffect(() => {
    const flush = () => {
      const video = videoRef.current;
      if (!video || !(video.currentTime > 0)) return;
      const body = JSON.stringify({ lessonId, seconds: Math.round(video.currentTime) });
      const blob = new Blob([body], { type: "application/json" });
      if (!navigator.sendBeacon("/api/progress", blob)) {
        void fetch("/api/progress", { method: "POST", body, keepalive: true });
      }
    };

    const onHide = () => document.visibilityState === "hidden" && flush();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);

    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [lessonId]);

  const onToggleComplete = () => {
    const value = !completed;
    setCompleted(value);
    completedRef.current = value;
    startTransition(async () => {
      await toggleLessonCompleted(lessonId, value);
      router.refresh();
      toast[value ? "success" : "message"](
        value ? "Aula marcada como concluída" : "Marcação removida",
      );
    });
  };

  return (
    <div className="space-y-4">
      {/* Palco do vídeo ------------------------------------------------ */}
      <div className="bg-foreground/95 relative aspect-video w-full overflow-hidden rounded-xl">
        {source.kind === "video" && (
          <video
            ref={videoRef}
            src={source.url}
            controls
            controlsList="nodownload"
            preload="metadata"
            playsInline
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => markCompleted(videoRef.current?.duration ?? 0)}
            className="size-full"
          />
        )}

        {source.kind === "embed" && (
          <iframe
            src={source.url}
            title="Videoaula"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            className="size-full border-0"
          />
        )}

        {source.kind === "missing" && (
          <div className="text-background/70 grid size-full place-items-center px-6 text-center text-sm">
            O vídeo desta aula ainda não foi publicado.
          </div>
        )}
      </div>

      {/* Barra de ações ------------------------------------------------ */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={onToggleComplete}
          disabled={pending}
          variant={completed ? "secondary" : "default"}
          className={cn(
            "gap-2",
            completed && "bg-success-soft text-success hover:bg-success-soft/80",
          )}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : completed ? (
            <CircleCheck className="size-4" />
          ) : (
            <Check className="size-4" />
          )}
          {completed ? "Concluída" : "Marcar como concluída"}
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" disabled={!previous} className="gap-1.5">
            {previous ? (
              <Link href={previous.href}>
                <ArrowLeft className="size-4" />
                Anterior
              </Link>
            ) : (
              <span className="text-muted-foreground pointer-events-none opacity-50">
                <ArrowLeft className="size-4" />
                Anterior
              </span>
            )}
          </Button>

          <Button asChild size="sm" disabled={!next} className="gap-1.5">
            {next ? (
              <Link href={next.href}>
                Próxima aula
                <ArrowRight className="size-4" />
              </Link>
            ) : (
              <span className="pointer-events-none opacity-50">
                Próxima aula
                <ArrowRight className="size-4" />
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatClock(seconds: number) {
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
