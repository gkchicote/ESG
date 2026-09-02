"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type Presence = "available" | "busy" | "offline";

const STATUS = {
  available: {
    label: "Disponível",
    hint: "Disponível — na plataforma",
    dot: "bg-success",
  },
  busy: {
    label: "Ocupado",
    hint: "Ocupado — assistindo a uma aula",
    dot: "bg-destructive",
  },
  offline: {
    label: "Offline",
    hint: "Offline — sem conexão",
    dot: "bg-muted-foreground/60",
  },
} as const satisfies Record<Presence, { label: string; hint: string; dot: string }>;

const subscribe = (onChange: () => void) => {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
};

/**
 * Presença do aluno, derivada de onde ele está — nada é gravado no banco.
 *
 * O "offline" é o fallback de conexão: quem está vendo esta árvore já passou
 * pela sessão, então desconectado aqui só pode significar rede caída. No HTML
 * do servidor assumimos conectado, senão a bolinha nasceria cinza e piscaria
 * para verde na hidratação.
 */
export function usePresence(): Presence {
  const pathname = usePathname();
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );

  if (!online) return "offline";
  return pathname.startsWith("/aula") ? "busy" : "available";
}

/** Só a bolinha — para encostar no avatar sem roubar espaço do cabeçalho. */
export function PresenceDot({ className }: { className?: string }) {
  const status = STATUS[usePresence()];

  return (
    <span
      role="status"
      title={status.hint}
      className={cn("block size-2.5 rounded-full", status.dot, className)}
    >
      <span className="sr-only">{status.hint}</span>
    </span>
  );
}

/** Bolinha com o nome do estado — usado dentro do menu da conta. */
export function PresenceBadge({ className }: { className?: string }) {
  const status = STATUS[usePresence()];

  return (
    <span
      role="status"
      className={cn("text-muted-foreground flex items-center gap-1.5 text-xs", className)}
    >
      <span className={cn("size-2 shrink-0 rounded-full", status.dot)} aria-hidden />
      {status.label}
    </span>
  );
}
