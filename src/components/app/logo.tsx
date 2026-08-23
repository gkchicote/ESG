import { cn } from "@/lib/utils";

/** Marca da plataforma. Troque o texto e o glifo pelo seu quando tiver a identidade. */
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className="bg-brand text-brand-foreground grid size-8 shrink-0 place-items-center rounded-[0.6rem] text-[15px] font-semibold tracking-tight"
      >
        F
      </span>
      {!compact && (
        <span className="text-[15px] font-semibold tracking-tight">Fluently</span>
      )}
    </span>
  );
}
