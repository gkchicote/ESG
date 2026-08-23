"use client";

import { useEffect, useRef } from "react";

/** Superfície mínima do player — a mesma para o <video> nativo e o YouTube. */
export type PlayerHandle = {
  currentTime: () => number;
  duration: () => number;
  seek: (seconds: number) => void;
  play: () => void;
};

type YTPlayer = {
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
  destroy: () => void;
};

type YTNamespace = {
  Player: new (el: HTMLElement, options: Record<string, unknown>) => YTPlayer;
  PlayerState: { ENDED: number };
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;

/** Carrega a IFrame API do YouTube uma única vez por aba. */
function loadApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise<YTNamespace>((resolve) => {
    // Outro trecho da página pode ter registrado o callback antes; encadeia.
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return apiPromise;
}

/**
 * Embed do YouTube com a IFrame API ligada, para o palco da aula acompanhar
 * a reprodução como faz com o MP4: retomar de onde parou, salvar a posição
 * e concluir sozinho no fim. Serve para vídeo não listado — o embed depende
 * do ID, não de o vídeo aparecer na busca.
 */
export function YouTubePlayer({
  videoId,
  onReady,
  onEnded,
}: {
  videoId: string;
  onReady: (handle: PlayerHandle) => void;
  onEnded: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);
  const onEndedRef = useRef(onEnded);

  useEffect(() => {
    onReadyRef.current = onReady;
    onEndedRef.current = onEnded;
  }, [onReady, onEnded]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let player: YTPlayer | undefined;
    let cancelled = false;

    // A API troca o elemento passado por um <iframe>. Por isso ela recebe um
    // nó criado fora do React — assim o React nunca tenta remover um filho
    // que já não existe quando o player é destruído.
    const mount = document.createElement("div");
    mount.className = "size-full";
    host.appendChild(mount);

    void loadApi().then((YT) => {
      if (cancelled) return;
      player = new YT.Player(mount, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          rel: 0,
          playsinline: 1,
          modestbranding: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            const p = player;
            if (!p) return;
            onReadyRef.current({
              currentTime: () => p.getCurrentTime() || 0,
              duration: () => p.getDuration() || 0,
              seek: (seconds) => p.seekTo(seconds, true),
              play: () => p.playVideo(),
            });
          },
          onStateChange: (event: { data: number }) => {
            if (event.data === YT.PlayerState.ENDED) onEndedRef.current();
          },
        },
      });
    });

    return () => {
      cancelled = true;
      player?.destroy();
      host.replaceChildren();
    };
  }, [videoId]);

  return <div ref={hostRef} className="size-full [&_iframe]:size-full [&_iframe]:border-0" />;
}
