import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession, type SessionPayload } from "./jwt";

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

/** Usa em qualquer página privada: devolve a sessão ou manda pro login. */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Usa em página ou ação restrita ao admin. */
export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== "admin") throw new Error("Acesso restrito a administradores.");
  return session;
}

export async function createSessionCookie(payload: SessionPayload) {
  const token = await signSession(payload);
  const store = await cookies();
  const hdrs = await headers();
  // Sem reverse proxy na frente, a conexão pode ser HTTP puro mesmo em produção
  // (ex.: deploy direto na VPS). Um proxy que termina TLS (Nginx, Cloudflare
  // Tunnel) seta x-forwarded-proto: https; sem ele, o cookie Secure seria
  // descartado pelo navegador e a sessão se perderia a cada navegação.
  const secure = hdrs.get("x-forwarded-proto") === "https";
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}
