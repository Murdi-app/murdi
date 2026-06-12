import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { companyName, email, revenue, expenses, bank_balance, debts, murdiScore, survivalDays, distress, margin, history } = body
    if (!email) return NextResponse.json({ error: 'لا يوجد بريد إلكتروني' }, { status: 400 })

    const hist = Array.isArray(history) ? history.slice().reverse() : []
    let histText = ''
    if (hist.length >= 2) {
      histText = '\nالتاريخ:\n' + hist.map((h:any)=>`${h.month}/${h.year}: ربح ${((h.revenue||0)-(h.expenses||0)).toLocaleString('ar-SA')}، رصيد ${(h.bank_balance||0).toLocaleString('ar-SA')}، Score ${h.murdi_score||'-'}`).join('\n')
    }

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 600,
        system: `أنت Murdi — المستشار المالي الرقمي لشركات المقاولات السعودية، تجسيد منهجية د. عبدالحكيم المرضي. تكتب تنبيهاً استباقياً قصيراً وذكياً يلفت انتباه المقاول لأهم خطر أو فرصة في أرقامه، بلغة سعودية دافئة ومباشرة. لا تخترع أرقاماً غير موجودة. جملتان إلى ثلاث فقط. ابدأ بلفت انتباه حقيقي مبني على رقم. اختم بدعوة لطيفة للدخول ومراجعة التفاصيل.`,
        messages: [{ role: 'user', content: `شركة ${companyName}: إيرادات ${revenue?.toLocaleString('ar-SA')}، مصروفات ${expenses?.toLocaleString('ar-SA')}، رصيد ${bank_balance?.toLocaleString('ar-SA')}، ديون ${debts?.toLocaleString('ar-SA')}، هامش ${margin}%، أيام بقاء ${survivalDays}، Murdi Score ${murdiScore}/85، مؤشر الضائقة ${distress}/100.${histText}\n\nاكتب التنبيه الذكي.` }]
      })
    })
    const aiData = await aiRes.json()
    const alertText = aiData.content?.find((b:any)=>b.type==='text')?.text || 'لديك تحديثات مهمة في أرقام شركتك — ادخل لمراجعتها.'

    await resend.emails.send({
      from: 'د. عبدالحكيم المرضي <noreply@murdi.sa>',
      to: email,
      subject: `🔔 ${companyName} — تنبيه Murdi الذكي`,
      html: `<div dir="rtl" style="font-family:Tahoma,Arial;padding:0;background:#0B1D3A;color:white;max-width:600px;margin:0 auto;border-radius:16px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#0B1D3A,#112244);padding:28px;text-align:center;border-bottom:2px solid #C8A84B;">
          <div style="color:#C8A84B;font-size:24px;font-weight:bold;letter-spacing:2px;">MURDI</div>
          <div style="color:#8aa;font-size:13px;margin-top:4px;">مستشارك المالي الذكي</div>
        </div>
        <div style="padding:28px;">
          <h2 style="color:#C8A84B;font-size:18px;margin:0 0 16px;">🔔 تنبيه ذكي عن ${companyName}</h2>
          <div style="background:#112244;padding:20px;border-radius:12px;border-right:4px solid #C8A84B;color:#fff;font-size:15px;line-height:1.9;">${alertText}</div>
          <div style="display:flex;gap:12px;margin:24px 0;flex-wrap:wrap;">
            <div style="flex:1;min-width:120px;background:#0a1420;padding:14px;border-radius:10px;text-align:center;">
              <div style="color:#8aa;font-size:11px;">أيام البقاء</div>
              <div style="color:#C8A84B;font-size:22px;font-weight:bold;">${survivalDays || '-'}</div>
            </div>
            <div style="flex:1;min-width:120px;background:#0a1420;padding:14px;border-radius:10px;text-align:center;">
              <div style="color:#8aa;font-size:11px;">Murdi Score</div>
              <div style="color:#C8A84B;font-size:22px;font-weight:bold;">${murdiScore || '-'}/85</div>
            </div>
          </div>
          <a href="https://murdi.vercel.app/dashboard" style="display:block;background:linear-gradient(135deg,#C8A84B,#F5C842);color:#0B1D3A;text-align:center;padding:14px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:15px;">ادخل لمراجعة التحليل الكامل ←</a>
        </div>
        <div style="padding:16px;text-align:center;color:#557;font-size:11px;border-top:1px solid #1a2a44;">Murdi — بُني على منهجية د. عبدالحكيم المرضي</div>
      </div>`
    })

    return NextResponse.json({ sent: true, alertText })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
