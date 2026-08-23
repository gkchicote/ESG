"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, Loader2, UserPlus } from "lucide-react";
import { acceptInvite, type AcceptInviteState } from "@/app/actions/accept-invite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AcceptInviteForm({ token, fullName }: { token: string; fullName: string }) {
  const [state, formAction, pending] = useActionState<AcceptInviteState, FormData>(
    acceptInvite,
    {},
  );
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="token" value={token} />

      <div className="space-y-2">
        <Label htmlFor="fullName">Nome completo</Label>
        <Input
          id="fullName"
          name="fullName"
          placeholder="Ana Duarte"
          defaultValue={fullName}
          autoComplete="name"
          autoFocus
          className="h-11"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Mínimo 6 caracteres"
            minLength={6}
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
            Criando acesso...
          </>
        ) : (
          <>
            <UserPlus className="size-4" />
            Criar acesso
          </>
        )}
      </Button>
    </form>
  );
}
