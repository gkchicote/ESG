import { SignJWT, jwtVerify } from "jose";

/**
 * Assinatura/verificação do cookie de sessão.
 * Sem dependências de Node — roda também no middleware (edge runtime).
 */

const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "dev-only-secret-troque-em-producao-32-chars",
);

export const SESSION_COOKIE = "lms_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

export type SessionPayload = {
  sub: string;
  email: string;
  name: string;
  role: "student" | "admin";
};

export async function signSession(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(SECRET);
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET, { algorithms: ["HS256"] });
    return {
      sub: String(payload.sub),
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
      role: (payload.role as SessionPayload["role"]) ?? "student",
    };
  } catch {
    return null;
  }
}
