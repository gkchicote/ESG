"use client";

import { useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { removeUser } from "@/app/actions/admin-users";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function DeleteUserButton({ userId, email }: { userId: string; email: string }) {
  const [pending, startTransition] = useTransition();

  const onConfirm = () => {
    startTransition(async () => {
      const result = await removeUser(userId);
      if (result.error) toast.error(result.error);
      else if (result.success) toast.success(result.success);
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive gap-1.5"
        >
          <Trash2 className="size-3.5" />
          Excluir
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir acesso?</AlertDialogTitle>
          <AlertDialogDescription>
            Isso remove permanentemente a conta de <span className="font-medium">{email}</span>{" "}
            e todo o progresso registrado. Não pode ser desfeito.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={pending}
            className="bg-destructive text-white hover:bg-destructive/90 gap-2"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
