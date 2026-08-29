"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CircleCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveLessonProgress, toggleLessonCompleted } from "@/app/actions/progress";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/format";
import { StreakCelebration } from "@/components/app/streak-celebration";
import type { VideoSource } from "@/lib/video";
import { cn } from "@/lib/utils";
import { YouTubePlayer, type PlayerHandle } from "./youtube-player";

const SAVE_EVERY_SECONDS = 10;
const RESUME_AFTER_SECONDS = 10;
/** Fração do vídeo que precisa ter passado na tela. Espelha `WATCH_REQUIRED`
 *  do servidor — que é quem decide de verdade; aqui é só para não deixar o
 *  aluno pedir uma conclusão que vai ser recusada. */
const COMPLETE_AT = 0.9;
const TICK_MS = 1000;

/**
 * Em quantas fatias o vídeo é dividido para medir o que foi assistido.
 *
 * Contar segundos não serve: rever os mesmos 30s dez vezes somaria 5 minutos
 * sem ter avançado nada. Cada fatia conta uma vez só, então a cobertura mede
 * o quanto do vídeo foi visto — não o quanto de tempo passou nele.
 */
const COVERAGE_SLICES = 200;

/**
 * Maior salto, em segundos, que ainda conta como reprodução contínua.
 *
 * Acima disso é a barra sendo arrastada, e nada é creditado. 3s deixa passar
 * reprodução em 2x (2s por tique) e engasgos de rede, mas fica abaixo do pulo
 * de 5s das setas do teclado — senão dava para "assistir" a aula no anda-anda.
 */
const MAX_PLAYBACK_STEP = 3;

type Neighbour = { href: string; title: string } | null;

