"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/inicio", label: "Início" },
  { href: "/modulos", label: "Módulos" },
  { href: "/progresso", label: "Progresso" },
];

const ADMIN_LINK = { href: "/admin", label: "Usuários" };

export function TopNav({
  className,
  isAdmin = false,
}: {
  className?: string;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const links = isAdmin ? [...LINKS, ADMIN_LINK] : LINKS;

  return (
    <nav className={cn("flex items-center gap-1", className)}>
      {links.map((link) => {
        const active =
          pathname === link.href ||
          (link.href === "/modulos" && pathname.startsWith("/aula"));

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {link.label}
            {active && (
              <span className="bg-foreground absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
