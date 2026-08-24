p='src/app/admin/services/page.tsx'
s=open(p,encoding='utf-8').read()

# 1) قائمة الحقول — قبل تعريف المكوّن، جنب PITCH_FIELDS
import re
m=re.search(r"const PITCH_FIELDS[^\n]*\n", s)
assert m, "PITCH_FIELDS not found"
FZ = """const FZ_TEXT = [
  { k: 'projectDescription', t: 'وصف المشروع' },
  { k: 'sectorText', t: 'القطاع' },
  { k: 'location', t: 'موقع المشروع' },
  { k: 'capacityNote', t: 'الطاقة المستهدفة' },
  { k: 'staffNote', t: 'العمالة المتوقعة' },
  { k: 'existingRevenue', t: 'إيراد النشاط القائم (للتوسعة)' },
]
const FZ_NUM = [
  { k: 'capex', t: 'التكلفة الرأسمالية (ريال)' },
  { k: 'workingCapital', t: 'رأس المال العامل (ريال)' },
  { k: 'unitPrice', t: 'سعر الوحدة أو الخدمة (ريال)' },
  { k: 'unitsYear1', t: 'عدد الوحدات السنة الأولى' },
  { k: 'growthRate', t: 'نمو المبيعات سنوياً %' },
  { k: 'variableCostPct', t: 'التكلفة المتغيرة % من الإيراد' },
  { k: 'fixedCostsAnnual', t: 'المصاريف الثابتة سنوياً (ريال)' },
  { k: 'inflationRate', t: 'نمو المصاريف سنوياً % (افتراضي 3)' },
  { k: 'ownFunds', t: 'مساهمة المؤسس (ريال)' },
  { k: 'financingAmount', t: 'التمويل المطلوب (ريال)' },
  { k: 'financingYears', t: 'مدة السداد (سنوات)' },
  { k: 'financingRate', t: 'كلفة التمويل السنوية %' },
]
"""
s=s[:m.start()]+FZ+s[m.start():]
print("OK field lists")

# 2) البطاقة — قبل بطاقة العرض التقديمي
anchor="              {r.service_title === 'تجهيز ملف عرض المستثمر والتفاوض' && ("
assert s.count(anchor)==1, "card anchor: %d"%s.count(anchor)
IN="{ padding:'8px 10px', borderRadius:8, border:'1.5px solid #E8D9A8', fontFamily:'Cairo', fontSize:12.5 }"
card = """              {r.service_title === 'دراسة الجدوى الاقتصادية' && (
                <div style={{ background:'#FBF5E8', border:'1.5px solid #E8D9A8', borderRadius:10, padding:'12px 14px', marginBottom:10 }}>
                  <div style={{ color:'#9A7B2E', fontWeight:900, fontSize:12.5, marginBottom:8 }}>📐 مدخلات دراسة الجدوى — الأرقام تُحسب برمجياً ولا يخترعها النموذج</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))', gap:8, marginBottom:8 }}>
                    <select value={(fzIn[r.id] || {}).audience || ''} onChange={(e) => setFzIn((prev) => ({ ...prev, [r.id]: { ...(prev[r.id] || {}), audience: e.target.value } }))} style={IN_STYLE}>
                      <option value="">— لمن الدراسة؟ —</option>
                      <option value="financier">جهة تمويل</option>
                      <option value="investor">مستثمر</option>
                      <option value="regulator">جهة حكومية أو ترخيص</option>
                      <option value="internal">استخدام داخلي</option>
                    </select>
                    <select value={(fzIn[r.id] || {}).projectKind || ''} onChange={(e) => setFzIn((prev) => ({ ...prev, [r.id]: { ...(prev[r.id] || {}), projectKind: e.target.value } }))} style={IN_STYLE}>
                      <option value="">— نوع المشروع —</option>
                      <option value="new">مشروع جديد</option>
                      <option value="expansion">توسعة نشاط قائم</option>
                    </select>
                    {FZ_TEXT.map((f) => (
                      <input key={f.k} placeholder={f.t} value={(fzIn[r.id] || {})[f.k] || ''}
                        onChange={(e) => setFzIn((prev) => ({ ...prev, [r.id]: { ...(prev[r.id] || {}), [f.k]: e.target.value } }))}
                        style={IN_STYLE} />
                    ))}
                    {FZ_NUM.map((f) => (
                      <input key={f.k} placeholder={f.t} value={(fzIn[r.id] || {})[f.k] || ''}
                        onChange={(e) => setFzIn((prev) => ({ ...prev, [r.id]: { ...(prev[r.id] || {}), [f.k]: e.target.value } }))}
                        style={IN_STYLE} />
                    ))}
                  </div>
                  <button onClick={() => saveFeasibility(r.id, r.company_id)} disabled={busy === 'fz' + r.id} style={{ background:'#9A7B2E', color:'#fff', border:'none', padding:'8px 18px', borderRadius:24, fontFamily:'Cairo', fontWeight:900, fontSize:12.5, cursor:'pointer', marginLeft:8 }}>{busy === 'fz' + r.id ? 'جارٍ الحفظ...' : '💾 احفظ المدخلات'}</button>
                  <button onClick={() => genFeasibility(r.company_id)} disabled={busy === 'gfz' + r.company_id} style={{ background:'#1A3D34', color:'#fff', border:'none', padding:'8px 18px', borderRadius:24, fontFamily:'Cairo', fontWeight:900, fontSize:12.5, cursor:'pointer' }}>{busy === 'gfz' + r.company_id ? 'جارٍ التوليد...' : '📐 ولّد دراسة الجدوى'}</button>
                </div>
              )}
"""
s=s.replace(anchor, card+anchor)
print("OK card")

# 3) IN_STYLE ثابت مشترك
m2=re.search(r"const FZ_TEXT = \[", s)
s=s[:m2.start()]+"const IN_STYLE = "+IN+"\n"+s[m2.start():]
print("OK style const")
open(p,'w',encoding='utf-8').write(s)
