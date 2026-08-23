/**
 * Cria (ou atualiza) o acesso de um aluno e o matricula no curso.
 *
 *   npm run create-user -- --email ana@exemplo.com --nome "Ana Duarte" --senha "trocar123"
 *   npm run create-user -- --email ana@exemplo.com --nome "Ana" --senha "x" --curso ingles-do-zero-a-fluencia
 *
 * Sem --curso, matricula no primeiro curso publicado.
 */
import bcrypt from "bcryptjs";
import { query, queryOne } from "../src/lib/db/driver";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email");
  const name = arg("nome");
  const password = arg("senha");
  const slug = arg("curso");
  const role = (arg("papel") ?? "student") as "student" | "admin";

  if (!email || !name || !password) {
    console.error(
      "\nUso: npm run create-user -- --email <email> --nome <nome> --senha <senha> [--curso <slug>] [--papel admin]\n",
    );
    process.exit(1);
  }

  const hash = bcrypt.hashSync(password, 10);

  const profile = await queryOne<{ id: string; email: string }>(
    `insert into profiles (email, password_hash, full_name, role)
     values ($1, $2, $3, $4)
     on conflict (email) do update
        set password_hash = excluded.password_hash,
            full_name     = excluded.full_name,
            role          = excluded.role
     returning id, email`,
    [email.toLowerCase(), hash, name, role],
  );

  const course = slug
    ? await queryOne<{ id: string; title: string }>(
        `select id, title from courses where slug = $1`,
        [slug],
      )
    : await queryOne<{ id: string; title: string }>(
        `select id, title from courses where is_published order by created_at limit 1`,
      );

  if (!course) {
    console.error("✗ Curso não encontrado. Cadastre um curso antes de matricular.");
    process.exit(1);
  }

  await query(
    `insert into enrollments (profile_id, course_id)
     values ($1, $2) on conflict (profile_id, course_id) do nothing`,
    [profile!.id, course.id],
  );

  console.log(`\n✓ Acesso pronto para ${profile!.email}`);
  console.log(`  Nome:  ${name}`);
  console.log(`  Senha: ${password}`);
  console.log(`  Curso: ${course.title}\n`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
