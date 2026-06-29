"use client";
import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

function PayInner() {
  const params = useSearchParams();
  const router = useRouter();
  const amountSar = Number(params.get("amount") || "2900");
  const kind = params.get("kind") || "subscription";
  const companyId = params.get("company_id") || "";
  const sr = params.get("sr") || "";
  const label = kind === "subscription" ? "اشتراك العضوية (٤ أشهر)" : "خدمة استشارية";
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const requestLink = async () => {
    setBusy(true);
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL as string,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
      );
      const { error } = await supabase.from("payment_link_requests").insert({
        company_id: companyId || null,
        amount: amountSar,
        kind,
        service_request_id: sr || null,
        status: "مطلوب",
      });
      if (error) { setStatus("تعذّر إرسال الطلب، حاول مرة أخرى"); setBusy(false); return; }
      setStatus("done");
    } catch {
      setStatus("تعذّر الاتصال، حاول مرة أخرى");
    }
    setBusy(false);
  };

  const ink = "#1A3D34", green = "#2E9E7B", gray = "#6B8A80";

  if (status === "done") {
    return (
      <div dir="rtl" style={{ fontFamily: "Cairo", maxWidth: 520, margin: "0 auto", padding: "60px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 54, marginBottom: 16 }}>✅</div>
        <h1 style={{ color: ink, fontSize: 24, fontWeight: 900 }}>تم استلام طلبك</h1>
        <p style={{ color: "#3A4D47", fontSize: 15, lineHeight: 2, marginTop: 12 }}>
          سيصلك رابط الدفع الآمن من فريق مُرضي خلال وقت قصير عبر الجوال أو البريد.
        </p>
        <div style={{ background: "#EAF7F0", border: "2px solid " + green, borderRadius: 14, padding: 20, marginTop: 24, textAlign: "right" }}>
          <div style={{ color: ink, fontWeight: 900, fontSize: 15, marginBottom: 12, textAlign: "center" }}>⚡ أو حوّل الآن مباشرة (أسرع)</div>
          <p style={{ color: gray, fontSize: 13, lineHeight: 1.8, marginBottom: 14, textAlign: "center" }}>
            لا تنتظر الرابط — حوّل المبلغ على الحساب التالي وارفع الإيصال، ويُفعّل اشتراكك فور المراجعة.
          </p>
          <button onClick={() => router.push("/pay/transfer?amount=" + amountSar + "&kind=" + kind + "&company_id=" + companyId + (sr ? "&sr=" + sr : ""))}
            style={{ width: "100%", background: green, color: "#fff", fontWeight: 900, fontSize: 15, padding: "14px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: "Cairo" }}>
            🏦 حوّل الآن وارفع الإيصال
          </button>
        </div>
        <button onClick={() => router.push("/goal")}
          style={{ marginTop: 16, background: "transparent", color: gray, fontWeight: 700, fontSize: 14, padding: "10px 24px", borderRadius: 999, border: "none", cursor: "pointer" }}>
          العودة للوحة
        </button>
      </div>
    );
  }

  return (
    <div dir="rtl" style={{ fontFamily: "Cairo", maxWidth: 520, margin: "0 auto", padding: "40px 20px", minHeight: "100vh", background: "#FBFCFB" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <h1 style={{ color: ink, fontSize: 24, fontWeight: 900, margin: 0 }}>إتمام الدفع</h1>
        <p style={{ color: gray, fontSize: 14, marginTop: 8 }}>{label}</p>
        <div style={{ color: ink, fontSize: 34, fontWeight: 900, marginTop: 12 }}>{amountSar.toLocaleString("ar-SA")} ريال</div>
      </div>

      <div style={{ background: "#fff", border: "2px solid #E8F5EF", borderRadius: 16, padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>💳</div>
        <h2 style={{ color: ink, fontSize: 18, fontWeight: 900, marginBottom: 8 }}>الدفع برابط إلكتروني آمن</h2>
        <p style={{ color: gray, fontSize: 13.5, lineHeight: 1.9, marginBottom: 20 }}>
          اطلب رابط الدفع، وسيصلك من فريق مُرضي خلال وقت قصير. تدفع ببطاقتك (مدى/فيزا) بأمان بضغطة واحدة.
        </p>
        {status && status !== "done" && (
          <div style={{ background: "#FBEEEC", color: "#C0564B", padding: 12, borderRadius: 10, fontSize: 13, marginBottom: 14 }}>{status}</div>
        )}
        <button onClick={requestLink} disabled={busy}
          style={{ width: "100%", background: green, color: "#fff", fontWeight: 900, fontSize: 16, padding: "15px", borderRadius: 999, border: "none", cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
          {busy ? "جارٍ الإرسال..." : "📨 اطلب رابط الدفع"}
        </button>
      </div>

      <div style={{ textAlign: "center", margin: "22px 0 10px", color: gray, fontSize: 13 }}>أو</div>

      <button onClick={() => router.push("/pay/transfer?amount=" + amountSar + "&kind=" + kind + "&company_id=" + companyId + (sr ? "&sr=" + sr : ""))}
        style={{ width: "100%", background: "#fff", color: ink, fontWeight: 900, fontSize: 15, padding: "14px", borderRadius: 999, border: "2px solid " + ink, cursor: "pointer" }}>
        🏦 الدفع بتحويل بنكي
      </button>

      <p style={{ textAlign: "center", color: "#9DB3AB", fontSize: 12, marginTop: 24 }}>🔒 جميع المدفوعات تتم بأمان</p>
    </div>
  );
}

export default function PayPage() {
  return (
    <Suspense fallback={<div dir="rtl" style={{ fontFamily: "Cairo", textAlign: "center", padding: 60, color: "#9DB3AB" }}>جارٍ التحميل…</div>}>
      <PayInner />
    </Suspense>
  );
}
