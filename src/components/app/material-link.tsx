import { Download, FileText } from "lucide-react";
import { formatFileSize } from "@/lib/format";
import type { Material } from "@/lib/db/queries";
import { cn } from "@/lib/utils";

/** Anexo de aula. O download passa pelo servidor, que valida a matrícula. */
export function MaterialLink({
  material,
  className,
}: {
  material: Material;
  className?: string;
}) {
  return (
    <a
      href={`/api/materials/${material.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group/mat hover:border-foreground/20 hover:bg-accent/50 flex items-center gap-3 rounded-lg border px-3.5 py-2.5 transition-colors",
        className,
      )}
    >
      <span className="bg-muted text-muted-foreground grid size-8 shrink-0 place-items-center rounded-md">
        <FileText className="size-4" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{material.title}</span>
        <span className="text-muted-foreground text-xs uppercase">
          {material.file_type}
          {material.file_size ? ` · ${formatFileSize(material.file_size)}` : ""}
        </span>
      </span>
      <Download
        className="text-muted-foreground group-hover/mat:text-foreground size-4 shrink-0 transition-colors"
        strokeWidth={1.75}
      />
    </a>
  );
}
