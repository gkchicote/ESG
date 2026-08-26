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

/**
 * Vídeo no bucket R2. `key` é o caminho completo do objeto, com o mesmo nome
 * que aparece no painel do Cloudflare — inclusive espaços e maiúsculas.
 */
const r2 = (key: string): VideoSeed => ({ provider: "r2", id: key });

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
      { slug: "jack-hannaford-01", title: "Aula 01 - Jack Hannaford", description: "", seconds: 1802, video: r2("F-MODULO02/M01V04 - Jack Hannaford 01.mp4") },
      { slug: "jack-hannaford-02", title: "Aula 02 - Jack Hannaford", description: "", seconds: 1917, video: r2("F-MODULO02/M02V11 - Jack Hannaford 02 (1).mp4") },
      { slug: "jack-hannaford-03", title: "Aula 03 - Jack Hannaford", description: "", seconds: 1113, video: r2("F-MODULO02/M02V12 - Jack Hannaford 03.mp4") },
      { slug: "jack-hannaford-04", title: "Aula 04 - Jack Hannaford", description: "", seconds: 1408, video: r2("F-MODULO02/M02V13 - Jack Hannaford 04.mp4") },
      { slug: "jack-hannaford-05", title: "Aula 05 - Jack Hannaford", description: "", seconds: 1066, video: r2("F-MODULO02/M02V14 - Jack Hannaford 05.mp4") },
      { slug: "jack-hannaford-06", title: "Aula 06 - Jack Hannaford", description: "", seconds: 1288, video: r2("F-MODULO02/M02V15 - Jack Hannaford 06.mp4") },
      { slug: "jack-hannaford-07", title: "Aula 07 - Jack Hannaford", description: "", seconds: 1771, video: r2("F-MODULO02/M02V16 - Jack Hannaford 07.mp4") },
      { slug: "jack-hannaford-08", title: "Aula 08 - Jack Hannaford", description: "", seconds: 974, video: r2("F-MODULO02/M02V17 - Jack Hannaford 08.mp4") },
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
