"use client";

import { useTransition } from "react";
import { Check, ListPlus, Loader2 } from "lucide-react";
import { usePlaylist } from "@/components/app/playlist-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Botão "Adicionar à playlist" de um áudio.
 *
 * É um alterna: clicar de novo tira da playlist. Mostrar "Adicionar" num áudio
 * que já está salvo faria o aluno clicar duas vezes sem entender o que mudou.
 */
export function AddToPlaylistButton({
  materialId,
  label,
  className,
}: {
  materialId: string;
  /** Nome do áudio nas mensagens ("Jake · Jack Hannaford"). */
  label?: string;
  className?: string;
}) {
  const { has, toggle } = usePlaylist();
  const [pending, startTransition] = useTransition();
  const saved = has(materialId);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      aria-pressed={saved}
      onClick={() => startTransition(() => toggle(materialId, label))}
      className={cn(saved && "border-brand/40 bg-brand-soft text-brand hover:bg-brand-soft", className)}
    >
      {pending ? (
        <Loader2 className="animate-spin" />
      ) : saved ? (
        <Check strokeWidth={2.5} />
      ) : (
        <ListPlus strokeWidth={1.75} />
      )}
      {saved ? "Na playlist" : "Adicionar à playlist"}
    </Button>
  );
}
