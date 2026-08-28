"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, MailCheck, Send } from "lucide-react";
import { requestPasswordReset, type RequestResetState } from "@/app/actions/password-reset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RequestResetForm() {
  const [state, formAction, pending] = useActionState<RequestResetState, FormData>(
    requestPasswordReset,
    {},
  );

  // A confirmação não diz se o e-mail existe — só que, se existir, o link
  // saiu. É o mesmo texto para quem errou o endereço e para quem acertou.
  if (state.sent) {
    return (
      <div className="space-y-5">
        <div className="border-success/30 bg-success-soft/50 flex gap-3 rounded-lg border px-4 py-4">
          <MailCheck className="text-success mt-0.5 size-5 shrink-0" strokeWidth={1.75} />
          <div className="space-y-1">
            <p className="text-sm font-medium">Se essa conta existir, o link já está a caminho.</p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Confira a caixa de entrada e o spam. O link vale por 1 hora.
            </p>
          </div>
        </div>

        <Button asChild variant="outline" size="lg" className="h-11 w-full">
          <Link href="/login">
            <ArrowLeft className="size-4" />
            Voltar para o login
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="voce@email.com"
          autoFocus
          aria-invalid={!!state.error}
          className="h-11"
        />
      </div>

      {state.error && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-3.5 py-3 text-sm"
        >
          {state.error}
        </div>
      )}

      <Button type="submit" size="lg" disabled={pending} className="h-11 w-full">
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Enviando...
          </>
        ) : (
          <>
            <Send className="size-4" />
            Enviar link de recuperação
          </>
        )}
      </Button>

      <p className="text-muted-foreground text-center text-sm">
        Lembrou a senha?{" "}
        <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
          Voltar para o login
        </Link>
      </p>
    </form>
  );
}
