"use client";

import { useEffect, useRef, useState } from "react";
import { AudioLines, Download, Headphones } from "lucide-react";
import { AddToPlaylistButton } from "@/components/app/add-to-playlist-button";
import { formatFileSize } from "@/lib/format";
import type { Material } from "@/lib/db/queries";
import { cn } from "@/lib/utils";

/**
 * Áudio da aula em várias vozes.
 *
 * A mesma história é lida por narradores diferentes (sotaque, ritmo e timbre
 * mudam), e treinar escuta é justamente alternar entre eles — por isso a troca
 * acontece no mesmo player, sem recarregar a página, e continua tocando se já
 * estava tocando.
 */
export function LessonAudio({
  tracks,
  lessonTitle,
}: {
  tracks: Material[];
  lessonTitle: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const wasPlaying = useRef(false);
  const [activeId, setActiveId] = useState(tracks[0].id);

  const active = tracks.find((track) => track.id === activeId) ?? tracks[0];
  // Salvo no computador, "Jake.mp3" não diz de que aula é.
  const fileName = `${lessonTitle} - ${active.title}.mp3`;

  // Trocar o `src` recarrega a faixa e o navegador volta ao estado pausado;
  // só aqui, depois do src novo estar no elemento, dá para voltar a tocar.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !wasPlaying.current) return;
    wasPlaying.current = false;
    // Falha se o navegador ainda considerar o gesto do clique consumido —
    // nesse caso a faixa fica pronta e o aluno dá play.
    void audio.play().catch(() => {});
  }, [activeId]);

  function selectVoice(id: string) {
    if (id === activeId) return;
    const audio = audioRef.current;
    wasPlaying.current = !!audio && !audio.paused && !audio.ended;
    setActiveId(id);
  }

  return (
    <div className="rounded-xl border p-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Voz do áudio">
        {tracks.map((track) => {
          const selected = track.id === active.id;
          return (
            <button
              key={track.id}
              type="button"
              onClick={() => selectVoice(track.id)}
              aria-pressed={selected}
              className={cn(
                "focus-visible:ring-ring/50 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors focus-visible:ring-3 focus-visible:outline-none",
                selected
                  ? "border-brand/40 bg-brand-soft text-brand font-medium"
                  : "text-muted-foreground hover:border-foreground/20 hover:bg-accent/50",
              )}
            >
              {selected ? (
                <AudioLines className="size-3.5" strokeWidth={1.75} />
              ) : (
                <Headphones className="size-3.5" strokeWidth={1.75} />
              )}
              {track.title}
            </button>
          );
        })}
      </div>

      <audio
        ref={audioRef}
        src={`/api/materials/${active.id}`}
        controls
        preload="metadata"
        // Sem color-scheme os controles nativos ficam claros no tema escuro.
        className="mt-3.5 w-full dark:[color-scheme:dark]"
      >
        Seu navegador não consegue tocar este áudio.
      </audio>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5">
        <span className="text-muted-foreground min-w-0 truncate text-xs">
          Ouvindo a voz de {active.title}
          {active.file_size ? ` · ${formatFileSize(active.file_size)}` : ""}
        </span>

        <div className="flex shrink-0 items-center gap-2">
          {/* Guarda a voz que está selecionada — trocar de voz troca o áudio
              que o botão salva, que é o que o aluno vê na tela. */}
          <AddToPlaylistButton materialId={active.id} label={active.title} />
          <a
            href={`/api/materials/${active.id}`}
            download={fileName}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
          >
            <Download className="size-3.5" strokeWidth={1.75} />
            Baixar
          </a>
        </div>
      </div>
    </div>
  );
}
