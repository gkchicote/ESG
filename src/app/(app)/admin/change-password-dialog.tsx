"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { changeUserPassword, type ActionState } from "@/app/actions/admin-users";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ActionState = {};

export function ChangePasswordDialog({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(changeUserPassword, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      toast.success(state.success);
      formRef.current?.reset();
      requestAnimationFrame(() => setOpen(false));
    }
  }, [state.success]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) formRef.current?.reset();
      }}
    >
      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <KeyRound className="size-3.5" />
        Alterar senha
      </Button>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterar senha</DialogTitle>
          <DialogDescription>
            Define uma nova senha para <span className="font-medium">{email}</span>.
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={formAction} className="space-y-4">
          <input type="hidden" name="userId" value={userId} />

          <div className="space-y-2">
            <Label htmlFor={`password-${userId}`}>Nova senha</Label>
            <Input
              id={`password-${userId}`}
              name="password"
              type="text"
              placeholder="Mínimo 6 caracteres"
              minLength={6}
              autoFocus
              required
            />
          </div>

          {state.error && (
            <p role="alert" className="text-destructive text-sm">
              {state.error}
            </p>
          )}

          <DialogFooter className="pt-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending} className="gap-2">
              {pending && <Loader2 className="size-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
