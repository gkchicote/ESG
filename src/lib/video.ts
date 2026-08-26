export type VideoSource =
  /** MP4 tocado no <video> nativo — arquivo local ou URL direta. */
  | { kind: "video"; url: string }
  /** YouTube: o player usa a IFrame API para acompanhar o progresso. */
  | { kind: "youtube"; videoId: string }
  /** Demais provedores: iframe simples, sem integração de progresso. */
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

    // Cloudflare R2, bucket privado: `videoId` é a chave do objeto. A mesma
    // rota do `file` responde, mas redirecionando para uma URL assinada —
    // as credenciais ficam no servidor e o player nunca as vê. Do ponto de
    // vista da tela é um <video> comum, com progresso e retomada.
    case "r2":
      return { kind: "video", url: `/api/video/${lessonId}` };

    // Vale para vídeos não listados: o embed exige só o ID, não a listagem.
    case "youtube":
      return { kind: "youtube", videoId };

    case "vimeo":
      return { kind: "embed", url: `https://player.vimeo.com/video/${videoId}` };

    // Google Drive: precisa de "Qualquer pessoa com o link" como visualizador.
    // Sem API de postMessage, então cai no embed simples — sem retomar de
    // onde parou nem conclusão automática, diferente do YouTube.
    case "drive":
      return { kind: "embed", url: `https://drive.google.com/file/d/${videoId}/preview` };

    case "bunny": {
      const library = process.env.BUNNY_LIBRARY_ID;
      if (!library) return { kind: "missing" };
      return { kind: "embed", url: `https://iframe.mediadelivery.net/embed/${library}/${videoId}` };
    }

    default:
      return { kind: "missing" };
  }
}
