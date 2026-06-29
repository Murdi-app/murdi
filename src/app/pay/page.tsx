"use client";
import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function PayInner() {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    // الدفع عبر التحويل البنكي فقط — نوجّه مباشرة لصفحة التحويل
    const qs = params.toString();
    router.replace("/pay/transfer" + (qs ? "?" + qs : ""));
  }, [params, router]);

  return (
    <div dir="rtl" style={{ fontFamily: "Cairo", textAlign: "center", padding: 60, color: "#9DB3AB" }}>
      جارٍ تحويلك لصفحة الدفع…
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
