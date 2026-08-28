import Link from "next/link";
import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import { Logo } from "@/components/app/logo";
import { hashResetToken } from "@/lib/auth/password-reset";
import { getPasswordResetByHash } from "@/lib/db/queries";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Nova senha" };

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // A URL traz o token cru; no banco só existe o hash dele.
  const reset = await getPasswordResetByHash(hashResetToken(token));
  const invalid = !reset || !!reset.used_at || new Date(reset.expires_at) < new Date();

  return (
    <main className="flex min-h-svh flex-col items-center px-6 py-10 sm:px-10">
      <Link href="/" aria-label="Voltar para a página inicial" className="w-fit self-start">
        <Logo />
      </Link>

      <div className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-sm">
          {invalid ? (
            <div className="space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">Link indisponível</h1>
              <p className="text-muted-foreground text-[15px] leading-relaxed">
                {!reset
                  ? "Esse link de recuperação não existe."
                  : reset.used_at
                    ? "Esse link já foi usado. Se ainda precisa trocar a senha, peça outro."
                    : "Esse link expirou — ele vale por 1 hora."}
              </p>
              <Link
                href="/esqueci-senha"
                className="text-foreground mt-4 inline-block text-sm underline underline-offset-4"
              >
                Pedir um novo link
              </Link>
            </div>
          ) : (
            <>
              <header className="mb-8 space-y-2">
                <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-[0.12em] uppercase">
                  <KeyRound className="size-3.5" />
                  Nova senha
                </p>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  Escolha uma senha nova
                </h1>
                <p className="text-muted-foreground text-[15px] leading-relaxed">
                  Você está redefinindo a senha de{" "}
                  <span className="font-medium">{reset.email}</span>.
                </p>
              </header>

              <ResetPasswordForm token={token} />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
