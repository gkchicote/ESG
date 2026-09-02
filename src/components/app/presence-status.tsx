"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { PresenceMark, type Presence } from "@/components/app/presence-mark";

/** De quanto em quanto tempo o navegador avisa que ainda está aí. */
const HEARTBEAT_MS = 30_000;

const subscribe = (onChange: () => void) => {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
};

/**
 * Presença de quem está olhando, derivada de onde a pessoa está.
 *
 * O "offline" aqui é o fallback de conexão: quem vê esta árvore já passou pela
 * sessão, então desconectado só pode ser rede caída. No HTML do servidor
 * assumimos conectado — senão a bolinha nasceria cinza e piscaria para verde
 * na hidratação.
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
  return <PresenceMark status={usePresence()} className={className} />;
}

/** Bolinha com o nome do estado — usado dentro do menu da conta. */
export function PresenceBadge({ className }: { className?: string }) {
  return <PresenceMark status={usePresence()} className={className} labelled />;
}

/**
 * Publica o status para a turma ver no placar de /progresso.
 *
 * Mora no layout do app, e não em cada página: a mudança de estado é uma
 * mudança de rota, e é o mesmo componente que atravessa a navegação. O
 * servidor só guarda o instante do último aviso — quem sumiu vira "offline"
 * sozinho quando o batimento vence, sem depender de despedida nenhuma.
 */
export function PresenceReporter() {
  const presence = usePresence();

  useEffect(() => {
    // Sem rede não há o que avisar: o próprio silêncio conta a história.
    if (presence === "offline") return;

    const controller = new AbortController();
    const send = () => {
      void fetch("/api/presence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: presence }),
        signal: controller.signal,
        keepalive: true,
      }).catch(() => {
        // Batimento perdido não é erro: o próximo (ou o vencimento) resolve.
      });
    };

    send();
    const timer = setInterval(send, HEARTBEAT_MS);

    // Aba em segundo plano tem o timer estrangulado pelo navegador; ao voltar,
    // avisamos na hora em vez de esperar o próximo tique.
    const onVisible = () => {
      if (document.visibilityState === "visible") send();
    };
    document.addEventListener("visibilitychange", onVisible);

    // Fechar a aba apaga a bolinha na hora — sem isto a pessoa continuaria
    // "disponível" no placar dos outros até o batimento vencer.
    const onLeave = () => {
      navigator.sendBeacon(
        "/api/presence",
        new Blob([JSON.stringify({ status: "offline" })], { type: "application/json" }),
      );
    };
    window.addEventListener("pagehide", onLeave);

    return () => {
      clearInterval(timer);
      controller.abort();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", onLeave);
    };
  }, [presence]);

  return null;
}
