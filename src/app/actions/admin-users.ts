"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import {
  countAdmins,
  createInvite,
  deleteUser,
  getUserById,
  updateUserPassword,
} from "@/lib/db/queries";

export type ActionState = { error?: string; success?: string; link?: string };

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

const CreateInviteSchema = z.object({
  role: z.enum(["student", "admin"]),
  courseId: z.string().uuid().optional().or(z.literal("")),
});

/**
 * Gera só o link de convite. O admin define o que é decisão dele — perfil e
 * curso — e nada mais: nome, e-mail e senha são preenchidos por quem recebe
 * o link, então o admin nunca vê a senha nem precisa saber o e-mail antes.
 */
export async function createUserInvite(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdmin();

  const parsed = CreateInviteSchema.safeParse({
    role: formData.get("role") || "student",
    courseId: formData.get("courseId") || "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const token = randomBytes(24).toString("base64url");
  await createInvite({
    token,
    role: parsed.data.role,
    courseId: parsed.data.courseId || null,
    createdBy: session.sub,
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  });

  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const host = hdrs.get("host");
  const link = `${proto}://${host}/convite/${token}`;

  revalidatePath("/admin");
  return { success: "Link de convite gerado.", link };
}

const ChangePasswordSchema = z.object({
  userId: z.string().uuid(),
  password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres."),
});

export async function changeUserPassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = ChangePasswordSchema.safeParse({
    userId: formData.get("userId"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const target = await getUserById(parsed.data.userId);
  if (!target) return { error: "Usuário não encontrado." };

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await updateUserPassword(parsed.data.userId, passwordHash);

  revalidatePath("/admin");
  return { success: `Senha de ${target.email} atualizada.` };
}

export async function removeUser(userId: string): Promise<ActionState> {
  const session = await requireAdmin();

  if (userId === session.sub) {
    return { error: "Você não pode excluir a própria conta." };
  }

  const target = await getUserById(userId);
  if (!target) return { error: "Usuário não encontrado." };

  if (target.role === "admin") {
    const { count } = (await countAdmins()) ?? { count: "0" };
    if (Number(count) <= 1) {
      return { error: "Não é possível excluir o único administrador." };
    }
  }

  await deleteUser(userId);
  revalidatePath("/admin");
  return { success: `${target.email} removido.` };
}
