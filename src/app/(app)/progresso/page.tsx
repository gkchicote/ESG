import type { Metadata } from "next";
import { Flame, Sparkles, Trophy } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getEnrolledCourse, listScoreboard } from "@/lib/db/queries";
import { formatLastAccess, initials } from "@/lib/format";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/app/empty-state";
import { PRESENCE, PresenceMark, toPresence } from "@/components/app/presence-mark";
import { PresenceDot, PresenceHint } from "@/components/app/presence-status";
import { PresenceRefresher } from "./presence-refresher";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Progresso" };

/**
 * Placar da turma — aberto a qualquer aluno matriculado.
 *
 * A lista é do curso de quem está olhando: comparar-se com quem estuda outra
 * coisa não diz nada. Só nome, módulo atual e pontos vão para a tela; e-mail,
 * percentual e último login continuam restritos a /admin.
 */
export default async function ProgressPage() {
  const session = await requireSession();
  const course = await getEnrolledCourse(session.sub);

  if (!course) {
    return (
      <EmptyState
        title="Nenhum curso liberado ainda"
        description="Assim que sua matrícula for ativada, você entra no placar da turma."
      />
    );
  }

  const rows = await listScoreboard(course.id);
  const me = rows.find((row) => row.profile_id === session.sub);
  // Posição no placar contando empates: dois com 40 pontos dividem o 1º lugar
  // e o próximo é 3º. Sem isto, quem empata vê números diferentes na tela.
  const rankOf = (points: number) => rows.filter((row) => row.points > points).length + 1;

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
      <header className="mb-8 space-y-1.5">
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-[0.12em] uppercase">
          <Trophy className="size-3.5" />
          Progresso da turma
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Você não está estudando sozinho
        </h1>
        <p className="text-muted-foreground max-w-2xl text-[15px] leading-relaxed">
          Cada aula concluída vale <span className="text-foreground font-medium">1 ponto</span> e
          acende a <span className="text-foreground font-medium">ofensiva</span> do dia. Veja em
          que módulo cada pessoa de {course.title} está e quanto já somou.
        </p>
      </header>

      {/* Onde eu estou ---------------------------------------------- */}
      {me && (
        <section
          aria-label="Sua posição"
          className="bg-brand text-brand-foreground mb-6 flex flex-wrap items-center gap-x-8 gap-y-4 rounded-2xl px-7 py-6"
        >
          <div>
            <p className="text-[11px] font-semibold tracking-[0.14em] text-white/70 uppercase">
              Sua posição
            </p>
            <p className="tabular mt-1 text-2xl font-semibold tracking-tight">
              {rankOf(me.points)}º
              <span className="ml-1.5 text-sm font-normal text-white/70">de {rows.length}</span>
            </p>
          </div>

          <div>
            <p className="text-[11px] font-semibold tracking-[0.14em] text-white/70 uppercase">
              Seus pontos
            </p>
            <p className="tabular mt-1 text-2xl font-semibold tracking-tight">{me.points}</p>
          </div>

          <div>
            <p className="text-[11px] font-semibold tracking-[0.14em] text-white/70 uppercase">
              Sua ofensiva
            </p>
            <p className="tabular mt-1 flex items-baseline gap-1.5 text-2xl font-semibold tracking-tight">
              <Flame
                className="size-5 shrink-0 self-center"
                strokeWidth={1.75}
                fill="currentColor"
                fillOpacity={me.streak_days > 0 ? 0.25 : 0}
                aria-hidden
              />
              {me.streak_days}
              <span className="text-sm font-normal text-white/70">
                {me.streak_days === 1 ? "dia" : "dias"}
              </span>
            </p>
          </div>

          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-white/70 uppercase">
              Módulo atual
            </p>
            <p className="mt-1 truncate text-[15px] font-medium">
              {me.module_title ?? "Ainda não começou"}
            </p>
          </div>
        </section>
      )}

      {/* Placar ------------------------------------------------------ */}
      {/* Sem a legenda a bolinha vira enfeite: verde e vermelho não dizem
          sozinhos o que significam. */}
      <div className="text-muted-foreground mb-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 px-1">
        <PresenceMark status="available" labelled />
        <PresenceMark status="busy" labelled />
        <PresenceMark status="offline" labelled />
      </div>

      <PresenceRefresher />

      <div className="overflow-hidden rounded-xl border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>Aluno</TableHead>
                <TableHead>Módulo atual</TableHead>
                <TableHead className="text-right">Ofensiva</TableHead>
                <TableHead className="text-right">Pontos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const rank = rankOf(row.points);
                const isMe = row.profile_id === session.sub;
                const presence = toPresence(row.presence);

                return (
                  <TableRow key={row.profile_id} className={cn(isMe && "bg-brand-soft/40")}>
                    <TableCell className="text-center">
                      {/* O pódio ganha a taça; do 4º em diante, só o número. */}
                      {rank <= 3 && row.points > 0 ? (
                        <Trophy
                          className={cn(
                            "mx-auto size-4",
                            rank === 1 && "text-brand",
                            rank > 1 && "text-muted-foreground",
                          )}
                          strokeWidth={1.75}
                          aria-label={`${rank}º lugar`}
                        />
                      ) : (
                        <span className="text-muted-foreground tabular text-sm">{rank}</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="relative shrink-0">
                          <Avatar className="size-8">
                            <AvatarFallback className="bg-brand-soft text-brand text-[11px] font-semibold">
                              {initials(row.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          {/* A própria linha não espera o servidor: quem
                              chega vindo de uma aula chegaria aqui ainda
                              marcado como "ocupado", porque a página é
                              renderizada antes de o batimento novo aterrissar.
                              No navegador o estado já é o de agora. */}
                          {isMe ? (
                            <PresenceDot className="ring-background absolute -right-0.5 -bottom-0.5 ring-2" />
                          ) : (
                            <PresenceMark
                              status={presence}
                              className="ring-background absolute -right-0.5 -bottom-0.5 ring-2"
                            />
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium">{row.full_name}</p>
                            {isMe && (
                              <Badge variant="secondary" className="shrink-0 text-[10px]">
                                Você
                              </Badge>
                            )}
                          </div>
                          {/* Quem está online agora não precisa de "há 2 dias":
                              o estado ao vivo é a informação mais nova que
                              existe sobre a pessoa. */}
                          <p className="text-muted-foreground text-xs">
                            {isMe ? (
                              <PresenceHint />
                            ) : presence === "offline" ? (
                              formatLastAccess(row.last_accessed_at)
                            ) : (
                              PRESENCE[presence].hint
                            )}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      {row.module_title ? (
                        <div className="min-w-0">
                          <p className="text-muted-foreground text-xs font-medium tracking-wide">
                            MÓDULO {row.module_position}
                          </p>
                          <p className="truncate text-sm">{row.module_title}</p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Ainda não começou</span>
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      {/* Sem ofensiva viva o fogo fica apagado (cinza, sem
                          preenchimento) em vez de sumir: a coluna não muda de
                          largura de linha para linha. */}
                      <span
                        className={cn(
                          "tabular inline-flex items-center gap-1.5 text-sm font-semibold",
                          row.streak_days === 0 && "text-muted-foreground font-normal",
                        )}
                        title={
                          row.streak_days > 0
                            ? `${row.streak_days} ${row.streak_days === 1 ? "dia" : "dias"} seguidos estudando`
                            : "Sem ofensiva ativa"
                        }
                      >
                        <Flame
                          className={cn("size-3.5", row.streak_days > 0 && "text-streak")}
                          strokeWidth={1.75}
                          fill="currentColor"
                          fillOpacity={row.streak_days > 0 ? 0.2 : 0}
                        />
                        {row.streak_days}
                      </span>
                    </TableCell>

                    <TableCell className="text-right">
                      <span className="tabular inline-flex items-center gap-1.5 text-sm font-semibold">
                        <Sparkles className="text-brand size-3.5" strokeWidth={1.75} />
                        {row.points}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <p className="text-muted-foreground mt-4 text-sm">
        O ponto é somado assim que a aula é concluída e não é perdido depois — o placar só anda
        para a frente. Já a ofensiva conta dias, não aulas: ela sobe na primeira aula que você
        concluir no dia e zera quando um dia passa sem nenhuma. Entrar na plataforma não conta.
      </p>
    </div>
  );
}
