import Link from "next/link";
import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import { Logo } from "@/components/app/logo";
import { RequestResetForm } from "./request-reset-form";

export const metadata: Metadata = { title: "Esqueci minha senha" };

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-svh flex-col items-center px-6 py-10 sm:px-10">
      <Link href="/" aria-label="Voltar para a página inicial" className="w-fit self-start">
        <Logo />
      </Link>

      <div className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-sm">
          <header className="mb-8 space-y-2">
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-[0.12em] uppercase">
              <KeyRound className="size-3.5" />
              Recuperar acesso
            </p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Esqueceu sua senha?
            </h1>
            <p className="text-muted-foreground text-[15px] leading-relaxed">
              Informe o e-mail da sua conta e enviamos um link para você escolher uma senha nova.
            </p>
          </header>

          <RequestResetForm />
        </div>
      </div>
    </main>
  );
}
