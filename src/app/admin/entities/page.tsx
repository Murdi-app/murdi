'use client';
import AdminNav from '@/components/AdminNav';

import { useEffect, useState } from 'react';

const FUNDING_TYPES = ['cash','working_capital','revenue','pos','invoices','assets','vehicles','real_estate','lc','project','tax','payroll','equipment','franchise','other'];
const FT_LABELS: Record<string,string> = { cash:'نقدي', working_capital:'رأس مال عامل', revenue:'إيرادات', pos:'نقاط بيع', invoices:'فواتير', assets:'أصول', vehicles:'مركبات', real_estate:'عقاري', lc:'اعتمادات', project:'مشاريع', tax:'ضرائب', payroll:'رواتب', equipment:'معدات', franchise:'امتياز تجاري', other:'أخرى' };
const ISSUES = ['late_debt','no_statements','simah_record','new_company','high_debt_ratio','seasonal_revenue'];
const ISSUE_LABELS: Record<string,string> = { late_debt:'تعثر سابق', no_statements:'بلا قوائم مالية', simah_record:'ملاحظات سمة', new_company:'شركة حديثة (أقل من سنتين)', high_debt_ratio:'نسبة دين مرتفعة', seasonal_revenue:'إيرادات موسمية' };
const STAGES = ['seed','growth','expansion','pre_ipo'];
const ST_LABELS: Record<string,string> = { seed:'تأسيس', growth:'نمو', expansion:'توسع', pre_ipo:'ما قبل الطرح' };

