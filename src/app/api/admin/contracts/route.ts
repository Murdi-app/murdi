import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { fundingContract, investmentContract, acquisitionContract, ContractFields, type FeeType } from '@/lib/contracts';

// آلية الأتعاب تُقرأ من صفوف العقد ذاتها، فنص العقد يتبع الحقول ولا يُكتب يدوياً
const FEE_COLS = ['client_name', 'client_id_number', 'establishment_name', 'establishment_cr',
                  'fee_percent', 'deal_value', 'fee_type', 'fixed_amount', 'success_min', 'success_base'];

function toFields(r: Record<string, unknown>): ContractFields {
  return {
    clientName: r.client_name as string,
    clientIdNumber: r.client_id_number as string,
    establishmentName: r.establishment_name as string,
    establishmentCr: r.establishment_cr as string,
    feePercent: r.fee_percent as number,
    feeType: (r.fee_type as FeeType) || 'percent',
    fixedAmount: r.fixed_amount as number,
    successMin: r.success_min as number,
  };
}

function render(type: string, f: ContractFields): string {
  return type === 'acquisition' ? acquisitionContract(f) : type === 'investment' ? investmentContract(f) : fundingContract(f);
}
import { requireAdmin } from '@/lib/requireAdmin';
import { COMMERCIAL } from '@/lib/servicePricing';

const ADMIN_EMAIL = 'hololalmurdi.fs@gmail.com';

async function getAdmin() {
  const cookieStore = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
}

// GET: كل العقود (أو عقود شركة واحدة عبر ?company_id=)
export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const admin = await getAdmin();
  if (admin === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  const companyId = new URL(req.url).searchParams.get('company_id');
  let q = admin.from('contracts').select('*, companies(company_name, phone)').order('created_at', { ascending: false });
  if (companyId) q = q.eq('company_id', companyId);
  const { data } = await q;
  return NextResponse.json({ contracts: data || [] });
}

// POST: إنشاء مسودّة عقد لطلب خدمة
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const admin = await getAdmin();
  if (admin === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  const body = await req.json();
  const { serviceRequestId, companyId, contractType } = body;

  // ثلاثة من حقول العقد الأربعة موجودة في جدول المنشآت منذ التسجيل،
  // وكانت المسودّة تخرج بخانات نقاط تُملأ يدوياً في كل عقد. الآن تُقرأ.
  const { data: co } = await admin.from('companies')
    .select('company_name, company_name_en, cr_number, owner_name, owner_name_en, owner_id_number')
    .eq('id', companyId).maybeSingle();
  const party: Record<string, unknown> = {
    client_name: co?.owner_name || null,
    client_id_number: co?.owner_id_number || null,
    establishment_name: co?.company_name || null,
    establishment_cr: co?.cr_number || null,
  };

  // آلية الأتعاب المبدئية.
  // كانت تُقرأ من أعمدة في طلب الخدمة لا يكتبها أحد، فتخرج كل مسودّة «نسبة نجاح بلا مقدّم» —
  // على خدمة مقدّمها معلن. فالمصدر الصحيح هو سجل الأسعار نفسه: إن كان للخدمة سعر معلن،
  // فهو مقدّم مستحق، ومعه نسبة نجاح إن نصّ عليها السجل.
  const BASE_BY_TYPE: Record<string, string> = { funding: 'financing', investment: 'round', acquisition: 'deal' };
  let seed: Record<string, unknown> = { fee_type: 'percent', success_base: BASE_BY_TYPE[String(contractType)] || 'financing' };

  if (serviceRequestId) {
    const { data: sr } = await admin.from('service_requests')
      .select('service_title, price, quoted_price, fee_type, success_pct, success_min, success_base')
      .eq('id', serviceRequestId).maybeSingle();
    if (sr) {
      const com = COMMERCIAL[String(sr.service_title || '')];
      // المقدّم: ما سُعّر به الطلب فعلاً، وإلا السعر المعلن للخدمة في السجل
      const listed = typeof com?.price === 'number' ? com.price : null;
      const upfront = Number(sr.price ?? sr.quoted_price ?? listed ?? 0) || null;
      // نسبة نجاح يذكرها السجل صراحةً في خانة successFee
      const hasSuccess = Boolean(com?.successFee);
      const inferred = upfront && hasSuccess ? 'both' : upfront ? 'fixed' : 'percent';

      seed = {
        fee_type: sr.fee_type || inferred,
        fee_percent: sr.success_pct ?? null,
        success_min: sr.success_min ?? null,
        success_base: sr.success_base || BASE_BY_TYPE[String(contractType)] || 'financing',
        fixed_amount: (sr.fee_type ? (sr.fee_type === 'fixed' || sr.fee_type === 'both') : inferred !== 'percent') ? upfront : null,
      };
    }
  }
  const text = render(String(contractType), toFields({ ...seed, ...party }));

  const { data, error } = await admin.from('contracts').insert({
    company_id: companyId,
    service_request_id: serviceRequestId,
    contract_type: contractType,
    status: 'draft',
    contract_body: text,
    ...seed,
    ...party,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, contract: data });
}

