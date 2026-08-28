"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getProfileByEmail, touchLastLogin } from "@/lib/db/queries";
import { createSessionCookie } from "./session";

const LoginSchema = z.object({
  email: z.string().trim().min(1, "Informe seu e-mail.").email("E-mail inválido."),
  password: z.string().min(1, "Informe sua senha."),
});

export type LoginState = { error?: string; fieldErrors?: Record<string, string> };

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors };
  }

  const profile = await getProfileByEmail(parsed.data.email);

  // Compara sempre um hash, mesmo sem usuário, para não vazar quais e-mails existem.
  const hash = profile?.password_hash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidiu";
  const ok = await bcrypt.compare(parsed.data.password, hash);

  if (!profile || !ok) {
    return { error: "E-mail ou senha incorretos." };
  }

  await touchLastLogin(profile.id);

  await createSessionCookie({
    sub: profile.id,
    email: profile.email,
    name: profile.full_name,
    role: profile.role,
  });

  const next = String(formData.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/inicio");
}
