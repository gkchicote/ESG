"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * De quanto em quanto tempo o placar volta a perguntar quem está online.
 *
 * Dez segundos é o teto do atraso para ver a turma mudar de estado — a linha
 * de quem está olhando não depende disto, é resolvida no navegador. Cada tique
 * custa a consulta do placar, então baixar mais não compraria muito.
 */
const REFRESH_MS = 10_000;

/**
 * Mantém as bolinhas do placar vivas.
 *
 * `router.refresh()` em vez de uma rota de leitura própria: a página já é
 * renderizada no servidor com a query do placar, então recarregar o mesmo
 * componente custa uma consulta e não duplica regra nenhuma no cliente.
 *
 * Aba em segundo plano não atualiza — ninguém está olhando. Ao voltar para a
 * aba, atualiza na hora, sem esperar o próximo tique.
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
