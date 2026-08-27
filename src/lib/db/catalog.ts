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
  provider: "file" | "url" | "youtube" | "vimeo" | "bunny" | "drive" | "r2";
  /**
   * O que identifica o vídeo no provider: nome do arquivo (`file`), chave do
   * objeto (`r2`), ID do vídeo (`youtube`/`vimeo`/`drive`/`bunny`) ou URL
   * completa (`url`).
   *
   * null = aula publicada, vídeo ainda não subiu (o player mostra o aviso).
   */
  id: string | null;
};

/**
 * Anexo da aula. `storage` decide como `file` é lido:
 *   - "file" (padrão) — caminho relativo a `content/`
 *     ("materials/jack-hannaford-01/texto.pdf"); um nome solto, sem barra,
 *     continua sendo lido de content/pdfs, como nas primeiras versões do
 *     catálogo.
 *   - "r2" — chave do objeto no bucket privado, igual ao vídeo da aula.
 */
export type MaterialSeed = {
  title: string;
  file: string;
  type?: "pdf" | "zip" | "audio";
  storage?: "file" | "r2";
};

/** Faixa de áudio da aula. `voice` é o nome do narrador, mostrado no player. */
export type AudioSeed = { voice: string; file: string; storage?: "file" | "r2" };

export type LessonSeed = {
  slug: string;
  title: string;
  description: string;
  seconds: number;
  video?: VideoSeed;
  materials?: MaterialSeed[];
  /** Mesma gravação em vozes diferentes — vira o player de escolha na aula. */
  audios?: AudioSeed[];
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

/**
 * Todos os anexos da aula na ordem em que vão para a tabela `materials`:
 * primeiro os arquivos para baixar, depois as faixas de áudio. Quem separa os
 * dois na tela é o `file_type`.
 */
export function lessonMaterials(lesson: LessonSeed): {
  title: string;
  file: string;
  type: "pdf" | "zip" | "audio";
  storage: "file" | "r2";
}[] {
  return [
    ...(lesson.materials ?? []).map((m) => ({
      ...m,
      type: m.type ?? ("pdf" as const),
      storage: m.storage ?? ("file" as const),
    })),
    ...(lesson.audios ?? []).map((a) => ({
      title: a.voice,
      file: a.file,
      type: "audio" as const,
      storage: a.storage ?? ("file" as const),
    })),
  ];
}

/**
 * Vídeo no bucket R2. `key` é o caminho completo do objeto, com o mesmo nome
 * que aparece no painel do Cloudflare — inclusive espaços e maiúsculas.
 */
const r2 = (key: string): VideoSeed => ({ provider: "r2", id: key });

/** Narradores do áudio de treino, na ordem em que aparecem no player. */
const VOICES = ["Jake", "John", "Moira", "Natalie"];

/**
 * Anexos das aulas de Jack Hannaford.
 *
 * Os arquivos moram no mesmo bucket privado do vídeo, dentro de
 * F-MODULO02/Módulo 02/Aula 0N/ — a pasta original foi enviada ao R2 como
 * está, nomes e espaços inclusive, então a chave de cada objeto segue esse
 * padrão em vez do slug da aula. Só a aula 01 tem o baralho extra (.apkg).
 */
function jackHannaford(number: number): { materials: MaterialSeed[]; audios: AudioSeed[] } {
  const n = String(number).padStart(2, "0");
  // Só o PDF usa 3 dígitos ("PDF Jack Hannaford 001.pdf") — pasta e áudio usam 2.
  const n3 = String(number).padStart(3, "0");
  // A pasta foi enviada ao R2 a partir de um Mac, que grava nomes de arquivo
  // no disco em NFD (o "ó" vira "o" + acento combinante) — diferente do NFC
  // que qualquer editor de texto produz ao digitar o mesmo caractere. Bytes
  // diferentes, mesmo com a mesma aparência: sem isto, a chave assinada não
  // bate com a gravada e o R2 devolve 404 mesmo com o nome "certo" na tela.
  const dir = `F-MODULO02/Módulo 02/Aula ${n}`.normalize("NFD");
  // Único arquivo cujo nome não segue o padrão "JH<n> Frases para o Anki.zip".
  const zipName = number === 1 ? "JH01 Sentence for Anki.zip" : `JH${number} Frases para o Anki.zip`;

  return {
    materials: [
      { title: "Texto da aula", file: `${dir}/PDF Jack Hannaford ${n3}.pdf`, type: "pdf", storage: "r2" },
      { title: "Frases para o Anki", file: `${dir}/${zipName}`, type: "zip", storage: "r2" },
      ...(number === 1
        ? [
            {
              title: "Baralho do Anki",
              file: `${dir}/01_Jack_Hannaford.apkg`,
              type: "zip" as const,
              storage: "r2" as const,
            },
          ]
        : []),
    ],
    audios: VOICES.map((voice) => ({
      voice,
      file: `${dir}/AUDIO Jack Hannaford ${n} ${voice}.mp3`,
      storage: "r2",
    })),
  };
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
    // ---------------------------------------------------------------
    //  Todo o vídeo do curso mora no bucket privado do Cloudflare R2, na
    //  pasta do módulo (F-MODULO02, F-MODULO03, ...). Os nomes das pastas
    //  seguem a numeração original da gravação, não a posição do módulo
    //  aqui — renomear o objeto no R2 quebraria a aula, então eles ficam
    //  como estão.
    //
    //  Antes disso o YouTube e o Google Drive bloquearam os arquivos por
    //  conta própria (sinalizados como "suspeitos"), e servir do VPS
    //  gastava banda a cada aluno. No R2 o arquivo é nosso, o acesso passa
    //  por URL assinada de vida curta (src/lib/r2.ts) e a saída de dados
    //  não é cobrada.
    //
    //  Para publicar uma aula nova:
    //    1. suba o MP4 pelo painel do R2, na pasta do módulo
    //    2. copie o nome exato do objeto para o `video: r2(...)` abaixo
    //    3. rode `npm run content:sync` (ou clique em "Publicar catálogo"
    //       em /admin)
    // ---------------------------------------------------------------
    slug: "jack-hannaford",
    title: "Jack Hannaford",
    description: "A história de Jack Hannaford, em oito aulas.",
    lessons: [
      { slug: "jack-hannaford-01", title: "Aula 01 - Jack Hannaford", description: "", seconds: 1802, video: r2("F-MODULO02/M01V04 - Jack Hannaford 01.mp4"), ...jackHannaford(1) },
      { slug: "jack-hannaford-02", title: "Aula 02 - Jack Hannaford", description: "", seconds: 1917, video: r2("F-MODULO02/M02V11 - Jack Hannaford 02 (1).mp4"), ...jackHannaford(2) },
      { slug: "jack-hannaford-03", title: "Aula 03 - Jack Hannaford", description: "", seconds: 1113, video: r2("F-MODULO02/M02V12 - Jack Hannaford 03.mp4"), ...jackHannaford(3) },
      { slug: "jack-hannaford-04", title: "Aula 04 - Jack Hannaford", description: "", seconds: 1408, video: r2("F-MODULO02/M02V13 - Jack Hannaford 04.mp4"), ...jackHannaford(4) },
      { slug: "jack-hannaford-05", title: "Aula 05 - Jack Hannaford", description: "", seconds: 1066, video: r2("F-MODULO02/M02V14 - Jack Hannaford 05.mp4"), ...jackHannaford(5) },
      { slug: "jack-hannaford-06", title: "Aula 06 - Jack Hannaford", description: "", seconds: 1288, video: r2("F-MODULO02/M02V15 - Jack Hannaford 06.mp4"), ...jackHannaford(6) },
      { slug: "jack-hannaford-07", title: "Aula 07 - Jack Hannaford", description: "", seconds: 1771, video: r2("F-MODULO02/M02V16 - Jack Hannaford 07.mp4"), ...jackHannaford(7) },
      { slug: "jack-hannaford-08", title: "Aula 08 - Jack Hannaford", description: "", seconds: 974, video: r2("F-MODULO02/M02V17 - Jack Hannaford 08.mp4"), ...jackHannaford(8) },
    ],
  },
  {
    slug: "the-endless-tale",
    title: "The Endless Tale",
    description: "A história de The Endless Tale, em sete aulas.",
    lessons: [
      { slug: "the-endless-tale-01", title: "Aula 01 - The Endless Tale", description: "", seconds: 1354, video: r2("F-MODULO03/M03V20 - The Endless Tale 01.mp4") },
      { slug: "the-endless-tale-02", title: "Aula 02 - The Endless Tale", description: "", seconds: 1574, video: r2("F-MODULO03/M03V21 - The Endless Tale 02.mp4") },
      { slug: "the-endless-tale-03", title: "Aula 03 - The Endless Tale", description: "", seconds: 1121, video: r2("F-MODULO03/M03V22 - The Endless Tale 03.mp4") },
      { slug: "the-endless-tale-04", title: "Aula 04 - The Endless Tale", description: "", seconds: 862, video: r2("F-MODULO03/M03V23 - The Endless Tale 04.mp4") },
      { slug: "the-endless-tale-05", title: "Aula 05 - The Endless Tale", description: "", seconds: 1379, video: r2("F-MODULO03/M03V24 - The Endless Tale 05.mp4") },
      { slug: "the-endless-tale-06", title: "Aula 06 - The Endless Tale", description: "", seconds: 1155, video: r2("F-MODULO03/M03V25 - The Endless Tale 06.mp4") },
      { slug: "the-endless-tale-07", title: "Aula 07 - The Endless Tale", description: "", seconds: 1107, video: r2("F-MODULO03/M03V26 - The Endless Tale 07.mp4") },
    ],
  },
];
