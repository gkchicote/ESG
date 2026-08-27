import { query, queryOne } from "./driver";
import { applyMigrations } from "./migrate";
import { contentFileSize, r2FileSizes } from "../content-files";
import { COURSE, CURRICULUM, lessonMaterials, lessonVideo } from "./catalog";

/**
 * Aplica o catálogo (./catalog.ts) no banco.
 *
 * Roda pelo CLI (`npm run content:sync`) e pelo botão "Publicar catálogo" da
 * página de administração — o segundo existe porque, num deploy em que o
 * Postgres só é alcançável de dentro da rede do container, o CLI não tem como
 * chegar no banco. O seed só popula banco criado do zero; daí em diante é
 * este sync que publica módulos e aulas.
 *
 * Casa as linhas pelo `slug`: o que já existe é atualizado (o progresso dos
 * alunos continua de pé) e o que sumiu do catálogo é apagado.
 */

export type SyncSummary = {
  courseId: string;
  courseTitle: string;
  courseCreated: boolean;
  modules: number;
  lessons: number;
  created: number;
  updated: number;
  removed: number;
};

type Log = (line: string) => void;

/**
 * As migrações também rodam no boot do driver (src/lib/db/migrate.ts). Aqui
 * elas são refeitas de propósito: se o boot falhou por falta de permissão, é
 * neste clique que o erro precisa aparecer para quem publica o catálogo.
 */
async function ensureSchema() {
  await applyMigrations((sql) => query(sql));
}

/**
 * Linhas antigas (sem slug) recebem o slug do catálogo — assim o primeiro sync
 * atualiza o que já existe em vez de recriar tudo e zerar o progresso. Módulo
 * casa por posição; aula, por título dentro do módulo.
 */
async function backfillSlugs(courseId: string) {
  for (const [mi, mod] of CURRICULUM.entries()) {
    const rows = await query<{ id: string }>(
      `update modules set slug = $1
        where course_id = $2 and position = $3 and slug is null
        returning id`,
      [mod.slug, courseId, mi + 1],
    );
    const moduleId =
      rows[0]?.id ??
      (
        await queryOne<{ id: string }>(`select id from modules where course_id = $1 and slug = $2`, [
          courseId,
          mod.slug,
        ])
      )?.id;
    if (!moduleId) continue;

    for (const lesson of mod.lessons) {
      await query(
        `update lessons set slug = $1 where module_id = $2 and title = $3 and slug is null`,
        [lesson.slug, moduleId, lesson.title],
      );
    }
  }
}

export async function syncCurriculum(
  { courseSlug = COURSE.slug, log }: { courseSlug?: string; log?: Log } = {},
): Promise<SyncSummary> {
  await ensureSchema();

  // Uma listagem por pasta do R2 para todos os materiais, em vez de uma
  // requisição por arquivo — o tamanho é só cosmético, não vale o custo.
  const r2Keys = CURRICULUM.flatMap((m) =>
    m.lessons.flatMap((l) => lessonMaterials(l).filter((mat) => mat.storage === "r2").map((mat) => mat.file)),
  );
  const r2Sizes = await r2FileSizes(r2Keys);

  const existing = await queryOne<{ id: string; title: string }>(
    `select id, title from courses where slug = $1`,
    [courseSlug],
  );

  const course =
    existing ??
    (await queryOne<{ id: string; title: string }>(
      `insert into courses (title, slug, description, level)
       values ($1, $2, $3, $4) returning id, title`,
      [COURSE.title, courseSlug, COURSE.description, COURSE.level],
    ))!;

  const summary: SyncSummary = {
    courseId: course.id,
    courseTitle: course.title,
    courseCreated: !existing,
    modules: CURRICULUM.length,
    lessons: CURRICULUM.reduce((n, m) => n + m.lessons.length, 0),
    created: 0,
    updated: 0,
    removed: 0,
  };

  log?.(`${existing ? "~" : "+"} Curso ${course.title}`);
  await backfillSlugs(course.id);

  // Posições viram negativas antes do upsert: quem não for tocado sobra com
  // valor negativo e é apagado no fim. Também evita colidir com o índice
  // único (course_id, position) quando um módulo muda de lugar.
  await query(`update modules set position = -position where course_id = $1 and position > 0`, [
    course.id,
  ]);

  for (const [mi, mod] of CURRICULUM.entries()) {
    const [m] = await query<{ id: string; inserted: boolean }>(
      `insert into modules (course_id, slug, title, description, position)
       values ($1, $2, $3, $4, $5)
       on conflict (course_id, slug) do update
          set title = excluded.title,
              description = excluded.description,
              position = excluded.position
       returning id, (xmax = 0) as inserted`,
      [course.id, mod.slug, mod.title, mod.description, mi + 1],
    );

    log?.(`  ${m.inserted ? "+" : "~"} Módulo ${mi + 1} — ${mod.title}`);

    await query(`update lessons set position = -position where module_id = $1 and position > 0`, [
      m.id,
    ]);

    for (const [li, lesson] of mod.lessons.entries()) {
      const video = lessonVideo(lesson);
      const [l] = await query<{ id: string; inserted: boolean }>(
        `insert into lessons (module_id, slug, title, description, position,
                              video_provider, video_id, duration_seconds)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         on conflict (module_id, slug) do update
            set title = excluded.title,
                description = excluded.description,
                position = excluded.position,
                video_provider = excluded.video_provider,
                video_id = excluded.video_id,
                duration_seconds = excluded.duration_seconds
         returning id, (xmax = 0) as inserted`,
        [
          m.id,
          lesson.slug,
          lesson.title,
          lesson.description || null,
          li + 1,
          video.provider,
          video.id,
          lesson.seconds,
        ],
      );

      if (l.inserted) summary.created += 1;
      else summary.updated += 1;
      log?.(`      ${l.inserted ? "+" : "~"} ${lesson.title}  (${video.id ? video.provider : "sem vídeo"})`);

      // Materiais não têm slug: são só ponteiros para arquivos, refaz-se.
      await query(`delete from materials where lesson_id = $1`, [l.id]);
      for (const [xi, mat] of lessonMaterials(lesson).entries()) {
        const size = mat.storage === "r2" ? (r2Sizes.get(mat.file) ?? null) : contentFileSize(mat.file);
        await query(
          `insert into materials (lesson_id, title, storage_path, file_type, storage_provider, file_size, position)
           values ($1, $2, $3, $4, $5, $6, $7)`,
          [l.id, mat.title, mat.file, mat.type, mat.storage, size, xi],
        );
      }
    }

    const gone = await query<{ title: string }>(
      `delete from lessons where module_id = $1 and position < 0 returning title`,
      [m.id],
    );
    summary.removed += gone.length;
    for (const g of gone) log?.(`      - ${g.title}  (removida)`);
  }

  const goneModules = await query<{ title: string }>(
    `delete from modules where course_id = $1 and position < 0 returning title`,
    [course.id],
  );
  for (const g of goneModules) log?.(`  - Módulo ${g.title}  (removido)`);

  return summary;
}
