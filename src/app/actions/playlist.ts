"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { addPlaylistItem, removePlaylistItem } from "@/lib/db/queries";

/**
 * Playlist de áudios do aluno.
 *
 * Server Action é alcançável por POST direto, não só pelo botão — por isso a
 * sessão é conferida aqui e o direito ao material é conferido no SQL de
 * `addPlaylistItem`. O id vem do cliente, então passa por uma peneira de
 * formato antes de virar uuid no banco: um texto qualquer viraria erro de
 * sintaxe do Postgres (500) em vez de uma recusa limpa.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function addAudioToPlaylist(materialId: string) {
  const session = await requireSession();
  if (!UUID.test(materialId)) return { ok: false as const };

  const added = await addPlaylistItem(session.sub, materialId);
  if (!added) return { ok: false as const };

  revalidatePath("/playlist");
  return { ok: true as const };
}

export async function removeAudioFromPlaylist(materialId: string) {
  const session = await requireSession();
  if (!UUID.test(materialId)) return { ok: false as const };

  await removePlaylistItem(session.sub, materialId);

  revalidatePath("/playlist");
  return { ok: true as const };
}
