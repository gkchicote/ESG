import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/app/logo";
import { getInviteByToken } from "@/lib/db/queries";
import { AcceptInviteForm } from "./accept-invite-form";

export const metadata: Metadata = { title: "Criar acesso" };

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await getInviteByToken(token);

  const invalid = !invite || !!invite.used_at || new Date(invite.expires_at) < new Date();

  return (
    <main className="flex min-h-svh flex-col items-center px-6 py-10 sm:px-10">
      <Link href="/" aria-label="Voltar para a página inicial" className="w-fit self-start">
        <Logo />
      </Link>

      <div className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-sm">
          {invalid ? (
            <div className="space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">Convite indisponível</h1>
              <p className="text-muted-foreground text-[15px] leading-relaxed">
                {!invite
                  ? "Esse link de convite não existe."
                  : invite.used_at
                    ? "Esse convite já foi usado."
                    : "Esse convite expirou. Peça um novo link para quem te convidou."}
              </p>
              <Link
                href="/login"
                className="text-foreground mt-4 inline-block text-sm underline underline-offset-4"
              >
                Ir para o login
              </Link>
            </div>
          ) : (
            <>
              <header className="mb-8 space-y-2">
                <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-[0.12em] uppercase">
                  <CheckCircle2 className="size-3.5" />
                  Convite
                </p>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  Crie seu acesso
                </h1>
                <p className="text-muted-foreground text-[15px] leading-relaxed">
                  Preencha seu nome, seu e-mail e uma senha para criar seu acesso.
                </p>
              </header>

              <AcceptInviteForm
                token={token}
                fullName={invite.full_name ?? ""}
                email={invite.email ?? ""}
              />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
