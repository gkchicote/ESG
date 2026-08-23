"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSessionCookie } from "@/lib/auth/session";
import { createUserWithEnrollment, emailExists, getInviteByToken, markInviteUsed } from "@/lib/db/queries";

export type AcceptInviteState = { error?: string };

const AcceptInviteSchema = z.object({
  token: z.string().min(1),
  fullName: z.string().trim().min(2, "Informe o nome completo."),
  password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres."),
});

/** Rota pública: quem recebeu o link preenche nome + senha e o acesso é criado na hora. */
export async function acceptInvite(
  _prev: AcceptInviteState,
  formData: FormData,
): Promise<AcceptInviteState> {
  const parsed = AcceptInviteSchema.safeParse({
    token: formData.get("token"),
    fullName: formData.get("fullName"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const invite = await getInviteByToken(parsed.data.token);
  if (!invite) return { error: "Convite inválido." };
  if (invite.used_at) return { error: "Este convite já foi usado." };
  if (new Date(invite.expires_at) < new Date()) return { error: "Este convite expirou." };

  if (await emailExists(invite.email)) {
    return { error: "Já existe um usuário com este e-mail." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const profile = await createUserWithEnrollment({
    email: invite.email,
    fullName: parsed.data.fullName,
    passwordHash,
    role: invite.role,
    courseId: invite.course_id,
  });

  await markInviteUsed(invite.id);

  await createSessionCookie({
    sub: profile.id,
    email: invite.email,
    name: parsed.data.fullName,
    role: invite.role,
  });

  redirect("/inicio");
}
