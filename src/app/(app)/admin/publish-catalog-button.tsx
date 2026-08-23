"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { publishCatalog } from "@/app/actions/admin-content";
import { Button } from "@/components/ui/button";

export function PublishCatalogButton({ label }: { label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      className="gap-2"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await publishCatalog();
          if (result.error) toast.error(result.error);
          else toast.success(result.success!, { duration: 6000 });
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
      {label}
    </Button>
  );
}
