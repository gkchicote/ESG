"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import {
  countAdmins,
  createUserWithEnrollment,
  deleteUser,
  emailExists,
  getUserById,
  updateUserPassword,
} from "@/lib/db/queries";

/** Garante que só um admin autenticado execute as ações desta página. */
async function requireAdmin() {
  const session = await requireSession();
  if (session.role !== "admin") throw new Error("Acesso restrito a administradores.");
  return session;
}

export type ActionState = { error?: string; success?: string };

const CreateUserSchema = z.object({
  email: z.string().trim().min(1, "Informe o e-mail.").email("E-mail inválido."),
  fullName: z.string().trim().min(2, "Informe o nome completo."),
  password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres."),
  role: z.enum(["student", "admin"]),
  courseId: z.string().uuid().optional().or(z.literal("")),
});

export async function createUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = CreateUserSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    password: formData.get("password"),
    role: formData.get("role") || "student",
    courseId: formData.get("courseId") || "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  if (await emailExists(parsed.data.email)) {
    return { error: "Já existe um usuário com este e-mail." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await createUserWithEnrollment({
    email: parsed.data.email,
    fullName: parsed.data.fullName,
    passwordHash,
    role: parsed.data.role,
    courseId: parsed.data.courseId || null,
  });

  revalidatePath("/admin");
  return { success: `Acesso criado para ${parsed.data.email}.` };
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
