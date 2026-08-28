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
  storage_provider: "file" | "r2";
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

/** Carimba o login. Chamado quando a sessão é criada (entrada ou convite). */
export async function touchLastLogin(profileId: string) {
  await query(`update profiles set last_login_at = now() where id = $1`, [profileId]);
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
        `select id, lesson_id, title, file_type, storage_provider, file_size, storage_path
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
    `select id, title, file_type, storage_provider, file_size, storage_path
       from materials where lesson_id = $1 order by position, title`,
    [lessonId],
  );
}

/** Material + checagem de matrícula, para o download protegido. */
export function getMaterialForProfile(profileId: string, materialId: string) {
  return queryOne<Material>(
    `select mt.id, mt.title, mt.file_type, mt.storage_provider, mt.file_size, mt.storage_path
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

/**
 * Gamificação: 1 ponto pela aula concluída.
 *
 * Vive aqui, e não na Server Action, porque toda conclusão passa por
 * `saveProgress`/`setLessonCompleted` — pendurado nelas, nenhum caminho novo
 * (o player marcando sozinho no fim do vídeo, o botão manual, um import
 * futuro) pode esquecer de pontuar.
 *
 * `do nothing` no conflito faz o resto: a aula paga uma vez só, por mais que
 * o player reenvie `completed: true` a cada gravação de posição. O ponto
 * também não é devolvido quando o aluno desmarca a aula — ele já assistiu, e
 * um placar que anda para trás a cada clique não incentiva ninguém.
 */
export async function awardLessonPoint(profileId: string, lessonId: string) {
  await query(
    `insert into lesson_points (profile_id, lesson_id)
     values ($1, $2)
     on conflict (profile_id, lesson_id) do nothing`,
    [profileId, lessonId],
  );
}

export type StudyStreak = {
  /** Dias seguidos, já contando o de hoje. */
  days: number;
  /** `true` só na primeira aula concluída do dia — a que fez o número subir. */
  advanced: boolean;
};

/**
 * Registra que o aluno estudou hoje e devolve a ofensiva resultante.
 *
 * Chamada em toda conclusão de aula, nunca no login: a ofensiva mede estudo,
 * e abrir a plataforma não é estudar.
 *
 * Quem decide se o dia já contou é o `where` — não o app. Isso é o que faz a
 * regra "só a primeira aula do dia avança" valer mesmo quando duas conclusões
 * chegam juntas (duas abas, beacon + action): o `update` trava a linha, a
 * segunda encontra `streak_last_day` já em hoje e atualiza zero linhas.
 *
 * O dia é o de Brasília, e não o do servidor (UTC no deploy): terminar a aula
 * às 22h não pode contar como o dia seguinte.
 */
export async function registerStudyDay(profileId: string): Promise<StudyStreak> {
  const advanced = await queryOne<{ streak_days: number }>(
    `update profiles p
        set streak_days = case
              -- Estudou ontem: a sequência continua. Qualquer buraco maior
              -- recomeça do 1 — e o 1 é hoje, não zero.
              when p.streak_last_day = (t.hoje - 1) then p.streak_days + 1
              else 1
            end,
            streak_best = greatest(
              p.streak_best,
              case when p.streak_last_day = (t.hoje - 1) then p.streak_days + 1 else 1 end
            ),
            streak_last_day = t.hoje
       from (select (now() at time zone 'America/Sao_Paulo')::date as hoje) t
      where p.id = $1
        and (p.streak_last_day is null or p.streak_last_day < t.hoje)
      returning p.streak_days`,
    [profileId],
  );

  if (advanced) return { days: advanced.streak_days, advanced: true };

  // Nenhuma linha atualizada: a aula de hoje não foi a primeira. Lê o valor
  // que já estava lá para a tela continuar mostrando o número certo.
  const current = await queryOne<{ streak_days: number }>(
    `select case
              when streak_last_day >= ((now() at time zone 'America/Sao_Paulo')::date - 1)
                then streak_days
              else 0
            end as streak_days
       from profiles
      where id = $1`,
    [profileId],
  );

  return { days: current?.streak_days ?? 0, advanced: false };
}

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

  if (!completed) return null;
  await awardLessonPoint(profileId, lessonId);
  return registerStudyDay(profileId);
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

  // Desmarcar não devolve o dia: a ofensiva, como os pontos, só anda para a
  // frente. O aluno já assistiu.
  if (!completed) return null;
  await awardLessonPoint(profileId, lessonId);
  return registerStudyDay(profileId);
}

