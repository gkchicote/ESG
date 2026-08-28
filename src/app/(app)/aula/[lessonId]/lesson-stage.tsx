"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CircleCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveLessonProgress, toggleLessonCompleted } from "@/app/actions/progress";
import { Button } from "@/components/ui/button";
import { StreakCelebration } from "@/components/app/streak-celebration";
import type { VideoSource } from "@/lib/video";
import { cn } from "@/lib/utils";
import { YouTubePlayer, type PlayerHandle } from "./youtube-player";

const SAVE_EVERY_SECONDS = 10;
const RESUME_AFTER_SECONDS = 10;
const COMPLETE_AT = 0.9; // 90% assistido conclui a aula
const TICK_MS = 1000;

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
  source: VideoSource;
  startAt: number;
  completed: boolean;
  previous: Neighbour;
  next: Neighbour;
}) {
  const router = useRouter();
  // Um só ponteiro para o player em uso: <video> nativo ou YouTube.
  const playerRef = useRef<PlayerHandle | null>(null);
  const lastSavedAt = useRef(0);
  const completedRef = useRef(initialCompleted);
  const [completed, setCompleted] = useState(initialCompleted);
  const [pending, startTransition] = useTransition();
  // Dias da ofensiva a celebrar, ou null. Preenchido só quando a conclusão
  // fez o contador subir — ou seja, na primeira aula concluída do dia.
  const [celebrating, setCelebrating] = useState<number | null>(null);

  useEffect(() => {
    completedRef.current = completed;
  }, [completed]);

  /** Toast padrão de conclusão — usado quando não há ofensiva a celebrar. */
  const completionToast = useCallback(() => {
    toast.success("Aula concluída", {
      description: next ? `Próxima: ${next.title}` : "Você chegou ao fim do módulo.",
      action: next ? { label: "Ir", onClick: () => router.push(next.href) } : undefined,
    });
  }, [next, router]);

  const markCompleted = useCallback(
    (position: number) => {
      if (completedRef.current) return;
      completedRef.current = true;
      setCompleted(true);

      // O aviso espera a resposta do servidor (uma ida rápida) porque é ela
      // que diz se esta foi a primeira aula do dia. Celebração e toast se
      // excluem: duas notificações para o mesmo evento viram ruído.
      void saveLessonProgress(lessonId, position, true)
        .then((result) => {
          router.refresh();
          if (result.ok && result.streak?.advanced) setCelebrating(result.streak.days);
          else completionToast();
        })
        .catch(() => {
          // Rede caiu no meio: o aluno ainda merece saber que concluiu — a
          // posição volta a ser gravada no próximo tick ou no beacon de saída.
          completionToast();
        });
    },
    [lessonId, router, completionToast],
  );

  /* Retoma no ponto salvo -------------------------------------------- */
  // Depende da duração, que só existe depois que o player carrega os
  // metadados — por isso a tentativa acontece dentro do tick, e não num
  // evento que pode já ter passado quando o React assume a página.
  const resumedRef = useRef(false);

  const tryResume = useCallback(
    (player: PlayerHandle, duration: number) => {
      if (resumedRef.current) return;
      resumedRef.current = true;
      if (startAt < RESUME_AFTER_SECONDS || startAt >= duration - 5) return; // fim: recomeça
      player.seek(startAt);
      lastSavedAt.current = startAt;
      toast("Retomando de onde você parou", {
        description: formatClock(startAt),
        action: {
          label: "Do início",
          onClick: () => {
            player.seek(0);
            player.play();
          },
        },
      });
    },
    [startAt],
  );

  /* Salva progresso a cada 10s de reprodução -------------------------- */
  const tick = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;

    const duration = player.duration();
    if (!duration) return;

    tryResume(player, duration);

    const now = player.currentTime();
    if (Math.abs(now - lastSavedAt.current) >= SAVE_EVERY_SECONDS) {
      lastSavedAt.current = now;
      void saveLessonProgress(lessonId, now);
    }

    if (now / duration >= COMPLETE_AT) markCompleted(now);
  }, [lessonId, markCompleted, tryResume]);

  useEffect(() => {
    if (source.kind === "missing" || source.kind === "embed") return;
    const id = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(id);
  }, [tick, source.kind]);

  /* Ao sair da página, grava a posição exata ------------------------- */
  // sendBeacon sobrevive ao unload; uma Server Action seria cancelada.
  useEffect(() => {
    const flush = () => {
      const player = playerRef.current;
      const seconds = player?.currentTime() ?? 0;
      if (!(seconds > 0)) return;
      const body = JSON.stringify({ lessonId, seconds: Math.round(seconds) });
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

  /* Registro dos players --------------------------------------------- */
  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    playerRef.current = el
      ? {
          currentTime: () => el.currentTime,
          duration: () => el.duration || 0,
          seek: (seconds) => {
            el.currentTime = seconds;
          },
          play: () => void el.play(),
        }
      : null;
  }, []);

  const attachYouTube = useCallback((handle: PlayerHandle) => {
    playerRef.current = handle;
  }, []);

  const onPlayerEnded = useCallback(() => {
    markCompleted(playerRef.current?.duration() ?? 0);
  }, [markCompleted]);

  const onToggleComplete = () => {
    const value = !completed;
    setCompleted(value);
    completedRef.current = value;
    startTransition(async () => {
      // Marcar no botão conta como conclusão — é o mesmo evento que paga o
      // ponto. Só o login é que nunca move a ofensiva.
      const result = await toggleLessonCompleted(lessonId, value);
      router.refresh();
      if (result.ok && result.streak?.advanced) return setCelebrating(result.streak.days);
      toast[value ? "success" : "message"](
        value ? "Aula marcada como concluída" : "Marcação removida",
      );
    });
  };

  return (
    <div className="space-y-4">
      {celebrating !== null && (
        <StreakCelebration
          days={celebrating}
          next={next}
          onClose={() => setCelebrating(null)}
        />
      )}

      {/* Palco do vídeo ------------------------------------------------ */}
      <div className="bg-foreground/95 relative aspect-video w-full overflow-hidden rounded-xl">
        {source.kind === "video" && (
          <video
            ref={attachVideo}
            src={source.url}
            controls
            controlsList="nodownload"
            preload="metadata"
            playsInline
            onTimeUpdate={tick}
            onEnded={onPlayerEnded}
            className="size-full"
          />
        )}

        {source.kind === "youtube" && (
          <YouTubePlayer
            videoId={source.videoId}
            onReady={attachYouTube}
            onEnded={onPlayerEnded}
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
