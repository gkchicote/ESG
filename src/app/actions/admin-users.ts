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
  emailExists,
  getUserById,
  updateUserPassword,
} from "@/lib/db/queries";

export type ActionState = { error?: string; success?: string; link?: string };

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

const CreateInviteSchema = z.object({
  email: z.string().trim().min(1, "Informe o e-mail.").email("E-mail inválido."),
  fullName: z.string().trim().optional(),
  role: z.enum(["student", "admin"]),
  courseId: z.string().uuid().optional().or(z.literal("")),
});

/**
 * Gera um link de convite em vez de criar a senha diretamente — o admin
 * nunca chega a ver a senha, quem preenche é o próprio convidado.
 */
export async function createUserInvite(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdmin();

  const parsed = CreateInviteSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    role: formData.get("role") || "student",
    courseId: formData.get("courseId") || "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  if (await emailExists(parsed.data.email)) {
    return { error: "Já existe um usuário com este e-mail." };
  }

  const token = randomBytes(24).toString("base64url");
  await createInvite({
    token,
    email: parsed.data.email,
    fullName: parsed.data.fullName?.trim() || null,
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
  return { success: `Convite gerado para ${parsed.data.email}.`, link };
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
