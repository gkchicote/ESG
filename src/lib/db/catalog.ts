/**
 * Catálogo do curso — fonte única do currículo.
 *
 * Usado pelo seed do banco (primeiro boot), pelo `npm run content:sync`
 * (aplica este arquivo num banco que já existe) e pelos geradores de
 * conteúdo de exemplo (scripts/make-sample-*.ts).
 *
 * Cada módulo e cada aula tem um `slug` estável: é por ele que o sync
 * reconhece a linha no banco. Renomear o título é seguro; trocar o slug
 * apaga a aula antiga (e o progresso dela) e cria outra no lugar.
 */

/** Onde o vídeo está hospedado. Sem `video`, assume MP4 local `<slug>.mp4`. */
export type VideoSeed = {
  provider: "file" | "url" | "youtube" | "vimeo" | "bunny";
  /** null = aula publicada, vídeo ainda não subiu (o player mostra o aviso). */
  id: string | null;
};

export type LessonSeed = {
  slug: string;
  title: string;
  description: string;
  seconds: number;
  video?: VideoSeed;
  materials?: { title: string; file: string }[];
};

export type ModuleSeed = {
  slug: string;
  title: string;
  description: string;
  lessons: LessonSeed[];
};

/** Resolve o `video` de uma aula, aplicando o padrão de arquivo local. */
export function lessonVideo(lesson: LessonSeed): VideoSeed {
  return lesson.video ?? { provider: "file", id: `${lesson.slug}.mp4` };
}

/** O curso em si. O sync cria a linha em `courses` se ela ainda não existir. */
export const COURSE = {
  slug: "ingles-do-zero-a-fluencia",
  title: "Inglês do Zero à Fluência",
  description:
    "Um caminho direto do primeiro contato até conversar com confiança, sem decorar regras soltas.",
  level: "A1 → B1",
};

export const CURRICULUM: ModuleSeed[] = [
  {
    slug: "fundamentos-sons-alfabeto",
    title: "Fundamentos: Sons e Alfabeto",
    description: "A base da pronúncia que a escola tradicional pula. Comece por aqui.",
    lessons: [
      { slug: "boas-vindas", title: "Boas-vindas e como estudar neste curso", description: "Como a plataforma funciona, quanto tempo estudar por dia e o que esperar de cada módulo.", seconds: 24, materials: [{ title: "Guia de Estudos — Semana 1", file: "guia-de-estudos.pdf" }] },
      { slug: "alfabeto", title: "O alfabeto e o som das letras", description: "Soletrar nomes, e-mails e endereços sem travar.", seconds: 32, materials: [{ title: "Tabela do Alfabeto Fonético", file: "alfabeto-fonetico.pdf" }] },
      { slug: "vogais", title: "Vogais curtas x vogais longas", description: "A diferença entre ship e sheep — e por que ela importa.", seconds: 28 },
      { slug: "som-th", title: "Os sons do TH", description: "Treino guiado para o som que não existe em português.", seconds: 36, materials: [{ title: "Exercícios de Pronúncia — TH", file: "exercicios-th.pdf" }] },
    ],
  },
  {
    // ---------------------------------------------------------------
    //  Módulo 02 — vídeos no YouTube (não listados).
    //  Para publicar as aulas que faltam: cole o ID de 11 caracteres do
    //  link (https://youtu.be/<ID>) em `video.id` e rode:
    //      npm run content:sync
    // ---------------------------------------------------------------
    slug: "jack-hannaford",
    title: "Jack Hannaford",
    description: "A história de Jack Hannaford, em oito aulas.",
    lessons: [
      { slug: "jack-hannaford-01", title: "Aula 01 - Jack Hannaford", description: "", seconds: 1802, video: { provider: "youtube", id: "zdXmqqPBXEQ" } },
      { slug: "jack-hannaford-02", title: "Aula 02 - Jack Hannaford", description: "", seconds: 1917, video: { provider: "youtube", id: "B-zhym9qGXs" } },
      { slug: "jack-hannaford-03", title: "Aula 03 - Jack Hannaford", description: "", seconds: 1113, video: { provider: "youtube", id: "jwxYEis-38c" } },
      { slug: "jack-hannaford-04", title: "Aula 04 - Jack Hannaford", description: "", seconds: 0, video: { provider: "youtube", id: null } },
      { slug: "jack-hannaford-05", title: "Aula 05 - Jack Hannaford", description: "", seconds: 0, video: { provider: "youtube", id: null } },
      { slug: "jack-hannaford-06", title: "Aula 06 - Jack Hannaford", description: "", seconds: 0, video: { provider: "youtube", id: null } },
      { slug: "jack-hannaford-07", title: "Aula 07 - Jack Hannaford", description: "", seconds: 0, video: { provider: "youtube", id: null } },
      { slug: "jack-hannaford-08", title: "Aula 08 - Jack Hannaford", description: "", seconds: 0, video: { provider: "youtube", id: null } },
    ],
  },
  {
    slug: "present-simple",
    title: "Present Simple no dia a dia",
    description: "Rotina, hábitos e fatos — o tempo verbal que você mais vai usar.",
    lessons: [
      { slug: "present-simple", title: "Estrutura do Present Simple", description: "Afirmativa, negativa e o temido -s da terceira pessoa.", seconds: 33, materials: [{ title: "Resumo Visual — Present Simple", file: "present-simple.pdf" }] },
      { slug: "do-does", title: "Do e Does em perguntas", description: "Como montar perguntas que soam naturais.", seconds: 29 },
      { slug: "adverbios", title: "Advérbios de frequência", description: "Always, usually, sometimes, never — e onde encaixá-los na frase.", seconds: 26 },
      { slug: "rotina", title: "Descrevendo sua rotina completa", description: "Do café da manhã ao fim do expediente, em inglês.", seconds: 42, materials: [{ title: "Vocabulário de Rotina", file: "vocabulario-rotina.pdf" }] },
    ],
  },
  {
    slug: "vocabulario-trabalho-viagem",
    title: "Vocabulário Essencial: Trabalho e Viagem",
    description: "As 300 palavras que resolvem 80% das situações reais.",
    lessons: [
      { slug: "aeroporto-hotel", title: "No aeroporto e no hotel", description: "Check-in, bagagem, reserva e pedidos comuns.", seconds: 36, materials: [{ title: "Frases de Sobrevivência — Viagem", file: "frases-viagem.pdf" }] },
      { slug: "reunioes-emails", title: "Reuniões e e-mails de trabalho", description: "Vocabulário corporativo sem formalidade excessiva.", seconds: 40 },
      { slug: "small-talk", title: "Small talk: o que falar nos primeiros 2 minutos", description: "Clima, fim de semana, trânsito — e como sair da conversa.", seconds: 28 },
    ],
  },
  {
    slug: "listening-conversacao",
    title: "Listening e Conversação",
    description: "Treinar o ouvido para a velocidade real do inglês falado.",
    lessons: [
      { slug: "connected-speech", title: "Connected speech: por que você não entende nativos", description: "Wanna, gonna, gotta e o encadeamento das palavras.", seconds: 34, materials: [{ title: "Transcrições Comentadas", file: "transcricoes.pdf" }] },
      { slug: "treino-escuta", title: "Treino de escuta com áudio real", description: "Três trechos autênticos, do mais lento ao mais rápido.", seconds: 46 },
      { slug: "primeira-conversa", title: "Sua primeira conversa de 5 minutos", description: "Roteiro prático para destravar a fala.", seconds: 38, materials: [{ title: "Roteiro de Conversação", file: "roteiro-conversacao.pdf" }] },
    ],
  },
];
