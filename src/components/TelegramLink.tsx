import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tgCreateLinkToken } from "@/lib/telegram.functions";

export function TelegramLink() {
  const create = useServerFn(tgCreateLinkToken);
  return (
    <Button variant="outline" className="w-full" onClick={async () => {
      try { const { url } = await create(); window.open(url, "_blank"); } catch (e) { toast.error((e as Error).message); }
    }}><Send className="size-4" /> ربط حسابي ببوت تيلجرام</Button>
  );
}
