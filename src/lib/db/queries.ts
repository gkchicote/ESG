import "server-only";
import { query, queryOne } from "./client";

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  role: "student" | "admin";
};

export type Material = {
  id: string;
  title: string;
  file_type: "pdf" | "zip" | "audio" | "link";
  file_size: number | null;
  storage_path: string;
};

export type Lesson = {
  id: string;
  title: string;
  description: string | null;
  position: number;
  video_provider: string;
  video_id: string | null;
  duration_seconds: number;
  completed: boolean;
  last_position_seconds: number;
  materials: Material[];
};

export type ModuleWithLessons = {
  id: string;
  title: string;
  description: string | null;
  position: number;
  lessons: Lesson[];
  completed_lessons: number;
  total_seconds: number;
};

export type CourseOverview = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  level: string | null;
  percent: number;
  total_lessons: number;
  completed_lessons: number;
  total_seconds: number;
  completed_seconds: number;
  last_accessed_at: string | null;
  last_lesson_id: string | null;
};

/* ------------------------------------------------------------------ */
/* Perfil                                                              */
/* ------------------------------------------------------------------ */

export function getProfileByEmail(email: string) {
  return queryOne<Profile & { password_hash: string }>(
    `select id, email, full_name, avatar_url, role, password_hash
       from profiles where lower(email) = lower($1)`,
    [email],
  );
}

export function getProfileById(id: string) {
  return queryOne<Profile>(
    `select id, email, full_name, avatar_url, role from profiles where id = $1`,
    [id],
  );
}

/* ------------------------------------------------------------------ */
/* Curso + progresso                                                   */
/* ------------------------------------------------------------------ */

/** Curso matriculado do aluno, já com o progresso agregado. */
export function getEnrolledCourse(profileId: string) {
  return queryOne<CourseOverview>(
    `select c.id, c.title, c.slug, c.description, c.level,
            coalesce(cp.percent, 0)            as percent,
            coalesce(cp.total_lessons, 0)      as total_lessons,
            coalesce(cp.completed_lessons, 0)  as completed_lessons,
            coalesce(cp.total_seconds, 0)      as total_seconds,
            coalesce(cp.completed_seconds, 0)  as completed_seconds,
            e.last_accessed_at, e.last_lesson_id
       from enrollments e
       join courses c on c.id = e.course_id
       left join course_progress cp
              on cp.course_id = e.course_id and cp.profile_id = e.profile_id
      where e.profile_id = $1
        and (e.expires_at is null or e.expires_at > now())
      order by e.enrolled_at desc
      limit 1`,
    [profileId],
  );
}

/** Módulos -> aulas -> materiais, com o progresso do aluno embutido. */
export async function getCurriculum(
  profileId: string,
  courseId: string,
): Promise<ModuleWithLessons[]> {
  const rows = await query<{
    module_id: string;
    module_title: string;
    module_description: string | null;
    module_position: number;
    lesson_id: string | null;
    lesson_title: string | null;
    lesson_description: string | null;
    lesson_position: number | null;
    video_provider: string | null;
    video_id: string | null;
    duration_seconds: number | null;
    completed: boolean | null;
    last_position_seconds: number | null;
  }>(
    `select m.id            as module_id,
            m.title         as module_title,
            m.description   as module_description,
            m.position      as module_position,
            l.id            as lesson_id,
            l.title         as lesson_title,
            l.description   as lesson_description,
            l.position      as lesson_position,
            l.video_provider, l.video_id, l.duration_seconds,
            coalesce(lp.completed, false)             as completed,
            coalesce(lp.last_position_seconds, 0)     as last_position_seconds
       from modules m
       left join lessons l
              on l.module_id = m.id and l.is_published
       left join lesson_progress lp
              on lp.lesson_id = l.id and lp.profile_id = $2
      where m.course_id = $1 and m.is_published
      order by m.position, l.position`,
    [courseId, profileId],
  );

  const lessonIds = rows.map((r) => r.lesson_id).filter((x): x is string => !!x);
  const materials = lessonIds.length
    ? await query<Material & { lesson_id: string }>(
        `select id, lesson_id, title, file_type, file_size, storage_path
           from materials
          where lesson_id = any(string_to_array($1, ',')::uuid[])
          order by position, title`,
        [lessonIds.join(",")],
      )
    : [];

  const byLesson = new Map<string, Material[]>();
  for (const m of materials) {
    const list = byLesson.get(m.lesson_id) ?? [];
    list.push(m);
    byLesson.set(m.lesson_id, list);
  }

  const modules = new Map<string, ModuleWithLessons>();
  for (const r of rows) {
    let mod = modules.get(r.module_id);
    if (!mod) {
      mod = {
        id: r.module_id,
        title: r.module_title,
        description: r.module_description,
        position: r.module_position,
        lessons: [],
        completed_lessons: 0,
        total_seconds: 0,
      };
      modules.set(r.module_id, mod);
    }
    if (!r.lesson_id) continue;
    mod.lessons.push({
      id: r.lesson_id,
      title: r.lesson_title!,
      description: r.lesson_description,
      position: r.lesson_position!,
      video_provider: r.video_provider!,
      video_id: r.video_id,
      duration_seconds: r.duration_seconds ?? 0,
      completed: !!r.completed,
      last_position_seconds: r.last_position_seconds ?? 0,
      materials: byLesson.get(r.lesson_id) ?? [],
    });
    if (r.completed) mod.completed_lessons += 1;
    mod.total_seconds += r.duration_seconds ?? 0;
  }

  return [...modules.values()];
}

