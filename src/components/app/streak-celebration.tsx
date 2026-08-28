"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Flame } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Tempo na tela antes de sair sozinha. Cabe ler o número e a frase sem pressa. */
const AUTO_DISMISS_MS = 6000;

/**
 * Brasas: posição inicial, deriva horizontal, duração e atraso fixos.
 *
 * Fixos, e não sorteados, porque valores aleatórios em render quebram a
 * hidratação — e porque oito brasas afinadas à mão sobem melhor que oito
 * sorteadas. A irregularidade dos delays é o que evita o efeito "chuveiro".
 */
const EMBERS = [
  { left: "18%", x: "-14px", duration: "2.6s", delay: "0s", size: 5 },
  { left: "31%", x: "10px", duration: "3.2s", delay: "0.5s", size: 3 },
  { left: "44%", x: "-8px", duration: "2.2s", delay: "1.1s", size: 4 },
  { left: "52%", x: "16px", duration: "3.6s", delay: "0.2s", size: 3 },
  { left: "63%", x: "-12px", duration: "2.9s", delay: "0.8s", size: 5 },
  { left: "72%", x: "8px", duration: "2.4s", delay: "1.4s", size: 3 },
  { left: "84%", x: "-6px", duration: "3.4s", delay: "0.35s", size: 4 },
  { left: "26%", x: "12px", duration: "3.0s", delay: "1.7s", size: 3 },
];

/**
 * A frase muda com o tamanho da ofensiva: no primeiro dia o que motiva é
 * saber que ela existe; no trigésimo, é o tamanho do que já foi feito.
 */
function streakMessage(days: number): { title: string; line: string } {
  if (days <= 1) {
    return {
      title: "Sua ofensiva começou",
      line: "Um dia já é mais do que a maioria faz. Volte amanhã e ela vira 2.",
    };
  }
  if (days === 2) {
    return {
      title: "Dois dias seguidos",
      line: "O segundo dia é o mais difícil — e você acabou de passar por ele.",
    };
  }
  if (days < 7) {
    return {
      title: `${days} dias seguidos`,
      line: "Está virando rotina. Inglês entra pela constância, não pela pressa.",
    };
  }
  if (days < 30) {
    return {
      title: `${days} dias seguidos`,
      line: "Uma semana ou mais sem quebrar. É exatamente assim que a fluência aparece.",
    };
  }
  return {
    title: `${days} dias seguidos`,
    line: "Um mês de constância. O inglês já não é mais uma tentativa — é um hábito.",
  };
}

/**
 * Celebração da primeira aula concluída no dia.
 *
 * Só é montada quando a ofensiva realmente avançou (`streak.advanced`), então
 * não aparece na segunda, terceira ou décima aula do mesmo dia — o que a torna
 * rara o suficiente para continuar valendo alguma coisa.
 *
 * Fecha sozinha, com Esc, com clique fora ou no botão. Nada aqui prende o
 * aluno: a única ação real é seguir para a próxima aula.
 */
export function StreakCelebration({
  days,
  next,
  onClose,
}: {
  days: number;
  /** Próxima aula, quando existe — a celebração vira a ponte para ela. */
  next: { href: string; title: string } | null;
  onClose: () => void;
}) {
  const { title, line } = streakMessage(days);

  useEffect(() => {
    const timer = window.setTimeout(onClose, AUTO_DISMISS_MS);
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={onClose}
      className="streak-veil bg-background/80 fixed inset-0 z-50 grid place-items-center p-6 backdrop-blur-sm"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="streak-card bg-card relative w-full max-w-sm overflow-hidden rounded-2xl border p-8 text-center shadow-2xl"
      >
        {/* Brasas — decorativas, atrás do conteúdo e fora do fluxo de leitura */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-full">
          {EMBERS.map((ember, i) => (
            <span
              key={i}
              className="streak-ember bg-streak absolute bottom-16 rounded-full blur-[1px]"
              style={
                {
                  left: ember.left,
                  width: ember.size,
                  height: ember.size,
                  "--ember-x": ember.x,
                  "--ember-duration": ember.duration,
                  "--ember-delay": ember.delay,
                } as React.CSSProperties
              }
            />
          ))}
        </div>

        <div className="relative">
          {/* Chama sobre um halo quente: o "fogo" sem nenhuma imagem */}
          <div className="relative mx-auto grid size-20 place-items-center">
            <span
              aria-hidden
              className="streak-glow bg-streak/25 absolute inset-0 rounded-full blur-xl"
            />
            <Flame
              className="streak-flame text-streak relative size-11"
              strokeWidth={1.75}
              fill="currentColor"
              fillOpacity={0.15}
            />
          </div>

          <p className="text-streak mt-4 text-5xl font-semibold tracking-tight tabular">{days}</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">{title}</h2>
          <p className="text-muted-foreground mt-2 text-[15px] leading-relaxed text-balance">
            {line}
          </p>

          <div className="mt-6 flex flex-col gap-2">
            {next && (
              <Button asChild onClick={onClose}>
                <Link href={next.href}>Próxima aula</Link>
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              Continuar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
