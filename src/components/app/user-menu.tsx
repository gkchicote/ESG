"use client";

import { LogOut, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PresenceBadge, PresenceDot } from "@/components/app/presence-status";
import { initials } from "@/lib/format";

export function UserMenu({ name, email }: { name: string; email: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 gap-2 px-1.5 sm:pr-3"
          aria-label="Abrir menu da conta"
        >
          {/* A bolinha encosta no avatar em vez de virar mais um item na
              barra: o status é sobre a pessoa, não sobre a navegação. */}
          <span className="relative">
            <Avatar className="size-7">
              <AvatarFallback className="bg-brand-soft text-brand text-[11px] font-semibold">
                {initials(name)}
              </AvatarFallback>
            </Avatar>
            <PresenceDot className="ring-background absolute -right-0.5 -bottom-0.5 ring-2" />
          </span>
          <span className="hidden text-sm font-medium sm:inline">{name.split(" ")[0]}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">{name}</p>
          <p className="text-muted-foreground truncate text-xs">{email}</p>
          <PresenceBadge className="mt-1.5" />
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <User className="size-4" />
          Minha conta
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* Formulário nativo: quem navega é o navegador, no clique. O menu
            fecha e desmonta logo depois, e a saída acontece do mesmo jeito. */}
        <form action="/api/logout" method="post">
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full cursor-pointer">
              <LogOut className="size-4" />
              Sair
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
