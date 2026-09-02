"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { toast } from "sonner";
import { addAudioToPlaylist, removeAudioFromPlaylist } from "@/app/actions/playlist";

/**
 * Estado da playlist no cliente.
 *
 * A fonte da verdade é o banco (ver `playlist_items`) — este contexto guarda
 * só os ids já salvos, para que o botão de cada aula saiba se aquele áudio já
 * está na lista e para que a aba do topo mostre o contador.
 *
 * A lista é semeada pelo layout, que a lê do banco a cada requisição, e é
 * atualizada de forma otimista: o clique muda a tela na hora e desfaz sozinho
 * se o servidor recusar. Sem isso, salvar um áudio pareceria travar por um
 * instante — a ida ao servidor é rápida, mas não é instantânea.
 */
type PlaylistState = {
  ids: string[];
  count: number;
  has: (materialId: string) => boolean;
  /** Salva o áudio. Devolve quando o servidor confirmou (ou desfez). */
  add: (materialId: string, label?: string) => Promise<void>;
  remove: (materialId: string, label?: string) => Promise<void>;
  toggle: (materialId: string, label?: string) => Promise<void>;
};

const PlaylistContext = createContext<PlaylistState | null>(null);

export function PlaylistProvider({
  initialIds,
  children,
}: {
  initialIds: string[];
  children: React.ReactNode;
}) {
  const [ids, setIds] = useState(initialIds);

  // Set derivado da lista: `has` é chamado por todo botão de áudio na tela.
  const idSet = useMemo(() => new Set(ids), [ids]);
  const has = useCallback((materialId: string) => idSet.has(materialId), [idSet]);

  const add = useCallback(async (materialId: string, label?: string) => {
    setIds((current) => (current.includes(materialId) ? current : [...current, materialId]));

    const result = await addAudioToPlaylist(materialId);
    if (result.ok) {
      toast.success(label ? `${label} entrou na playlist` : "Áudio salvo na playlist");
      return;
    }

    setIds((current) => current.filter((id) => id !== materialId));
    toast.error("Não foi possível salvar este áudio na playlist.");
  }, []);

  const remove = useCallback(async (materialId: string, label?: string) => {
    let previous: string[] = [];
    setIds((current) => {
      previous = current;
      return current.filter((id) => id !== materialId);
    });

    const result = await removeAudioFromPlaylist(materialId);
    if (result.ok) {
      toast.success(label ? `${label} saiu da playlist` : "Áudio removido da playlist");
      return;
    }

    setIds(previous);
    toast.error("Não foi possível remover este áudio da playlist.");
  }, []);

  const toggle = useCallback(
    (materialId: string, label?: string) =>
      idSet.has(materialId) ? remove(materialId, label) : add(materialId, label),
    [idSet, add, remove],
  );

  const value = useMemo<PlaylistState>(
    () => ({ ids, count: ids.length, has, add, remove, toggle }),
    [ids, has, add, remove, toggle],
  );

  return <PlaylistContext.Provider value={value}>{children}</PlaylistContext.Provider>;
}

export function usePlaylist(): PlaylistState {
  const context = useContext(PlaylistContext);
  if (!context) {
    throw new Error("usePlaylist precisa de <PlaylistProvider> acima na árvore.");
  }
  return context;
}
