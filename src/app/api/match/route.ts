import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const ADMIN_EMAIL = 'hololalmurdi.fs@gmail.com'

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (n: string) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const { data: company } = await supabase
      .from('companies').select('*').eq('user_id', user.id).maybeSingle()
    if (!company || company.account_status !== 'active')
      return NextResponse.json({ error: 'not active' }, { status: 403 })

    const { data: fin } = await supabase
      .from('financial_data').select('*').eq('company_id', company.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()

    const { data: products } = await supabase
      .from('financing_products').select('*').eq('status', 'active')

    const revenue = fin?.annual_revenue || 0
    const years = fin?.years_operating || 0

    const matched: any[] = []
    const clientTypes: string[] = []
    for (const p of (products || [])) {
      const okRev = !p.min_revenue || revenue >= p.min_revenue
      const okYears = !p.min_years_operating || years >= p.min_years_operating
      if (okRev && okYears) {
        matched.push(p)
        if (!clientTypes.includes(p.product_name)) clientTypes.push(p.product_name)
      }
    }

    await supabase.from('funding_matches').insert({
      company_id: company.id,
      match_count: matched.length,
      funding_types: clientTypes,
      provider_details: matched.map(m => ({ provider: m.provider_name, product: m.product_name })),
      notes: 'auto-generated',
    })

    if (matched.length > 0) {
      const rows = matched.map(m => `<tr><td style="padding:6px;border:1px solid #ddd">${m.provider_name}</td><td style="padding:6px;border:1px solid #ddd">${m.product_name}</td></tr>`).join('')
      await resend.emails.send({
        from: 'Murdi <onboarding@resend.dev>',
        to: ADMIN_EMAIL,
        subject: `فرصة تمويل جديدة: ${company.company_name}`,
        html: `<div dir="rtl"><h2>${company.company_name}</h2><p>السجل: ${company.cr_number} | الجوال: ${company.phone}</p><p>الإيرادات: ${revenue} | العمر: ${years} سنة</p><p>عدد الجهات المطابقة: ${matched.length}</p><table style="border-collapse:collapse">${rows}</table></div>`,
      })
    }

    return NextResponse.json({ match_count: matched.length, funding_types: clientTypes })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
