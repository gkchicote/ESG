"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { AudioLines, ListMusic, Pause, Play, SkipBack, SkipForward, Trash2 } from "lucide-react";
import { usePlaylist } from "@/components/app/playlist-provider";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/format";
import type { PlaylistTrack } from "@/lib/db/queries";
import { cn } from "@/lib/utils";

/**
 * Playlist do aluno, com reprodução contínua.
 *
 * Um único <audio> na tela, e não um player por faixa: só assim a faixa
 * seguinte começa sozinha quando a atual termina (`handleEnded`) — e o
 * navegador não deixa dois áudios tocando ao mesmo tempo por engano.
 *
 * Trocar o `src` de um <audio> recarrega a faixa e o navegador volta ao
 * estado pausado. Por isso a intenção de continuar tocando fica em
 * `shouldPlay`, e o play acontece no efeito, depois de o src novo estar no
 * elemento — mesma mecânica do player de vozes da aula (`lesson-audio.tsx`).
 */
export function PlaylistPlayer({ tracks }: { tracks: PlaylistTrack[] }) {
  const { has, remove } = usePlaylist();
  const audioRef = useRef<HTMLAudioElement>(null);
  const shouldPlay = useRef(false);

  const [currentId, setCurrentId] = useState<string | null>(tracks[0]?.material_id ?? null);
  const [playing, setPlaying] = useState(false);
  const [, startTransition] = useTransition();

  // A fila na tela é o que o servidor mandou, filtrado pelo que o contexto já
  // sabe — é o que faz a linha removida sumir no clique, antes de a resposta
  // chegar. Guardar uma segunda cópia em estado local só criaria uma versão da
  // lista para manter em dia com as outras duas.
  const items = useMemo(() => tracks.filter((track) => has(track.material_id)), [tracks, has]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !shouldPlay.current) return;
    shouldPlay.current = false;
    // Falha se o navegador ainda não tiver liberado o áudio desta página —
    // nesse caso a faixa fica pronta e o aluno dá play.
    void audio.play().catch(() => {});
  }, [currentId]);

  const index = items.findIndex((track) => track.material_id === currentId);
  const current = index >= 0 ? items[index] : (items[0] ?? null);
  const currentIndex = current ? items.indexOf(current) : -1;

  function select(materialId: string) {
    if (materialId === currentId) {
      const audio = audioRef.current;
      if (!audio) return;
      if (audio.paused) void audio.play().catch(() => {});
      else audio.pause();
      return;
    }
    shouldPlay.current = true;
    setCurrentId(materialId);
  }

  /** Anterior/próxima. Mantém tocando se já estava tocando. */
  function step(delta: number) {
    const next = items[currentIndex + delta];
    if (!next) return;
    shouldPlay.current = playing;
    setCurrentId(next.material_id);
  }

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => {});
    else audio.pause();
  }

  /** Fim da faixa: a próxima entra sozinha — é isto que faz a playlist tocar direto. */
  function handleEnded() {
    const next = items[currentIndex + 1];
    if (!next) {
      setPlaying(false);
      return;
    }
    shouldPlay.current = true;
    setCurrentId(next.material_id);
  }

  function handleRemove(track: PlaylistTrack) {
    // Tirar a faixa que está tocando não pode calar a playlist: o ponteiro
    // anda para a seguinte (ou para a anterior, se era a última).
    if (track.material_id === current?.material_id) {
      const next = items[currentIndex + 1] ?? items[currentIndex - 1] ?? null;
      shouldPlay.current = playing && next !== null;
      setCurrentId(next?.material_id ?? null);
    }
    startTransition(() => remove(track.material_id, track.title));
  }

  if (!current) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-10 text-center text-sm">
        Sua playlist está vazia. Abra uma aula e toque em “Adicionar à playlist”.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {/* Tocando agora ------------------------------------------------ */}
      <div className="rounded-xl border p-4">
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-[0.12em] uppercase">
          <AudioLines className="size-3.5" strokeWidth={1.75} />
          Tocando agora
        </p>

        <h2 className="mt-2 text-base font-semibold tracking-tight">
          {current.title} · {current.lesson_title}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Módulo {current.module_position} · {current.module_title} ·{" "}
          <Link href={`/aula/${current.lesson_id}`} className="hover:text-foreground underline underline-offset-4">
            ir para a aula
          </Link>
        </p>

        <audio
          ref={audioRef}
          src={`/api/materials/${current.material_id}`}
          controls
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={handleEnded}
          // Sem color-scheme os controles nativos ficam claros no tema escuro.
          className="mt-3.5 w-full dark:[color-scheme:dark]"
        >
          Seu navegador não consegue tocar este áudio.
        </audio>

        <div className="mt-3 flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => step(-1)}
            disabled={currentIndex <= 0}
            aria-label="Áudio anterior"
          >
            <SkipBack strokeWidth={1.75} />
          </Button>
          <Button type="button" size="sm" onClick={togglePlay}>
            {playing ? <Pause strokeWidth={1.75} /> : <Play strokeWidth={1.75} />}
            {playing ? "Pausar" : "Tocar"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => step(1)}
            disabled={currentIndex >= items.length - 1}
            aria-label="Próximo áudio"
          >
            <SkipForward strokeWidth={1.75} />
          </Button>
          <span className="text-muted-foreground tabular ml-auto text-xs">
            {currentIndex + 1} de {items.length}
          </span>
        </div>
      </div>

      {/* Fila ---------------------------------------------------------- */}
      <div className="overflow-hidden rounded-xl border">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3.5">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <ListMusic className="size-4" strokeWidth={1.75} />
            Na fila
          </h2>
          <span className="text-muted-foreground tabular text-xs">
            {items.length} {items.length === 1 ? "áudio" : "áudios"}
          </span>
        </div>

        <ol className="p-2">
          {items.map((track, position) => {
            const active = track.material_id === current.material_id;
            return (
              <li key={track.material_id}>
                <div
                  className={cn(
                    "group/track flex items-center gap-3 rounded-lg px-2.5 py-2.5 transition-colors",
                    active ? "bg-brand-soft" : "hover:bg-accent/60",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => select(track.material_id)}
                    aria-label={
                      active && playing ? `Pausar ${track.title}` : `Tocar ${track.title}`
                    }
                    className={cn(
                      "focus-visible:ring-ring/50 grid size-8 shrink-0 place-items-center rounded-full border transition-colors focus-visible:ring-3 focus-visible:outline-none",
                      active
                        ? "border-brand text-brand"
                        : "text-muted-foreground hover:border-foreground/20 hover:text-foreground",
                    )}
                  >
                    {active && playing ? (
                      <Pause className="size-3.5" strokeWidth={2} />
                    ) : (
                      <Play className="size-3 fill-current" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => select(track.material_id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-sm font-medium">
                      {track.title} · {track.lesson_title}
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      Módulo {track.module_position} · {track.module_title}
                      {track.file_size ? ` · ${formatFileSize(track.file_size)}` : ""}
                    </span>
                  </button>

                  <span className="text-muted-foreground tabular hidden w-6 text-right text-xs sm:block">
                    {position + 1}
                  </span>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleRemove(track)}
                    aria-label={`Remover ${track.title} da playlist`}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                  >
                    <Trash2 strokeWidth={1.75} />
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