// PATCH: تحديث المسودّة أو إصدارها
export async function PATCH(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const admin = await getAdmin();
  if (admin === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  const body = await req.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of [...FEE_COLS, 'status']) {
    if (body[k] !== undefined) updates[k] = body[k] === '' ? null : body[k];
  }
  // إعادة توليد نص العقد بالحقول المعبأة (الحقول هي المصدر، لا النص)
  // السلسلة مكتوبة حرفياً لا مبنيةً من مصفوفة — وإلا فقد Supabase استنتاج النوع وعاد GenericStringError
  const { data: existingRaw } = await admin.from('contracts')
    .select('contract_type, client_name, client_id_number, establishment_name, establishment_cr, fee_percent, deal_value, fee_type, fixed_amount, success_min, success_base')
    .eq('id', body.id).single();
  const existing = existingRaw as unknown as Record<string, unknown> | null;
  if (existing) {
    const merged: Record<string, unknown> = { ...existing };
    for (const k of FEE_COLS) if (updates[k] !== undefined) merged[k] = updates[k];

    // مصالحة الأتعاب — أخطر تناقض في العقد وأهدؤه.
    // كان بالإمكان كتابة مبلغ مقدّم بينما النوع «نسبة»، فيبقى الرقم في الصفّ
    // والنصّ يقول «ولا يستحق الطرف الأول أي مبلغ مقدّم» — فيوقّع العميل على نفي ما ستطالب به.
    // القاعدة: اختيارُك الصريح للنوع يحكم ويمسح ما ينفيه؛ فإن لم تختر، تحكم الأرقام.
    const n = (v: unknown) => Number(v ?? 0) || 0;
    if (body.fee_type !== undefined) {
      const ft = String(merged.fee_type || 'percent');
      if (ft === 'percent') merged.fixed_amount = null;
      if (ft === 'fixed')   merged.fee_percent  = null;
    } else {
      const hasFixed = n(merged.fixed_amount) > 0;
      const hasPct   = n(merged.fee_percent)  > 0;
      merged.fee_type = hasFixed && hasPct ? 'both' : hasFixed ? 'fixed' : 'percent';
    }
    // ما استقرّ عليه المنطق يُحفظ في الصفّ لا في النص وحده، وإلا عاد التناقض في أول تحرير
    updates.fee_type     = merged.fee_type;
    updates.fixed_amount = merged.fixed_amount ?? null;
    updates.fee_percent  = merged.fee_percent  ?? null;

    updates.contract_body = render(String(merged.contract_type), toFields(merged));
  }
  // لا يخرج عقد بخانة نقاط. العقد الذي يصل العميل ناقصَ اسمٍ أو رقم هوية أو سجل
  // لا يصلح سنداً، ويُحرج المستشار حين يُطلب تنفيذه.
  if (body.status === 'issued' && existing) {
    const merged: Record<string, unknown> = { ...existing };
    for (const k of FEE_COLS) if (updates[k] !== undefined) merged[k] = updates[k];
    const LABEL: Record<string, string> = {
      client_name: 'اسم المالك',
      client_id_number: 'رقم هوية المالك',
      establishment_name: 'اسم المنشأة',
      establishment_cr: 'رقم السجل التجاري',
    };
    const missing = Object.keys(LABEL).filter(k => !String(merged[k] ?? '').trim());

    // الأتعاب لا تُصدَر بقيمة ضمنية. كانت المسودّة تخرج بنسبة فارغة فتُقرأ صفراً،
    // أو بنسبة موروثة من سجل الأسعار لم يقرّها المستشار لهذا العميل بعينه.
    const ft = String(merged.fee_type || 'percent');
    const pct = Number(merged.fee_percent ?? 0);
    const fixed = Number(merged.fixed_amount ?? 0);
    if ((ft === 'percent' || ft === 'both') && !(pct > 0)) missing.push('__pct');
    if ((ft === 'fixed'   || ft === 'both') && !(fixed > 0)) missing.push('__fixed');
    LABEL.__pct = 'نسبة أتعاب النجاح';
    LABEL.__fixed = 'المبلغ المقدّم';

    if (missing.length) {
      return NextResponse.json({
        error: 'لا يمكن إصدار العقد قبل استكمال: ' + missing.map(k => LABEL[k]).join('، '),
        missing,
      }, { status: 422 });
    }

    // العقد وثيقة عربية، ومحكمة التنفيذ تطابق الاسم العربي في الهوية.
    // إقامة المستثمر الأجنبي تحمل الاسمين، فيسهل أن يُكتب اللاتيني سهواً —
    // ولا يظهر الخلل إلا يوم التنفيذ، وهو أسوأ يوم يظهر فيه.
    const AR = /[\u0621-\u064A]/;
    const nonAr = ([
      ['client_name', 'اسم المالك — اكتبه كما هو في الهوية أو الإقامة بالعربي'],
      ['establishment_name', 'اسم المنشأة — اكتبه كما هو في السجل التجاري بالعربي'],
    ] as const).filter(([k]) => !AR.test(String(merged[k] || '')));
    if (nonAr.length) {
      return NextResponse.json({
        error: 'العقد وثيقة عربية والتنفيذ عبر نافذ يطابق الاسم العربي. ' + nonAr.map(([, m]) => m).join(' · '),
        missing: nonAr.map(([k]) => k),
      }, { status: 422 });
    }
  }

  if (body.status === 'issued') updates.issued_at = new Date().toISOString();
  if (body.status === 'completed') updates.completed_at = new Date().toISOString();
  const { error } = await admin.from('contracts').update(updates).eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // رقم الهوية يُكتب مرة ويُحفظ على المنشأة، فلا يُطلب مرة أخرى في العقد القادم
  if (body.client_id_number && String(body.client_id_number).trim()) {
    const { data: row } = await admin.from('contracts').select('company_id').eq('id', body.id).maybeSingle();
    if (row?.company_id) {
      await admin.from('companies')
        .update({ owner_id_number: String(body.client_id_number).trim() })
        .eq('id', row.company_id);
    }
  }

  return NextResponse.json({ ok: true });
}
