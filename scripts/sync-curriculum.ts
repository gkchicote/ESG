/**
 * Aplica o catálogo (src/lib/db/catalog.ts) num banco que já existe.
 *
 *   npm run content:sync                              # curso mais antigo
 *   npm run content:sync -- --curso ingles-do-zero-a-fluencia
 *
 * O seed só roda no primeiro boot do banco. Este script é o caminho para
 * publicar módulos e aulas depois disso — inclusive em produção, apontando
 * DATABASE_URL para o Postgres do servidor.
 *
 * Casa as linhas pelo `slug`: aula existente é atualizada (o progresso dos
 * alunos é preservado), aula que sumiu do catálogo é apagada.
 */
import { query, queryOne } from "../src/lib/db/driver";
import { CURRICULUM, lessonVideo } from "../src/lib/db/catalog";
import fs from "node:fs";
import path from "node:path";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function pdfSize(file: string): number | null {
  const p = path.join(process.cwd(), "content", "pdfs", file);
  return fs.existsSync(p) ? fs.statSync(p).size : null;
}

/** Colunas de slug: bancos criados antes desta versão não as têm. */
async function ensureSchema() {
  await query(`alter table modules add column if not exists slug text`);
  await query(`alter table lessons add column if not exists slug text`);
  await query(
    `create unique index if not exists modules_course_slug_idx on modules (course_id, slug)`,
  );
  await query(
    `create unique index if not exists lessons_module_slug_idx on lessons (module_id, slug)`,
  );
}

/**
 * Linhas antigas (sem slug) recebem o slug do catálogo pelo título — assim o
 * primeiro sync atualiza o que já existe em vez de recriar tudo e zerar o
 * progresso. Módulo casa por posição; aula, por título dentro do módulo.
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
      (await queryOne<{ id: string }>(
        `select id from modules where course_id = $1 and slug = $2`,
        [courseId, mod.slug],
      ))?.id;
    if (!moduleId) continue;

    for (const lesson of mod.lessons) {
      await query(
        `update lessons set slug = $1
          where module_id = $2 and title = $3 and slug is null`,
        [lesson.slug, moduleId, lesson.title],
      );
    }
  }
}

async function main() {
  const slug = arg("curso");
  await ensureSchema();

  const course = await queryOne<{ id: string; title: string; slug: string }>(
    slug
      ? `select id, title, slug from courses where slug = $1`
      : `select id, title, slug from courses order by created_at limit 1`,
    slug ? [slug] : [],
  );

  if (!course) {
    console.error(slug ? `\n  Curso "${slug}" não encontrado.\n` : "\n  Nenhum curso no banco.\n");
    process.exit(1);
  }

  console.log(`\n  Curso: ${course.title} (${course.slug})\n`);
  await backfillSlugs(course.id);

  // Posições viram negativas antes do upsert: quem não for tocado sobra com
  // valor negativo e é apagado no fim. Também evita colisão com o índice
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

    console.log(`  ${m.inserted ? "+" : "~"} Módulo ${mi + 1} — ${mod.title}`);

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

      const state = video.id ? video.provider : "sem vídeo";
      console.log(`      ${l.inserted ? "+" : "~"} ${lesson.title}  (${state})`);

      // Materiais não têm slug: são só ponteiros para arquivos, refaz-se.
      await query(`delete from materials where lesson_id = $1`, [l.id]);
      for (const [xi, mat] of (lesson.materials ?? []).entries()) {
        await query(
          `insert into materials (lesson_id, title, storage_path, file_type, file_size, position)
           values ($1, $2, $3, 'pdf', $4, $5)`,
          [l.id, mat.title, mat.file, pdfSize(mat.file), xi],
        );
      }
    }

    const gone = await query<{ title: string }>(
      `delete from lessons where module_id = $1 and position < 0 returning title`,
      [m.id],
    );
    for (const g of gone) console.log(`      - ${g.title}  (removida)`);
  }

  const goneModules = await query<{ title: string }>(
    `delete from modules where course_id = $1 and position < 0 returning title`,
    [course.id],
  );
  for (const g of goneModules) console.log(`  - Módulo ${g.title}  (removido)`);

  console.log("\n  ✓ Currículo sincronizado.\n");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
