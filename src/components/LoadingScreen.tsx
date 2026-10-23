import { Loader2 } from "lucide-react";
import { WormLogo } from "@/components/WormLogo";

export function LoadingScreen() {
  return <div role="status" aria-live="polite" className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background">
    <WormLogo size={80} />
    <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 motion-safe:animate-spin text-primary" /> جارٍ التحميل…</p>
  </div>;
}