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

/**
 * Normaliza uma chave do R2 para NFD.
 *
 * Todas as pastas do curso foram enviadas ao bucket a partir de um Mac, que
 * grava nomes de arquivo no disco em NFD (o "ó" vira "o" + acento combinante)
 * — diferente do NFC que qualquer editor de texto produz ao digitar o mesmo
 * caractere. Bytes diferentes, mesmo com a mesma aparência: sem isto, a chave
 * assinada não bate com a gravada e o R2 devolve 404 mesmo com o nome "certo"
 * na tela.
 *
 * Fica aqui, no único ponto por onde toda chave passa a caminho do banco, em
 * vez de em cada entrada do catálogo — assim nenhuma aula nova pode esquecer.
 */
function r2Key(key: string): string {
  return key.normalize("NFD");
}

/** Resolve o `video` de uma aula, aplicando o padrão de arquivo local. */
export function lessonVideo(lesson: LessonSeed): VideoSeed {
  const video = lesson.video ?? { provider: "file" as const, id: `${lesson.slug}.mp4` };
  if (video.provider !== "r2" || !video.id) return video;
  return { ...video, id: r2Key(video.id) };
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
      title: m.title,
      file: m.storage === "r2" ? r2Key(m.file) : m.file,
      type: m.type ?? ("pdf" as const),
      storage: m.storage ?? ("file" as const),
    })),
    ...(lesson.audios ?? []).map((a) => ({
      title: a.voice,
      file: a.storage === "r2" ? r2Key(a.file) : a.file,
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

/**
 * Aula publicada cujo vídeo ainda não está no bucket.
 *
 * O player mostra o aviso no lugar do vídeo e, como não há duração cadastrada,
 * o servidor não cobra prova de que a aula foi assistida — o aluno consegue
 * marcá-la como concluída pelo botão. Serve para as conclusões dos módulos 07
 * e 08, que existem para entregar os arquivos completos da história.
 */
const conclusaoSemVideo: VideoSeed = { provider: "r2", id: null };

/**
 * Anexos de uma aula de história (módulos 02 a 04).
 *
 * Os três módulos têm a mesma pasta no R2 — o PDF do texto, um .zip de frases
 * para o Anki e a mesma gravação em quatro vozes — mas cada um foi nomeado por
 * uma pessoa diferente, então o padrão do nome muda de módulo para módulo. As
 * pastas foram enviadas ao bucket como estavam, com espaços e maiúsculas
 * inclusive, e renomear o objeto no R2 quebraria a aula: quem se adapta é o
 * catálogo. Daí cada módulo abaixo passar o seu próprio molde de nome.
 *
 * `deck` é o baralho do Anki do módulo inteiro (.apkg). Ele mora na raiz da
 * pasta do módulo, não na da aula, e por isso entra só na aula 01.
 */
function storyMaterials({
  dir,
  pdf,
  zip,
  audio,
  voices,
  deck,
}: {
  /** Pasta da aula no bucket, já com o número. */
  dir: string;
  /** Nome do PDF do texto, dentro de `dir`. */
  pdf: string;
  /** Nome do .zip de frases para o Anki, dentro de `dir`. */
  zip: string;
  /** Nome do MP3 de uma voz, dentro de `dir`. */
  audio: (voice: string) => string;
  /** Narradores, na ordem em que aparecem no player. */
  voices: string[];
  /** Baralho do módulo — caminho completo; só a aula 01 recebe. */
  deck?: string;
}): { materials: MaterialSeed[]; audios: AudioSeed[] } {
  return {
    materials: [
      { title: "Texto da aula", file: `${dir}/${pdf}`, type: "pdf", storage: "r2" },
      { title: "Frases para o Anki", file: `${dir}/${zip}`, type: "zip", storage: "r2" },
      ...(deck
        ? [{ title: "Baralho do Anki", file: deck, type: "zip" as const, storage: "r2" as const }]
        : []),
    ],
    audios: voices.map((voice) => ({
      voice,
      file: `${dir}/${audio(voice)}`,
      storage: "r2" as const,
    })),
  };
}

/** Anexos das aulas de Jack Hannaford (módulo 02). */
function jackHannaford(number: number): { materials: MaterialSeed[]; audios: AudioSeed[] } {
  const n = String(number).padStart(2, "0");
  return storyMaterials({
    dir: `F-MODULO02/Módulo 02/Aula ${n}`,
    // Só o PDF usa 3 dígitos ("PDF Jack Hannaford 001.pdf") — pasta e áudio usam 2.
    pdf: `PDF Jack Hannaford ${String(number).padStart(3, "0")}.pdf`,
    // A aula 01 é a única cujo .zip não segue "JH<n> Frases para o Anki.zip".
    zip: number === 1 ? "JH01 Sentence for Anki.zip" : `JH${number} Frases para o Anki.zip`,
    audio: (voice) => `AUDIO Jack Hannaford ${n} ${voice}.mp3`,
    voices: ["Jake", "John", "Moira", "Natalie"],
    deck: number === 1 ? "F-MODULO02/Módulo 02/Aula 01/01_Jack_Hannaford.apkg" : undefined,
  });
}

/** Anexos das aulas de The Endless Tale (módulo 03). */
function theEndlessTale(number: number): { materials: MaterialSeed[]; audios: AudioSeed[] } {
  const n = String(number).padStart(2, "0");
  return storyMaterials({
    dir: `F-MODULO03/Módulo 03/The Endless Tale ${n}`,
    pdf: `PDF The Endless Tale ${n}.pdf`,
    zip: `TET ${n} Audios para o Anki.zip`,
    audio: (voice) => `AUDIO The Endless Tale ${n} ${voice}.mp3`,
    voices: ["Harry", "James", "Natalie", "Peter"],
    deck: number === 1 ? "F-MODULO03/Módulo 03/03_The_Endless_Tale.apkg" : undefined,
  });
}

/** Anexos das aulas de Jack and the Beanstalk (módulo 04). */
function jackAndTheBeanstalk(number: number): { materials: MaterialSeed[]; audios: AudioSeed[] } {
  const n = String(number).padStart(2, "0");
  return storyMaterials({
    // Aqui a pasta do módulo veio sem acento ("Modulo 04"), ao contrário das
    // dos módulos 02 e 03.
    dir: `F-MODULO04/Modulo 04/Jack and the Beanstalk ${n}`,
    // O PDF escreve "The" com maiúscula (o áudio e a pasta, não), e o da aula
    // 05 é o único com 3 dígitos.
    pdf: `PDF Jack and The Beanstalk ${number === 5 ? "005" : n}.pdf`,
    zip: `JATB ${n} Audios para o Anki.zip`,
    audio: (voice) => `AUDIO Jack and the Beanstalk ${n} ${voice}.mp3`,
    voices: ["Daniel", "Natalie", "Peter", "Zoe"],
    deck: number === 1 ? "F-MODULO04/Modulo 04/04_Jack_and_the_Beanstalk.apkg" : undefined,
  });
}

/** Anexos das aulas de The Boy Who Flew Too High (módulo 05). */
function theBoyWhoFlewTooHigh(number: number): { materials: MaterialSeed[]; audios: AudioSeed[] } {
  const n = String(number).padStart(2, "0");
  return storyMaterials({
    dir: `F-MODULO05/Módulo 05/The Boy Who Flew Too High ${n}`,
    // O PDF é o único que escreve "who" e "too" em minúscula; a pasta usa as
    // duas maiúsculas e o áudio mistura os dois jeitos ("Who ... too").
    pdf: `PDF The Boy who Flew too High ${n}.pdf`,
    // E o .zip encurta o título: só "The Boy Who Flew", sem o "Too High".
    zip: `The Boy Who Flew ${n} Audios para o Anki.zip`,
    audio: (voice) => `AUDIO The Boy Who Flew too High ${n} ${voice}.mp3`,
    voices: ["Natalie", "Peter", "Zoe"],
  });
}

/** Anexos das aulas de The Bell of Atri (módulo 06). */
function theBellOfAtri(number: number): { materials: MaterialSeed[]; audios: AudioSeed[] } {
  const n = String(number).padStart(2, "0");
  return storyMaterials({
    // A pasta da aula tem **dois** espaços antes do número ("Atri  01"). Foi
    // assim que ela subiu para o bucket; é assim que a chave precisa ser.
    dir: `F-MODULO06/Módulo 06/The Bell of Atri  ${n}`,
    pdf: `PDF The Bell of Atri ${n}.pdf`,
    // Aqui o .zip é "para Anki", sem o "o" que os módulos anteriores usam.
    zip: `The Bell of Atri ${n} Audios para Anki.zip`,
    audio: (voice) => `AUDIO The Bell of Atri ${n} ${voice}.mp3`,
    voices: ["Charlie", "Kathy", "Peter", "Zoe"],
  });
}

/** Anexos das aulas de Goldilocks and the Three Bears (módulo 07). */
function goldilocks(number: number): { materials: MaterialSeed[]; audios: AudioSeed[] } {
  const n = String(number).padStart(2, "0");
  return storyMaterials({
    dir: `F-MODULO07/Módulo 07/Goldilocks and the Three Bears ${n}`,
    pdf: `PDF Goldilocks and the Three Bears ${n}.pdf`,
    // O .zip encurta o título para só "Goldilocks" e leva o número no fim,
    // depois de "Anki" — nos módulos anteriores ele vinha antes.
    zip: `Goldilocks Audios para Anki ${n}.zip`,
    audio: (voice) => `AUDIO Goldilocks and the Three Bears ${n} ${voice}.mp3`,
    voices: ["Charlie", "Kathy", "Peter", "Zoe"],
  });
}

/** Anexos das aulas de Antonio Canova (módulo 08). */
function antonioCanova(number: number): { materials: MaterialSeed[]; audios: AudioSeed[] } {
  const n = String(number).padStart(2, "0");
  return storyMaterials({
    dir: `F-MODULO08/Módulo 08/Antonio Canova ${n}`,
    pdf: `PDF Antonio Canova ${n}.pdf`,
    // "AC" é a abreviação do título; só o .zip a usa.
    zip: `AC Audios para Anki ${n}.zip`,
    audio: (voice) => `AUDIO Antonio Canova ${n} ${voice}.mp3`,
    voices: ["Charlie", "Kathy", "Peter", "Zoe"],
  });
}

/** Anexos das aulas de Why Cats and Dogs are Enemies (módulo 09). */
function whyCatsAndDogs(number: number): { materials: MaterialSeed[]; audios: AudioSeed[] } {
  const n = String(number).padStart(2, "0");
  return storyMaterials({
    dir: `F-MODULO09/Módulo 09/Why Cats and Dogs are Enemies ${n}`,
    pdf: `PDF Why Cats and Dogs are Enemies ${n}.pdf`,
    // O .zip corta o título para "Cats and Dogs" — mesma abreviação da pasta
    // dos arquivos completos, e a única coisa no módulo que a usa.
    zip: `Cats and Dogs Audios para Anki ${n}.zip`,
    audio: (voice) => `AUDIO Why Cats and Dogs are Enemies ${n} ${voice}.mp3`,
    voices: ["Charlie", "Kathy", "Peter", "Zoe"],
    deck:
      number === 1
        ? "F-MODULO09/Módulo 09/09_why_cats_and_dogs_are_enemies.apkg"
        : undefined,
  });
}

/**
 * Texto e áudio completos da história — módulos 05 em diante.
 *
 * Todos eles trazem, além dos arquivos aula a aula, uma pasta com a história
 * inteira: um PDF único e a gravação corrida de cada voz. Não é material de
 * nenhuma aula em particular, então vai na conclusão do módulo, onde o aluno
 * chega com a história toda estudada. Os módulos 05 a 08 não têm baralho do
 * Anki; o 09 tem, e ele continua na aula 01, como nos módulos 02 a 04.
 */
function completeStory({
  dir,
  pdf,
  audio,
  voices,
}: {
  /** Pasta dos arquivos completos no bucket. */
  dir: string;
  /** Nome do PDF com a história inteira, dentro de `dir`. */
  pdf: string;
  /** Nome do MP3 corrido de uma voz, dentro de `dir`. */
  audio: (voice: string) => string;
  /** Narradores, na ordem em que aparecem no player. */
  voices: string[];
}): { materials: MaterialSeed[]; audios: AudioSeed[] } {
  return {
    materials: [
      { title: "Texto completo da história", file: `${dir}/${pdf}`, type: "pdf", storage: "r2" },
    ],
    audios: voices.map((voice) => ({ voice, file: `${dir}/${audio(voice)}`, storage: "r2" as const })),
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
    //  pasta do módulo (F-MODULO01, F-MODULO02, ...). Os nomes dos arquivos
    //  seguem a numeração original da gravação ("M03V20 - ..."), que é
    //  contínua entre os módulos e não recomeça a cada um — renomear o
    //  objeto no R2 quebraria a aula, então eles ficam como estão.
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
    //
    //  A ordem dos módulos nesta lista é a ordem em que eles aparecem para
    //  o aluno: o `position` no banco sai do índice do array.
    // ---------------------------------------------------------------
    slug: "introducao",
    title: "Introdução",
    description: "Como o curso funciona e como estudar com o Anki, em cinco aulas.",
    lessons: [
      { slug: "introducao-01", title: "Exemplo prático de estudo de textos com áudio", description: "", seconds: 720, video: r2("F-MODULO01/M01V05 - Exemplo prático de estudo de textos com áudio.mp4") },
      { slug: "introducao-02", title: "Anki e o método de sentenças", description: "", seconds: 1398, video: r2("F-MODULO01/M01V06 - Anki e o método de sentenças.mp4") },
      { slug: "introducao-03", title: "Como instalar e configurar corretamente o Anki", description: "", seconds: 1899, video: r2("F-MODULO01/M01V07 - Como instalar e configurar corretamente o Anki.mp4") },
      { slug: "introducao-04", title: "Como estudar com o Anki na Etapa 1", description: "", seconds: 1970, video: r2("F-MODULO01/M01V08 - Como estudar com o Anki na Etapa 1.mp4") },
      { slug: "introducao-05", title: "Conclusão do Módulo 01", description: "", seconds: 292, video: r2("F-MODULO01/M01V09 - Conclusão do Módulo 01.mp4") },
    ],
  },
  {
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
      { slug: "the-endless-tale-01", title: "Aula 01 - The Endless Tale", description: "", seconds: 1354, video: r2("F-MODULO03/M03V20 - The Endless Tale 01.mp4"), ...theEndlessTale(1) },
      { slug: "the-endless-tale-02", title: "Aula 02 - The Endless Tale", description: "", seconds: 1574, video: r2("F-MODULO03/M03V21 - The Endless Tale 02.mp4"), ...theEndlessTale(2) },
      { slug: "the-endless-tale-03", title: "Aula 03 - The Endless Tale", description: "", seconds: 1121, video: r2("F-MODULO03/M03V22 - The Endless Tale 03.mp4"), ...theEndlessTale(3) },
      { slug: "the-endless-tale-04", title: "Aula 04 - The Endless Tale", description: "", seconds: 862, video: r2("F-MODULO03/M03V23 - The Endless Tale 04.mp4"), ...theEndlessTale(4) },
      { slug: "the-endless-tale-05", title: "Aula 05 - The Endless Tale", description: "", seconds: 1379, video: r2("F-MODULO03/M03V24 - The Endless Tale 05.mp4"), ...theEndlessTale(5) },
      { slug: "the-endless-tale-06", title: "Aula 06 - The Endless Tale", description: "", seconds: 1155, video: r2("F-MODULO03/M03V25 - The Endless Tale 06.mp4"), ...theEndlessTale(6) },
      { slug: "the-endless-tale-07", title: "Aula 07 - The Endless Tale", description: "", seconds: 1107, video: r2("F-MODULO03/M03V26 - The Endless Tale 07.mp4"), ...theEndlessTale(7) },
      { slug: "the-endless-tale-conclusao", title: "Conclusão do Módulo 03", description: "", seconds: 418, video: r2("F-MODULO03/M03V27 - Conclusão do Módulo 03_comprimido.mp4") },
    ],
  },
  {
    slug: "jack-and-the-beanstalk",
    title: "Jack and the Beanstalk",
    description: "A história de Jack and the Beanstalk, em seis aulas.",
    lessons: [
      { slug: "jack-and-the-beanstalk-instrucoes", title: "Instruções do Módulo 04", description: "", seconds: 457, video: r2("F-MODULO04/M04V28 Instruções do Módulo 04_comprimido.mp4") },
      { slug: "jack-and-the-beanstalk-01", title: "Aula 01 - Jack and the Beanstalk", description: "", seconds: 1346, video: r2("F-MODULO04/M04V29 Jack and the Beanstalk 01_comprimido.mp4"), ...jackAndTheBeanstalk(1) },
      { slug: "jack-and-the-beanstalk-02", title: "Aula 02 - Jack and the Beanstalk", description: "", seconds: 1325, video: r2("F-MODULO04/M04V30 Jack and the Beanstalk 02_comprimido.mp4"), ...jackAndTheBeanstalk(2) },
      { slug: "jack-and-the-beanstalk-03", title: "Aula 03 - Jack and the Beanstalk", description: "", seconds: 1495, video: r2("F-MODULO04/M04V31 Jack and the Beanstalk 03_comprimido.mp4"), ...jackAndTheBeanstalk(3) },
      { slug: "jack-and-the-beanstalk-04", title: "Aula 04 - Jack and the Beanstalk", description: "", seconds: 1068, video: r2("F-MODULO04/M04V32 Jack and the Beanstalk 04_comprimido.mp4"), ...jackAndTheBeanstalk(4) },
      { slug: "jack-and-the-beanstalk-05", title: "Aula 05 - Jack and the Beanstalk", description: "", seconds: 725, video: r2("F-MODULO04/M04V33 Jack and the Beanstalk 05_comprimido.mp4"), ...jackAndTheBeanstalk(5) },
      { slug: "jack-and-the-beanstalk-06", title: "Aula 06 - Jack and the Beanstalk", description: "", seconds: 1365, video: r2("F-MODULO04/M04V34 Jack and the Beanstalk 06_comprimido.mp4"), ...jackAndTheBeanstalk(6) },
      { slug: "jack-and-the-beanstalk-conclusao", title: "Conclusão do Módulo 04", description: "", seconds: 147, video: r2("F-MODULO04/M04V35 Conclusão do Módulo 04_comprimido.mp4") },
    ],
  },
  {
    slug: "the-boy-who-flew-too-high",
    title: "The Boy Who Flew Too High",
    description: "A história de The Boy Who Flew Too High, em sete aulas.",
    lessons: [
      { slug: "the-boy-who-flew-too-high-instrucoes", title: "Instruções do Módulo 05", description: "", seconds: 345, video: r2("F-MODULO05/M05V36 Instruções do Módulo 05_comprimido.mp4") },
      { slug: "the-boy-who-flew-too-high-01", title: "Aula 01 - The Boy Who Flew Too High", description: "", seconds: 1846, video: r2("F-MODULO05/M05V37 The Boy Who Flew Too High 01_comprimido.mp4"), ...theBoyWhoFlewTooHigh(1) },
      { slug: "the-boy-who-flew-too-high-02", title: "Aula 02 - The Boy Who Flew Too High", description: "", seconds: 1887, video: r2("F-MODULO05/M05V38 The Boy Who Flew Too High 02_comprimido.mp4"), ...theBoyWhoFlewTooHigh(2) },
      { slug: "the-boy-who-flew-too-high-03", title: "Aula 03 - The Boy Who Flew Too High", description: "", seconds: 1650, video: r2("F-MODULO05/M05V39 The Boy Who Flew Too High 03_comprimido.mp4"), ...theBoyWhoFlewTooHigh(3) },
      { slug: "the-boy-who-flew-too-high-04", title: "Aula 04 - The Boy Who Flew Too High", description: "", seconds: 1258, video: r2("F-MODULO05/M05V40 The Boy Who Flew Too High 04_comprimido.mp4"), ...theBoyWhoFlewTooHigh(4) },
      { slug: "the-boy-who-flew-too-high-05", title: "Aula 05 - The Boy Who Flew Too High", description: "", seconds: 1428, video: r2("F-MODULO05/M05V41 The Boy Who Flew Too High 05_comprimido.mp4"), ...theBoyWhoFlewTooHigh(5) },
      { slug: "the-boy-who-flew-too-high-06", title: "Aula 06 - The Boy Who Flew Too High", description: "", seconds: 1562, video: r2("F-MODULO05/M05V42 The Boy Who Flew Too High 06_comprimido.mp4"), ...theBoyWhoFlewTooHigh(6) },
      { slug: "the-boy-who-flew-too-high-07", title: "Aula 07 - The Boy Who Flew Too High", description: "", seconds: 1178, video: r2("F-MODULO05/M05V43 The Boy Who Flew Too High 07_comprimido.mp4"), ...theBoyWhoFlewTooHigh(7) },
      {
        slug: "the-boy-who-flew-too-high-conclusao",
        title: "Conclusão do Módulo 05",
        description: "",
        seconds: 401,
        video: r2("F-MODULO05/M05V44 Conclusão do Módulo 05_comprimido.mp4"),
        ...completeStory({
          dir: "F-MODULO05/Módulo 05/The Boy Who Flew Too High Arquivos Completos",
          pdf: "PDF The Boy Who Flew Too High Texto Completo.pdf",
          audio: (voice) => `The Boy who Flew too High ${voice} Complete Audio.mp3`,
          voices: ["Natalie", "Peter", "Zoe"],
        }),
      },
    ],
  },
  {
    slug: "the-bell-of-atri",
    title: "The Bell of Atri",
    description: "A história de The Bell of Atri, em oito aulas.",
    lessons: [
      { slug: "the-bell-of-atri-instrucoes", title: "Instruções do Módulo 06", description: "", seconds: 615, video: r2("F-MODULO06/M06V45 Instruções do Módulo 06_comprimido.mp4") },
      { slug: "the-bell-of-atri-01", title: "Aula 01 - The Bell of Atri", description: "", seconds: 1690, video: r2("F-MODULO06/M06V46 The Bell of Atri 01_comprimido.mp4"), ...theBellOfAtri(1) },
      { slug: "the-bell-of-atri-02", title: "Aula 02 - The Bell of Atri", description: "", seconds: 1212, video: r2("F-MODULO06/M06V47 The Bell of Atri 02_comprimido.mp4"), ...theBellOfAtri(2) },
      { slug: "the-bell-of-atri-03", title: "Aula 03 - The Bell of Atri", description: "", seconds: 1629, video: r2("F-MODULO06/M06V48 The Bell of Atri 03_comprimido.mp4"), ...theBellOfAtri(3) },
      { slug: "the-bell-of-atri-04", title: "Aula 04 - The Bell of Atri", description: "", seconds: 1005, video: r2("F-MODULO06/M06V49 The Bell of Atri 04_comprimido.mp4"), ...theBellOfAtri(4) },
      { slug: "the-bell-of-atri-05", title: "Aula 05 - The Bell of Atri", description: "", seconds: 1337, video: r2("F-MODULO06/M06V50 The Bell of Atri 05_comprimido.mp4"), ...theBellOfAtri(5) },
      { slug: "the-bell-of-atri-06", title: "Aula 06 - The Bell of Atri", description: "", seconds: 1662, video: r2("F-MODULO06/M06V51 The Bell of Atri 06_comprimido.mp4"), ...theBellOfAtri(6) },
      { slug: "the-bell-of-atri-07", title: "Aula 07 - The Bell of Atri", description: "", seconds: 770, video: r2("F-MODULO06/M06V52 The Bell of Atri 07_comprimido.mp4"), ...theBellOfAtri(7) },
      { slug: "the-bell-of-atri-08", title: "Aula 08 - The Bell of Atri", description: "", seconds: 1779, video: r2("F-MODULO06/M06V53 The Bell of Atri 08_comprimido.mp4"), ...theBellOfAtri(8) },
      {
        slug: "the-bell-of-atri-conclusao",
        title: "Conclusão do Módulo 06",
        description: "",
        seconds: 148,
        video: r2("F-MODULO06/M06V54 Conclusão do Módulo 06_comprimido.mp4"),
        ...completeStory({
          dir: "F-MODULO06/Módulo 06/The Bell of Atri Completo",
          pdf: "PDF The Bell of Atri Texto Completo.pdf",
          audio: (voice) => `The Bell of Atri ${voice} Complete Audio.mp3`,
          voices: ["Charlie", "Kathy", "Peter", "Zoe"],
        }),
      },
    ],
  },
  {
    slug: "goldilocks-and-the-three-bears",
    title: "Goldilocks and the Three Bears",
    description: "A história de Goldilocks and the Three Bears, em sete aulas.",
    lessons: [
      { slug: "goldilocks-and-the-three-bears-instrucoes", title: "Instruções do Módulo 07", description: "", seconds: 339, video: r2("F-MODULO07/M07V55 Instruções do Módulo 07_comprimido.mp4") },
      { slug: "goldilocks-and-the-three-bears-01", title: "Aula 01 - Goldilocks and the Three Bears", description: "", seconds: 1710, video: r2("F-MODULO07/M07V56 Goldilocks and the Three Bears 01_comprimido.mp4"), ...goldilocks(1) },
      { slug: "goldilocks-and-the-three-bears-02", title: "Aula 02 - Goldilocks and the Three Bears", description: "", seconds: 1169, video: r2("F-MODULO07/M07V57 Goldilocks and the Three Bears 02_comprimido.mp4"), ...goldilocks(2) },
      { slug: "goldilocks-and-the-three-bears-03", title: "Aula 03 - Goldilocks and the Three Bears", description: "", seconds: 1222, video: r2("F-MODULO07/M07V58 Goldilocks and the Three Bears 03_comprimido.mp4"), ...goldilocks(3) },
      { slug: "goldilocks-and-the-three-bears-04", title: "Aula 04 - Goldilocks and the Three Bears", description: "", seconds: 1225, video: r2("F-MODULO07/M07V59 Goldilocks and the Three Bears 04_comprimido.mp4"), ...goldilocks(4) },
      { slug: "goldilocks-and-the-three-bears-05", title: "Aula 05 - Goldilocks and the Three Bears", description: "", seconds: 1605, video: r2("F-MODULO07/M07V60 Goldilocks and the Three Bears 05_comprimido.mp4"), ...goldilocks(5) },
      { slug: "goldilocks-and-the-three-bears-06", title: "Aula 06 - Goldilocks and the Three Bears", description: "", seconds: 1166, video: r2("F-MODULO07/M07V61 Goldilocks and the Three Bears 06_comprimido.mp4"), ...goldilocks(6) },
      { slug: "goldilocks-and-the-three-bears-07", title: "Aula 07 - Goldilocks and the Three Bears", description: "", seconds: 1514, video: r2("F-MODULO07/M07V62 Goldilocks and the Three Bears 07_comprimido.mp4"), ...goldilocks(7) },
      {
        slug: "goldilocks-and-the-three-bears-conclusao",
        title: "Conclusão do Módulo 07",
        description: "",
        seconds: 0,
        // O M07V63 ainda não subiu como vídeo — o bucket só tem o .png do
        // slide. A aula fica publicada pelos arquivos completos, com o aviso
        // do player no lugar do vídeo; quando o MP4 subir, é só trocar por
        // r2(...) e a duração real. Ver conclusaoSemVideo.
        video: conclusaoSemVideo,
        ...completeStory({
          dir: "F-MODULO07/Módulo 07/Goldilocks and the Three Bears Arquivos Completos",
          pdf: "PDF Goldilocks and the Three Bears Completo.pdf",
          audio: (voice) => `Goldilocks and the Three Bears ${voice} Audio Completo.mp3`,
          voices: ["Charlie", "Kathy", "Peter", "Zoe"],
        }),
      },
    ],
  },
  {
    slug: "antonio-canova",
    title: "Antonio Canova",
    description: "A história de Antonio Canova, em sete aulas.",
    lessons: [
      { slug: "antonio-canova-instrucoes", title: "Instruções do Módulo 08", description: "", seconds: 367, video: r2("F-MODULO08/M08V64 Instruções do Módulo 08_comprimido.mp4") },
      { slug: "antonio-canova-01", title: "Aula 01 - Antonio Canova", description: "", seconds: 1289, video: r2("F-MODULO08/M08V65 Antonio Canova 01_comprimido.mp4"), ...antonioCanova(1) },
      { slug: "antonio-canova-02", title: "Aula 02 - Antonio Canova", description: "", seconds: 1118, video: r2("F-MODULO08/M08V66 Antonio Canova 02_comprimido.mp4"), ...antonioCanova(2) },
      { slug: "antonio-canova-03", title: "Aula 03 - Antonio Canova", description: "", seconds: 1206, video: r2("F-MODULO08/M08V67 Antonio Canova 03_comprimido.mp4"), ...antonioCanova(3) },
      { slug: "antonio-canova-04", title: "Aula 04 - Antonio Canova", description: "", seconds: 868, video: r2("F-MODULO08/M08V68 Antonio Canova 04_comprimido.mp4"), ...antonioCanova(4) },
      { slug: "antonio-canova-05", title: "Aula 05 - Antonio Canova", description: "", seconds: 1085, video: r2("F-MODULO08/M08V69 Antonio Canova 05_comprimido.mp4"), ...antonioCanova(5) },
      { slug: "antonio-canova-06", title: "Aula 06 - Antonio Canova", description: "", seconds: 721, video: r2("F-MODULO08/M08V70 Antonio Canova 06_comprimido.mp4"), ...antonioCanova(6) },
      { slug: "antonio-canova-07", title: "Aula 07 - Antonio Canova", description: "", seconds: 1342, video: r2("F-MODULO08/M08V71 Antonio Canova 07_comprimido.mp4"), ...antonioCanova(7) },
      {
        slug: "antonio-canova-conclusao",
        title: "Conclusão do Módulo 08",
        description: "",
        seconds: 0,
        // Mesma situação do módulo 07: o M08V72 está no bucket só como .png.
        video: conclusaoSemVideo,
        ...completeStory({
          dir: "F-MODULO08/Módulo 08/Antonio Canova Complete",
          pdf: "PDF Antonio Canova Completo.pdf",
          audio: (voice) => `Antonio Canova ${voice} Complete Audio.mp3`,
          voices: ["Charlie", "Kathy", "Peter", "Zoe"],
        }),
      },
    ],
  },
  {
    slug: "why-cats-and-dogs-are-enemies",
    title: "Why Cats and Dogs are Enemies",
    description: "A história de Why Cats and Dogs are Enemies, em oito aulas.",
    lessons: [
      { slug: "why-cats-and-dogs-are-enemies-instrucoes", title: "Instruções do Módulo 09", description: "", seconds: 182, video: r2("F-MODULO09/M09V73 Instruções do Módulo 09_comprimido.mp4") },
      { slug: "why-cats-and-dogs-are-enemies-01", title: "Aula 01 - Why Cats and Dogs are Enemies", description: "", seconds: 2203, video: r2("F-MODULO09/M09V74 Why Cats and Dogs are Enemies 01_comprimido.mp4"), ...whyCatsAndDogs(1) },
      { slug: "why-cats-and-dogs-are-enemies-02", title: "Aula 02 - Why Cats and Dogs are Enemies", description: "", seconds: 1326, video: r2("F-MODULO09/M09V75 Why Cats and Dogs are Enemies 02_comprimido.mp4"), ...whyCatsAndDogs(2) },
      { slug: "why-cats-and-dogs-are-enemies-03", title: "Aula 03 - Why Cats and Dogs are Enemies", description: "", seconds: 1186, video: r2("F-MODULO09/M09V76 Why Cats and Dogs are Enemies 03_comprimido.mp4"), ...whyCatsAndDogs(3) },
      { slug: "why-cats-and-dogs-are-enemies-04", title: "Aula 04 - Why Cats and Dogs are Enemies", description: "", seconds: 1476, video: r2("F-MODULO09/M09V77 Why Cats and Dogs are Enemies 04_comprimido.mp4"), ...whyCatsAndDogs(4) },
      { slug: "why-cats-and-dogs-are-enemies-05", title: "Aula 05 - Why Cats and Dogs are Enemies", description: "", seconds: 1429, video: r2("F-MODULO09/M09V78 Why Cats and Dogs are Enemies 05_comprimido.mp4"), ...whyCatsAndDogs(5) },
      { slug: "why-cats-and-dogs-are-enemies-06", title: "Aula 06 - Why Cats and Dogs are Enemies", description: "", seconds: 1151, video: r2("F-MODULO09/M09V79 Why Cats and Dogs are Enemies 06_comprimido.mp4"), ...whyCatsAndDogs(6) },
      { slug: "why-cats-and-dogs-are-enemies-07", title: "Aula 07 - Why Cats and Dogs are Enemies", description: "", seconds: 1355, video: r2("F-MODULO09/M09V80 Why Cats and Dogs are Enemies 07_comprimido.mp4"), ...whyCatsAndDogs(7) },
      { slug: "why-cats-and-dogs-are-enemies-08", title: "Aula 08 - Why Cats and Dogs are Enemies", description: "", seconds: 981, video: r2("F-MODULO09/M09V81 Why Cats and Dogs are Enemies 08_comprimido.mp4"), ...whyCatsAndDogs(8) },
      {
        // O vídeo fecha a Fundação inteira, não só o módulo 09 — é o nome que
        // ele tem no bucket ("Conclusão da Fundação") e o que o aluno ouve.
        slug: "why-cats-and-dogs-are-enemies-conclusao",
        title: "Conclusão da Fundação",
        description: "",
        seconds: 822,
        video: r2("F-MODULO09/M09V82 Conclusão da Fundação_comprimido.mp4"),
        ...completeStory({
          // A pasta abrevia o título ("Cats and Dogs"), mas os arquivos dentro
          // dela não.
          dir: "F-MODULO09/Módulo 09/Cats and Dogs Arquivos Completos",
          pdf: "PDF Why Cats and Dogs are Enemies Completo.pdf",
          audio: (voice) => `Why Cats and Dogs are Enemies ${voice} Complete Audio.mp3`,
          voices: ["Charlie", "Kathy", "Peter", "Zoe"],
        }),
      },
    ],
  },
];
