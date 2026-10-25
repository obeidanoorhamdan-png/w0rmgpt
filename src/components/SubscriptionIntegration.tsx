import { useEffect, useState } from "react";
import { Copy, Download, KeyRound, Link2, Loader2, Plus, Trash2, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export type SellerKey = { id: string; name: string; active: boolean; created_at: string; key_masked: string; codes_created: number };

const PYTHON = `import os
import requests

url = os.environ["WORM_SUBSCRIPTIONS_URL"]
headers = {"Authorization": "Bearer " + os.environ["WORM_SUBSCRIPTIONS_KEY"]}

def call(method, **kwargs):
    response = requests.request(method, url, headers=headers, timeout=30, **kwargs)
    response.raise_for_status()
    return response.json()

# Create
created = call("POST", json={"plan": "plus", "days": 30, "max_uses": 1})
code = created["data"]["code"]
print(created)

# Read one / list latest 100
print(call("GET", params={"code": code}))
print(call("GET"))

# Update
print(call("PATCH", params={"code": code}, json={"plan": "pro", "days": 365}))

# Delete this test code
print(call("DELETE", params={"code": code}))
`;

export function SubscriptionIntegration({ enabled, configured, sellerKeys, onToggle, onCreateKey, onToggleKey, onDeleteKey }: {
  enabled: boolean;
  configured: boolean;
  sellerKeys: SellerKey[];
  onToggle: (enabled: boolean) => Promise<unknown>;
  onCreateKey: (name: string) => Promise<string | undefined>;
  onToggleKey: (id: string, active: boolean) => Promise<unknown>;
  onDeleteKey: (id: string) => Promise<unknown>;
}) {
  const [origin, setOrigin] = useState("");
  const [busy, setBusy] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const url = `${origin}/api/public/subscriptions`;

  async function toggle(next: boolean) {
    if (!next && !window.confirm("تعطيل الربط؟ ستتوقف طلبات موقع البيع، وتبقى الأكواد والاشتراكات الحالية.")) return;
    setBusy(true);
    try { await onToggle(next); } finally { setBusy(false); }
  }

  async function createKey() {
    if (!keyName.trim()) return;
    setBusy(true);
    try {
      const key = await onCreateKey(keyName.trim());
      if (key) { setNewKey(key); setKeyName(""); }
    } finally { setBusy(false); }
  }

  return <section className="space-y-4 border-b pb-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 font-bold"><Link2 className="size-5 text-primary" /> ربط موقع بيع المفاتيح</h3>
      <span className="text-sm text-muted-foreground">{enabled ? "الربط مفعّل" : "الربط معطّل"} · {configured ? "المفتاح الرئيسي محفوظ" : "المفتاح الرئيسي غير مضبوط"}</span>
    </div>
    <label className="block text-sm" htmlFor="subscription-url">رابط الاستدعاء على هذا الموقع</label>
    <div className="flex gap-2"><Input id="subscription-url" dir="ltr" readOnly value={url} className="min-w-0 text-left font-mono text-xs" /><Button variant="outline" size="icon" aria-label="نسخ رابط الاشتراكات" onClick={() => { void navigator.clipboard.writeText(url); toast.success("تم نسخ الرابط"); }}><Copy className="size-4" /></Button></div>
    <p className="text-xs text-muted-foreground">يمكن استخدام المفتاح الرئيسي (SUBSCRIPTIONS_API_KEY) أو أي مفتاح بيع تنشئه أدناه. استخدم رابط الموقع المنشور للربط الفعلي.</p>
    <div className="flex flex-wrap gap-2">
      <Button disabled={busy || !configured} variant={enabled ? "destructive" : "default"} onClick={() => void toggle(!enabled)}>{enabled ? <Unplug className="size-4" /> : <Link2 className="size-4" />}{enabled ? "حذف الربط" : "تفعيل الربط"}</Button>
      <Button variant="outline" onClick={() => { const objectUrl = URL.createObjectURL(new Blob([PYTHON], { type: "text/x-python" })); const a = document.createElement("a"); a.href = objectUrl; a.download = "worm_subscriptions_test.py"; a.click(); URL.revokeObjectURL(objectUrl); }}><Download className="size-4" /> تنزيل تجربة Python</Button>
      <Button variant="outline" size="icon" aria-label="نسخ كود بايثون" onClick={() => { void navigator.clipboard.writeText(PYTHON); toast.success("تم نسخ الكود"); }}><Copy className="size-4" /></Button>
    </div>

    <div className="space-y-3 rounded-lg border p-3">
      <h4 className="flex items-center gap-2 text-sm font-bold"><KeyRound className="size-4 text-primary" /> مفاتيح البيع (API Keys)</h4>
      <div className="flex gap-2">
        <Input placeholder="اسم المفتاح (مثال: متجر X)" value={keyName} onChange={(e) => setKeyName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void createKey()} />
        <Button disabled={busy || !keyName.trim()} onClick={() => void createKey()}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} إنشاء مفتاح</Button>
      </div>
      {newKey && (
        <div className="space-y-2 rounded-md border border-primary/40 bg-primary/5 p-3">
          <p className="text-xs font-bold text-primary">المفتاح الجديد — يظهر مرة واحدة فقط، انسخه الآن:</p>
          <div className="flex gap-2">
            <Input dir="ltr" readOnly value={newKey} className="min-w-0 text-left font-mono text-xs" />
            <Button size="icon" variant="outline" aria-label="نسخ المفتاح الجديد" onClick={() => { void navigator.clipboard.writeText(newKey); toast.success("تم نسخ المفتاح"); }}><Copy className="size-4" /></Button>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setNewKey(null)}>تم النسخ، إخفاء</Button>
        </div>
      )}
      <div className="divide-y text-sm">
        {sellerKeys.length === 0 && <p className="py-2 text-muted-foreground">لا توجد مفاتيح بيع بعد</p>}
        {sellerKeys.map((k) => (
          <div key={k.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div className="min-w-0">
              <div className="font-medium">{k.name} <span className="font-mono text-xs text-muted-foreground" dir="ltr">{k.key_masked}</span></div>
              <div className="text-xs text-muted-foreground">أنشأ {k.codes_created} كود · {new Date(k.created_at).toLocaleDateString("ar")}</div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={k.active} onCheckedChange={(on) => void onToggleKey(k.id, on)} aria-label={`تفعيل ${k.name}`} />
              <Button size="icon" variant="destructive" aria-label={`حذف ${k.name}`} onClick={() => { if (window.confirm(`حذف مفتاح "${k.name}"؟ ستتوقف طلباته فوراً، وتبقى الأكواد التي أنشأها.`)) void onDeleteKey(k.id); }}><Trash2 className="size-4" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>

    <div dir="ltr" className="overflow-x-auto rounded-md border bg-muted p-3 text-left text-xs"><pre>{PYTHON}</pre></div>
  </section>;
}