/**
 * Marca "último acesso" e a aula corrente — alimenta o card de continuar e,
 * pelo módulo da aula, a coluna "Módulo atual" do placar de /progresso.
 *
 * O módulo sai de subconsulta sobre a própria aula em vez de virar parâmetro:
 * assim os três chamadores (player, beacon de saída e a página da aula)
 * continuam passando só o `lessonId`, sem chance de mandar um módulo que não
 * é o da aula.
 */
export async function touchEnrollment(
  profileId: string,
  courseId: string,
  lessonId: string | null,
) {
  await query(
    `update enrollments
        set last_accessed_at  = now(),
            last_lesson_id    = coalesce($3, last_lesson_id),
            current_module_id = coalesce(
              (select l.module_id from lessons l where l.id = $3),
              current_module_id
            )
      where profile_id = $1 and course_id = $2`,
    [profileId, courseId, lessonId],
  );
}

/* ------------------------------------------------------------------ */
/* Placar de progresso (aba /progresso)                                */
/* ------------------------------------------------------------------ */

export type ScoreboardRow = {
  profile_id: string;
  full_name: string;
  points: number;
  module_position: number | null;
  module_title: string | null;
  last_accessed_at: string | null;
  /** Ofensiva viva: já zerada pela view quando a sequência foi quebrada. */
  streak_days: number;
  /** Maior sequência que a pessoa já teve — não zera nunca. */
  streak_best: number;
};

/**
 * Todo mundo matriculado no curso, do mais pontuado para o menos.
 *
 * Empate desempata por nome, e não por data: a ordem precisa ser a mesma a
 * cada carregamento, senão a lista embaralha sozinha entre visitas.
 *
 * A view `student_scoreboard` já limita as linhas a matrículas válidas, então
 * quem perdeu o acesso some do placar sem sumir do banco.
 */
