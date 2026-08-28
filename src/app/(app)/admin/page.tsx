import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookOpen, ShieldCheck } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { countCourseContent, listCourses, listUsers } from "@/lib/db/queries";
import { formatLoginAt, initials } from "@/lib/format";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { progressTone } from "@/lib/progress-tone";
import { cn } from "@/lib/utils";
import { ChangePasswordDialog } from "./change-password-dialog";
import { CourseSelect } from "./course-select";
import { CreateUserDialog } from "./create-user-dialog";
import { DeleteUserButton } from "./delete-user-button";
import { PublishCatalogButton } from "./publish-catalog-button";

export const metadata: Metadata = { title: "Usuários" };

export default async function AdminUsersPage() {
  const session = await requireSession();
  if (session.role !== "admin") notFound();

  const [users, courses, content] = await Promise.all([
    listUsers(),
    listCourses(),
    countCourseContent(),
  ]);

  const contentByCourse = new Map(content.map((row) => [row.course_id, row]));

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-[0.12em] uppercase">
            <ShieldCheck className="size-3.5" />
            Administração
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Usuários</h1>
          <p className="text-muted-foreground text-[15px]">
            Crie acessos, libere o curso de cada aluno e gerencie quem entra na plataforma.
          </p>
        </div>

        <CreateUserDialog courses={courses} />
      </header>

      {/* Conteúdo publicado ------------------------------------------- */}
      <section className="mb-8 rounded-xl border p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-[0.12em] uppercase">
              <BookOpen className="size-3.5" />
              Conteúdo
            </p>
            {courses.length > 0 ? (
              <ul className="space-y-1">
                {courses.map((course) => {
                  const counts = contentByCourse.get(course.id);
                  return (
                    <li key={course.id} className="text-[15px]">
                      <span className="font-medium">{course.title}</span>
                      <span className="text-muted-foreground tabular text-sm">
                        {" · "}
                        {Number(counts?.modules ?? 0)} módulos · {Number(counts?.lessons ?? 0)} aulas
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[15px] font-medium">Nenhum curso publicado ainda</p>
            )}
            <p className="text-muted-foreground max-w-xl text-sm">
              Publicar aplica o catálogo do código no banco desta instalação. Use depois de
              acrescentar módulos ou aulas — o progresso de quem já estuda é preservado.
            </p>
          </div>

          <PublishCatalogButton label={courses.length > 0 ? "Publicar catálogo" : "Publicar curso"} />
        </div>
      </section>

      <div className="overflow-hidden rounded-xl border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Progresso</TableHead>
                <TableHead>Último acesso</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8 shrink-0">
                        <AvatarFallback className="bg-brand-soft text-brand text-[11px] font-semibold">
                          {initials(user.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium">{user.full_name}</p>
                          {user.role === "admin" && (
                            <Badge variant="secondary" className="shrink-0 text-[10px]">
                              Admin
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground truncate text-xs">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <CourseSelect
                      userId={user.id}
                      courseId={user.course_id}
                      courses={courses}
                    />
                  </TableCell>

                  <TableCell>
                    {user.percent !== null ? (
                      <div className="flex w-32 items-center gap-2">
                        <Progress
                          value={user.percent}
                          className={cn("h-1.5", progressTone(user.percent))}
                        />
                        <span className="tabular text-muted-foreground w-9 text-right text-xs">
                          {user.percent}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>

                  <TableCell className="tabular text-muted-foreground text-sm whitespace-nowrap">
                    {formatLoginAt(user.last_login_at)}
                  </TableCell>

                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <ChangePasswordDialog userId={user.id} email={user.email} />
                      <DeleteUserButton userId={user.id} email={user.email} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
