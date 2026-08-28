"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  RESET_TTL_MS,
  createResetToken,
  hashResetToken,
  resetEmail,
} from "@/lib/auth/password-reset";
import { sendEmail } from "@/lib/email";
import {
  closePasswordResets,
  createPasswordReset,
  getPasswordResetByHash,
  getProfileByEmail,
  hasRecentPasswordReset,
  updateUserPassword,
} from "@/lib/db/queries";

/** Um pedido a cada 2 minutos por conta — ver `hasRecentPasswordReset`. */
const THROTTLE_SECONDS = 120;

export type RequestResetState = { error?: string; sent?: boolean };

const RequestSchema = z.object({
  email: z.string().trim().min(1, "Informe seu e-mail.").email("E-mail inválido."),
});

/**
 * Pedido de redefinição — rota pública.
 *
 * A resposta é sempre a mesma, exista o e-mail ou não: um formulário aberto
 * que responde "não achei" vira uma lista de quem estuda aqui. Quem digitou o
 * endereço certo recebe o link; quem digitou errado vê o mesmo texto e não
 * recebe nada.
 */
export async function requestPasswordReset(
  _prev: RequestResetState,
  formData: FormData,
): Promise<RequestResetState> {
  const parsed = RequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const profile = await getProfileByEmail(parsed.data.email);

  if (profile && !(await hasRecentPasswordReset(profile.id, THROTTLE_SECONDS))) {
    const { token, tokenHash } = createResetToken();
    await createPasswordReset({
      profileId: profile.id,
      tokenHash,
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    });

    const hdrs = await headers();
    const proto = hdrs.get("x-forwarded-proto") ?? "http";
    const host = hdrs.get("host");
    const link = `${proto}://${host}/redefinir-senha/${token}`;

    const { subject, text, html } = resetEmail(profile.full_name, link);
    await sendEmail({ to: profile.email, subject, text, html });
  }

  return { sent: true };
}

export type ResetPasswordState = { error?: string };

const ResetSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres."),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: "As senhas não são iguais.",
    path: ["confirm"],
  });

/**
 * Troca a senha a partir do token do e-mail — também rota pública.
 *
 * O token vale uma vez só: junto com a senha nova, todos os pedidos em aberto
 * da conta são fechados, então nem este link nem outro que ainda esteja na
 * caixa de entrada abrem a tela de novo.
 */
export async function resetPassword(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const parsed = ResetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const reset = await getPasswordResetByHash(hashResetToken(parsed.data.token));
  if (!reset || reset.used_at || new Date(reset.expires_at) < new Date()) {
    return { error: "Este link não vale mais. Peça um novo em “Esqueci minha senha”." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await updateUserPassword(reset.profile_id, passwordHash);
  await closePasswordResets(reset.profile_id);

  // Sem criar sessão de propósito: entrar com a senha nova é o que confirma,
  // para a própria pessoa, que a troca funcionou.
  redirect("/login?senha=redefinida");
}
