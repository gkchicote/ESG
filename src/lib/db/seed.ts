import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { CURRICULUM } from "./catalog";

type Runner = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
};

/** Tamanho real dos PDFs gerados, para exibir na interface. */
function pdfSize(file: string): number | null {
  const p = path.join(process.cwd(), "content", "pdfs", file);
  return fs.existsSync(p) ? fs.statSync(p).size : null;
}

/**
 * Popula o banco com o curso de demonstração.
 * Chamado uma única vez, quando o banco local é criado do zero.
 */
export async function seed(db: Runner) {
  const [student] = (
    await db.query(
      `insert into profiles (email, password_hash, full_name, role)
       values ($1, $2, $3, 'student') returning id`,
      ["aluno@demo.com", bcrypt.hashSync("demo1234", 10), "Ana Duarte"],
    )
  ).rows as { id: string }[];

  await db.query(
    `insert into profiles (email, password_hash, full_name, role)
     values ($1, $2, $3, 'admin')`,
    ["admin@demo.com", bcrypt.hashSync("admin1234", 10), "Coordenação"],
  );

  const [course] = (
    await db.query(
      `insert into courses (title, slug, description, level)
       values ($1, $2, $3, $4) returning id`,
      [
        "Inglês do Zero à Fluência",
        "ingles-do-zero-a-fluencia",
        "Um caminho direto do primeiro contato até conversar com confiança, sem decorar regras soltas.",
        "A1 → B1",
      ],
    )
  ).rows as { id: string }[];

  const lessonIds: string[] = [];

  for (const [mi, mod] of CURRICULUM.entries()) {
    const [m] = (
      await db.query(
        `insert into modules (course_id, title, description, position)
         values ($1, $2, $3, $4) returning id`,
        [course.id, mod.title, mod.description, mi + 1],
      )
    ).rows as { id: string }[];

    for (const [li, lesson] of mod.lessons.entries()) {
      const [l] = (
        await db.query(
          `insert into lessons (module_id, title, description, position,
                                video_provider, video_id, duration_seconds, is_free_preview)
           values ($1, $2, $3, $4, 'file', $5, $6, $7) returning id`,
          [
            m.id,
            lesson.title,
            lesson.description,
            li + 1,
            `${lesson.slug}.mp4`,
            lesson.seconds,
            mi === 0 && li === 0,
          ],
        )
      ).rows as { id: string }[];

      lessonIds.push(l.id);

      for (const [xi, mat] of (lesson.materials ?? []).entries()) {
        await db.query(
          `insert into materials (lesson_id, title, storage_path, file_type, file_size, position)
           values ($1, $2, $3, 'pdf', $4, $5)`,
          [l.id, mat.title, mat.file, pdfSize(mat.file), xi],
        );
      }
    }
  }

  // Estado inicial do aluno de demonstração: módulo 1 concluído, duas aulas
  // do módulo 2 concluídas e a sétima aula começada pela metade.
  for (const id of lessonIds.slice(0, 6)) {
    await db.query(
      `insert into lesson_progress
         (profile_id, lesson_id, completed, completed_at, last_position_seconds, watched_seconds)
       values ($1, $2, true, now() - interval '2 days', 0, 0)`,
      [student.id, id],
    );
  }

  const current = lessonIds[6];
  await db.query(
    `insert into lesson_progress
       (profile_id, lesson_id, completed, last_position_seconds, watched_seconds)
     values ($1, $2, false, 12, 12)`,
    [student.id, current],
  );

  await db.query(
    `insert into enrollments (profile_id, course_id, last_lesson_id, last_accessed_at)
     values ($1, $2, $3, now() - interval '1 day')`,
    [student.id, course.id, current],
  );
}