/** Uma aula específica — valida que o aluno tem matrícula no curso dela. */
export function getLessonForProfile(profileId: string, lessonId: string) {
  return queryOne<{
    id: string;
    title: string;
    description: string | null;
    video_provider: string;
    video_id: string | null;
    duration_seconds: number;
    position: number;
    module_id: string;
    module_title: string;
    module_position: number;
    course_id: string;
    course_title: string;
    completed: boolean;
    last_position_seconds: number;
  }>(
    `select l.id, l.title, l.description, l.video_provider, l.video_id,
            l.duration_seconds, l.position,
            m.id as module_id, m.title as module_title, m.position as module_position,
            c.id as course_id, c.title as course_title,
            coalesce(lp.completed, false)         as completed,
            coalesce(lp.last_position_seconds, 0) as last_position_seconds
       from lessons l
       join modules m on m.id = l.module_id
       join courses c on c.id = m.course_id
       join enrollments e on e.course_id = c.id and e.profile_id = $1
       left join lesson_progress lp on lp.lesson_id = l.id and lp.profile_id = $1
      where l.id = $2 and l.is_published
        and (e.expires_at is null or e.expires_at > now())`,
    [profileId, lessonId],
  );
}

export function getLessonMaterials(lessonId: string) {
  return query<Material>(
    `select id, title, file_type, file_size, storage_path
       from materials where lesson_id = $1 order by position, title`,
    [lessonId],
  );
}

/** Material + checagem de matrícula, para o download protegido. */
export function getMaterialForProfile(profileId: string, materialId: string) {
  return queryOne<Material>(
    `select mt.id, mt.title, mt.file_type, mt.file_size, mt.storage_path
       from materials mt
       join lessons l     on l.id = mt.lesson_id
       join modules m     on m.id = l.module_id
       join enrollments e on e.course_id = m.course_id and e.profile_id = $1
      where mt.id = $2
        and (e.expires_at is null or e.expires_at > now())`,
    [profileId, materialId],
  );
}

/** Lista plana e ordenada das aulas do curso — usada para anterior/próxima. */
export function getLessonSequence(courseId: string) {
  return query<{ id: string; title: string }>(
    `select l.id, l.title
       from lessons l
       join modules m on m.id = l.module_id
      where m.course_id = $1 and m.is_published and l.is_published
      order by m.position, l.position`,
    [courseId],
  );
}

/* ------------------------------------------------------------------ */
/* Escrita de progresso                                                */
/* ------------------------------------------------------------------ */

