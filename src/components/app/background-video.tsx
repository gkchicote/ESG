"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type NetworkInformation = { saveData?: boolean; effectiveType?: string };

/** Abaixo disto vale a variante leve: telas de celular em retrato. */
const SMALL_SCREEN = "(max-width: 767px)";

/**
 * Conexão em que baixar vídeo decorativo é hostil: "economia de dados" ligada
 * ou rede 2G. Nesses casos o pôster já conta a mesma história.
 */
function connectionIsFrugal() {
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  if (!connection) return false;
  return Boolean(connection.saveData) || /2g$/.test(connection.effectiveType ?? "");
}

/**
 * Vídeo decorativo de fundo.
 *
 * Fica mudo e em loop, e o `<source>` só é montado no cliente, depois de
 * decidir *se* e *qual* arquivo vale a pena baixar. Até lá o elemento mostra
 * o pôster — que também é o estado final para quem tem "reduzir movimento"
 * ligado (vídeo em loop atrás de texto é justamente o tipo de animação que
 * essa preferência existe para desligar), para quem está em rede fraca e para
 * quem não passa no `loadOn`.
 *
 * Montar o `<source>` tarde é o ponto: com `preload` estático o navegador
 * busca o arquivo mesmo com o elemento em `display:none`, então a coluna de
 * marca do login — visível só em `lg:` — custava 10 MB em todo celular.
 */
export function BackgroundVideo({
  src,
  mobileSrc,
  poster,
  className,
  loadOn,
}: {
  src: string;
  /** Variante leve servida em telas pequenas. Sem ela, `src` vale para todas. */
  mobileSrc?: string;
  poster: string;
  className?: string;
  /** Media query que o viewport precisa satisfazer para o vídeo ser baixado. */
  loadOn?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const small = window.matchMedia(SMALL_SCREEN);
    const gate = loadOn ? window.matchMedia(loadOn) : null;
    const queries = [motion, small, ...(gate ? [gate] : [])];

    const sync = () => {
      const worthIt = !motion.matches && (gate?.matches ?? true) && !connectionIsFrugal();
      if (!worthIt) return setSource(null);
      setSource(small.matches && mobileSrc ? mobileSrc : src);
    };

    sync();
    for (const query of queries) query.addEventListener("change", sync);
    return () => {
      for (const query of queries) query.removeEventListener("change", sync);
    };
  }, [src, mobileSrc, loadOn]);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    // `load()` é o que faz o elemento reler o `<source>` que o React acabou de
    // montar (ou desmontar) — trocar o filho sozinho não reinicia a mídia.
    video.load();
    if (!source) return;

    void video.play().catch(() => {
      // Autoplay bloqueado (bateria fraca, política do navegador):
      // o pôster continua no lugar, então não há nada a fazer.
    });
  }, [source]);

  return (
    <video
      ref={ref}
      aria-hidden
      tabIndex={-1}
      poster={poster}
      loop
      muted
      playsInline
      preload="none"
      className={cn("absolute inset-0 size-full object-cover", className)}
    >
      {source && <source src={source} type="video/mp4" />}
    </video>
  );
}
