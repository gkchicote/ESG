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

  // ---------------------------------------------------------------
  //  Gamificação — 1 ponto por aula concluída
  // ---------------------------------------------------------------

  // Uma linha por ponto, e não um contador em `profiles`: a chave primária
  // composta é o que garante que a mesma aula nunca pague duas vezes, sem
  // depender de nenhum cuidado do lado do app. `points` é sempre 1 hoje, mas
  // fica como coluna para o dia em que uma aula valer mais que outra.
  await exec(
    `create table if not exists lesson_points (
       profile_id uuid not null references profiles(id) on delete cascade,
       lesson_id  uuid not null references lessons(id) on delete cascade,
       points     int  not null default 1,
       awarded_at timestamptz not null default now(),
       primary key (profile_id, lesson_id)
     )`,
  );
  await exec(`create index if not exists lesson_points_profile_idx on lesson_points (profile_id)`);

  // Quem concluiu aula antes da gamificação existir também tem direito ao
  // ponto. Roda todo boot de propósito: é `on conflict do nothing`, então
  // custa uma varredura e conserta sozinho qualquer ponto que tenha faltado.
  await exec(
    `insert into lesson_points (profile_id, lesson_id, awarded_at)
     select lp.profile_id, lp.lesson_id, coalesce(lp.completed_at, lp.updated_at)
       from lesson_progress lp
      where lp.completed
     on conflict (profile_id, lesson_id) do nothing`,
  );

  // ---------------------------------------------------------------
  //  Ofensiva (streak) — dias seguidos com aula concluída
  // ---------------------------------------------------------------

  // Contador materializado em `profiles` em vez de derivado de `lesson_points`:
  // a regra "só a primeira aula do dia avança" precisa de um lugar onde o
  // próprio banco decida se o dia já contou (ver `registerStudyDay`), e uma
  // agregação por data não sabe distinguir a primeira conclusão das demais.
  //
  // `streak_last_day` é `date`, não `timestamptz`, e sempre no fuso de
  // Brasília: quem termina a aula às 22h de terça não pode acordar na quarta
  // achando que já estudou — em UTC essa hora já é o dia seguinte.
  await exec(`alter table profiles add column if not exists streak_days int not null default 0`);
  await exec(`alter table profiles add column if not exists streak_best int not null default 0`);
  await exec(`alter table profiles add column if not exists streak_last_day date`);

  // Quem já estudava antes da ofensiva existir não começa do zero: as datas
  // de `lesson_points` reconstroem as sequências. O truque do `d - row_number()`
  // é o clássico "ilhas": dias consecutivos caem no mesmo grupo.
  //
  // Só preenche quem nunca registrou ofensiva (`streak_last_day is null`), então
  // rodar todo boot não sobrescreve o que o app já contou.
  await exec(
    `with dias as (
       select profile_id,
              (awarded_at at time zone 'America/Sao_Paulo')::date as d
         from lesson_points
        group by 1, 2
     ),
     ilhas as (
       select profile_id, d,
              d - (row_number() over (partition by profile_id order by d))::int as grupo
         from dias
     ),
     sequencias as (
       select profile_id, count(*)::int as dias, max(d) as ultimo
         from ilhas
        group by profile_id, grupo
     ),
     recorde as (
       select profile_id, max(dias) as melhor
         from sequencias
        group by profile_id
     ),
     atual as (
       select distinct on (profile_id) profile_id, dias, ultimo
         from sequencias
        order by profile_id, ultimo desc
     )
     update profiles p
        set streak_days     = a.dias,
            streak_best     = greatest(p.streak_best, r.melhor),
            streak_last_day = a.ultimo
       from atual a
       join recorde r on r.profile_id = a.profile_id
      where p.id = a.profile_id
        and p.streak_last_day is null`,
  );

  // Módulo onde o aluno está agora. Dá para deduzir de `last_lesson_id`, mas
  // gravado ele sai de graça no placar (uma coluna, sem subconsulta) e
  // sobrevive à aula sair do catálogo.
  await exec(
    `alter table enrollments add column if not exists current_module_id uuid
       references modules(id) on delete set null`,
  );
  await exec(
    `update enrollments e
        set current_module_id = l.module_id
       from lessons l
      where l.id = e.last_lesson_id and e.current_module_id is null`,
  );

  // Placar da aba "Progresso": nome, módulo atual e pontos, por curso.
  // Os pontos vêm de subconsulta em vez de join para não multiplicar linha
  // com o join de `modules` — e ficam limitados ao curso da matrícula.
  //
  // drop+create em vez de `create or replace`: o Postgres recusa o replace
  // quando a lista de colunas muda, e esta view ainda vai crescer.
  await exec(`drop view if exists student_scoreboard`);
  await exec(
    `create view student_scoreboard as
     select p.id         as profile_id,
            p.full_name,
            p.avatar_url,
            e.course_id,
            coalesce((select sum(pt.points)
                        from lesson_points pt
                        join lessons lx on lx.id = pt.lesson_id
                        join modules mx on mx.id = lx.module_id
                       where pt.profile_id = p.id
                         and mx.course_id  = e.course_id), 0)::int as points,
            m.id       as module_id,
            m.position as module_position,
            m.title    as module_title,
            e.last_accessed_at,
            -- Ofensiva "viva": o contador guardado só vale enquanto a
            -- sequência não foi quebrada. Sem este case, quem parou há um mês
            -- continuaria exibindo os 12 dias em que a sequência morreu.
            -- Ontem ainda conta — o dia de hoje inteiro é a chance de manter.
            case
              when p.streak_last_day >= ((now() at time zone 'America/Sao_Paulo')::date - 1)
                then p.streak_days
              else 0
            end as streak_days,
            p.streak_best
       from enrollments e
       join profiles p on p.id = e.profile_id
       left join modules m on m.id = e.current_module_id
      where e.expires_at is null or e.expires_at > now()`,
  );

  // ---------------------------------------------------------------
  //  Recuperação de senha
  // ---------------------------------------------------------------

  // Guarda o SHA-256 do token, nunca o token em si: quem lê o banco (backup,
  // log de query, dump vazado) não consegue redefinir a senha de ninguém. O
  // valor cru existe só dentro do link que vai no e-mail.
  await exec(
    `create table if not exists password_resets (
       id         uuid primary key default gen_random_uuid(),
       profile_id uuid not null references profiles(id) on delete cascade,
       token_hash text not null unique,
       created_at timestamptz not null default now(),
       expires_at timestamptz not null,
       used_at    timestamptz
     )`,
  );
  await exec(
    `create index if not exists password_resets_profile_idx on password_resets (profile_id)`,
  );

  // ---------------------------------------------------------------
  //  Convites
  // ---------------------------------------------------------------

  // O admin só gera o link: quem recebe informa nome, e-mail e senha. Por
  // isso `email` deixa de ser obrigatório — ele passa a ser preenchido no
  // aceite, não na geração. Convites antigos mantêm o e-mail que já tinham.
  await exec(
    `create table if not exists invites (
       id         uuid primary key default gen_random_uuid(),
       token      text not null unique,
       email      text,
       full_name  text,
       role       text not null default 'student' check (role in ('student', 'admin')),
       course_id  uuid references courses(id) on delete set null,
       created_by uuid not null references profiles(id) on delete cascade,
       created_at timestamptz not null default now(),
       expires_at timestamptz not null,
       used_at    timestamptz
     )`,
  );
  await exec(`create index if not exists invites_token_idx on invites (token)`);
  await exec(`alter table invites alter column email drop not null`);

  // ---------------------------------------------------------------
  //  Playlist de áudios
  // ---------------------------------------------------------------

  // Uma linha por áudio salvo pelo aluno. A chave primária composta é o que
  // impede o mesmo áudio de entrar duas vezes, sem depender de o app conferir
  // antes de inserir — mesma ideia de `lesson_points`.
  //
  // O `on delete cascade` dos dois lados é o que mantém a playlist honesta:
  // material que sai do catálogo (ou aluno removido) leva o item embora, e a
  // lista nunca aponta para um arquivo que não existe mais.
  //
  // Fica no banco, e não no navegador: a playlist é do aluno, não do aparelho
  // — quem monta a lista no computador continua ouvindo dela no celular.
  await exec(
    `create table if not exists playlist_items (
       profile_id  uuid not null references profiles(id) on delete cascade,
       material_id uuid not null references materials(id) on delete cascade,
       added_at    timestamptz not null default now(),
       primary key (profile_id, material_id)
     )`,
  );
  // A playlist é sempre lida inteira e na ordem em que foi montada.
  await exec(
    `create index if not exists playlist_items_profile_idx
       on playlist_items (profile_id, added_at)`,
  );
}
