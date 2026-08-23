"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { setUserCourse } from "@/app/actions/admin-content";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CourseOption } from "@/lib/db/queries";

/** Radix não aceita item com value vazio; "none" representa "sem matrícula". */
const NO_COURSE = "none";

export function CourseSelect({
  userId,
  courseId,
  courses,
}: {
  userId: string;
  courseId: string | null;
  courses: CourseOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (courses.length === 0) {
    return <span className="text-muted-foreground text-sm">nenhum curso publicado</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={courseId ?? NO_COURSE}
        disabled={pending}
        onValueChange={(value) =>
          startTransition(async () => {
            const result = await setUserCourse(userId, value === NO_COURSE ? null : value);
            if (result.error) toast.error(result.error);
            else toast.success(result.success!);
            router.refresh();
          })
        }
      >
        <SelectTrigger size="sm" className="w-[13.5rem]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_COURSE}>
            <span className="text-muted-foreground">Sem acesso</span>
          </SelectItem>
          {courses.map((course) => (
            <SelectItem key={course.id} value={course.id}>
              {course.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {pending && <Loader2 className="text-muted-foreground size-3.5 animate-spin" />}
    </div>
  );
}
