import Link from "next/link";
import { Logo } from "@/components/app/logo";
import { PlaylistProvider } from "@/components/app/playlist-provider";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { TopNav } from "@/components/app/top-nav";
import { UserMenu } from "@/components/app/user-menu";
import { requireSession } from "@/lib/auth/session";
import { listPlaylistIds } from "@/lib/db/queries";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession();
  // Os ids da playlist sobem no layout, e não em cada página: o contador da
  // aba e o botão de cada áudio vivem em lugares diferentes da árvore.
  const playlistIds = await listPlaylistIds(session.sub);

  return (
    <PlaylistProvider initialIds={playlistIds}>
      <div className="flex min-h-svh flex-col">
        <header className="bg-background/85 sticky top-0 z-40 border-b backdrop-blur-md">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-5 sm:px-8">
            <Link href="/inicio" aria-label="Ir para o início">
              <Logo />
            </Link>
            <TopNav className="hidden sm:flex" isAdmin={session.role === "admin"} />
            <div className="ml-auto flex items-center gap-1.5">
              <ThemeToggle />
              <UserMenu name={session.name} email={session.email} />
            </div>
          </div>
          <TopNav className="flex border-t px-3 pt-1 pb-1.5 sm:hidden" isAdmin={session.role === "admin"} />
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </PlaylistProvider>
  );
}
