'use client'

// شريط الخدمات في الواجهة العامة — يُقرأ من فهرس الخدمات نفسه،
// فلا يتخلّف العدد المعروض عن القائمة حين تُضاف خدمة أو تُدمج.
import { CATALOG, SERVICE_COUNT, displayName } from '@/lib/serviceCatalog'

export default function ServicesBand({ onStart }: { onStart: () => void }) {
  return (
    <section className="sec">
      <style>{`
        .svc{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:var(--line);border:1px solid var(--line)}
        .svc-g{background:#fff;padding:26px 24px}
        .svc-g h3{font-size:15px;margin-bottom:3px}
        .svc-g .svc-n{color:var(--gold);font-size:12px;font-weight:600;margin-bottom:14px;display:block}
        .svc-g ul{list-style:none;margin:0;padding:0}
        .svc-g li{color:var(--muted);font-size:13.5px;line-height:1.6;padding:7px 0;border-top:1px solid var(--line)}
        .svc-g li:first-child{border-top:none}
        .svc-cta{text-align:center;margin-top:26px}
        .svc-cta p{color:var(--muted);font-size:13.5px;line-height:1.95;max-width:560px;margin:0 auto 14px}
        @media (max-width:760px){ .svc{grid-template-columns:1fr} }
      `}</style>

      <div className="sec-head">
        <div className="rule" />
        <h2>{SERVICE_COUNT} خدمة تؤهّل منشأتك لرأس المال</h2>
        <p>التقييم يكشف ما يمنع قبولك. وهذه الخدمات تُزيله — كل واحدة منها تعالج عائقاً بعينه بين ملفك وبين الجهة التي تموّلك، بسعر معلن ومدة معلومة.</p>
      </div>

      <div className="svc">
        {CATALOG.map(cat => (
          <div className="svc-g" key={cat.label}>
            <h3>{cat.label}</h3>
            <span className="svc-n">{cat.note}</span>
            <ul>{cat.items.map(t => <li key={t}>{displayName(t)}</li>)}</ul>
          </div>
        ))}
      </div>

      <div className="svc-cta">
        <p>لا تحتاجها كلها. التقييم يحدد أيّها يخصّك، ولا نبيعك ما لا ينفعك.</p>
        <button className="cta" onClick={onStart}>اعرف أي خدمة تخصّك — التقييم مجاني</button>
      </div>
    </section>
  )
}
