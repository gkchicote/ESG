"use client";

import { LogOut, User } from "lucide-react";
import { signOut } from "@/lib/auth/actions";
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
          <Avatar className="size-7">
            <AvatarFallback className="bg-brand-soft text-brand text-[11px] font-semibold">
              {initials(name)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium sm:inline">{name.split(" ")[0]}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">{name}</p>
          <p className="text-muted-foreground truncate text-xs">{email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <User className="size-4" />
          Minha conta
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOut}>
          <button type="submit" className="w-full">
            <DropdownMenuItem asChild>
              <span className="cursor-pointer">
                <LogOut className="size-4" />
                Sair
              </span>
            </DropdownMenuItem>
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
