"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { createUser, type ActionState } from "@/app/actions/admin-users";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CourseOption } from "@/lib/db/queries";

const initialState: ActionState = {};

export function CreateUserDialog({ courses }: { courses: CourseOption[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createUser, initialState);
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
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="size-4" />
          Novo usuário
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar acesso</DialogTitle>
          <DialogDescription>
            Cria o login do aluno e já matricula no curso escolhido.
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nome completo</Label>
            <Input id="fullName" name="fullName" placeholder="Ana Duarte" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" placeholder="ana@email.com" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              name="password"
              type="text"
              placeholder="Mínimo 6 caracteres"
              minLength={6}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="role">Perfil</Label>
              <Select name="role" defaultValue="student">
                <SelectTrigger id="role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Aluno</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="courseId">Curso</Label>
              <Select name="courseId" defaultValue={courses[0]?.id ?? ""}>
                <SelectTrigger id="courseId" className="w-full">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
              Criar acesso
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
