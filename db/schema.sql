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
  created_at    timestamptz not null default now()
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
  -- 'url'  = link http(s) direto (mp4/hls)
  -- 'bunny' | 'youtube' | 'vimeo' = id no provider
  video_provider   text not null default 'file'
                   check (video_provider in ('file', 'url', 'bunny', 'youtube', 'vimeo')),
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

-- ---------- Convites -------------------------------------------------
-- Admin gera o link (sem definir senha); quem recebe preenche nome + senha
-- e o próprio convite cria o acesso — o admin nunca vê a senha do usuário.
create table if not exists invites (
  id         uuid primary key default gen_random_uuid(),
  token      text not null unique,
  email      text not null,
  full_name  text,
  role       text not null default 'student' check (role in ('student', 'admin')),
  course_id  uuid references courses(id) on delete set null,
  created_by uuid not null references profiles(id) on delete cascade,
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

-- Bancos criados antes dos slugs: o `create table if not exists` acima não
-- adiciona colunas novas, então o ALTER cobre esse caso. Idempotente.
alter table modules add column if not exists slug text;
alter table lessons add column if not exists slug text;

create unique index if not exists modules_course_slug_idx on modules (course_id, slug);
create unique index if not exists lessons_module_slug_idx on lessons (module_id, slug);

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
