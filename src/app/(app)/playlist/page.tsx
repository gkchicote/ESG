import type { Metadata } from "next";
import Link from "next/link";
import { Headphones } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { listPlaylist } from "@/lib/db/queries";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { PlaylistPlayer } from "./playlist-player";

export const metadata: Metadata = { title: "Playlist" };

/**
 * Playlist de áudios do aluno.
 *
 * A ideia é treinar escuta sem depender da aula: os áudios salvos tocam em
 * sequência daqui mesmo, sem voltar para a página de cada uma.
 */
export default async function PlaylistPage() {
  const session = await requireSession();
  const tracks = await listPlaylist(session.sub);

  if (tracks.length === 0) {
    return (
      <EmptyState
        title="Sua playlist está vazia"
        description="Em cada aula, o botão “Adicionar à playlist” guarda o áudio aqui. Depois é só dar play e ouvir tudo em sequência."
        action={
          <Button asChild size="lg">
            <Link href="/modulos">Escolher uma aula</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <header className="mb-8 space-y-1.5">
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-[0.12em] uppercase">
          <Headphones className="size-3.5" />
          Seus áudios
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Playlist</h1>
        <p className="text-muted-foreground max-w-2xl text-[15px] leading-relaxed">
          Tudo o que você salvou, na ordem em que salvou. Um áudio puxa o outro — dá para deixar
          tocando enquanto faz outra coisa.
        </p>
      </header>

      <PlaylistPlayer tracks={tracks} />
    </div>
  );
}
