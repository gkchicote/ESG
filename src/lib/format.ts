/**
 * Fuso de referência do produto: a turma é brasileira e o servidor roda em UTC
 * no deploy. Todo rótulo de dia ("hoje", "ontem") e toda contagem de ofensiva
 * (feita no banco, com `at time zone`) usam este mesmo relógio — senão, entre
 * 21h e a meia-noite de Brasília o dia UTC já virou e a aula concluída à tarde
 * apareceria como "ontem".
 */
export const APP_TIME_ZONE = "America/Sao_Paulo";

const dayParts = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * O dia civil de Brasília de um instante, como número de dias desde a época.
 * Subtrair dois destes dá a diferença em dias de calendário — sem depender do
 * fuso do processo (UTC no servidor, o do aluno no navegador).
 */
function brasiliaDay(date: Date): number {
  const parts = dayParts.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return Math.floor(Date.UTC(get("year"), get("month") - 1, get("day")) / 86_400_000);
}

/** 3725 -> "1h 02min" | 612 -> "10min" | 45 -> "45s" | 0 -> "—" */
export function formatDuration(totalSeconds: number): string {
  // Aula publicada sem duração cadastrada (vídeo ainda por vir): "0s" soaria
  // como erro, então o traço marca "a definir".
  if (!(totalSeconds > 0)) return "—";
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}min`;
  if (m > 0) return `${m}min`;
  return `${s}s`;
}

/** 3725 -> "1:02:05" | 612 -> "10:12" — para o player */
export function formatTimecode(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * "hoje", "ontem", "há 3 dias", ou a data cheia — sempre no fuso de Brasília,
 * para bater com o dia que conta a ofensiva. `now` só existe para teste.
 */
export function formatLastAccess(value: string | Date | null, now: Date = new Date()): string {
  if (!value) return "primeiro acesso";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "primeiro acesso";

  // Carimbo no futuro (relógio do cliente adiantado, por exemplo) é "hoje", e
  // não uma contagem negativa.
  const days = Math.max(0, brasiliaDay(now) - brasiliaDay(date));

  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;
  if (days < 30) return `há ${Math.floor(days / 7)} semana${days >= 14 ? "s" : ""}`;
  return date.toLocaleDateString("pt-BR", {
    timeZone: APP_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * "28/08/2026 14:32" — data e hora cheias da última atividade (login ou aula),
 * no fuso de Brasília. O servidor roda em UTC no deploy; fixar o fuso evita
 * mostrar hora errada.
 */
export function formatSeenAt(value: string | Date | null): string {
  if (!value) return "nunca acessou";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "nunca acessou";

  return date.toLocaleString("pt-BR", {
    timeZone: APP_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
