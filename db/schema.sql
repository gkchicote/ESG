-- =====================================================================
--  LMS de Inglês — schema base (PostgreSQL)
--  Roda identicamente no PGlite (dev local) e no Supabase/Postgres.
-- =====================================================================

-- ---------- Pessoas -------------------------------------------------
create table if not exists profiles (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,
  full_name     text not null,
  avatar_url    text,
  role          text not null default 'student' check (role in ('student', 'admin')),
  created_at    timestamptz not null default now(),
  -- Quando a pessoa entrou na plataforma pela última vez (login efetivado).
  last_login_at timestamptz
);

-- ---------- Conteúdo ------------------------------------------------
create table if not exists courses (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  slug         text not null unique,
  description  text,
  cover_url    text,
  level        text,
  is_published boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists modules (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references courses(id) on delete cascade,
  -- Identificador estável do módulo no catálogo (src/lib/db/catalog.ts).
  -- É por ele que `npm run content:sync` reconhece a linha e a atualiza.
  slug         text,
  title        text not null,
  description  text,
  position     int  not null,
  is_published boolean not null default true,
  unique (course_id, position)
);

create table if not exists lessons (
  id               uuid primary key default gen_random_uuid(),
  module_id        uuid not null references modules(id) on delete cascade,
  -- Mesmo papel do slug do módulo: chave estável para o sync do catálogo.
  slug             text,
  title            text not null,
  description      text,
  position         int  not null,
  -- 'file' = arquivo local em content/videos (dev)
  -- 'r2'   = chave do objeto no bucket privado do Cloudflare R2 (produção)
  -- 'url'  = link http(s) direto (mp4/hls)
  -- 'bunny' | 'youtube' | 'vimeo' | 'drive' = id no provider
  video_provider   text not null default 'file'
                   check (video_provider in ('file', 'r2', 'url', 'bunny', 'youtube', 'vimeo', 'drive')),
  video_id         text,
  duration_seconds int  not null default 0,
  is_published     boolean not null default true,
  is_free_preview  boolean not null default false,
  unique (module_id, position)
);

-- PDFs e anexos: pendurados na aula OU no módulo
create table if not exists materials (
  id           uuid primary key default gen_random_uuid(),
  lesson_id    uuid references lessons(id) on delete cascade,
  module_id    uuid references modules(id) on delete cascade,
  title        text not null,
  -- 'file' = arquivo local em content/ (dev, ou VPS com volume montado)
  -- 'r2'   = chave do objeto no bucket privado do Cloudflare R2, na mesma
  --          pasta do vídeo da aula — evita depender do disco do servidor.
  storage_provider text not null default 'file' check (storage_provider in ('file', 'r2')),
  storage_path text not null,
  file_type    text not null default 'pdf' check (file_type in ('pdf', 'zip', 'audio', 'link')),
  file_size    bigint,
  position     int  not null default 0,
  check (lesson_id is not null or module_id is not null)
);

-- ---------- Matrícula e progresso -----------------------------------
create table if not exists enrollments (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid not null references profiles(id) on delete cascade,
  course_id        uuid not null references courses(id) on delete cascade,
  enrolled_at      timestamptz not null default now(),
  last_accessed_at timestamptz,
  last_lesson_id   uuid references lessons(id) on delete set null,
  -- Módulo em que a pessoa está agora — alimenta o placar de /progresso.
  current_module_id uuid references modules(id) on delete set null,
  expires_at       timestamptz,
  unique (profile_id, course_id)
);

create table if not exists lesson_progress (
  id                    uuid primary key default gen_random_uuid(),
  profile_id            uuid not null references profiles(id) on delete cascade,
  lesson_id             uuid not null references lessons(id) on delete cascade,
  completed             boolean not null default false,
  completed_at          timestamptz,
  last_position_seconds int not null default 0,
  watched_seconds       int not null default 0,
  updated_at            timestamptz not null default now(),
  unique (profile_id, lesson_id)
);

-- ---------- Gamificação ----------------------------------------------
-- 1 ponto por aula concluída. Um registro por ponto, não um contador: a
-- chave primária composta é o que impede a mesma aula de pagar duas vezes.
-- O ponto é ganho uma vez e fica — desmarcar a aula depois não o devolve.
create table if not exists lesson_points (
  profile_id uuid not null references profiles(id) on delete cascade,
  lesson_id  uuid not null references lessons(id) on delete cascade,
  points     int  not null default 1,
  awarded_at timestamptz not null default now(),
  primary key (profile_id, lesson_id)
);

-- ---------- Convites -------------------------------------------------
-- Admin só gera o link (define perfil e curso); quem recebe preenche nome,
-- e-mail e senha, e o próprio convite cria o acesso — o admin nunca vê a
-- senha nem precisa saber o e-mail de antemão.
--
-- `email` e `full_name` ficam nulos nos convites novos. Continuam na tabela
-- porque convites antigos, gerados quando o admin informava o e-mail, ainda
-- os têm — e o formulário de aceite usa esses valores como sugestão.
create table if not exists invites (
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
);

-- ---------- Recuperação de senha -------------------------------------
-- Guarda o SHA-256 do token, nunca o token em si: quem lê o banco (backup,
-- dump, log de query) não consegue redefinir a senha de ninguém. O valor cru
-- só existe dentro do link enviado por e-mail.
create table if not exists password_resets (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at    timestamptz
);

-- ---------- Índices -------------------------------------------------
create index if not exists modules_course_idx    on modules (course_id, position);
create index if not exists lessons_module_idx    on lessons (module_id, position);
create index if not exists materials_lesson_idx  on materials (lesson_id);
create index if not exists materials_module_idx  on materials (module_id);
create index if not exists progress_profile_idx  on lesson_progress (profile_id);
create index if not exists enrollments_prof_idx  on enrollments (profile_id);
create index if not exists invites_token_idx     on invites (token);
create index if not exists lesson_points_profile_idx on lesson_points (profile_id);
create index if not exists password_resets_profile_idx on password_resets (profile_id);

-- Bancos criados antes dos slugs: o `create table if not exists` acima não
-- adiciona colunas novas, então o ALTER cobre esse caso. Idempotente.
alter table modules add column if not exists slug text;
alter table lessons add column if not exists slug text;

create unique index if not exists modules_course_slug_idx on modules (course_id, slug);
create unique index if not exists lessons_module_slug_idx on lessons (module_id, slug);

-- Bancos criados antes dos providers 'drive' e 'r2': recria a checagem com os
-- valores novos. drop+add é idempotente — não falha se já tiver sido aplicado.
alter table lessons drop constraint if exists lessons_video_provider_check;
alter table lessons add constraint lessons_video_provider_check
  check (video_provider in ('file', 'r2', 'url', 'bunny', 'youtube', 'vimeo', 'drive'));

-- Bancos criados antes do registro de login: coluna nova em profiles.
alter table profiles add column if not exists last_login_at timestamptz;

-- Bancos criados antes do storage_provider de materials: idem, coluna nova.
alter table materials add column if not exists storage_provider text not null default 'file';

-- Bancos criados antes do convite sem e-mail: o e-mail agora chega no aceite.
alter table invites alter column email drop not null;
alter table materials drop constraint if exists materials_storage_provider_check;
alter table materials add constraint materials_storage_provider_check
  check (storage_provider in ('file', 'r2'));

-- ---------- View de progresso agregado ------------------------------
create or replace view course_progress as
select
  e.profile_id,
  e.course_id,
  count(l.id)                                                as total_lessons,
  count(lp.id) filter (where lp.completed)                   as completed_lessons,
  coalesce(round(100.0 * count(lp.id) filter (where lp.completed)
        / nullif(count(l.id), 0)), 0)::int                   as percent,
  coalesce(sum(l.duration_seconds), 0)::int                  as total_seconds,
  coalesce(sum(l.duration_seconds) filter (where lp.completed), 0)::int as completed_seconds
from enrollments e
join modules m on m.course_id = e.course_id and m.is_published
join lessons l on l.module_id = m.id        and l.is_published
left join lesson_progress lp
       on lp.lesson_id = l.id and lp.profile_id = e.profile_id
group by e.profile_id, e.course_id;

-- ---------- Placar de progresso (aba /progresso) ---------------------
-- Nome, módulo atual e total de pontos de cada aluno, por curso. Os pontos
-- vêm de subconsulta em vez de join para não multiplicar linha com o join de
-- `modules`, e ficam restritos ao curso da matrícula.
create or replace view student_scoreboard as
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
       e.last_accessed_at
  from enrollments e
  join profiles p on p.id = e.profile_id
  left join modules m on m.id = e.current_module_id
 where e.expires_at is null or e.expires_at > now();
