import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/jwt";
import { getSession } from "@/lib/auth/session";
import { updatePresence } from "@/lib/db/queries";

export const runtime = "nodejs";

/**
 * Encerra a sessão e devolve a pessoa para a landing.
 *
 * É uma rota, e não uma Server Action, de propósito: o menu da conta envia um
 * <form method="post"> nativo, então o navegador assume a navegação no
 * instante do clique. O dropdown do Radix fecha (e desmonta o formulário)
 * logo em seguida, o que chegava a abortar a requisição da Server Action e
 * deixar a página em erro — com o cookie ainda de pé.
 *
 * Só aceita POST: um GET permitiria deslogar alguém com um <img src> qualquer.
 */
export async function POST() {
  // Apaga a bolinha do placar na saída. Sem isto, quem sai pelo menu ficaria
  // "disponível" para a turma até o batimento vencer — e o aviso de saída do
  // navegador não é confiável aqui, porque compete com esta própria navegação.
  const session = await getSession();
  if (session) await updatePresence(session.sub, "offline");

  // 303: o navegador troca o POST por um GET ao seguir o Location.
  // Location relativo evita depender do host correto atrás do proxy.
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: "/", "Cache-Control": "no-store" },
  });

  response.cookies.delete({ name: SESSION_COOKIE, path: "/" });

  return response;
}
