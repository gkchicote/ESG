"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { signIn, type LoginState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function LoginForm() {
  const searchParams = useSearchParams();
  const [state, formAction, pending] = useActionState<LoginState, FormData>(signIn, {});
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={searchParams.get("next") ?? ""} />

      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="voce@email.com"
          autoFocus
          aria-invalid={!!state.fieldErrors?.email}
          className="h-11"
        />
        {state.fieldErrors?.email && (
          <p className="text-destructive text-sm">{state.fieldErrors.email}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            aria-invalid={!!state.fieldErrors?.password}
            className="h-11 pr-11"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-md transition-colors"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {state.fieldErrors?.password && (
          <p className="text-destructive text-sm">{state.fieldErrors.password}</p>
        )}
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
            Entrando...
          </>
        ) : (
          <>
            <LogIn className="size-4" />
            Entrar
          </>
        )}
      </Button>

      <p className={cn("text-muted-foreground text-center text-sm")}>
        Esqueceu a senha?{" "}
        <a
          href="mailto:suporte@fluently.com.br"
          className="text-foreground underline-offset-4 hover:underline"
        >
          Fale com o suporte
        </a>
      </p>
    </form>
  );
}