export async function saveProgress(
  profileId: string,
  lessonId: string,
  positionSeconds: number,
  completed?: boolean,
) {
  await query(
    `insert into lesson_progress
       (profile_id, lesson_id, last_position_seconds, watched_seconds, completed, completed_at, updated_at)
     values ($1, $2, $3, $3, coalesce($4, false), case when $4 then now() end, now())
     on conflict (profile_id, lesson_id) do update
        set last_position_seconds = excluded.last_position_seconds,
            watched_seconds       = greatest(lesson_progress.watched_seconds, excluded.watched_seconds),
            completed             = lesson_progress.completed or coalesce($4, false),
            completed_at          = coalesce(lesson_progress.completed_at, case when $4 then now() end),
            updated_at            = now()`,
    [profileId, lessonId, Math.max(0, Math.round(positionSeconds)), completed ?? null],
  );
}

export async function setLessonCompleted(
  profileId: string,
  lessonId: string,
  completed: boolean,
) {
  await query(
    `insert into lesson_progress (profile_id, lesson_id, completed, completed_at, updated_at)
     values ($1, $2, $3, case when $3 then now() end, now())
     on conflict (profile_id, lesson_id) do update
        set completed    = excluded.completed,
            completed_at = case when excluded.completed then coalesce(lesson_progress.completed_at, now()) end,
            updated_at   = now()`,
    [profileId, lessonId, completed],
  );
}

/** Marca "último acesso" e a aula corrente — alimenta o card de continuar. */
export async function touchEnrollment(
  profileId: string,
  courseId: string,
  lessonId: string | null,
) {
  await query(
    `update enrollments
        set last_accessed_at = now(),
            last_lesson_id   = coalesce($3, last_lesson_id)
      where profile_id = $1 and course_id = $2`,
    [profileId, courseId, lessonId],
  );
}

/* ------------------------------------------------------------------ */
/* Administração de usuários                                           */
/* ------------------------------------------------------------------ */

export type AdminUserRow = {
  id: string;
  email: string;
  full_name: string;
  role: "student" | "admin";
  created_at: string;
  course_title: string | null;
  percent: number | null;
  last_accessed_at: string | null;
};

export type CourseOption = { id: string; title: string };

export function listCourses() {
  return query<CourseOption>(
    `select id, title from courses where is_published order by created_at`,
  );
}

/** Lista todos os alunos/admins com o curso matriculado e o progresso. */
export function listUsers() {
  return query<AdminUserRow>(
    `select p.id, p.email, p.full_name, p.role, p.created_at,
            c.title as course_title,
            cp.percent,
            e.last_accessed_at
       from profiles p
       left join enrollments e on e.profile_id = p.id
       left join courses c     on c.id = e.course_id
       left join course_progress cp
              on cp.course_id = e.course_id and cp.profile_id = e.profile_id
      order by p.created_at desc`,
  );
}

export function getUserById(id: string) {
  return queryOne<Profile>(
    `select id, email, full_name, avatar_url, role from profiles where id = $1`,
    [id],
  );
}

export function emailExists(email: string) {
  return queryOne<{ id: string }>(
    `select id from profiles where lower(email) = lower($1)`,
    [email],
  );
}

export async function createUserWithEnrollment(input: {
  email: string;
  fullName: string;
  passwordHash: string;
  role: "student" | "admin";
  courseId: string | null;
}) {
  const profile = await queryOne<{ id: string }>(
    `insert into profiles (email, password_hash, full_name, role)
     values ($1, $2, $3, $4) returning id`,
    [input.email.toLowerCase(), input.passwordHash, input.fullName, input.role],
  );

  if (profile && input.courseId) {
    await query(
      `insert into enrollments (profile_id, course_id) values ($1, $2)
       on conflict (profile_id, course_id) do nothing`,
      [profile.id, input.courseId],
    );
  }

  return profile!;
}

export function deleteUser(id: string) {
  return query(`delete from profiles where id = $1`, [id]);
}

export function updateUserPassword(id: string, passwordHash: string) {
  return query(`update profiles set password_hash = $2 where id = $1`, [id, passwordHash]);
}

export function countAdmins() {
  return queryOne<{ count: string }>(
    `select count(*) as count from profiles where role = 'admin'`,
  );
}
