"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_VOLUME = 0.35;

/**
 * Áudio de fundo com botão de ativar/desativar e controle de volume.
 *
 * Começa desligado e num volume moderado: navegadores bloqueiam autoplay
 * com som, então o primeiro play sempre depende de um clique do usuário.
 */
export function BackgroundAudio({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);

  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;

    if (enabled) {
      void audio.play().catch(() => setEnabled(false));
    } else {
      audio.pause();
    }
  }, [enabled]);

  useEffect(() => {
    const audio = ref.current;
    if (audio) audio.volume = volume;
  }, [volume]);

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full bg-neutral-900/70 px-3 py-2 text-white backdrop-blur",
        className,
      )}
    >
      {/* preload="none": o arquivo tem ~9 MB e o player começa desligado —
          buscá-lo antes do primeiro clique é dado móvel jogado fora. */}
      <audio ref={ref} src={src} loop preload="none" />

      <button
        type="button"
        onClick={() => setEnabled((value) => !value)}
        aria-label={enabled ? "Disable audio" : "Enable audio"}
        aria-pressed={enabled}
        className="flex size-7 shrink-0 items-center justify-center rounded-full transition hover:bg-white/10"
      >
        {enabled ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
      </button>

      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        onChange={(event) => {
          const next = Number(event.target.value);
          setVolume(next);
          setEnabled(next > 0);
        }}
        aria-label="Volume"
        className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-white/25 accent-white"
      />
    </div>
  );
}
