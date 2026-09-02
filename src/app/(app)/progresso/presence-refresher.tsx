"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** De quanto em quanto tempo o placar volta a perguntar quem está online. */
const REFRESH_MS = 30_000;

/**
 * Mantém as bolinhas do placar vivas.
 *
 * `router.refresh()` em vez de uma rota de leitura própria: a página já é
 * renderizada no servidor com a query do placar, então recarregar o mesmo
 * componente custa uma consulta e não duplica regra nenhuma no cliente.
 *
 * Aba em segundo plano não atualiza — ninguém está olhando, e o tique voltaria
 * a rodar de qualquer jeito quando a pessoa voltasse.
 */
export function PresenceRefresher() {
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };

    const timer = setInterval(tick, REFRESH_MS);
    document.addEventListener("visibilitychange", tick);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router]);

  return null;
}
