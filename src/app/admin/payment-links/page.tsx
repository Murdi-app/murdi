"use client";
import AdminNav from "@/components/AdminNav";
import { useEffect, useState } from "react";

type Req = {
  id: string; company_id: string; amount: number; kind: string;
  status: string; note: string | null; created_at: string;
  companies?: { company_name: string | null; phone: string | null } | null;
};

const C = { ink: "#1A3D34", green: "#2E9E7B", gray: "#6B8A80", mint: "#E8F5EF", bg: "#F0F5F3", card: "#FBFCFB" };

export default function PaymentLinksPage() {
  const [reqs, setReqs] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");

  const flash = (t: string) => { setNote(t); setTimeout(() => setNote(""), 2500); };

  const load = async () => {
    const r = await fetch("/api/admin/payment-links");
    const d = await r.json();
    if (d.ok) setReqs(d.requests);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const act = async (id: string, status: string) => {
    const r = await fetch("/api/admin/payment-links", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const d = await r.json();
    if (d.ok) { flash("تم"); load(); } else flash(d.error || "خطأ");
  };

  const statusColor = (s: string) =>
    s === "مدفوع" ? C.green : s === "أُرسل" ? "#2980B9" : "#C9A84C";

  const fmt = (d: string) => new Date(d).toLocaleString("ar-SA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{ background: C.bg, minHeight: "100vh" }}>
      <AdminNav />
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "24px 16px", direction: "rtl", fontFamily: "Cairo,sans-serif" }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: C.ink, marginBottom: 6 }}>📨 طلبات روابط الدفع</h1>
        <p style={{ color: C.gray, fontSize: 13, marginBottom: 20 }}>
          عملاء طلبوا رابط دفع. جهّز الرابط من MyFatoorah وأرسله لهم، ثم علّم الحالة.
        </p>

        {note && <div style={{ background: C.ink, color: "#fff", padding: "10px 16px", borderRadius: 10, marginBottom: 16, fontSize: 13, fontWeight: 700 }}>{note}</div>}

        {loading ? (
          <div style={{ textAlign: "center", color: C.gray, padding: 40 }}>جارٍ التحميل…</div>
        ) : reqs.length === 0 ? (
          <div style={{ textAlign: "center", color: C.gray, padding: 40, fontSize: 14 }}>لا توجد طلبات بعد.</div>
        ) : (
          reqs.map((r) => (
            <div key={r.id} style={{ background: C.card, border: "2px solid " + C.mint, borderRadius: 14, padding: 16, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                <div>
                  <span style={{ fontSize: 16, fontWeight: 900, color: C.ink }}>{r.companies?.company_name || "عميل"}</span>
                  <span style={{ marginRight: 10, color: C.gray, fontSize: 12.5 }}>{r.companies?.phone || ""}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 900, color: "#fff", background: statusColor(r.status), padding: "3px 12px", borderRadius: 20 }}>{r.status}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                <span style={{ color: C.ink, fontSize: 18, fontWeight: 900 }}>{r.amount.toLocaleString("ar-SA")} ريال</span>
                <span style={{ color: C.gray, fontSize: 12 }}>{r.kind === "subscription" ? "اشتراك" : "خدمة"} · {fmt(r.created_at)}</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {r.status !== "أُرسل" && r.status !== "مدفوع" && (
                  <button onClick={() => act(r.id, "أُرسل")} style={{ background: "#2980B9", color: "#fff", border: "none", padding: "8px 18px", borderRadius: 8, fontWeight: 900, fontSize: 13, cursor: "pointer", fontFamily: "Cairo" }}>📤 علّم: أرسلت الرابط</button>
                )}
                {r.status !== "مدفوع" && (
                  <button onClick={() => act(r.id, "مدفوع")} style={{ background: C.green, color: "#fff", border: "none", padding: "8px 18px", borderRadius: 8, fontWeight: 900, fontSize: 13, cursor: "pointer", fontFamily: "Cairo" }}>✅ علّم: مدفوع</button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