export function LessonStage({
  lessonId,
  source,
  startAt,
  watchedSeconds,
  durationSeconds,
  completed: initialCompleted,
  previous,
  next,
}: {
  lessonId: string;
  source: VideoSource;
  startAt: number;
  /** O que o servidor já contou como assistido em visitas anteriores. */
  watchedSeconds: number;
  durationSeconds: number;
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

  /* Quanto do vídeo já passou na tela ---------------------------------- */
  // Uma fatia marcada = aquele pedaço do vídeo foi reproduzido. Só avanço
  // contínuo marca (ver `credit`), então arrastar a barra não credita nada.
  const slicesRef = useRef<Uint8Array | null>(null);
  const seenRef = useRef(0);
  // Última posição vista pelo tique — a diferença para a atual é o que
  // distingue reprodução de salto.
  const lastTimeRef = useRef<number | null>(null);

  // Percentual mostrado na tela. Parte do que o servidor já contou, senão
  // quem volta para terminar a aula veria 0% depois de ter assistido metade.
  const serverRatio = durationSeconds > 0 ? watchedSeconds / durationSeconds : 0;
  const [watchedPercent, setWatchedPercent] = useState(() =>
    initialCompleted ? 100 : Math.min(100, Math.round(serverRatio * 100)),
  );
  const percentRef = useRef(watchedPercent);

  /** Credita as fatias entre duas posições — só chamado em reprodução real. */
  const credit = useCallback((from: number, to: number, duration: number) => {
    if (!(duration > 0)) return;
    const slices = (slicesRef.current ??= new Uint8Array(COVERAGE_SLICES));
    const slice = (seconds: number) =>
      Math.min(COVERAGE_SLICES - 1, Math.max(0, Math.floor((seconds / duration) * COVERAGE_SLICES)));

    for (let i = slice(from); i <= slice(to); i++) {
      if (slices[i]) continue;
      slices[i] = 1;
      seenRef.current += 1;
    }

    // O percentual do servidor é o piso: ele já viu sessões anteriores.
    const percent = Math.min(
      100,
      Math.round(Math.max(seenRef.current / COVERAGE_SLICES, serverRatio) * 100),
    );
    if (percent === percentRef.current) return; // evita re-render a cada tique
    percentRef.current = percent;
    setWatchedPercent(percent);
  }, [serverRatio]);

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

  /** Avisa o que ainda falta assistir quando o servidor recusa a conclusão. */
  const missingToast = useCallback((watched: number, required: number) => {
    const missing = Math.max(0, required - watched);
    toast("Ainda falta assistir", {
      description: `Faltam cerca de ${formatDuration(missing)} de aula para ela contar. Pular trechos não conclui.`,
    });
  }, []);

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
          if (!result.ok || !result.completion) return completionToast();

          // Recusa: o servidor mediu menos do que o necessário. Desfaz o
          // check otimista — a aula continua em aberto de verdade.
          if (!result.completion.ok) {
            completedRef.current = false;
            setCompleted(false);
            return missingToast(result.completion.watched, result.completion.required);
          }

          if (result.completion.streak.advanced) setCelebrating(result.completion.streak.days);
          else completionToast();
        })
        .catch(() => {
          // Rede caiu no meio: o aluno ainda merece saber que concluiu — a
          // posição volta a ser gravada no próximo tick ou no beacon de saída.
          completionToast();
        });
    },
    [lessonId, router, completionToast, missingToast],
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

    // Reprodução contínua credita o trecho percorrido; salto não credita nada.
    const previous = lastTimeRef.current;
    lastTimeRef.current = now;
    const step = previous === null ? 0 : now - previous;
    if (step > 0 && step <= MAX_PLAYBACK_STEP) credit(previous!, now, duration);

    if (Math.abs(now - lastSavedAt.current) >= SAVE_EVERY_SECONDS) {
      lastSavedAt.current = now;
      void saveLessonProgress(lessonId, now);
    }

    // Conclui por cobertura, não por posição: chegar ao fim arrastando a barra
    // deixa o vídeo em 100% da duração com quase nada assistido.
    if (percentRef.current >= COMPLETE_AT * 100) markCompleted(now);
  }, [lessonId, markCompleted, tryResume, credit]);

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
    const duration = playerRef.current?.duration() ?? 0;

    // O último trecho costuma ficar sem tique: o vídeo acaba antes do próximo.
    // Só creditamos essa ponta se o playhead já estava nela — quem pulou para
    // o fim também dispara `ended`, e aí ganha apenas a fatia final.
    const last = lastTimeRef.current;
    if (last !== null && duration - last <= MAX_PLAYBACK_STEP) credit(last, duration, duration);

    if (percentRef.current >= COMPLETE_AT * 100) return markCompleted(duration);
    // Chegou ao fim pulando trechos: nada de conclusão, e o motivo na tela.
    toast("Aula não concluída", {
      description: `Você assistiu ${percentRef.current}% da aula. É preciso ao menos ${Math.round(COMPLETE_AT * 100)}% para ela contar.`,
    });
  }, [markCompleted, credit]);

  // Embeds (Vimeo, Drive) rodam em iframe sem API de progresso: não há o que
  // medir, e o servidor também não cobra prova nesses casos.
  const trackable = source.kind === "video" || source.kind === "youtube";

  const onToggleComplete = () => {
    const value = !completed;
    setCompleted(value);
    completedRef.current = value;
    startTransition(async () => {
      // O botão passa pela mesma verificação do player: ele marca a aula, não
      // a dá por assistida. Quem decide é o tempo que o servidor mediu.
      const result = await toggleLessonCompleted(lessonId, value);
      router.refresh();
      if (!result.ok) return;

      // Recusado: desfaz o check otimista e diz o que falta.
      if (value && result.completion && !result.completion.ok) {
        setCompleted(false);
        completedRef.current = false;
        return missingToast(result.completion.watched, result.completion.required);
      }

      if (result.completion?.ok && result.completion.streak.advanced) {
        return setCelebrating(result.completion.streak.days);
      }
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

        {/* Quanto já passou na tela. Só aparece onde dá para medir e enquanto
            a aula não fechou — depois disso o número não decide mais nada. */}
        {!completed && trackable && (
          <span className="text-muted-foreground text-xs">
            {watchedPercent}% assistido
          </span>
        )}

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
