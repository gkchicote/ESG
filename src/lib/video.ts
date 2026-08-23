export type VideoSource =
  | { kind: "video"; url: string }
  | { kind: "embed"; url: string }
  | { kind: "missing" };

/**
 * Traduz (provider, video_id) na fonte que o player consome.
 * Trocar de hospedagem = mudar as linhas de uma aula no banco, não o código das telas.
 */
export function resolveVideoSource(
  provider: string,
  videoId: string | null,
  lessonId: string,
): VideoSource {
  if (!videoId) return { kind: "missing" };

  switch (provider) {
    case "url":
      return { kind: "video", url: videoId };

    // Arquivo local em content/videos — servido com suporte a Range pela API.
    case "file":
      return { kind: "video", url: `/api/video/${lessonId}` };

    case "youtube":
      return { kind: "embed", url: `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1` };

    case "vimeo":
      return { kind: "embed", url: `https://player.vimeo.com/video/${videoId}` };

    case "bunny": {
      const library = process.env.BUNNY_LIBRARY_ID;
      if (!library) return { kind: "missing" };
      return { kind: "embed", url: `https://iframe.mediadelivery.net/embed/${library}/${videoId}` };
    }

    default:
      return { kind: "missing" };
  }
}
