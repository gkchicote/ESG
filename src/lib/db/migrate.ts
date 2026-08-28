/**
 * Migrações incrementais de schema.
 *
 * `db/schema.sql` só roda uma vez, no primeiro boot do PGlite local — nunca
 * contra o Postgres apontado por DATABASE_URL. Sem isto, toda coluna nova
 * dependeria de alguém lembrar de clicar em "Publicar catálogo" no ambiente
 * certo, e o app quebraria (500) entre o deploy do código novo e esse clique.
 *
 * Por isso as mudanças de schema moram aqui e são aplicadas no boot de
 * qualquer driver, além de na publicação do catálogo. Todo comando é
 * idempotente: rodar de novo não falha nem perde dado.
 *
 * `exec` recebe o executor cru do driver — este módulo não importa o driver,
 * senão o boot dele dependeria de si mesmo.
 */
export type Exec = (sql: string) => Promise<unknown>;

export async function applyMigrations(exec: Exec): Promise<void> {
  // Colunas de slug: bancos criados antes dos slugs não as têm.
  await exec(`alter table modules add column if not exists slug text`);
  await exec(`alter table lessons add column if not exists slug text`);
  await exec(
    `create unique index if not exists modules_course_slug_idx on modules (course_id, slug)`,
  );
  await exec(
    `create unique index if not exists lessons_module_slug_idx on lessons (module_id, slug)`,
  );

  // Provedores de vídeo aceitos: recria a checagem com os valores novos.
  // drop+add é idempotente — não falha se já tiver sido aplicado.
  await exec(`alter table lessons drop constraint if exists lessons_video_provider_check`);
  await exec(
    `alter table lessons add constraint lessons_video_provider_check
       check (video_provider in ('file', 'r2', 'url', 'bunny', 'youtube', 'vimeo', 'drive'))`,
  );

  // Data/hora do último login — coluna lida pela tabela de usuários do admin.
  await exec(`alter table profiles add column if not exists last_login_at timestamptz`);

  // Onde cada material mora: disco do servidor ou bucket do R2.
  await exec(
    `alter table materials add column if not exists storage_provider text not null default 'file'`,
  );
  await exec(`alter table materials drop constraint if exists materials_storage_provider_check`);
  await exec(
    `alter table materials add constraint materials_storage_provider_check
       check (storage_provider in ('file', 'r2'))`,
  );
}
