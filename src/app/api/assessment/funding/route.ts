import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

interface FinancialInput {
  annual_revenue: number
  net_profit: number
  available_cash: number
  monthly_expenses: number
  total_debt: number
  monthly_installments: number
  receivables: number
  overdue_receivables: number
  avg_collection_days: number
  years_operating: number
  employee_count: number
  revenue_growth: number
  client_concentration: number
  has_financials: boolean
  has_external_auditor: boolean
  has_finance_manager: boolean
  has_accountant: boolean
  has_monthly_budget: boolean
  separate_accounts: boolean
}

interface Obstacle { title: string; severity: 'high' | 'medium' | 'low'; detail: string }

function calculateReadiness(d: FinancialInput) {
  let score = 0
  const obstacles: Obstacle[] = []
  const requiredDocs: string[] = ['السجل التجاري', 'كشف حساب بنكي (6 أشهر)']
  const improvementPlan: { phase: string; action: string }[] = []

  const profitMargin = d.annual_revenue > 0 ? (d.net_profit / d.annual_revenue) * 100 : 0
  if (profitMargin >= 15) score += 20
  else if (profitMargin >= 8) score += 14
  else if (profitMargin >= 3) score += 8
  else {
    score += 2
    obstacles.push({ title: 'هامش ربح منخفض', severity: 'high',
      detail: `هامش ربحك ${profitMargin.toFixed(1)}% — الجهات الممولة تفضل 8% فأعلى.` })
    improvementPlan.push({ phase: '30 يوم', action: 'مراجعة التسعير والمصروفات لرفع هامش الربح' })
  }

  const debtRatio = d.annual_revenue > 0 ? (d.total_debt / d.annual_revenue) * 100 : 100
  if (debtRatio <= 30) score += 20
  else if (debtRatio <= 50) score += 14
  else if (debtRatio <= 70) score += 7
  else {
    score += 0
    obstacles.push({ title: 'نسبة ديون مرتفعة', severity: 'high',
      detail: `ديونك تمثل ${debtRatio.toFixed(0)}% من إيراداتك — يفضل أقل من 50%.` })
    improvementPlan.push({ phase: '90 يوم', action: 'خفض الديون القائمة أو إعادة جدولتها' })
  }

  const monthsCovered = d.monthly_expenses > 0 ? d.available_cash / d.monthly_expenses : 0
  if (monthsCovered >= 6) score += 15
  else if (monthsCovered >= 3) score += 10
  else if (monthsCovered >= 1) score += 5
  else {
    obstacles.push({ title: 'سيولة ضعيفة', severity: 'medium',
      detail: `نقدك يغطي ${monthsCovered.toFixed(1)} شهر فقط من المصروفات.` })
    improvementPlan.push({ phase: '60 يوم', action: 'بناء احتياطي نقدي يغطي 3 أشهر على الأقل' })
  }

  if (d.avg_collection_days <= 45) score += 10
  else if (d.avg_collection_days <= 90) score += 6
  else {
    score += 2
    obstacles.push({ title: 'بطء التحصيل', severity: 'medium',
      detail: `متوسط تحصيلك ${d.avg_collection_days} يوم — يفضل أقل من 90 يوم.` })
    improvementPlan.push({ phase: '30 يوم', action: 'تشديد سياسة التحصيل ومتابعة الذمم المتأخرة' })
  }

  if (d.years_operating >= 3) score += 10
  else if (d.years_operating >= 2) score += 7
  else if (d.years_operating >= 1) score += 4
  else {
    score += 1
    obstacles.push({ title: 'حداثة النشاط', severity: 'medium',
      detail: `عمر شركتك ${d.years_operating} سنة — بعض المنتجات تتطلب سنتين فأكثر.` })
  }

  if (d.client_concentration <= 30) score += 10
  else if (d.client_concentration <= 50) score += 6
  else {
    score += 2
    obstacles.push({ title: 'تركز عملاء مرتفع', severity: 'medium',
      detail: `اعتمادك على عميل واحد ${d.client_concentration}% — يرفع المخاطر لدى الممول.` })
    improvementPlan.push({ phase: '90 يوم', action: 'تنويع قاعدة العملاء لتقليل التركز' })
  }

  let gov = 0
  if (d.has_financials) { gov += 5 } else { requiredDocs.push('قوائم مالية'); obstacles.push({ title: 'غياب القوائم المالية', severity: 'high', detail: 'القوائم المالية شرط أساسي لمعظم منتجات التمويل.' }) }
  if (d.has_external_auditor) { gov += 4 } else { requiredDocs.push('تقرير مراجع خارجي') }
  if (d.has_finance_manager || d.has_accountant) gov += 3
  if (d.has_monthly_budget) gov += 2
  if (d.separate_accounts) gov += 1
  score += gov
  if (gov < 8) improvementPlan.push({ phase: '90 يوم', action: 'تحسين الحوكمة: إعداد قوائم مالية وتعيين مراجع خارجي' })

  score = Math.min(100, Math.round(score))

  let verdict: string
  if (score >= 75) verdict = 'جاهز'
  else if (score >= 50) verdict = 'يحتاج تحسين'
  else verdict = 'غير مناسب حالياً'

  const sevRank = { high: 3, medium: 2, low: 1 }
  const top3 = obstacles
    .sort((a, b) => sevRank[b.severity] - sevRank[a.severity])
    .slice(0, 3)

  return {
    readiness_score: score,
    verdict,
    top_obstacles: top3,
    required_documents: [...new Set(requiredDocs)],
    improvement_plan: improvementPlan,
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name: string) => cookieStore.get(name)?.value,
          set: () => {},
          remove: () => {},
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const body = await req.json() as FinancialInput

    const { data: company } = await supabase
      .from('companies')
      .select('id, account_status, goal')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!company || company.account_status !== 'active') {
      return NextResponse.json({ error: 'الحساب غير مفعل' }, { status: 403 })
    }

    await supabase.from('financial_data').insert({
      company_id: company.id,
      ...body,
    })

    const result = calculateReadiness(body)

    const { data: saved, error: saveErr } = await supabase
      .from('readiness_results')
      .insert({
        company_id: company.id,
        goal: 'funding',
        readiness_score: result.readiness_score,
        verdict: result.verdict,
        top_obstacles: result.top_obstacles,
        required_documents: result.required_documents,
        improvement_plan: result.improvement_plan,
      })
      .select()
      .single()

    if (saveErr) return NextResponse.json({ error: 'فشل حفظ النتيجة' }, { status: 500 })

    return NextResponse.json({ success: true, result: saved })
  } catch (e) {
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}