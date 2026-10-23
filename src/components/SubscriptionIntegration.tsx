import { useEffect, useState } from "react";
import { Copy, Download, Link2, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SubscriptionIntegration({ enabled, configured, onToggle }: { enabled: boolean; configured: boolean; onToggle: (enabled: boolean) => Promise<unknown> }) {
  const [origin, setOrigin] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const url = `${origin}/api/public/subscriptions`;
  const python = `import os\nimport requests\n\nurl = os.environ["WORM_SUBSCRIPTIONS_URL"]\nheaders = {"Authorization": "Bearer " + os.environ["WORM_SUBSCRIPTIONS_KEY"]}\n\ndef call(method, **kwargs):\n    response = requests.request(method, url, headers=headers, timeout=30, **kwargs)\n    response.raise_for_status()\n    return response.json()\n\n# Create\ncreated = call("POST", json={"plan": "plus", "days": 30, "max_uses": 1})\ncode = created["data"]["code"]\nprint(created)\n\n# Read one / list latest 100\nprint(call("GET", params={"code": code}))\nprint(call("GET"))\n\n# Update\nprint(call("PATCH", params={"code": code}, json={"plan": "pro", "days": 365}))\n\n# Delete this test code\nprint(call("DELETE", params={"code": code}))\n`;
  async function toggle(next: boolean) {
    if (!next && !window.confirm("تعطيل الربط؟ ستتوقف طلبات موقع البيع، وتبقى الأكواد والاشتراكات الحالية.")) return;
    setBusy(true);
    try { await onToggle(next); } finally { setBusy(false); }
  }
  return <section className="space-y-4 border-b pb-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 font-bold"><Link2 className="size-5 text-primary" /> ربط موقع بيع المفاتيح</h3>
      <span className="text-sm text-muted-foreground">{enabled ? "الربط مفعّل" : "الربط معطّل"} · {configured ? "المفتاح محفوظ" : "المفتاح غير مضبوط"}</span>
    </div>
    <label className="block text-sm" htmlFor="subscription-url">رابط الاستدعاء على هذا الموقع</label>
    <div className="flex gap-2"><Input id="subscription-url" dir="ltr" readOnly value={url} className="min-w-0 text-left font-mono text-xs" /><Button variant="outline" size="icon" aria-label="نسخ رابط الاشتراكات" onClick={() => { void navigator.clipboard.writeText(url); toast.success("تم نسخ الرابط"); }}><Copy className="size-4" /></Button></div>
    <p className="text-xs text-muted-foreground">مفتاح مستقل باسم SUBSCRIPTIONS_API_KEY، يُحفظ بأمان ولا يُعرض هنا. استخدم رابط الموقع المنشور للربط الفعلي.</p>
    <div className="flex flex-wrap gap-2">
      <Button disabled={busy || !configured} variant={enabled ? "destructive" : "default"} onClick={() => void toggle(!enabled)}>{enabled ? <Unplug className="size-4" /> : <Link2 className="size-4" />}{enabled ? "حذف الربط" : "تفعيل الربط"}</Button>
      <Button variant="outline" onClick={() => { const objectUrl = URL.createObjectURL(new Blob([python], { type: "text/x-python" })); const a = document.createElement("a"); a.href = objectUrl; a.download = "worm_subscriptions_test.py"; a.click(); URL.revokeObjectURL(objectUrl); }}><Download className="size-4" /> تنزيل تجربة Python</Button>
      <Button variant="outline" size="icon" aria-label="نسخ كود بايثون" onClick={() => { void navigator.clipboard.writeText(python); toast.success("تم نسخ الكود"); }}><Copy className="size-4" /></Button>
    </div>
    <div dir="ltr" className="overflow-x-auto rounded-md border bg-muted p-3 text-left text-xs"><pre>{python}</pre></div>
  </section>;
}