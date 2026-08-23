"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Vídeo decorativo de fundo.
 *
 * Fica mudo e em loop. Quem tem "reduzir movimento" ligado no sistema recebe
 * apenas o frame de poster — vídeo em loop atrás de texto é justamente o tipo
 * de animação que essa preferência existe para desligar.
 */
export function BackgroundVideo({
  src,
  poster,
  className,
}: {
  src: string;
  poster: string;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");

    const sync = () => {
      if (media.matches) {
        video.pause();
        video.currentTime = 0;
      } else {
        void video.play().catch(() => {
          // Autoplay bloqueado (bateria fraca, política do navegador):
          // o poster continua no lugar, então não há nada a fazer.
        });
      }
    };

    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return (
    <video
      ref={ref}
      aria-hidden
      tabIndex={-1}
      poster={poster}
      loop
      muted
      playsInline
      preload="auto"
      className={cn("absolute inset-0 size-full object-cover", className)}
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}
