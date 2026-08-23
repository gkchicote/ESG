import { Inbox } from "lucide-react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-6 py-24 text-center">
      <div className="bg-muted text-muted-foreground mb-5 grid size-12 place-items-center rounded-full">
        <Inbox className="size-5" strokeWidth={1.75} />
      </div>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="text-muted-foreground mt-2 text-[15px] leading-relaxed">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
