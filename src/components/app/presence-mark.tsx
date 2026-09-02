import { cn } from "@/lib/utils";

/**
 * Vocabulário de presença, compartilhado pelo cabeçalho (status de quem está
 * olhando) e pelo placar de /progresso (status da turma). Fica fora do módulo
 * "use client" de propósito: a bolinha do placar é renderizada no servidor.
 */
export type Presence = "available" | "busy" | "offline";

export const PRESENCE = {
  available: { label: "Disponível", hint: "Disponível — na plataforma", dot: "bg-success" },
  busy: { label: "Ocupado", hint: "Ocupado — assistindo a uma aula", dot: "bg-destructive" },
  offline: { label: "Offline", hint: "Offline — fora da plataforma", dot: "bg-muted-foreground/50" },
} as const satisfies Record<Presence, { label: string; hint: string; dot: string }>;

/** Aceita o texto que veio do banco — a coluna é livre, o app é que não é. */
export function toPresence(value: string | null | undefined): Presence {
  return value === "available" || value === "busy" ? value : "offline";
}

/** A bolinha, sem estado próprio: quem chama já sabe o status. */
export function PresenceMark({
  status,
  className,
  labelled = false,
}: {
  status: Presence;
  className?: string;
  /** Mostra o rótulo em texto ao lado — no menu da conta, por exemplo. */
  labelled?: boolean;
}) {
  const { label, hint, dot } = PRESENCE[status];

  if (labelled) {
    return (
      <span
        role="status"
        className={cn("text-muted-foreground flex items-center gap-1.5 text-xs", className)}
      >
        <span className={cn("size-2 shrink-0 rounded-full", dot)} aria-hidden />
        {label}
      </span>
    );
  }

  return (
    <span role="status" title={hint} className={cn("block size-2.5 rounded-full", dot, className)}>
      <span className="sr-only">{hint}</span>
    </span>
  );
}
