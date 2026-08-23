/**
 * Catálogo do curso de demonstração.
 *
 * Fonte única usada pelo seed do banco e pelos geradores de conteúdo de
 * exemplo (scripts/make-sample-*.ts). Ao trocar pelo seu material real,
 * este arquivo deixa de ser necessário.
 */

export type LessonSeed = {
  slug: string;
  title: string;
  description: string;
  seconds: number;
  materials?: { title: string; file: string }[];
};

export type ModuleSeed = {
  title: string;
  description: string;
  lessons: LessonSeed[];
};

export const CURRICULUM: ModuleSeed[] = [
  {
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
    title: "Verb To Be e Apresentações",
    description: "Falar sobre si mesmo com naturalidade na primeira conversa.",
    lessons: [
      { slug: "to-be-estrutura", title: "I am, you are, he is — a estrutura", description: "O verbo mais usado do inglês, destrinchado.", seconds: 40, materials: [{ title: "Quadro de Conjugação — To Be", file: "to-be-conjugacao.pdf" }] },
      { slug: "to-be-perguntas", title: "Perguntas e negativas com To Be", description: "Are you...? / I'm not... — inversão e contrações.", seconds: 30 },
      { slug: "apresentar-se", title: "Apresentando-se: nome, profissão e origem", description: "Diálogo modelo completo com shadowing.", seconds: 34, materials: [{ title: "Diálogos para Shadowing", file: "dialogos-shadowing.pdf" }] },
      { slug: "pratica-frases", title: "Prática guiada: 20 frases sobre você", description: "Monte seu roteiro pessoal de apresentação.", seconds: 44 },
    ],
  },
  {
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
    title: "Vocabulário Essencial: Trabalho e Viagem",
    description: "As 300 palavras que resolvem 80% das situações reais.",
    lessons: [
      { slug: "aeroporto-hotel", title: "No aeroporto e no hotel", description: "Check-in, bagagem, reserva e pedidos comuns.", seconds: 36, materials: [{ title: "Frases de Sobrevivência — Viagem", file: "frases-viagem.pdf" }] },
      { slug: "reunioes-emails", title: "Reuniões e e-mails de trabalho", description: "Vocabulário corporativo sem formalidade excessiva.", seconds: 40 },
      { slug: "small-talk", title: "Small talk: o que falar nos primeiros 2 minutos", description: "Clima, fim de semana, trânsito — e como sair da conversa.", seconds: 28 },
    ],
  },
  {
    title: "Listening e Conversação",
    description: "Treinar o ouvido para a velocidade real do inglês falado.",
    lessons: [
      { slug: "connected-speech", title: "Connected speech: por que você não entende nativos", description: "Wanna, gonna, gotta e o encadeamento das palavras.", seconds: 34, materials: [{ title: "Transcrições Comentadas", file: "transcricoes.pdf" }] },
      { slug: "treino-escuta", title: "Treino de escuta com áudio real", description: "Três trechos autênticos, do mais lento ao mais rápido.", seconds: 46 },
      { slug: "primeira-conversa", title: "Sua primeira conversa de 5 minutos", description: "Roteiro prático para destravar a fala.", seconds: 38, materials: [{ title: "Roteiro de Conversação", file: "roteiro-conversacao.pdf" }] },
    ],
  },
];