export default function EntitiesAdmin() {
  const [tab, setTab] = useState<'fp'|'ie'>('fp');
  const [products, setProducts] = useState<any[]>([]);
  const [entities, setEntities] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  // نموذج منتج تمويلي
  const [fp, setFp] = useState({ provider_name:'', product_name:'', product_type:'بنك', min_revenue:'', min_years_operating:'', funding_types:[] as string[], accepts_late_debt:false, max_months_late:'', requires_statements:false, requires_zakat:true, funding_type_other:'', accepted_issues:[] as string[] });
  // نموذج جهة استثمار
  const [ie, setIe] = useState({ entity_name:'', entity_type:'صندوق', sectors:'', min_revenue:'', min_murdi_score:'70', stages:[] as string[], requires_audited:false, requires_governance:false });

  const load = async () => {
    const res = await fetch('/api/admin/entities');
    const d = await res.json();
    setProducts(d.products || []);
    setEntities(d.entities || []);
  };
  useEffect(() => { load(); }, []);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const addProduct = async () => {
    if (!fp.provider_name || !fp.product_name) { flash('أكمل اسم الجهة والمنتج'); return; }
    setBusy(true);
    const row: any = {
      provider_name: fp.provider_name, product_name: fp.product_name, product_type: fp.product_type,
      funding_types: fp.funding_types, status: 'active',
      accepts_late_debt: fp.accepts_late_debt, requires_statements: fp.requires_statements, requires_zakat: fp.requires_zakat,
      accepted_issues: fp.accepted_issues, funding_type_other: fp.funding_types.includes('other') ? fp.funding_type_other : null,
    };
    if (fp.min_revenue !== '') row.min_revenue = Number(fp.min_revenue);
    if (fp.min_years_operating !== '') row.min_years_operating = Number(fp.min_years_operating);
    if (fp.accepts_late_debt && fp.max_months_late !== '') row.max_months_late = Number(fp.max_months_late);
    const res = await fetch('/api/admin/entities', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ table:'financing_products', row }) });
    const d = await res.json();
    flash(d.ok ? '✓ أُضيف المنتج' : 'خطأ: ' + d.error);
    if (d.ok) { setFp({ provider_name:'', product_name:'', product_type:'بنك', min_revenue:'', min_years_operating:'', funding_types:[], accepts_late_debt:false, max_months_late:'', requires_statements:false, requires_zakat:true, funding_type_other:'', accepted_issues:[] }); load(); }
    setBusy(false);
  };

  const addEntity = async () => {
    if (!ie.entity_name) { flash('أكمل اسم الجهة'); return; }
    setBusy(true);
    const row: any = {
      entity_name: ie.entity_name, entity_type: ie.entity_type, status: 'active',
      sectors: ie.sectors.split(',').map(s => s.trim()).filter(Boolean),
      stages: ie.stages, requires_audited: ie.requires_audited, requires_governance: ie.requires_governance,
    };
    if (ie.min_revenue !== '') row.min_revenue = Number(ie.min_revenue);
    if (ie.min_murdi_score !== '') row.min_murdi_score = Number(ie.min_murdi_score);
    const res = await fetch('/api/admin/entities', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ table:'investment_entities', row }) });
    const d = await res.json();
    flash(d.ok ? '✓ أُضيفت الجهة' : 'خطأ: ' + d.error);
    if (d.ok) { setIe({ entity_name:'', entity_type:'صندوق', sectors:'', min_revenue:'', min_murdi_score:'70', stages:[], requires_audited:false, requires_governance:false }); load(); }
    setBusy(false);
  };

  const rowAction = async (table: string, id: string, action: string, status?: string) => {
    await fetch('/api/admin/entities', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ table, id, action, status }) });
    load();
  };

  const inp = "w-full p-3 rounded-xl border-2 border-[#E8F5EF] bg-white text-[#1A3D34] font-bold focus:border-[#2E9E7B] focus:outline-none text-right";
  const chip = (active: boolean) => 'px-4 py-2 rounded-full text-sm font-black cursor-pointer border-2 ' + (active ? 'bg-[#2E9E7B] text-white border-[#2E9E7B]' : 'bg-white text-[#6B8A80] border-[#E8F5EF]');

  return (
    <div dir="rtl" className="min-h-screen bg-[#FBFCFB] px-4 py-8" style={{ fontFamily: 'Cairo, sans-serif' }}>
      <div className="max-w-3xl mx-auto">
        <AdminNav />
        <h1 className="text-2xl font-black text-[#1A3D34] mb-6">🏦 إدارة الجهات والمنتجات</h1>

        {msg !== '' && <div className="mb-4 p-3 rounded-xl bg-[#E8F5EF] text-[#2E9E7B] font-black text-sm text-center">{msg}</div>}

        <div className="flex gap-2 mb-6">
          <button onClick={() => setTab('fp')} className={chip(tab==='fp')}>منتجات التمويل ({products.length})</button>
          <button onClick={() => setTab('ie')} className={chip(tab==='ie')}>جهات الاستثمار ({entities.length})</button>
        </div>

        {tab === 'fp' && (
          <>
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#E8F5EF] mb-6 space-y-3">
              <h2 className="font-black text-[#1A3D34]">+ إضافة منتج تمويلي</h2>
              <div className="grid grid-cols-2 gap-3">
                <input className={inp} placeholder="اسم الجهة (مثال: البنك الأهلي)" value={fp.provider_name} onChange={e => setFp({...fp, provider_name: e.target.value})} />
                <input className={inp} placeholder="اسم المنتج (مثال: تمويل كفالة)" value={fp.product_name} onChange={e => setFp({...fp, product_name: e.target.value})} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <select className={inp} value={fp.product_type} onChange={e => setFp({...fp, product_type: e.target.value})}>
                  <option value="بنك">بنك</option><option value="شركة تمويل">شركة تمويل</option><option value="برنامج حكومي">برنامج حكومي</option>
                </select>
                <input className={inp} type="number" placeholder="حد أدنى للإيرادات (ريال)" value={fp.min_revenue} onChange={e => setFp({...fp, min_revenue: e.target.value})} />
                <input className={inp} type="number" placeholder="حد أدنى لسنوات التشغيل" value={fp.min_years_operating} onChange={e => setFp({...fp, min_years_operating: e.target.value})} />
              </div>
              <p className="text-xs font-black text-[#6B8A80]">أنواع التمويل التي يغطيها:</p>
              <div className="flex flex-wrap gap-2">
                {FUNDING_TYPES.map(t => (
                  <span key={t} className={chip(fp.funding_types.includes(t))} onClick={() => setFp({...fp, funding_types: fp.funding_types.includes(t) ? fp.funding_types.filter(x => x!==t) : [...fp.funding_types, t]})}>{FT_LABELS[t]}</span>
                ))}
              </div>
              {fp.funding_types.includes('other') && (
                <input className={inp} placeholder="اكتب نوع التمويل الآخر (مثال: تمويل ضرائب مؤجلة)" value={fp.funding_type_other} onChange={e => setFp({...fp, funding_type_other: e.target.value})} />
              )}
              <p className="text-xs font-black text-[#6B8A80]">المشاكل الدارجة التي يقبلها هذا المنتج:</p>
              <div className="flex flex-wrap gap-2">
                {ISSUES.map(i => (
                  <span key={i} className={chip(fp.accepted_issues.includes(i))} onClick={() => setFp({...fp, accepted_issues: fp.accepted_issues.includes(i) ? fp.accepted_issues.filter(x => x!==i) : [...fp.accepted_issues, i]})}>{ISSUE_LABELS[i]}</span>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={chip(fp.accepts_late_debt)} onClick={() => setFp({...fp, accepts_late_debt: !fp.accepts_late_debt})}>يقبل تعثراً سابقاً</span>
                {fp.accepts_late_debt && <input className={inp + ' max-w-[200px]'} type="number" placeholder="أقصى أشهر تأخر" value={fp.max_months_late} onChange={e => setFp({...fp, max_months_late: e.target.value})} />}
                <span className={chip(fp.requires_statements)} onClick={() => setFp({...fp, requires_statements: !fp.requires_statements})}>يشترط قوائم مالية</span>
                <span className={chip(fp.requires_zakat)} onClick={() => setFp({...fp, requires_zakat: !fp.requires_zakat})}>يشترط شهادة زكاة</span>
              </div>
              <button onClick={addProduct} disabled={busy} className="px-8 py-3 rounded-full bg-[#2E9E7B] text-white font-black text-sm disabled:opacity-40">{busy ? 'جارٍ...' : 'إضافة المنتج'}</button>
            </div>

            {products.map(p => (
              <div key={p.id} className="bg-white rounded-2xl p-4 mb-3 border border-[#F0F5F3] flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="font-black text-[#1A3D34]">{p.provider_name} — {p.product_name}</p>
                  <p className="text-xs text-[#6B8A80] font-bold">{(p.funding_types || []).map((t: string) => FT_LABELS[t] || t).join('، ') || 'بدون أنواع'} | {p.status === 'active' ? '🟢 نشط' : '⚪ موقوف'}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => rowAction('financing_products', p.id, 'toggle', p.status === 'active' ? 'inactive' : 'active')} className="px-4 py-2 rounded-full border-2 border-[#E8F5EF] text-[#6B8A80] font-black text-xs">{p.status === 'active' ? 'إيقاف' : 'تفعيل'}</button>
                  <button onClick={() => { if (confirm('حذف نهائي؟')) rowAction('financing_products', p.id, 'delete'); }} className="px-4 py-2 rounded-full border-2 border-red-100 text-red-400 font-black text-xs">حذف</button>
                </div>
              </div>
            ))}
          </>
        )}

        {tab === 'ie' && (
          <>
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#E8F5EF] mb-6 space-y-3">
              <h2 className="font-black text-[#1A3D34]">+ إضافة جهة استثمار</h2>
              <div className="grid grid-cols-2 gap-3">
                <input className={inp} placeholder="اسم الجهة" value={ie.entity_name} onChange={e => setIe({...ie, entity_name: e.target.value})} />
                <select className={inp} value={ie.entity_type} onChange={e => setIe({...ie, entity_type: e.target.value})}>
                  <option value="صندوق">صندوق استثمار</option><option value="محفظة عائلية">محفظة عائلية (Family Office)</option><option value="محفظة استثمارية">محفظة استثمارية</option><option value="مستثمر فرد">مستثمر فرد</option><option value="مستثمر ملائكي">مستثمر ملائكي</option><option value="شركة استثمار">شركة استثمار</option><option value="جهة حكومية">جهة حكومية</option>
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><p className="text-xs font-black text-[#6B8A80] mb-1">القطاعات (افصل بفاصلة)</p>
                <input className={inp} placeholder="تقنية، عقار، تجزئة..." value={ie.sectors} onChange={e => setIe({...ie, sectors: e.target.value})} /></div>
                <div><p className="text-xs font-black text-[#6B8A80] mb-1">حد أدنى للإيرادات (ريال)</p>
                <input className={inp} type="number" value={ie.min_revenue} onChange={e => setIe({...ie, min_revenue: e.target.value})} /></div>
                <div><p className="text-xs font-black text-[#6B8A80] mb-1">حد أدنى Murdi Score</p>
                <input className={inp} type="number" value={ie.min_murdi_score} onChange={e => setIe({...ie, min_murdi_score: e.target.value})} /></div>
              </div>
              <p className="text-xs font-black text-[#6B8A80]">المراحل المستهدفة:</p>
              <div className="flex flex-wrap gap-2">
                {STAGES.map(s => (
                  <span key={s} className={chip(ie.stages.includes(s))} onClick={() => setIe({...ie, stages: ie.stages.includes(s) ? ie.stages.filter(x => x!==s) : [...ie.stages, s]})}>{ST_LABELS[s]}</span>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={chip(ie.requires_audited)} onClick={() => setIe({...ie, requires_audited: !ie.requires_audited})}>يشترط قوائم مدققة</span>
                <span className={chip(ie.requires_governance)} onClick={() => setIe({...ie, requires_governance: !ie.requires_governance})}>يشترط حوكمة</span>
              </div>
              <button onClick={addEntity} disabled={busy} className="px-8 py-3 rounded-full bg-[#2E9E7B] text-white font-black text-sm disabled:opacity-40">{busy ? 'جارٍ...' : 'إضافة الجهة'}</button>
            </div>

            {entities.map(e2 => (
              <div key={e2.id} className="bg-white rounded-2xl p-4 mb-3 border border-[#F0F5F3] flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="font-black text-[#1A3D34]">{e2.entity_name} ({e2.entity_type})</p>
                  <p className="text-xs text-[#6B8A80] font-bold">Murdi Score ≥ {e2.min_murdi_score ?? '—'} | {(e2.sectors || []).join('، ') || 'كل القطاعات'} | {e2.status === 'active' ? '🟢 نشطة' : '⚪ موقوفة'}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => rowAction('investment_entities', e2.id, 'toggle', e2.status === 'active' ? 'inactive' : 'active')} className="px-4 py-2 rounded-full border-2 border-[#E8F5EF] text-[#6B8A80] font-black text-xs">{e2.status === 'active' ? 'إيقاف' : 'تفعيل'}</button>
                  <button onClick={() => { if (confirm('حذف نهائي؟')) rowAction('investment_entities', e2.id, 'delete'); }} className="px-4 py-2 rounded-full border-2 border-red-100 text-red-400 font-black text-xs">حذف</button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
