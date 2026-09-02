"use client";

import { useState } from "react";
import { Download, ExternalLink, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/format";
import type { Material } from "@/lib/db/queries";
import { cn } from "@/lib/utils";

/**
 * Texto da aula lido na própria página.
 *
 * O PDF vem da mesma rota protegida dos anexos (`/api/materials/[id]`), que já
 * responde `Content-Type: application/pdf` e `Content-Disposition: inline` —
 * sem isso o navegador baixaria o arquivo em vez de desenhá-lo aqui. O leitor
 * é o nativo do navegador (paginação, zoom, busca e impressão saem de graça);
 * uma biblioteca só entraria se fosse preciso anotar ou destacar o texto.
 *
 * A altura é fixa de propósito: um PDF não informa quantas páginas tem antes
 * de carregar, então crescer com o conteúdo faria a página inteira pular
 * depois de renderizada. O botão amplia para quase a tela toda.
 *
 * Fica a ressalva do celular: o Safari do iOS desenha só a primeira página
 * dentro de um <iframe> e ignora a rolagem interna. Por isso "Abrir em nova
 * aba" não é um extra — é a saída de quem está no iPhone.
 */
export function LessonPdf({ material, lessonTitle }: { material: Material; lessonTitle: string }) {
  const [expanded, setExpanded] = useState(false);

  const src = `/api/materials/${material.id}`;
  // Salvo no computador, "texto.pdf" não diz de que aula é.
  const fileName = `${lessonTitle} - ${material.title}.pdf`;

  return (
    <figure className="overflow-hidden rounded-xl border">
      <figcaption className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b px-4 py-3">
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{material.title}</span>
          <span className="text-muted-foreground text-xs uppercase">
            PDF
            {material.file_size ? ` · ${formatFileSize(material.file_size)}` : ""}
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
          >
            {expanded ? <Minimize2 strokeWidth={1.75} /> : <Maximize2 strokeWidth={1.75} />}
            {expanded ? "Reduzir" : "Ampliar"}
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={src} target="_blank" rel="noopener noreferrer">
              <ExternalLink strokeWidth={1.75} />
              Nova aba
            </a>
          </Button>
          <Button asChild variant="ghost" size="icon-sm" aria-label={`Baixar ${material.title}`}>
            <a href={src} download={fileName}>
              <Download strokeWidth={1.75} />
            </a>
          </Button>
        </span>
      </figcaption>

      <iframe
        // A altura muda com o botão, e o src leva a âncora do leitor nativo
        // (`FitH` = página na largura do quadro, que é estreito).
        src={`${src}#view=FitH&navpanes=0`}
        title={`${material.title} — ${lessonTitle}`}
        className={cn(
          "bg-muted w-full border-0 transition-[height] duration-200",
          expanded ? "h-[85svh]" : "h-[36rem] max-h-[70svh] min-h-80",
        )}
      />

      <p className="text-muted-foreground border-t px-4 py-2.5 text-xs">
        Não está vendo o documento?{" "}
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground underline underline-offset-4"
        >
          Abra o PDF em uma nova aba
        </a>
        .
      </p>
    </figure>
  );
}