export function listScoreboard(courseId: string) {
  return query<ScoreboardRow>(
    `select profile_id, full_name, points, module_position, module_title,
            last_accessed_at, streak_days, streak_best
       from student_scoreboard
      where course_id = $1
      order by points desc, full_name asc`,
    [courseId],
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
  course_id: string | null;
  course_title: string | null;
  percent: number | null;
  last_accessed_at: string | null;
  last_login_at: string | null;
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
            e.course_id,
            c.title as course_title,
            cp.percent,
            e.last_accessed_at,
            p.last_login_at
       from profiles p
       left join enrollments e on e.profile_id = p.id
       left join courses c     on c.id = e.course_id
       left join course_progress cp
              on cp.course_id = e.course_id and cp.profile_id = e.profile_id
      order by p.created_at desc`,
  );
}

/** Quantos módulos e aulas publicados cada curso tem — resumo da página admin. */
export function countCourseContent() {
  return query<{ course_id: string; modules: string; lessons: string }>(
    `select m.course_id,
            count(distinct m.id) as modules,
            count(l.id)          as lessons
       from modules m
       left join lessons l on l.module_id = m.id and l.is_published
      where m.is_published
      group by m.course_id`,
  );
}

/**
 * Define (ou remove) o curso do aluno. É a matrícula que libera o conteúdo:
 * sem linha em `enrollments`, o app não mostra módulo nenhum.
 *
 * Tirar o acesso não apaga `lesson_progress` — se a matrícula voltar, o aluno
 * retoma exatamente de onde parou.
 */
export async function setUserEnrollment(profileId: string, courseId: string | null) {
  if (!courseId) {
    await query(`delete from enrollments where profile_id = $1`, [profileId]);
    return;
  }

  await query(`delete from enrollments where profile_id = $1 and course_id <> $2`, [
    profileId,
    courseId,
  ]);
  await query(
    `insert into enrollments (profile_id, course_id) values ($1, $2)
     on conflict (profile_id, course_id) do nothing`,
    [profileId, courseId],
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

/* ------------------------------------------------------------------ */
/* Convites                                                             */
/* ------------------------------------------------------------------ */

export type Invite = {
  id: string;
  token: string;
  /** Nulo nos convites novos: o e-mail chega no aceite, não na geração. */
  email: string | null;
  full_name: string | null;
  role: "student" | "admin";
  course_id: string | null;
  expires_at: string;
  used_at: string | null;
};

export async function createInvite(input: {
  token: string;
  role: "student" | "admin";
  courseId: string | null;
  createdBy: string;
  expiresAt: Date;
}) {
  const invite = await queryOne<{ id: string }>(
    `insert into invites (token, role, course_id, created_by, expires_at)
     values ($1, $2, $3, $4, $5) returning id`,
    [input.token, input.role, input.courseId, input.createdBy, input.expiresAt.toISOString()],
  );
  return invite!;
}

export function getInviteByToken(token: string) {
  return queryOne<Invite>(
    `select id, token, email, full_name, role, course_id, expires_at, used_at
       from invites where token = $1`,
    [token],
  );
}

export function markInviteUsed(id: string) {
  return query(`update invites set used_at = now() where id = $1`, [id]);
}

/* ------------------------------------------------------------------ */
/* Recuperação de senha                                                */
/* ------------------------------------------------------------------ */

export type PasswordReset = {
  id: string;
  profile_id: string;
  email: string;
  full_name: string;
  expires_at: string;
  used_at: string | null;
};

/**
 * Guarda um pedido de redefinição. Recebe o **hash** do token, nunca o token:
 * quem monta o link é quem chamou (src/lib/auth/password-reset.ts).
 */
export async function createPasswordReset(input: {
  profileId: string;
  tokenHash: string;
  expiresAt: Date;
}) {
  const row = await queryOne<{ id: string }>(
    `insert into password_resets (profile_id, token_hash, expires_at)
     values ($1, $2, $3) returning id`,
    [input.profileId, input.tokenHash, input.expiresAt.toISOString()],
  );
  return row!;
}

/**
 * Já existe um pedido recente e ainda em aberto para esta pessoa?
 *
 * O formulário de "esqueci minha senha" é público: sem esta trava, qualquer
 * um digita o e-mail de um aluno em sequência e enche a caixa dele. Um pedido
 * a cada `withinSeconds` é o bastante para o fluxo real, em que a pessoa pede
 * uma vez e espera o e-mail chegar.
 */
export async function hasRecentPasswordReset(profileId: string, withinSeconds: number) {
  const row = await queryOne<{ id: string }>(
    `select id from password_resets
      where profile_id = $1
        and used_at is null
        and created_at > now() - make_interval(secs => $2)
      limit 1`,
    [profileId, withinSeconds],
  );
  return row !== null;
}

/** O pedido correspondente ao hash, já com o dono junto. */
export function getPasswordResetByHash(tokenHash: string) {
  return queryOne<PasswordReset>(
    `select pr.id, pr.profile_id, pr.expires_at, pr.used_at,
            p.email, p.full_name
       from password_resets pr
       join profiles p on p.id = pr.profile_id
      where pr.token_hash = $1`,
    [tokenHash],
  );
}

/**
 * Fecha todos os pedidos em aberto da pessoa.
 *
 * Chamado depois de a senha ser trocada: se ela pediu o link três vezes, os
 * outros dois e-mails param de valer no mesmo instante — senão um link antigo
 * ainda na caixa de entrada continuaria abrindo a tela de nova senha.
 */
export function closePasswordResets(profileId: string) {
  return query(
    `update password_resets set used_at = now()
      where profile_id = $1 and used_at is null`,
    [profileId],
  );
}
