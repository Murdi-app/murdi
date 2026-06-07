'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const C = { navy:'#0B1C3D', navyLight:'#112244', border:'#1E3A6E', gold:'#F5C842', goldLight:'#E6A800', white:'#fff', gray:'#8899BB' }

const fmt = (n: number) => n.toLocaleString('ar-SA') + ' ر.س'
const days = (n: number) => Math.round(n) + ' يوم'

interface RiskItem {
  text: string
  impact: number
  category: 'liquidity' | 'profit' | 'collection' | 'debt'
}

function generateReport(f: any) {
  const r = parseFloat(f.revenue)||0, e = parseFloat(f.expenses)||0
  const b = parseFloat(f.bank_balance)||0, d = parseFloat(f.debts)||0
  const recCurrent = parseFloat(f.rec_current)||0
  const recLate = parseFloat(f.rec_late)||0
  const recBad = parseFloat(f.rec_bad)||0
  const rec = recCurrent + recLate + recBad
  const recReal = recCurrent + (recLate * 0.4) + (recBad * 0.05)
  const recWriteoff = recBad
  const monthlyPayment = parseFloat(f.monthly_payment)||0
  const debtStatus = f.debt_status || 'committed' // committed | late | default | none
  const margin = r>0 ? ((r-e)/r*100) : 0
  const liq = e>0 ? b/e : 0
  const dso = r>0 ? recReal/r*30 : 0
  const dr = r>0 ? d/(r*12)*100 : 0
  const dailyBurn = e/30
  const daysLeft = dailyBurn>0 ? b/dailyBurn : 0
  const monthlyProfit = r - e

  // كاشف الربح الوهمي — الفجوة بين الربح الدفتري والنقد الفعلي
  // الربح الدفتري يفترض تحصيل كل الإيرادات، لكن جزءاً منها عالق في ذمم غير قابلة للتحصيل فوراً
  const uncollectibleGap = rec - recReal  // الذمم المعلّقة/المشكوك فيها (ربح على الورق لا في اليد)
  const paperProfit = monthlyProfit  // الربح الدفتري المعلن
  // الربح النقدي لا ينزل تحت صفر — نخصم العالق بحدود الربح نفسه (الفجوة قد تخص أشهراً سابقة)
  const cashProfit = Math.max(0, monthlyProfit - (uncollectibleGap > 0 ? uncollectibleGap : 0))
  // جودة الربح = نسبة النقد الفعلي من الربح المعلن
  const profitQuality = paperProfit > 0 ? Math.max(0, Math.min(100, (cashProfit / paperProfit) * 100)) : (paperProfit < 0 ? 0 : 100)
  const hasPhantomProfit = paperProfit > 0 && profitQuality < 60

  // Survival Clock — ساعة البقاء الذكية (تدمج السياق الزمني)
  const expInflow = parseFloat(f.expected_inflow)||0
  const expInflowDays = parseInt(f.expected_inflow_days)||0
  const upcomingOblig = parseFloat(f.upcoming_obligations)||0
  // السيولة الفعلية المتاحة = الرصيد + الدفعات المتوقعة − الالتزامات القادمة
  const effectiveLiquidity = b + expInflow - upcomingOblig
  // أيام البقاء الواقعية مع الأخذ بالحسبان الدخل القادم
  let survivalDays = dailyBurn>0 ? effectiveLiquidity/dailyBurn : 999
  if (survivalDays < 0) survivalDays = 0
  if (survivalDays > 999) survivalDays = 999
  // التصنيف اللوني
  const survivalColor = survivalDays >= 90 ? '#22c55e' : survivalDays >= 45 ? '#C8A84B' : survivalDays >= 21 ? '#f97316' : '#ef4444'
  const survivalLabel = survivalDays >= 90 ? 'منطقة آمنة' : survivalDays >= 45 ? 'منطقة مراقبة' : survivalDays >= 21 ? 'منطقة تحذير' : 'منطقة خطر'

  const risks: RiskItem[] = []
  const actions: string[] = []
  const impacts: string[] = []
  const strengths: string[] = []
  const opportunities: string[] = []

  if (liq < 1) {
    risks.push({ text: `🔴 رصيدك ${fmt(b)} يغطي فقط ${days(daysLeft)} من مصروفاتك — معدل الصرف اليومي ${Math.round(dailyBurn).toLocaleString("ar-SA")} ريال/يوم — خطر نقدي حقيقي`, impact: 9, category: 'liquidity' })
    if (recReal > 0) {
      const recAction = recCurrent > 0
        ? `⚡ ركّز على تحصيل الذمم السائلة ${fmt(recCurrent)} — عميلها ملتزم وقابلة للتحصيل هذا الشهر`
        : recLate > 0
        ? `📞 تابع الذمم المتأخرة ${fmt(recLate)} — تفاوض على جدول سداد أو خصم 20% للتسوية الفورية`
        : `⚖️ الذمم المشكوك فيها ${fmt(recBad)} — استشر محامياً أو اشطبها محاسبياً كخسارة ضريبية`
      actions.push(recAction)
      impacts.push(`💡 الذمم القابلة للتحصيل فعلياً: ${fmt(recReal)} (بعد تصنيف المخاطر) — تحصيلها سيرفع رصيدك إلى ${fmt(b + recReal)} ويرفع Score +15 نقطة`)
    } else {
      actions.push(`⚡ رصيدك حرج — راجع مصروفاتك وخفض أكبر بند 20% (توفير ${fmt(e*0.2)} شهرياً)`)
      impacts.push(`💡 خفض المصروفات 20% يرفع تغطيتك من ${days(daysLeft)} إلى ${days(daysLeft*1.25)} ويمنع الأزمة`)
    }
  } else if (liq < 3) {
    risks.push({ text: `🟡 رصيدك ${fmt(b)} يغطي ${days(daysLeft)} فقط — أقل من المعيار الموصى به (90 يوم)`, impact: 6, category: 'liquidity' })
    actions.push(`📊 ابن احتياطياً نقدياً يصل إلى ${fmt(e*3)} يعادل 3 أشهر من المصروفات`)
    impacts.push(`💡 الاحتياطي سيجعلك مؤهلاً لتمويل بنكي بفائدة أقل بـ2-3%`)
  } else {
    strengths.push(`✅ سيولتك قوية — رصيدك ${fmt(b)} يغطي ${days(daysLeft)} من المصروفات`)
  }

  if (monthlyProfit < 0) {
    risks.push({ text: `🔴 شركتك تخسر ${fmt(Math.abs(monthlyProfit))} شهرياً — أي ${fmt(Math.abs(monthlyProfit)*12)} سنوياً`, impact: 8, category: 'profit' })
    actions.push(`🔍 راجع أكبر 3 بنود مصروفات وخفّضها — خفض 10% سيوفر ${fmt(e*0.1)} شهرياً`)
    impacts.push(`💡 الوصول للتعادل يحتاج خفض المصروفات ${fmt(Math.abs(monthlyProfit))} أو رفع الإيرادات بنفس المقدار`)
  } else if (margin < 15) {
    risks.push({ text: `🟡 هامش ربحك ${margin.toFixed(1)}% — أقل من معيار قطاع المقاولات (15-25%)`, impact: 5, category: 'profit' })
    actions.push(`💰 رفع هامشك 5% يضيف ${fmt(r*0.05)} شهرياً أي ${fmt(r*0.05*12)} سنوياً`)
    impacts.push(`💡 مع هامش 20% ستتأهل لمشاريع حكومية تشترط ربحية لا تقل عن 15%`)
  } else {
    strengths.push(`✅ هامش ربحك ${margin.toFixed(1)}% — أعلى من معيار القطاع (15%) بفارق ${(margin-15).toFixed(1)}%`)
  }

  if (dso > 90) {
    risks.push({ text: `🔴 عملاؤك يدفعون بعد ${days(dso)} في المتوسط — ذممك ${fmt(rec)} محتجزة طويلاً`, impact: 7, category: 'collection' })
    actions.push(`📞 اتصل هذا الأسبوع بأكبر 3 عملاء مدينين وفاوض على جدول سداد`)
    impacts.push(`💡 تحصيل الذمم في 60 يوم بدل 90 سيضيف ${fmt(rec/3)} لسيولتك كل شهر`)
  } else if (dso > 60) {
    risks.push({ text: `🟡 متوسط التحصيل ${days(dso)} — يمكن تحسينه`, impact: 4, category: 'collection' })
    actions.push(`📋 طبّق فواتير إلكترونية مع تذكير تلقائي كل 30 يوم`)
  } else if (r > 0) {
    if (rec > 0) strengths.push(`✅ تحصيلك سريع — عملاؤك يدفعون خلال ${days(dso)} في المتوسط`)
    else strengths.push(`✅ لا ذمم متأخرة — عملاؤك يدفعون فوراً عند الاستحقاق`)
  }

  if (d > 0) {
    const paymentBurden = monthlyPayment > 0 ? (monthlyPayment / r * 100) : 0
    if (dr > 100) {
      const debtStatusText = debtStatus === 'late' ? ' — متأخر عن السداد ⚠️' : debtStatus === 'default' ? ' — متعثر عن السداد 🔴' : ''
      risks.push({ text: `🔴 ديونك ${fmt(d)} تعادل ${dr.toFixed(0)}% من إيراداتك السنوية${monthlyPayment > 0 ? ` — قسط ${fmt(monthlyPayment)}/شهر` : ''}${debtStatusText}`, impact: debtStatus === 'default' ? 9 : debtStatus === 'late' ? 7 : 6, category: 'debt' })
      if (debtStatus === 'default') {
        actions.push(`🚨 وضعك التعثر خطير — تواصل فوراً مع البنك لإعادة الهيكلة قبل الإجراءات القانونية`)
        impacts.push(`💡 إعادة الهيكلة المبكرة تحمي سجلك الائتماني وتمنع الحجز على الأصول`)
      } else if (debtStatus === 'late') {
        actions.push(`⚠️ تأخرك عن السداد يؤثر على تصنيفك الائتماني — سدد المتأخرات فوراً ولو جزئياً`)
        impacts.push(`💡 السداد الجزئي يوقف الغرامات ويحافظ على علاقتك مع البنك`)
      } else if (monthlyPayment > 0 && paymentBurden > 20) {
        actions.push(`🏦 قسطك ${fmt(monthlyPayment)} يمثل ${paymentBurden.toFixed(0)}% من إيراداتك — فاوض البنك على تمديد الفترة`)
        impacts.push(`💡 تمديد القسط سيحرر ${fmt(monthlyPayment * 0.3)} شهرياً لتشغيل الشركة`)
      } else if (monthlyPayment > 0) {
        actions.push(`📊 قسطك ${fmt(monthlyPayment)} مقبول — ركّز على رفع الإيرادات لتحسين نسبة الديون`)
        impacts.push(`💡 رفع الإيرادات 20% سيخفض نسبة الديون من ${dr.toFixed(0)}% إلى ${(dr*0.83).toFixed(0)}%`)
      } else {
        actions.push(`🏦 حدد حالة ديونك للحصول على توصية دقيقة`)
        impacts.push(`💡 معرفة حالة الديون تساعد Murdi على تقييم العبء الحقيقي`)
      }
    } else if (dr > 50) {
      risks.push({ text: `🟡 ديونك ${fmt(d)} تمثل ${dr.toFixed(0)}% من إيراداتك السنوية${monthlyPayment > 0 ? ` — قسط ${fmt(monthlyPayment)}/شهر` : ''} — راقبها`, impact: 3, category: 'debt' })
      actions.push(`📉 لا تأخذ ديوناً جديدة حتى تنخفض النسبة تحت 50%`)
    }
  } else if (r > 0) {
    strengths.push(`✅ شركتك خالية من الديون — ميزة تنافسية قوية`)
  }

  if (margin > 20 && liq > 2) {
    opportunities.push(`🚀 وضعك المالي يؤهلك للتوسع — ربحيتك ${margin.toFixed(0)}% وسيولتك ${days(daysLeft)} تسمح بمشروع جديد`)
    opportunities.push(`💳 يمكنك التقدم لتمويل بنكي بضمان إيراداتك ${fmt(r)} شهرياً`)
  }
  if (recReal > r*0.5) {
    // في الخسارة: التحصيل يسدّ الفجوة لا يموّل توسعاً
    if (monthlyProfit < 0) {
      opportunities.push(`💰 لديك ${fmt(recReal)} ذمم قابلة للتحصيل — حصّلها لتغطية فجوتك النقدية قبل أي توسع`)
    } else {
      opportunities.push(`💰 لديك ${fmt(recReal)} ذمم قابلة للتحصيل — تحصيلها يموّل نموك دون ديون إضافية`)
    }
  } else if (recReal > 0) {
    opportunities.push(`💰 ذممك القابلة للتحصيل ${fmt(recReal)} — حصّلها لتعزيز سيولتك`)
  }
  if (margin > 15 && dr < 50) {
    opportunities.push(`📈 بناءً على أرقامك، يمكنك استيعاب مشروع إضافي بقيمة تصل ${fmt(r*0.3)} شهرياً`)
  }
  if (opportunities.length === 0) {
    opportunities.push(`📈 بعد تحسين السيولة والربحية ستظهر فرص توسع — ابدأ بخفض المصروفات وتحسين الهامش`)
  }

  const forecast3m = monthlyProfit > 0
    ? `إذا استمريت بنفس الأداء، رصيدك بعد 3 أشهر سيكون ${fmt(b + monthlyProfit*3)}`
    : `إذا لم تتحرك، رصيدك بعد 3 أشهر سيكون ${fmt(Math.max(0, b + monthlyProfit*3))} — ${b + monthlyProfit*3 < 0 ? '⚠️ خطر التوقف عن العمل' : 'تحتاج تحسين عاجل'}`

  const vsMarket = margin > 20 ? `هامش ربحك أعلى من 70% من شركات المقاولات السعودية` :
    margin > 15 ? `هامش ربحك أعلى من 50% من شركات المقاولات السعودية` :
    margin > 10 ? `هامش ربحك أعلى من 35% من شركات المقاولات السعودية` :
    `هامش ربحك أقل من 70% من شركات المقاولات السعودية — مجال للتحسين`

  // عبء القسط على التدفق النقدي الشهري (مهم في قطاع المقاولات)
  const paymentBurden = r > 0 ? (monthlyPayment / r) * 100 : (monthlyPayment > 0 ? 100 : 0)
  let score = 0
  // السيولة (25)
  if (liq >= 3) score+=25; else if (liq >= 1) score+=15; else if (liq > 0) score+=5
  // الربحية (25) — الخسارة تُعاقب فعلياً لا تكتفي بصفر
  if (margin >= 15) score+=25; else if (margin >= 8) score+=18; else if (margin > 0) score+=10; else score-=10
  // دورة التحصيل (15)
  if (dso <= 60) score+=15; else if (dso <= 90) score+=8
  // نسبة الدين (10)
  if (dr <= 50) score+=10; else if (dr <= 100) score+=5
  // عبء القسط (10) — جديد: القسط الذي يلتهم الدخل خطر حقيقي
  if (paymentBurden === 0) score+=10; else if (paymentBurden <= 15) score+=8; else if (paymentBurden <= 30) score+=4; else if (paymentBurden <= 50) score+=1; else score-=5
  // سقوف حالة الدين — التعثر يمنع أي درجة مرتفعة
  if (debtStatus === 'default') score = Math.min(score, 25)
  else if (debtStatus === 'late') score = Math.min(score, 45)
  // الخسارة تمنع تصنيف "قوي"
  if (monthlyProfit < 0) score = Math.min(score, 50)
  score = Math.max(0, Math.min(score, 85))

  const scoreLabel = score >= 70 ? 'شركة قوية — جاهزة للتوسع' : score >= 55 ? 'شركة متوسطة — تحتاج تحسين' : score >= 40 ? 'شركة تحت الضغط — تدخل عاجل' : 'وضع حرج — يحتاج إجراء فوري'

  let fundingScore = 0
  if (liq >= 3) fundingScore += 30; else if (liq >= 1) fundingScore += 15
  if (margin >= 15) fundingScore += 25; else if (margin > 0) fundingScore += 10
  if (dso <= 60) fundingScore += 25; else if (dso <= 90) fundingScore += 12
  if (dr <= 50) fundingScore += 20; else if (dr <= 100) fundingScore += 8
  if (debtStatus === 'default') fundingScore = Math.min(fundingScore, 15)
  else if (debtStatus === 'late') fundingScore = Math.min(fundingScore, 35)
  fundingScore = Math.min(fundingScore, 100)

  // Murdi Distress Index™️
  let distress = 0
  if (liq < 0.5) distress += 35; else if (liq < 1) distress += 25; else if (liq < 3) distress += 12; else distress += 0
  if (monthlyProfit < 0) distress += 25; else if (margin < 10) distress += 15; else if (margin < 15) distress += 8
  if (debtStatus === 'default') distress += 25; else if (debtStatus === 'late') distress += 18; else if (dr > 100) distress += 12; else if (dr > 50) distress += 6
  if (dso > 90) distress += 15; else if (dso > 60) distress += 8; else distress += 0
  distress = Math.min(distress, 100)
  const distressLabel = distress >= 70 ? 'خطر تعثر مرتفع' : distress >= 45 ? 'ضغط مالي متوسط' : distress >= 20 ? 'وضع مستقر مع مخاطر' : 'وضع مالي آمن'
  const distressColor = distress >= 70 ? '#ef4444' : distress >= 45 ? '#f97316' : distress >= 20 ? '#F5C842' : '#22c55e'

  const fundingWeaknesses: string[] = []
  if (liq < 1) fundingWeaknesses.push('🔴 السيولة أقل من شهر واحد')
  else if (liq < 3) fundingWeaknesses.push('🟡 السيولة أقل من 3 أشهر')
  if (dr > 100) fundingWeaknesses.push('🔴 نسبة الديون تتجاوز 100%')
  else if (dr > 50) fundingWeaknesses.push('🟡 نسبة الديون أعلى من المعيار')
  if (dso > 90) fundingWeaknesses.push('🔴 دورة التحصيل أطول من 90 يوم')
  else if (dso > 60) fundingWeaknesses.push('🟡 الذمم أعلى من الحد المطلوب')
  if (margin < 0) fundingWeaknesses.push('🔴 الشركة تخسر حالياً')
  else if (margin < 15) fundingWeaknesses.push('🟡 الهامش أقل من معيار القطاع')
  if (debtStatus === 'default') fundingWeaknesses.push('🔴 تعثر في السداد — يمنع أي تمويل بنكي حالياً')
  else if (debtStatus === 'late') fundingWeaknesses.push('🔴 تأخر في الأقساط — يؤثر على التصنيف الائتماني')

  // الإجراء التمويلي يتبع السبب الجذري الفعلي — لا يقفز للذمم تلقائياً
  const topFundingAction = (() => {
    // 1) خسارة أو هامش ضعيف = المشكلة في الربحية لا التمويل
    if (margin < 0) return `أوقف النزيف: راجع تسعير مشاريعك ومصروفاتك — الشركة تخسر ${fmt(Math.abs(monthlyProfit))} شهرياً`
    if (margin < 8) return `ارفع هامشك من ${margin.toFixed(0)}% — راجع تسعير العقود ووفّر في المصروفات قبل طلب أي تمويل`
    // 2) ثقل الدين = إعادة هيكلة
    if (dr > 100) return monthlyPayment > 0 ? `فاوض البنك على تمديد قسطك الشهري ${fmt(monthlyPayment)} لتخفيف الضغط` : `أعد جدولة ديونك لتخفيض نسبتها تحت 80%`
    // 3) سيولة قصيرة — الحل حسب توفّر ذمم قابلة للتحصيل فعلاً
    if (liq < 1) {
      if (recReal > e * 0.5) return `حصّل ${fmt(recReal)} من ذممك القابلة للتحصيل فعلاً — تكفي لتغطية فجوتك`
      return `خفّض مصروفاتك الشهرية ${fmt(e*0.2)} فوراً — سيولتك أقصر من شهر ولا ذمم كافية للتحصيل`
    }
    // 4) تحصيل بطيء حقيقي
    if (dso > 90 && recReal > 0) return `سرّع التحصيل: دورتك ${dso.toFixed(0)} يوم — استهدف 60 يوماً`
    // 5) الوضع صحي
    return `حافظ على هامشك فوق 15% وسيولتك فوق 3 أشهر — أنت مؤهل للتمويل`
  })()

  const fundingImpact = Math.min(fundingScore + 15, 100)

  const topRisk = [...risks].sort((a, b) => b.impact - a.impact)[0]
  const executiveSummary = {
    cashFlow: monthlyProfit > 0
      ? `شركتك تحقق تدفقاً نقدياً إيجابياً (+${fmt(monthlyProfit)}/شهر)`
      : `شركتك تسجل خسارة شهرية (${fmt(Math.abs(monthlyProfit))}/شهر)`,
    liquidityAlert: (() => {
      const sd = Math.round(survivalDays)
      const dl = Math.round(daysLeft)
      const extra = (expInflow > 0 && sd > dl) ? ` — ومع دفعتك المتوقعة (${fmt(expInflow)}) تمتد إلى ${days(sd)}` : ''
      if (sd < 30) return `لكن رصيدك يغطي ${days(dl)} فقط من مصروفاتك${extra} — خطر حرج`
      if (sd < 90) return `ورصيدك يغطي ${days(dl)}${extra} — أقل من المعيار الموصى به`
      return `وسيولتك جيدة — تغطي ${days(dl)}${extra}`
    })(),
    priority: topRisk
      ? `أولوية هذا الشهر: ${topRisk.category === 'liquidity' ? (recReal > e*0.5 ? `تحصيل ${fmt(recReal)} من ذممك القابلة للتحصيل` : `خفض المصروفات اليومية من ${Math.round(dailyBurn).toLocaleString('ar-SA')} ريال/يوم`) : topRisk.category === 'profit' ? `أوقف الخسارة: خفّض المصروفات أو ارفع تسعيرك بمقدار ${fmt(Math.abs(monthlyProfit))}` : topRisk.category === 'collection' ? `تسريع التحصيل من ${days(dso)} إلى 60 يوم` : `خفض نسبة الديون تحت 50%`}`
      : `شركتك في وضع جيد — ركّز على التوسع`,
    scoreImpact: topRisk
      ? (topRisk.category === 'liquidity' && recReal > e*0.5)
        ? `التغطية ترتفع من ${days(daysLeft)} إلى ${days(daysLeft + recReal/dailyBurn)} • درجتك ترتفع +15 نقطة`
        : `درجتك ترتفع +8 نقاط بعد التنفيذ`
      : `درجتك مؤهلة للتحسين بالتوسع`
  }

  const rankedRisks = [...risks].sort((a, b) => b.impact - a.impact)

  // Cash Runway
  const cashRunwayDate = dailyBurn > 0 && daysLeft < 90 ? (() => {
    const d = new Date();
    d.setDate(d.getDate() + Math.round(daysLeft));
    return d.toLocaleDateString('ar-SA', { year:'numeric', month:'long', day:'numeric' });
  })() : null;

  return { risks: rankedRisks, actions, impacts, strengths, opportunities, score, scoreLabel, forecast3m, vsMarket, margin, daysLeft, monthlyProfit, fundingScore, fundingWeaknesses, topFundingAction, fundingImpact, executiveSummary, rec, recReal, recCurrent, recLate, recBad, recWriteoff, dailyBurn, cashRunwayDate, distress, distressLabel, distressColor, dso, dr, survivalDays, survivalColor, survivalLabel, effectiveLiquidity, expInflow, upcomingOblig, paperProfit, cashProfit, profitQuality, hasPhantomProfit, uncollectibleGap }
}

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [form, setForm] = useState({ revenue:'', expenses:'', bank_balance:'', debts:'', rec_current:'', rec_late:'', rec_bad:'', employees:'', monthly_payment:'', debt_status:'committed', late_months:'', bank_contacted:'', payment_included:'', years_in_business:'', has_gov_contracts:'', credit_status:'clean', month_timing:'mid', expected_inflow:'', expected_inflow_days:'', upcoming_obligations:'', upcoming_obligations_days:'' })
  const [report, setReport] = useState<any>(null)
  const [saved, setSaved] = useState(false)
  const [isNew, setIsNew] = useState(false)
  const [lastMonth, setLastMonth] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [mobileMenu, setMobileMenu] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [advisorMsg, setAdvisorMsg] = useState('')
  const [loadingAdvisor, setLoadingAdvisor] = useState(false)
  const [whatIfAmount, setWhatIfAmount] = useState('')
  const [whatIfMode, setWhatIfMode] = useState<'collect'|'cut'|'funding'>('collect')
  const [chatMessages, setChatMessages] = useState<{q:string,a:string}[]>([])
  const [chatInput, setChatInput] = useState('')
  const [loadingChat, setLoadingChat] = useState(false)
  const [aiReport, setAiReport] = useState<any>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [fundingOpp, setFundingOpp] = useState<any>(null)
  const [loadingFunding, setLoadingFunding] = useState(false)
  const [activeQuestion, setActiveQuestion] = useState<number|null>(null)
  const [questionAnswer, setQuestionAnswer] = useState<string>('')
  const [loadingQuestion, setLoadingQuestion] = useState(false)
  const [simExpenseCut, setSimExpenseCut] = useState(0)
  const [simCollect, setSimCollect] = useState(0)
  const [sendingAlert, setSendingAlert] = useState(false)
  const [alertSent, setAlertSent] = useState(false)
  const [uploadDocType, setUploadDocType] = useState<'trial'|'bank'>('trial')
  const [extracting, setExtracting] = useState(false)
  const [extractMsg, setExtractMsg] = useState('')
  const [extractedMonths, setExtractedMonths] = useState<any[]>([])
  const [needsInput, setNeedsInput] = useState<string[]>([])
  const [showBuilder, setShowBuilder] = useState(false)
  const [builderStep, setBuilderStep] = useState(0)
  const [builderData, setBuilderData] = useState<any>({})
  const [twinProject, setTwinProject] = useState({description:'',value:'',margin:'',duration:'',paymentDelay:'',needsFunding:false,fundingAmount:''})
  const [twinResult, setTwinResult] = useState<any>(null)
  const [twinLoading, setTwinLoading] = useState(false)
  const [invoices, setInvoices] = useState<any[]>([{value:'',submittedDaysAgo:'',status:'قيد المراجعة',entity:''}])
  const [istikhlasResult, setIstikhlasResult] = useState<any>(null)
  const [istikhlasLoading, setIstikhlasLoading] = useState(false)
  const [tender, setTender] = useState({description:'',value:'',duration:'',entity:''})
  const [bidResult, setBidResult] = useState<any>(null)
  const [bidLoading, setBidLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUser(user)
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)
      const { data: records } = await supabase.from('monthly_data').select('*').eq('user_id', user.id).order('year', { ascending: false }).order('month', { ascending: false })
      if (!records || records.length === 0) {
        setIsNew(true)
      } else {
        setLastMonth(records[0])
        setHistory(records.slice(0, 6))
      }
    }
    getUser()
  }, [])

  const handleAnalyze = async () => {
    const r = generateReport(form)
    setReport(r)
    setAiReport(null)
    setFundingOpp(null)
    setTimeout(() => window.scrollTo({top: 400, behavior: "smooth"}), 200)
    setLoadingReport(true)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: profile?.company_name || 'شركتك',
          revenue: parseFloat(form.revenue)||0,
          expenses: parseFloat(form.expenses)||0,
          bank_balance: parseFloat(form.bank_balance)||0,
          debts: parseFloat(form.debts)||0,
          monthly_payment: parseFloat(form.monthly_payment)||0,
          debt_status: form.debt_status || 'committed',
          late_months: form.late_months || '',
          bank_contacted: form.bank_contacted || '',
          payment_included: form.payment_included || 'yes',
          receivables: (parseFloat(form.rec_current)||0) + (parseFloat(form.rec_late)||0) + (parseFloat(form.rec_bad)||0),
          rec_current: parseFloat(form.rec_current)||0,
          rec_late: parseFloat(form.rec_late)||0,
          rec_bad: parseFloat(form.rec_bad)||0,
          employees: parseInt(form.employees)||0,
          years_in_business: form.years_in_business || '',
          has_gov_contracts: form.has_gov_contracts || 'no',
          credit_status: form.credit_status || 'clean',
          history: history.map((h:any)=>({ month:h.month, year:h.year, revenue:h.revenue, expenses:h.expenses, bank_balance:h.bank_balance, debts:h.debts, receivables:h.receivables, murdi_score:h.murdi_score, funding_score:h.funding_score })),
          month_timing: form.month_timing || 'mid',
          expected_inflow: parseFloat(form.expected_inflow)||0,
          expected_inflow_days: parseInt(form.expected_inflow_days)||0,
          upcoming_obligations: parseFloat(form.upcoming_obligations)||0,
          upcoming_obligations_days: parseInt(form.upcoming_obligations_days)||0,
          murdiScore: r.score,
          fundingScore: r.fundingScore,
          distress: r.distress,
          margin: r.margin,
          daysLeft: r.daysLeft,
          monthlyProfit: r.monthlyProfit,
          dso: r.dso || 0,
          debtRatio: r.dr || 0,
          cashRunwayDate: r.cashRunwayDate || null
        })
      })
      const data = await res.json()
      if (!data.error) setAiReport(data)
    } catch {}
    setLoadingReport(false)
  }

  const handleSave = async () => {
    if (!report) return
    const now = new Date()
    await supabase.from('monthly_data').upsert({
      user_id: user.id, month: now.getMonth()+1, year: now.getFullYear(),
      revenue: parseFloat(form.revenue)||0, expenses: parseFloat(form.expenses)||0,
      bank_balance: parseFloat(form.bank_balance)||0, debts: parseFloat(form.debts)||0,
      receivables: (parseFloat(form.rec_current)||0) + (parseFloat(form.rec_late)||0) + (parseFloat(form.rec_bad)||0), employees: parseInt(form.employees)||0,
      murdi_score: report.score,
      funding_score: report.fundingScore
    })
    const shareId = Math.random().toString(36).substring(2, 10)
    await supabase.from('monthly_data').update({ share_id: shareId }).eq('user_id', user.id).eq('month', now.getMonth()+1).eq('year', now.getFullYear())
    setShareUrl(window.location.origin + '/report/' + shareId)
    setSaved(true)
    setTimeout(()=>setSaved(false), 3000)
  }

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setExtracting(true); setExtractMsg('Murdi يقرأ مستنداتك...'); setExtractedMonths([])
    try {
      const docs = await Promise.all(Array.from(files).slice(0,3).map(async (file) => {
        const data = await new Promise<string>((res, rej) => {
          const r = new FileReader()
          r.onload = () => res((r.result as string).split(',')[1])
          r.onerror = () => rej(new Error('فشل قراءة الملف'))
          r.readAsDataURL(file)
        })
        return { media_type: file.type, data }
      }))
      const res = await fetch('/api/extract', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documents: docs, docType: uploadDocType })
      })
      const result = await res.json()
      if (result.error) { setExtractMsg('⚠️ ' + result.error); setExtracting(false); return }
      const months = result.months || []
      if (months.length === 0) { setExtractMsg('⚠️ لم أتمكن من استخراج أرقام واضحة — جرّب مستنداً أوضح أو أدخل يدوياً'); setExtracting(false); return }
      // الأحدث = آخر شهر في القائمة، نعبّي النموذج به
      const latest = months[months.length - 1]
      setForm(prev => ({ ...prev,
        revenue: String(latest.revenue||0),
        expenses: String(latest.expenses||0),
        bank_balance: String(latest.bank_balance||0),
        debts: String(latest.debts||0),
        rec_current: String(latest.receivables_total||0),
      }))
      setExtractedMonths(months)
      setNeedsInput(result.needsInput || [])
      if (result.needsInput && result.needsInput.length > 0) {
        setExtractMsg(`✅ استخرج Murdi حركتك النقدية — أكمل الأرقام الناقصة بالأسفل ليكتمل التحليل`)
      } else {
        setExtractMsg(`✅ استخرج Murdi ${months.length} ${months.length===1?'شهر':'أشهر'} — راجع الأرقام بالأسفل`)
      }
    } catch (e:any) { setExtractMsg('⚠️ تعذّر المعالجة: ' + e.message) }
    setExtracting(false)
  }

  const sendAlert = async () => {
    if (!report || !user?.email) return
    setSendingAlert(true)
    try {
      await fetch('/api/alert', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: profile?.company_name || 'شركتك',
          email: user.email,
          revenue: parseFloat(form.revenue)||0,
          expenses: parseFloat(form.expenses)||0,
          bank_balance: parseFloat(form.bank_balance)||0,
          debts: parseFloat(form.debts)||0,
          murdiScore: report.score,
          survivalDays: Math.round(report.survivalDays),
          distress: report.distress,
          margin: Number(report.margin).toFixed(1),
          history: history.map((h:any)=>({ month:h.month, year:h.year, revenue:h.revenue, expenses:h.expenses, bank_balance:h.bank_balance, murdi_score:h.murdi_score }))
        })
      })
      setAlertSent(true); setTimeout(()=>setAlertSent(false), 4000)
    } catch {}
    setSendingAlert(false)
  }

  const getAdvisor = async () => {
    if (!report || loadingAdvisor) return
    setLoadingAdvisor(true)
    const topRisk = report.risks[0]?.text || 'لا توجد مخاطر حرجة'
    try {
      const res = await fetch('/api/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: profile?.company_name || 'شركتك',
          balance: parseFloat(form.bank_balance)||0,
          revenue: parseFloat(form.revenue)||0,
          expenses: parseFloat(form.expenses)||0,
          debts: parseFloat(form.debts)||0,
          receivables: (parseFloat(form.rec_current)||0) + (parseFloat(form.rec_late)||0) + (parseFloat(form.rec_bad)||0),
          murdiScore: report.score,
          topRisk,
          cashRunwayDays: report.daysLeft
        })
      })
      const data = await res.json()
      setAdvisorMsg(data.message || '')
    } catch { setAdvisorMsg('تعذر الاتصال بـ Murdi Advisor') }
    setLoadingAdvisor(false)
  }

  const runBid = async () => {
    if (!tender.description.trim() || !report) return
    setBidLoading(true); setBidResult(null)
    try {
      const res = await fetch('/api/bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tender,
          current: {
            revenue: parseFloat(form.revenue)||0,
            expenses: parseFloat(form.expenses)||0,
            bank_balance: parseFloat(form.bank_balance)||0,
            recReal: Math.round(report.recReal),
            debts: parseFloat(form.debts)||0,
            survivalDays: Math.round(report.survivalDays),
            score: report.score,
            employees: parseFloat(form.employees)||0,
            years: form.years_in_business||''
          }
        })
      })
      const data = await res.json()
      if (data.error) setBidResult({ error: data.error })
      else setBidResult(data)
    } catch {
      setBidResult({ error: 'تعذّر تحليل العطاء' })
    }
    setBidLoading(false)
  }

  const runIstikhlas = async () => {
    const valid = invoices.filter(inv => parseFloat(inv.value) > 0)
    if (valid.length === 0 || !report) return
    setIstikhlasLoading(true); setIstikhlasResult(null)
    try {
      const res = await fetch('/api/istikhlas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoices: valid.map(inv => ({
            value: parseFloat(inv.value)||0,
            submittedDaysAgo: parseInt(inv.submittedDaysAgo)||0,
            status: inv.status,
            entity: inv.entity
          })),
          current: { bank_balance: parseFloat(form.bank_balance)||0, expenses: parseFloat(form.expenses)||0 }
        })
      })
      const data = await res.json()
      if (data.error) setIstikhlasResult({ error: data.error })
      else setIstikhlasResult(data)
    } catch {
      setIstikhlasResult({ error: 'تعذّر تحليل المستخلصات' })
    }
    setIstikhlasLoading(false)
  }

  const runTwin = async () => {
    if (!twinProject.description.trim() || !report) return
    setTwinLoading(true); setTwinResult(null)
    try {
      const res = await fetch('/api/twin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current: {
            revenue: parseFloat(form.revenue)||0,
            expenses: parseFloat(form.expenses)||0,
            bank_balance: parseFloat(form.bank_balance)||0,
            recReal: Math.round(report.recReal),
            debts: parseFloat(form.debts)||0,
            monthly_payment: parseFloat(form.monthly_payment)||0,
            survivalDays: Math.round(report.survivalDays),
            score: report.score
          },
          project: twinProject
        })
      })
      const data = await res.json()
      if (data.error) setTwinResult({ error: data.error })
      else setTwinResult(data)
    } catch {
      setTwinResult({ error: 'تعذّر تشغيل المحاكاة' })
    }
    setTwinLoading(false)
  }

  const sendChat = async () => {
    if (!chatInput.trim() || loadingChat || !report) return
    const q = chatInput.trim()
    setChatInput('')
    setLoadingChat(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: profile?.company_name || 'شركتك',
          balance: parseFloat(form.bank_balance)||0,
          revenue: parseFloat(form.revenue)||0,
          expenses: parseFloat(form.expenses)||0,
          debts: parseFloat(form.debts)||0,
          receivables: (parseFloat(form.rec_current)||0) + (parseFloat(form.rec_late)||0) + (parseFloat(form.rec_bad)||0),
          murdiScore: report.score,
          question: q
        })
      })
      const data = await res.json()
      setChatMessages(prev => [...prev, { q, a: data.answer || 'تعذر الرد' }])
    } catch { setChatMessages(prev => [...prev, { q, a: 'تعذر الاتصال' }]) }
    setLoadingChat(false)
  }

  const getFundingOpportunities = async () => {
    if (!report || loadingFunding) return
    // تحقق من الحقول المطلوبة
    if (!form.years_in_business) {
      alert('⚠️ يرجى تحديد عدد سنوات شركتك في السوق أولاً — هذا يؤثر على نتائج التمويل')
      return
    }
    if (!form.has_gov_contracts) {
      alert('⚠️ يرجى تحديد هل لديك عقود حكومية — هذا يفتح منتجات تمويل إضافية')
      return
    }
    setLoadingFunding(true)
    try {
      const res = await fetch('https://padfsejgeywbcxidlbea.supabase.co/functions/v1/funding-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: profile?.company_name || 'شركتك',
          revenue: parseFloat(form.revenue)||0,
          expenses: parseFloat(form.expenses)||0,
          bank_balance: parseFloat(form.bank_balance)||0,
          debts: parseFloat(form.debts)||0,
          monthly_payment: parseFloat(form.monthly_payment)||0,
          receivables: (parseFloat(form.rec_current)||0) + (parseFloat(form.rec_late)||0) + (parseFloat(form.rec_bad)||0),
          employees: parseInt(form.employees)||0,
          murdiScore: report.score,
          fundingScore: report.fundingScore,
          debt_status: form.debt_status || 'committed',
          margin: report.margin,
          years_in_business: parseInt(form.years_in_business)||0,
          has_gov_contracts: form.has_gov_contracts || 'no',
          credit_status: form.credit_status || 'clean'
        })
      })
      const data = await res.json()
      setFundingOpp(data)
    } catch(e) {
      setFundingOpp({error: 'تعذر الاتصال', qualifiedCount:0, nearQualifiedCount:0, mainBarrier:'', opportunities:[], advisorNote:''})
    }
    setLoadingFunding(false)
  }

  const scoreColor = (s: number) => s >= 70 ? '#22c55e' : s >= 40 ? C.gold : '#ef4444'
  const fundingColor = (s: number) => s >= 70 ? '#22c55e' : s >= 50 ? C.gold : '#ef4444'

  // خطوات بناء "صورتك المالية" — أسئلة بلغة بسيطة للمقاول الذي لا يملك ميزان
  const builderSteps = [
    { key:'revenue', q:'كم قيمة العقود والفواتير التي أنجزتها هذا الشهر؟', hint:'كل ما حقّقته من مشاريع — حتى لو لم تُحصّله بعد', placeholder:'500000' },
    { key:'expenses', q:'كم صرفت هذا الشهر إجمالاً؟', hint:'الرواتب + المواد + الإيجار + الفواتير + كل المصروفات', placeholder:'400000' },
    { key:'bank_balance', q:'كم رصيدك في البنك الآن؟', hint:'الرقم الفعلي في حسابك اليوم', placeholder:'150000' },
    { key:'rec_current', q:'كم لك عند العملاء (فواتير لم تُحصّل بعد)؟', hint:'مستحقاتك على مشاريع منجزة — اكتب 0 إن لا يوجد', placeholder:'100000' },
    { key:'debts', q:'كم عليك من قروض أو ديون؟', hint:'إجمالي القروض البنكية والالتزامات — اكتب 0 إن لا يوجد', placeholder:'0' },
    { key:'monthly_payment', q:'كم تدفع شهرياً على هذه الديون؟', hint:'القسط الشهري — اكتب 0 إن لا يوجد', placeholder:'0' },
    { key:'employees', q:'كم عدد موظفيك؟', hint:'العمال والإداريون', placeholder:'25' },
  ]

  const fields = [
    { key:'revenue', label:'الإيرادات الشهرية', placeholder:'500000', tip:'إجمالي ما دخل لشركتك هذا الشهر من مشاريع وعقود — قبل خصم أي مصروفات' },
    { key:'expenses', label:'المصروفات الشهرية', placeholder:'350000', tip:'إجمالي ما صرفته هذا الشهر — رواتب ومواد وإيجارات وفواتير' },
    { key:'bank_balance', label:'الرصيد البنكي', placeholder:'200000', tip:'رصيدك الفعلي في البنك اليوم — ليس الذمم أو الأرباح المتوقعة' },
    { key:'debts', label:'الديون', placeholder:'100000', tip:'إجمالي ما عليك من قروض بنكية أو التزامات مالية مستحقة للغير' },
    { key:'rec_current', label:'ذمم سائلة (أقل من 60 يوم)', placeholder:'100000', tip:'فواتير منجزة وعميلها ملتزم — قابلة للتحصيل قريباً' },
    { key:'rec_late', label:'ذمم متأخرة (60-180 يوم)', placeholder:'30000', tip:'فواتير تأخر سدادها — محتملة التحصيل بمتابعة' },
    { key:'rec_bad', label:'ذمم مشكوك فيها (أكثر من 180 يوم)', placeholder:'20000', tip:'ذمم قديمة أو عميل متعثر — احتمال تحصيلها منخفض' },
  { key:'monthly_payment', label:'القسط الشهري للديون', placeholder:'10000', tip:'المبلغ الذي تدفعه شهرياً — اتركه صفراً إذا لا توجد ديون' },
    { key:'employees', label:'عدد الموظفين', placeholder:'25', tip:'إجمالي عدد موظفيك الحاليين بما فيهم العمال والإداريين' },
    { key:'expected_inflow', label:'دفعات/مستخلصات متوقعة (30 يوم)', placeholder:'300000', tip:'مبلغ تتوقع دخوله خلال 30 يوماً — مستخلص حكومي أو دفعة عميل. اتركه صفراً إن لا يوجد' },
    { key:'expected_inflow_days', label:'بعد كم يوم تتوقع الدفعة؟', placeholder:'7', tip:'كم يوماً يفصلك عن دخول هذه الدفعة تقريباً' },
    { key:'upcoming_obligations', label:'التزامات ثابتة قادمة', placeholder:'200000', tip:'رواتب أو مستحقات ثابتة عليك دفعها قريباً — اتركه صفراً إن لا يوجد' },
    { key:'upcoming_obligations_days', label:'بعد كم يوم الالتزام؟', placeholder:'10', tip:'كم يوماً يفصلك عن موعد هذا الالتزام تقريباً' },

  ]

  if (!user) return <div style={{background:C.navy,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{color:C.gold,fontSize:20}}>...</div></div>

  return (
    <div style={{minHeight:'100vh',background:C.navy,fontFamily:'system-ui',direction:'rtl'}}>

      {/* نافذة بناء صورتك المالية */}
      {showBuilder && (() => {
        const step = builderSteps[builderStep]
        const isLast = builderStep === builderSteps.length - 1
        return (
          <div style={{position:'fixed',inset:0,background:'#00000099',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setShowBuilder(false)}>
            <div onClick={e=>e.stopPropagation()} style={{background:C.navyLight,borderRadius:20,padding:'32px',maxWidth:480,width:'100%',border:`2px solid ${C.gold}50`,boxShadow:'0 20px 60px #000'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <div style={{color:C.gold,fontSize:17,fontWeight:800}}>🖼️ صورتك المالية مع Murdi</div>
                <button onClick={()=>setShowBuilder(false)} style={{background:'transparent',border:'none',color:C.gray,fontSize:22,cursor:'pointer'}}>×</button>
              </div>
              <div style={{height:6,background:C.navy,borderRadius:4,marginBottom:24,overflow:'hidden'}}>
                <div style={{height:'100%',background:C.gold,width:`${((builderStep+1)/builderSteps.length)*100}%`,transition:'width 0.3s'}}/>
              </div>
              <div style={{color:C.gray,fontSize:12,marginBottom:8}}>سؤال {builderStep+1} من {builderSteps.length}</div>
              <div style={{color:C.white,fontSize:18,fontWeight:700,marginBottom:8,lineHeight:1.5}}>{step.q}</div>
              <div style={{color:'#5a7a99',fontSize:13,marginBottom:18,lineHeight:1.5}}>{step.hint}</div>
              <input autoFocus type="number" value={builderData[step.key]||''}
                onChange={e=>setBuilderData({...builderData,[step.key]:e.target.value})}
                onKeyDown={e=>{if(e.key==='Enter'){if(isLast){const nd={...form,...builderData};setForm(nd);setShowBuilder(false);} else setBuilderStep(builderStep+1)}}}
                placeholder={step.placeholder}
                style={{width:'100%',padding:'14px 16px',borderRadius:10,border:`1px solid ${C.border}`,background:C.navy,color:C.white,fontSize:16,boxSizing:'border-box',marginBottom:20}} />
              <div style={{display:'flex',gap:10}}>
                {builderStep>0 && (
                  <button onClick={()=>setBuilderStep(builderStep-1)} style={{flex:1,padding:'14px',borderRadius:10,border:`1px solid ${C.border}`,background:'transparent',color:C.white,fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>السابق</button>
                )}
                <button onClick={()=>{
                  if(isLast){const nd={...form,...builderData};setForm(nd);setShowBuilder(false);}
                  else setBuilderStep(builderStep+1)
                }} style={{flex:2,padding:'14px',borderRadius:10,border:'none',background:`linear-gradient(135deg,${C.gold},${C.goldLight})`,color:C.navy,fontSize:15,fontWeight:800,cursor:'pointer',fontFamily:'inherit'}}>
                  {isLast ? '✓ اكتملت صورتك — املأ النموذج' : 'التالي'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      <div style={{background:C.navyLight,padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:`1px solid ${C.border}`,position:'sticky',top:0,zIndex:100}}>
        <div style={{display:'flex',flexDirection:'column',alignItems:'flex-start'}}>
          <div style={{fontSize:20,fontWeight:900,color:C.gold,letterSpacing:2,lineHeight:1}}>MURDI</div>
          <div style={{fontSize:11,color:C.gold,opacity:0.7,letterSpacing:1}}>مُرضي</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{textAlign:'right'}}>
            <div style={{color:C.white,fontWeight:700,fontSize:13}}>{profile?.company_name||'شركتك'}</div>
          </div>
          <button onClick={()=>setMobileMenu(!mobileMenu)} style={{padding:'8px 12px',borderRadius:8,border:`1px solid ${C.border}`,background:'transparent',color:C.white,cursor:'pointer',fontSize:20,lineHeight:1}}>☰</button>
        </div>
      </div>
      {mobileMenu && (
        <div style={{background:C.navyLight,borderBottom:`1px solid ${C.border}`,padding:'12px 20px',display:'flex',flexDirection:'column',gap:8,position:'sticky',top:53,zIndex:99}}>
          <div style={{color:C.gray,fontSize:12,padding:'4px 0'}}>{user.email}</div>
          <button onClick={()=>{router.push('/dashboard/trends');setMobileMenu(false)}} style={{padding:'12px',borderRadius:8,border:`1px solid ${C.border}`,background:'transparent',color:C.gray,cursor:'pointer',fontSize:14,textAlign:'right'}}>📈 Trends</button>
          <button onClick={()=>{router.push('/dashboard/memory');setMobileMenu(false)}} style={{padding:'12px',borderRadius:8,border:`1px solid ${C.gold}`,background:'transparent',color:C.gold,cursor:'pointer',fontSize:14,textAlign:'right'}}>🧠 Company Memory</button>
          <button onClick={()=>{router.push('/dashboard/certificate');setMobileMenu(false)}} style={{padding:'12px',borderRadius:8,border:`1px solid ${C.gold}`,background:'transparent',color:C.gold,cursor:'pointer',fontSize:14,textAlign:'right'}}>🏅 الشهادة</button>
          <button onClick={()=>{router.push('/dashboard/market');setMobileMenu(false)}} style={{padding:'12px',borderRadius:8,border:`1px solid ${C.gold}`,background:'transparent',color:C.gold,cursor:'pointer',fontSize:14,textAlign:'right'}}>📊 مقارنة السوق</button>
          <button onClick={async()=>{await supabase.auth.signOut();router.push('/auth/login')}} style={{padding:'12px',borderRadius:8,border:'1px solid #ef444440',background:'transparent',color:'#ef4444',cursor:'pointer',fontSize:14,textAlign:'right'}}>🚪 تسجيل الخروج</button>
        </div>
      )}

      <div style={{maxWidth:900,margin:'0 auto',padding:'20px 16px'}}>
        {isNew && (
          <div style={{background:'linear-gradient(135deg,#1a3a6e,#112244)',borderRadius:16,padding:'32px',marginBottom:24,border:`1px solid ${C.gold}`,textAlign:'center'}}>
            <div style={{fontSize:24,fontWeight:900,color:C.gold,marginBottom:8}}>أهلاً {profile?.company_name}! 🎉</div>
            <div style={{color:C.white,fontSize:16,marginBottom:8}}>هذا أول تقرير Murdi لك</div>
            <div style={{color:C.gray,fontSize:14}}>أدخل بيانات شركتك واحصل على تحليل مالي ذكي في 15 ثانية</div>
          </div>
        )}

        {lastMonth && (
          <div style={{background:'#0a1f0a',borderRadius:12,padding:'14px 20px',marginBottom:16,border:'1px solid #22c55e30',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
            <div style={{color:'#22c55e',fontSize:14,fontWeight:700}}>📊 آخر تقرير محفوظ — الشهر {lastMonth.month} / {lastMonth.year}</div>
            <div style={{display:'flex',gap:16,alignItems:'center'}}>
              <div style={{textAlign:'center'}}><div style={{color:C.gray,fontSize:11}}>Murdi Score</div><div style={{color:C.gold,fontSize:18,fontWeight:900}}>{lastMonth.murdi_score}/85</div></div>
              <div style={{textAlign:'center'}}><div style={{color:C.gray,fontSize:11}}>الإيرادات</div><div style={{color:C.white,fontSize:14,fontWeight:700}}>{lastMonth.revenue?.toLocaleString('ar-SA')} ر.س</div></div>
              <button onClick={()=>router.push('/dashboard/memory')} style={{padding:'8px 16px',borderRadius:8,border:`1px solid ${C.gold}`,background:'transparent',color:C.gold,cursor:'pointer',fontSize:12}}>عرض الذاكرة →</button>
            </div>
          </div>
        )}

        {/* منطقة رفع المستندات — استخراج ذكي عبر Murdi */}
        <div style={{background:'linear-gradient(135deg,#0f1f3a,#0a1628)',borderRadius:16,padding:'28px',border:`2px solid ${C.gold}40`,marginBottom:24}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
            <span style={{fontSize:20}}>📄</span>
            <div style={{color:C.gold,fontSize:17,fontWeight:800}}>دع Murdi يقرأ مستنداتك</div>
          </div>
          <div style={{color:C.gray,fontSize:13,marginBottom:20,lineHeight:1.7}}>بدل الإدخال اليدوي — ارفع مستندك ويستخرج Murdi الأرقام تلقائياً. <span style={{color:C.gold}}>ارفع آخر 3 أشهر</span> ليكتشف أنماطك من اليوم الأول، أو ابدأ بشهر واحد.</div>

          <div style={{display:'flex',gap:10,marginBottom:18,flexWrap:'wrap'}}>
            <button onClick={()=>setUploadDocType('trial')} style={{flex:1,minWidth:160,padding:'14px',borderRadius:10,border:`1px solid ${uploadDocType==='trial'?C.gold:C.border}`,background:uploadDocType==='trial'?C.gold:'transparent',color:uploadDocType==='trial'?C.navy:C.white,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
              📊 ميزان مراجعة <span style={{fontSize:11,opacity:0.8}}>(الأدق)</span>
            </button>
            <button onClick={()=>setUploadDocType('bank')} style={{flex:1,minWidth:160,padding:'14px',borderRadius:10,border:`1px solid ${uploadDocType==='bank'?C.gold:C.border}`,background:uploadDocType==='bank'?C.gold:'transparent',color:uploadDocType==='bank'?C.navy:C.white,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
              🏦 كشف حساب بنكي
            </button>
          </div>

          <div style={{textAlign:'center',margin:'4px 0 14px'}}>
            <button onClick={()=>{setShowBuilder(true);setBuilderStep(0);setBuilderData({})}}
              style={{background:'transparent',border:'none',color:'#7dd3fc',fontSize:13,cursor:'pointer',fontFamily:'inherit',textDecoration:'underline'}}>
              ما عندك مستند؟ دع Murdi يبني صورتك المالية بأسئلة بسيطة ←
            </button>
          </div>

          <label style={{display:'block',cursor:'pointer'}}>
            <input type="file" accept=".pdf,image/*" multiple onChange={e=>handleUpload(e.target.files)} style={{display:'none'}} disabled={extracting} />
            <div style={{border:`2px dashed ${C.gold}60`,borderRadius:12,padding:'32px',textAlign:'center',background:'#0a142080',transition:'all 0.3s'}}>
              <div style={{fontSize:36,marginBottom:8}}>{extracting?'⏳':'⬆️'}</div>
              <div style={{color:C.white,fontSize:15,fontWeight:700,marginBottom:4}}>{extracting?'Murdi يقرأ ويحلل...':'اضغط لرفع المستند'}</div>
              <div style={{color:C.gray,fontSize:12}}>PDF أو صورة — حتى 3 ملفات ({uploadDocType==='trial'?'ميزان مراجعة':'كشف حساب'})</div>
            </div>
          </label>

          {extractMsg && (
            <div style={{marginTop:16,padding:'14px 18px',borderRadius:10,background:extractMsg.startsWith('✅')?'#0a2d1a':extractMsg.startsWith('⚠️')?'#2d1a0a':'#112244',border:`1px solid ${extractMsg.startsWith('✅')?'#22c55e40':extractMsg.startsWith('⚠️')?'#f9731640':C.border}`,color:C.white,fontSize:13,lineHeight:1.7}}>{extractMsg}</div>
          )}

          {needsInput.length > 0 && (
            <div style={{marginTop:14,padding:'18px',background:'linear-gradient(135deg,#1a1505,#0f0c02)',borderRadius:12,border:`1px solid ${C.gold}50`}}>
              <div style={{color:C.gold,fontSize:14,fontWeight:800,marginBottom:8}}>📝 أكمل الصورة — 3 أرقام يحتاجها Murdi</div>
              <div style={{color:C.white,fontSize:13,lineHeight:1.9,marginBottom:6}}>كشف الحساب أظهر حركتك النقدية، لكنه لا يكشف:</div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {needsInput.includes('receivables') && <div style={{color:'#7dd3fc',fontSize:13}}>• ذممك المدينة (المبالغ المستحقة لك من العملاء) — صنفها بالأسفل</div>}
                {needsInput.includes('debts') && <div style={{color:'#7dd3fc',fontSize:13}}>• ديونك وقروضك — أدخلها في خانة الديون</div>}
                {needsInput.includes('monthly_payment') && <div style={{color:'#7dd3fc',fontSize:13}}>• القسط الشهري — أدخله في خانته</div>}
              </div>
              <div style={{color:C.gray,fontSize:12,marginTop:10,lineHeight:1.7}}>💡 للتحليل الأدق مستقبلاً، ارفع <span style={{color:C.gold}}>ميزان المراجعة</span> — يحتوي كل شيء في مستند واحد.</div>
            </div>
          )}

          {extractedMonths.length > 1 && (
            <div style={{marginTop:14,padding:'16px',background:'#0a1420',borderRadius:10,border:`1px solid ${C.border}`}}>
              <div style={{color:C.gold,fontSize:12,fontWeight:700,marginBottom:10}}>📅 الأشهر المستخرجة (ستُحفظ كتاريخ لذاكرة Murdi)</div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {extractedMonths.map((m:any,i:number)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:12,color:C.gray,padding:'6px 0',borderBottom:i<extractedMonths.length-1?`1px solid ${C.border}`:'none'}}>
                    <span>{m.month}/{m.year}</span>
                    <span>إيراد {Number(m.revenue||0).toLocaleString('ar-SA')} • ربح {Number((m.revenue||0)-(m.expenses||0)).toLocaleString('ar-SA')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{marginTop:16,textAlign:'center',color:C.gray,fontSize:12}}>— أو أدخل أرقامك يدوياً بالأسفل —</div>
        </div>

        <div style={{background:C.navyLight,borderRadius:16,padding:'32px',border:`1px solid ${C.border}`,marginBottom:24}}>
          <div style={{color:C.white,fontSize:18,fontWeight:700,marginBottom:24}}>بيانات الشهر الحالي</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:16}}>
            {fields.map(f => (
              <div key={f.key}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                  <div style={{color:C.gray,fontSize:13}}>{f.label}</div>
                  {f.tip && <div title={f.tip} style={{width:18,height:18,borderRadius:'50%',background:'#1E3A6E',color:C.gray,fontSize:11,display:'flex',alignItems:'center',justifyContent:'center',cursor:'help',flexShrink:0}}>?</div>}
                </div>
                {f.tip && <div style={{color:'#5a7a99',fontSize:11,marginBottom:6,lineHeight:1.4}}>{f.tip}</div>}
                <input value={form[f.key as keyof typeof form]} onChange={e=>setForm({...form,[f.key]:e.target.value})}
                  placeholder={f.placeholder}
                  style={{width:'100%',padding:'12px 14px',borderRadius:8,border:`1px solid ${C.border}`,background:C.navy,color:C.white,fontSize:15,boxSizing:'border-box'}} />
              </div>
            ))}
          </div>

          {/* توقيت الشهر — ذكاء سياقي للسيولة */}
          <div style={{marginTop:12,padding:'20px',background:C.navy,borderRadius:12,border:`1px solid ${C.border}`}}>
            <div style={{color:C.gray,fontSize:13,marginBottom:4}}>أين أنت في دورة الشهر؟</div>
            <div style={{color:'#5a7a99',fontSize:11,marginBottom:10,lineHeight:1.4}}>يساعد Murdi على تفسير رصيدك بدقة — الرصيد المنخفض أول الشهر يختلف عن آخره</div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {[
                {value:'start', label:'🌅 بداية الشهر'},
                {value:'mid', label:'☀️ منتصف الشهر'},
                {value:'end', label:'🌙 نهاية الشهر'},
              ].map(opt => (
                <button key={opt.value} onClick={()=>setForm({...form,month_timing:opt.value})}
                  style={{flex:1,minWidth:100,padding:'12px',borderRadius:8,border:`1px solid ${form.month_timing===opt.value?C.gold:C.border}`,background:form.month_timing===opt.value?C.gold:C.navy,color:form.month_timing===opt.value?C.navy:C.white,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>{opt.label}</button>
              ))}
            </div>
          </div>

          {parseFloat(form.debts) > 0 && (
            <div style={{marginTop:12,padding:'20px',background:C.navy,borderRadius:12,border:`1px solid ${C.border}`,display:'flex',flexDirection:'column',gap:16}}>
              
              {/* حالة الديون */}
              <div>
                <div style={{color:C.gray,fontSize:13,marginBottom:10}}>حالة الديون الحالية</div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {[
                    {value:'committed', label:'✅ ملتزم بالسداد', color:'#22c55e'},
                    {value:'late', label:'⚠️ متأخر عن القسط', color:C.gold},
                    {value:'default', label:'🔴 متعثر عن السداد', color:'#ef4444'},
                  ].map(opt => (
                    <button key={opt.value} onClick={()=>setForm({...form, debt_status:opt.value, late_months:'', bank_contacted:''})}
                      style={{padding:'8px 16px',borderRadius:20,border:`2px solid ${form.debt_status===opt.value?opt.color:C.border}`,background:form.debt_status===opt.value?opt.color+'20':'transparent',color:form.debt_status===opt.value?opt.color:C.gray,cursor:'pointer',fontSize:13,fontWeight:form.debt_status===opt.value?700:400}}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* إذا متأخر — كم شهر */}
              {form.debt_status === 'late' && (
                <div>
                  <div style={{color:C.gold,fontSize:13,marginBottom:10}}>كم شهر التأخر؟</div>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                    {[
                      {value:'1-2', label:'1-2 شهر'},
                      {value:'3-6', label:'3-6 أشهر'},
                      {value:'6+', label:'أكثر من 6 أشهر'},
                    ].map(opt => (
                      <button key={opt.value} onClick={()=>setForm({...form, late_months:opt.value})}
                        style={{padding:'8px 16px',borderRadius:20,border:`2px solid ${form.late_months===opt.value?C.gold:C.border}`,background:form.late_months===opt.value?C.gold+'20':'transparent',color:form.late_months===opt.value?C.gold:C.gray,cursor:'pointer',fontSize:13}}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* إذا متعثر — تفاصيل */}
              {form.debt_status === 'default' && (
                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  <div>
                    <div style={{color:'#ef4444',fontSize:13,marginBottom:10}}>منذ متى توقفت عن السداد؟</div>
                    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                      {[
                        {value:'1-3', label:'أقل من 3 أشهر'},
                        {value:'3-6', label:'3-6 أشهر'},
                        {value:'6+', label:'أكثر من 6 أشهر'},
                      ].map(opt => (
                        <button key={opt.value} onClick={()=>setForm({...form, late_months:opt.value})}
                          style={{padding:'8px 16px',borderRadius:20,border:`2px solid ${form.late_months===opt.value?'#ef4444':C.border}`,background:form.late_months===opt.value?'#ef444420':'transparent',color:form.late_months===opt.value?'#ef4444':C.gray,cursor:'pointer',fontSize:13}}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{color:'#ef4444',fontSize:13,marginBottom:10}}>هل تواصلت مع البنك؟</div>
                    <div style={{display:'flex',gap:8}}>
                      {[
                        {value:'yes', label:'✅ نعم، جاري التفاوض'},
                        {value:'no', label:'❌ لا، لم أتواصل بعد'},
                      ].map(opt => (
                        <button key={opt.value} onClick={()=>setForm({...form, bank_contacted:opt.value})}
                          style={{padding:'8px 16px',borderRadius:20,border:`2px solid ${form.bank_contacted===opt.value?'#ef4444':C.border}`,background:form.bank_contacted===opt.value?'#ef444420':'transparent',color:form.bank_contacted===opt.value?'#ef4444':C.gray,cursor:'pointer',fontSize:13}}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* هل القسط مشمول في المصروفات */}
              {parseFloat(form.monthly_payment) > 0 && (
                <div>
                  <div style={{color:C.gray,fontSize:13,marginBottom:10}}>هل القسط الشهري مشمول في المصروفات التي أدخلتها؟</div>
                  <div style={{display:'flex',gap:8}}>
                    {[
                      {value:'yes', label:'نعم، مشمول'},
                      {value:'no', label:'لا، غير مشمول'},
                    ].map(opt => (
                      <button key={opt.value} onClick={()=>setForm({...form, payment_included:opt.value})}
                        style={{padding:'8px 16px',borderRadius:20,border:`2px solid ${form.payment_included===opt.value?C.gold:C.border}`,background:form.payment_included===opt.value?C.gold+'20':'transparent',color:form.payment_included===opt.value?C.gold:C.gray,cursor:'pointer',fontSize:13}}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
          {/* حقول إضافية لتحليل التمويل */}
          <div style={{marginTop:16,padding:'16px',background:C.navy,borderRadius:12,border:`1px solid ${C.gold}30`}}>
            <div style={{color:C.gold,fontSize:13,fontWeight:700,marginBottom:12}}>🏦 معلومات إضافية لتحليل فرص التمويل</div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div>
                <div style={{color:C.gray,fontSize:12,marginBottom:6}}>كم سنة شركتك في السوق؟</div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {[{v:'1',l:'أقل من سنة'},{v:'2',l:'1-2 سنة'},{v:'3',l:'3-5 سنوات'},{v:'7',l:'5-10 سنوات'},{v:'11',l:'أكثر من 10 سنوات'}].map(opt=>(
                    <button key={opt.v} onClick={()=>setForm({...form,years_in_business:opt.v})}
                      style={{padding:'6px 14px',borderRadius:20,border:`1px solid ${form.years_in_business===opt.v?C.gold:C.border}`,background:form.years_in_business===opt.v?C.gold+'20':'transparent',color:form.years_in_business===opt.v?C.gold:C.gray,cursor:'pointer',fontSize:12}}>
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{color:C.gray,fontSize:12,marginBottom:6}}>هل لديك عقود حكومية نشطة؟</div>
                <div style={{display:'flex',gap:8}}>
                  {[{v:'yes',l:'✅ نعم'},{v:'no',l:'❌ لا'},{v:'pending',l:'⏳ قيد الإرساء'}].map(opt=>(
                    <button key={opt.v} onClick={()=>setForm({...form,has_gov_contracts:opt.v})}
                      style={{padding:'6px 14px',borderRadius:20,border:`1px solid ${form.has_gov_contracts===opt.v?C.gold:C.border}`,background:form.has_gov_contracts===opt.v?C.gold+'20':'transparent',color:form.has_gov_contracts===opt.v?C.gold:C.gray,cursor:'pointer',fontSize:12}}>
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{color:C.gray,fontSize:12,marginBottom:6}}>السجل الائتماني للشركة</div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {[{v:'clean',l:'✅ نظيف بدون ملاحظات',c:'#22c55e'},{v:'minor',l:'🟡 ملاحظات بسيطة',c:C.gold},{v:'major',l:'🔴 ملاحظات جوهرية',c:'#ef4444'}].map(opt=>(
                    <button key={opt.v} onClick={()=>setForm({...form,credit_status:opt.v})}
                      style={{padding:'6px 14px',borderRadius:20,border:`1px solid ${form.credit_status===opt.v?opt.c:C.border}`,background:form.credit_status===opt.v?opt.c+'20':'transparent',color:form.credit_status===opt.v?opt.c:C.gray,cursor:'pointer',fontSize:12}}>
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <button onClick={handleAnalyze} style={{marginTop:24,width:'100%',padding:'16px',borderRadius:8,border:'none',background:`linear-gradient(135deg,${C.gold},${C.goldLight})`,color:C.navy,fontSize:17,fontWeight:800,cursor:'pointer'}}>
            🔍 احلل وأظهر التقرير الذكي
          </button>
        </div>

        {report && loadingReport && !aiReport && (
          <div style={{background:'linear-gradient(135deg,#0d2a1a,#0a1f15)',borderRadius:16,padding:'48px 28px',border:'2px solid #22c55e40',textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,margin:'0 0 16px'}}>
            <div style={{fontSize:48}}>📊</div>
            <div style={{color:'#22c55e',fontSize:20,fontWeight:800}}>Murdi يحلل شركتك</div>
            <div style={{color:C.gray,fontSize:14,lineHeight:1.8}}>جاري إعداد تقريرك الذكي المخصص</div>
            <div style={{display:'flex',gap:8,marginTop:8,flexWrap:'wrap',justifyContent:'center'}}>
              {['السيولة','الربحية','المخاطر','الفرص'].map((item,i) => (
                <div key={i} style={{background:'#22c55e20',border:'1px solid #22c55e40',borderRadius:20,padding:'4px 12px',color:'#22c55e',fontSize:12}}>{item}</div>
              ))}
            </div>
          </div>
        )}

        {report && (!loadingReport || aiReport) && (
          <div style={{display:'flex',flexDirection:'column',gap:16}}>


            {aiReport?.advisorNote && (
              <div style={{background:'linear-gradient(135deg,#0d2a1a,#0a1f15)',borderRadius:16,padding:'28px',border:'2px solid #22c55e60'}}>
                <div style={{color:'#22c55e',fontSize:16,fontWeight:800,marginBottom:16}}>🤖 Murdi Advisor™️</div>
                <div style={{color:C.white,fontSize:15,lineHeight:2,whiteSpace:'pre-line',borderRight:'4px solid #22c55e',paddingRight:16}}>{aiReport.advisorNote}</div>
              </div>
            )}
            {/* السبب الجذري */}
            {aiReport?.rootCause && (
              <div style={{background:'linear-gradient(135deg,#1a0a2d,#0f0520)',borderRadius:16,padding:'24px',border:'2px solid #a855f760'}}>
                <div style={{color:'#a855f7',fontSize:14,fontWeight:800,marginBottom:10,letterSpacing:1}}>🔍 السبب الجذري — منهجية د. عبدالحكيم</div>
                <div style={{color:C.white,fontSize:15,lineHeight:1.8,borderRight:'4px solid #a855f7',paddingRight:16}}>{aiReport.rootCause}</div>
              </div>
            )}

            {/* ذاكرة Murdi الزمنية */}
            {(aiReport?.patternInsight || aiReport?.decisionImpact) && (
              <div style={{background:'linear-gradient(135deg,#0a1a2d,#05101a)',borderRadius:16,padding:'24px',border:'2px solid #38bdf850'}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
                  <span style={{fontSize:18}}>🧬</span>
                  <div style={{color:'#38bdf8',fontSize:15,fontWeight:800,letterSpacing:1}}>ذاكرة Murdi — ما يعرفه عن رحلتك</div>
                </div>
                {aiReport?.patternInsight && (
                  <div style={{marginBottom:aiReport?.decisionImpact?14:0}}>
                    <div style={{color:'#7dd3fc',fontSize:12,fontWeight:700,marginBottom:6}}>📈 نمط اكتشفه Murdi عبر الأشهر</div>
                    <div style={{color:C.white,fontSize:14,lineHeight:1.8,borderRight:'4px solid #38bdf8',paddingRight:14}}>{aiReport.patternInsight}</div>
                  </div>
                )}
                {aiReport?.decisionImpact && (
                  <div>
                    <div style={{color:'#7dd3fc',fontSize:12,fontWeight:700,marginBottom:6}}>⚖️ أثر التغيّرات في أرقامك</div>
                    <div style={{color:C.white,fontSize:14,lineHeight:1.8,borderRight:'4px solid #38bdf8',paddingRight:14}}>{aiReport.decisionImpact}</div>
                  </div>
                )}
              </div>
            )}

            {/* السيناريوهات الثلاثة */}
            {aiReport?.scenarios && (
              <div style={{background:'linear-gradient(135deg,#0d1f3a,#112244)',borderRadius:16,padding:'28px',border:`1px solid ${C.border}`}}>
                <div style={{color:C.gold,fontSize:16,fontWeight:800,marginBottom:6,letterSpacing:1}}>🔮 السيناريوهات الثلاثة — خلال 90 يوما</div>
                <div style={{color:C.gray,fontSize:12,marginBottom:20}}>بناءً على منهجية د. عبدالحكيم المرضي المالية</div>
                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  <div style={{background:'#2d0a0a',borderRadius:12,padding:'16px',border:'1px solid #ef444430'}}>
                    <div style={{color:'#ef4444',fontSize:12,fontWeight:800,marginBottom:8}}>⛔ السيناريو الأسوأ — إذا لم تتحرك</div>
                    <div style={{color:'#ffaaaa',fontSize:14,lineHeight:1.7}}>{aiReport.scenarios.worst}</div>
                  </div>
                  <div style={{background:'#1a1a0a',borderRadius:12,padding:'16px',border:'1px solid #F5C84230'}}>
                    <div style={{color:C.gold,fontSize:12,fontWeight:800,marginBottom:8}}>⚡ السيناريو الواقعي — إجراء واحد</div>
                    <div style={{color:'#ffe599',fontSize:14,lineHeight:1.7}}>{aiReport.scenarios.realistic}</div>
                  </div>
                  <div style={{background:'#0a2d1a',borderRadius:12,padding:'16px',border:'1px solid #22c55e30'}}>
                    <div style={{color:'#22c55e',fontSize:12,fontWeight:800,marginBottom:8}}>🚀 السيناريو الأمثل — كل التوصيات</div>
                    <div style={{color:'#aaffcc',fontSize:14,lineHeight:1.7}}>{aiReport.scenarios.best}</div>
                  </div>
                </div>
              </div>
            )}

            {/* مؤشر الأسبوع + مسار التمويل */}
            {(aiReport?.weeklyPulse || aiReport?.fundingPath) && (
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                {aiReport?.weeklyPulse && (
                  <div style={{background:'linear-gradient(135deg,#0a1f2d,#051520)',borderRadius:16,padding:'24px',border:'1px solid #38bdf830'}}>
                    <div style={{color:'#38bdf8',fontSize:14,fontWeight:800,marginBottom:10}}>📡 راقب هذا الأسبوع</div>
                    <div style={{color:C.white,fontSize:14,lineHeight:1.7}}>{aiReport.weeklyPulse}</div>
                  </div>
                )}
                {aiReport?.fundingPath && (
                  <div style={{background:'linear-gradient(135deg,#0a2d1a,#051a0f)',borderRadius:16,padding:'24px',border:'1px solid #22c55e30'}}>
                    <div style={{color:'#22c55e',fontSize:14,fontWeight:800,marginBottom:10}}>🏦 مسار التمويل المناسب</div>
                    <div style={{color:C.white,fontSize:14,lineHeight:1.7}}>{aiReport.fundingPath}</div>
                  </div>
                )}
              </div>
            )}

            {/* Murdi Proactive Intelligence — الأسئلة الاستباقية */}
            {aiReport?.proactiveQuestions && aiReport.proactiveQuestions.length > 0 && (
              <div style={{background:'linear-gradient(135deg,#1a0d2e,#0d0820)',borderRadius:16,padding:'28px',border:'1px solid #a855f740'}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                  <span style={{fontSize:18}}>🧠</span>
                  <div style={{color:'#c084fc',fontSize:16,fontWeight:800,letterSpacing:1}}>Murdi يسألك</div>
                </div>
                <div style={{color:C.gray,fontSize:12,marginBottom:20}}>لاحظت أشياء في أرقامك — دعني أفهم أكثر لأعطيك تحليلاً أعمق</div>
                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  {aiReport.proactiveQuestions.map((q:any, i:number) => (
                    <div key={i} style={{background:'#0d0820',borderRadius:12,padding:'18px',border:'1px solid #a855f730'}}>
                      <div style={{color:'#c084fc',fontSize:12,fontWeight:700,marginBottom:6}}>💡 {q.trigger}</div>
                      <div style={{color:C.white,fontSize:15,fontWeight:700,marginBottom:14,lineHeight:1.6}}>{q.question}</div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                        {(q.options||[]).map((opt:string, j:number) => (
                          <button key={j} onClick={async () => {
                            setActiveQuestion(i); setQuestionAnswer(''); setLoadingQuestion(true)
                            try {
                              const res = await fetch('/api/chat', {
                                method:'POST', headers:{'Content-Type':'application/json'},
                                body: JSON.stringify({
                                  message: `بخصوص ملاحظتك: "${q.trigger}". سؤالك كان: "${q.question}". إجابتي: "${opt}". الآن حلل هذا السبب بعمق وأعطني خطة عملية محددة بالأرقام لمعالجته، مبنية على وضع شركتي ومنهجية د. عبدالحكيم وواقع قطاع المقاولات السعودي.`,
                                  context: { companyName: profile?.company_name, ...form, murdiScore: report.score }
                                })
                              })
                              const data = await res.json()
                              setQuestionAnswer(data.reply || data.answer || 'تعذّر التحليل، حاول مرة أخرى')
                            } catch { setQuestionAnswer('تعذّر الاتصال، حاول مرة أخرى') }
                            setLoadingQuestion(false)
                          }} style={{background: activeQuestion===i ? '#a855f7' : '#1a1030', color: activeQuestion===i ? '#fff' : '#c084fc', border:'1px solid #a855f750', borderRadius:8, padding:'8px 14px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit'}}>{opt}</button>
                        ))}
                      </div>
                      {activeQuestion===i && (
                        <div style={{marginTop:14, padding:'16px', background:'#150a28', borderRadius:10, border:'1px solid #a855f730'}}>
                          {loadingQuestion ? (
                            <div style={{color:'#c084fc',fontSize:13}}>⏳ Murdi يحلل إجابتك...</div>
                          ) : (
                            <div style={{color:C.white,fontSize:14,lineHeight:1.9,whiteSpace:'pre-line'}}>{questionAnswer}</div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* بطاقة تصنيف الذمم */}
            {(report.recCurrent > 0 || report.recLate > 0 || report.recBad > 0) && (
              <div style={{background:'linear-gradient(135deg,#0d1f3a,#112244)',borderRadius:16,padding:'28px',border:`1px solid ${C.border}`}}>
                <div style={{color:C.gold,fontSize:16,fontWeight:800,marginBottom:6,letterSpacing:1}}>🔬 تحليل الذمم الحقيقية</div>
                <div style={{color:C.gray,fontSize:12,marginBottom:20}}>Murdi يحسب ما يمكن تحصيله فعلاً — لا ما هو مكتوب في الدفاتر</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
                  <div style={{background:'#0a2d1a',borderRadius:12,padding:'16px',border:'1px solid #22c55e30',textAlign:'center'}}>
                    <div style={{fontSize:11,color:'#22c55e',marginBottom:6,fontWeight:700}}>🟢 ذمم سائلة</div>
                    <div style={{fontSize:20,fontWeight:900,color:'#22c55e'}}>{report.recCurrent.toLocaleString('ar-SA')}</div>
                    <div style={{fontSize:10,color:C.gray,marginTop:4}}>ر.س • أقل من 60 يوم</div>
                    <div style={{fontSize:10,color:'#22c55e',marginTop:6,fontWeight:700}}>تحتسب 100%</div>
                  </div>
                  <div style={{background:'#2d1a0a',borderRadius:12,padding:'16px',border:'1px solid #f9731630',textAlign:'center'}}>
                    <div style={{fontSize:11,color:'#f97316',marginBottom:6,fontWeight:700}}>🟠 ذمم متأخرة</div>
                    <div style={{fontSize:20,fontWeight:900,color:'#f97316'}}>{report.recLate.toLocaleString('ar-SA')}</div>
                    <div style={{fontSize:10,color:C.gray,marginTop:4}}>ر.س • 60-180 يوم</div>
                    <div style={{fontSize:10,color:'#f97316',marginTop:6,fontWeight:700}}>تُحتسب 40%</div>
                  </div>
                  <div style={{background:'#2d0a0a',borderRadius:12,padding:'16px',border:'1px solid #ef444430',textAlign:'center'}}>
                    <div style={{fontSize:11,color:'#ef4444',marginBottom:6,fontWeight:700}}>🔴 ذمم مشكوك فيها</div>
                    <div style={{fontSize:20,fontWeight:900,color:'#ef4444'}}>{report.recBad.toLocaleString('ar-SA')}</div>
                    <div style={{fontSize:10,color:C.gray,marginTop:4}}>ر.س • أكثر من 180 يوم</div>
                    <div style={{fontSize:10,color:'#ef4444',marginTop:6,fontWeight:700}}>تُحتسب 5% فقط</div>
                  </div>
                </div>
                <div style={{background:C.navy,borderRadius:12,padding:'16px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}>
                  <div>
                    <div style={{color:C.gray,fontSize:12,marginBottom:4}}>إجمالي الذمم في الدفاتر</div>
                    <div style={{color:C.white,fontSize:18,fontWeight:700}}>{report.rec.toLocaleString('ar-SA')} ر.س</div>
                  </div>
                  <div style={{color:C.gold,fontSize:20,fontWeight:900}}>←</div>
                  <div>
                    <div style={{color:C.gray,fontSize:12,marginBottom:4}}>الذمم القابلة للتحصيل فعلاً</div>
                    <div style={{color:'#22c55e',fontSize:22,fontWeight:900}}>{Math.round(report.recReal).toLocaleString('ar-SA')} ر.س</div>
                  </div>
                  {report.recBad > 0 && (
                    <div style={{background:'#2d0a0a',borderRadius:8,padding:'10px 14px',border:'1px solid #ef444430'}}>
                      <div style={{color:'#ef4444',fontSize:11,fontWeight:700}}>⚖️ اشطبها ضريبياً</div>
                      <div style={{color:C.white,fontSize:14,fontWeight:700,marginTop:2}}>{report.recBad.toLocaleString('ar-SA')} ر.س</div>
                      <div style={{color:C.gray,fontSize:10,marginTop:2}}>خسارة ضريبية قابلة للاسترداد</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Murdi Survival Clock™️ — ساعة البقاء التفاعلية */}
            <div style={{background:'linear-gradient(135deg,#0a1828,#050f1a)',borderRadius:16,padding:'28px',border:`2px solid ${report.survivalColor}50`,marginBottom:0}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                <span style={{fontSize:18}}>⏳</span>
                <div style={{color:report.survivalColor,fontSize:16,fontWeight:800,letterSpacing:1}}>Murdi Survival Clock™️ — ساعة البقاء</div>
              </div>
              <div style={{color:C.gray,fontSize:12,marginBottom:20}}>كم يوماً تصمد شركتك بسيولتها الفعلية — محسوبة بالرصيد والدفعات القادمة والالتزامات</div>

              {(() => {
                const cutAmount = report.dailyBurn * 30 * (simExpenseCut/100)
                const collectAmount = report.recReal * (simCollect/100)
                const simLiquidity = report.effectiveLiquidity + (cutAmount) + collectAmount
                const simBurn = report.dailyBurn * (1 - simExpenseCut/100)
                let simDays = simBurn>0 ? simLiquidity/simBurn : 999
                if (simDays<0) simDays=0; if (simDays>999) simDays=999
                const simColor = simDays>=90?'#22c55e':simDays>=45?'#C8A84B':simDays>=21?'#f97316':'#ef4444'
                const baseDays = Math.round(report.survivalDays)
                const newDays = Math.round(simDays)
                const diff = newDays - baseDays
                return (
                  <div>
                    <div style={{textAlign:'center',marginBottom:20}}>
                      <div style={{fontSize:64,fontWeight:900,color:simColor,lineHeight:1,transition:'color 0.4s'}}>{newDays >= 999 ? '999+' : newDays}</div>
                      <div style={{color:C.gray,fontSize:14,marginTop:4}}>يوم متبقٍ</div>
                      {diff !== 0 && (
                        <div style={{color:diff>0?'#22c55e':'#ef4444',fontSize:14,fontWeight:700,marginTop:8}}>
                          {diff>0?'▲ +':'▼ '}{diff} يوم {diff>0?'بقرارك':''}
                        </div>
                      )}
                    </div>
                    <div style={{height:12,background:'#0a1420',borderRadius:8,overflow:'hidden',marginBottom:8}}>
                      <div style={{height:'100%',borderRadius:8,background:simColor,width:`${Math.min(100,(newDays/120)*100)}%`,transition:'width 0.6s ease, background 0.4s'}}/>
                    </div>
                    <div style={{display:'flex',justifyContent:'center',marginBottom:24}}>
                      <div style={{background:`${simColor}20`,border:`1px solid ${simColor}40`,borderRadius:20,padding:'6px 18px',color:simColor,fontSize:13,fontWeight:700}}>
                        {simDays>=90?'منطقة آمنة':simDays>=45?'منطقة مراقبة':simDays>=21?'منطقة تحذير':'منطقة خطر'}
                      </div>
                    </div>

                    <div style={{background:'#0a1420',borderRadius:12,padding:'20px',display:'flex',flexDirection:'column',gap:20}}>
                      <div style={{color:C.gold,fontSize:13,fontWeight:700,textAlign:'center'}}>🎛️ جرّب قراراتك — وشوف الساعة تتحرك</div>
                      <div>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                          <span style={{color:C.white,fontSize:13}}>خفّض مصروفاتك</span>
                          <span style={{color:C.gold,fontSize:13,fontWeight:700}}>{simExpenseCut}%</span>
                        </div>
                        <input type="range" min="0" max="40" value={simExpenseCut} onChange={e=>setSimExpenseCut(parseInt(e.target.value))}
                          style={{width:'100%',accentColor:C.gold,cursor:'pointer'}} />
                      </div>
                      <div>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                          <span style={{color:C.white,fontSize:13}}>حصّل من ذممك القابلة للتحصيل</span>
                          <span style={{color:C.gold,fontSize:13,fontWeight:700}}>{simCollect}%</span>
                        </div>
                        <input type="range" min="0" max="100" value={simCollect} onChange={e=>setSimCollect(parseInt(e.target.value))}
                          style={{width:'100%',accentColor:C.gold,cursor:'pointer'}} />
                      </div>
                      {(simExpenseCut>0||simCollect>0) && (
                        <button onClick={()=>{setSimExpenseCut(0);setSimCollect(0)}}
                          style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:8,padding:'8px',color:C.gray,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>↺ إعادة تعيين</button>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Murdi Distress Index™️ */}
            <div style={{background:report.distress>=70?'linear-gradient(135deg,#2d0a0a,#1a0505)':report.distress>=45?'linear-gradient(135deg,#2d1a0a,#1a0f05)':report.distress>=20?'linear-gradient(135deg,#1a1a0a,#0f0f05)':'linear-gradient(135deg,#0a2d1a,#051a0f)',borderRadius:16,padding:'28px',border:`2px solid ${report.distressColor}40`}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
                <div>
                  <div style={{color:report.distressColor,fontSize:16,fontWeight:800,letterSpacing:1}}>⚡ Murdi Distress Index™️</div>
                  <div style={{color:C.gray,fontSize:12,marginTop:4}}>احتمالية التعثر خلال 90 يوماً — من 0 إلى 100</div>
                </div>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:52,fontWeight:900,color:report.distressColor,lineHeight:1}}>{report.distress}</div>
                  <div style={{fontSize:11,color:C.gray,marginTop:4}}>/100</div>
                </div>
              </div>
              <div style={{background:'rgba(0,0,0,0.3)',borderRadius:8,height:12,marginBottom:16,overflow:'hidden'}}>
                <div style={{height:'100%',borderRadius:8,background:`linear-gradient(90deg,#22c55e,${report.distressColor})`,width:`${report.distress}%`,transition:'width 1s ease'}}/>
              </div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div style={{background:`${report.distressColor}20`,border:`1px solid ${report.distressColor}40`,borderRadius:20,padding:'6px 18px',color:report.distressColor,fontSize:13,fontWeight:700}}>{report.distressLabel}</div>
                <div style={{display:'flex',gap:16}}>
                  {[{l:'السيولة',ok:report.distress<25},{l:'التدفق',ok:report.monthlyProfit>=0},{l:'الديون',ok:report.fundingScore>50},{l:'التحصيل',ok:true}].map((x,i)=>(
                    <div key={i} style={{textAlign:'center'}}>
                      <div style={{width:8,height:8,borderRadius:'50%',background:x.ok?'#22c55e':'#ef4444',margin:'0 auto 4px'}}/>
                      <div style={{fontSize:10,color:C.gray}}>{x.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{background:'linear-gradient(135deg,#0d2a5e,#112244)',borderRadius:16,padding:'28px',border:`2px solid ${C.gold}60`}}>
              <div style={{color:C.gold,fontSize:16,fontWeight:800,marginBottom:16,letterSpacing:1}}>📋 Executive Summary — ملخص المدير التنفيذي</div>
              <div style={{color:C.white,fontSize:15,lineHeight:1.9,marginBottom:16}}>{aiReport?.executiveSummary || (report.executiveSummary.cashFlow + ' — ' + report.executiveSummary.liquidityAlert)}</div>
              <div style={{background:C.navy,borderRadius:12,padding:'16px',borderRight:`4px solid ${C.gold}`}}>
                <div style={{color:C.gray,fontSize:12,marginBottom:6}}>أولوية هذا الشهر</div>
                <div style={{color:C.white,fontSize:15,fontWeight:700,marginBottom:8}}>{aiReport?.topPriority || report.executiveSummary.priority}</div>
                <div style={{color:C.gray,fontSize:12,marginBottom:4}}>الأثر المتوقع</div>
                <div style={{color:'#22c55e',fontSize:14}}>{aiReport?.priorityImpact || report.executiveSummary.scoreImpact}</div>
              </div>
              <div style={{marginTop:16,borderTop:`1px solid ${C.border}`,paddingTop:12,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                <div style={{color:C.gold,fontSize:12}}>✦</div>
                <div style={{color:C.gray,fontSize:11,textAlign:'center'}}>هذا التحليل مبني على منهجية د. عبدالحكيم المرضي | مستشار أعمال معتمد | دكتوراه إدارة أعمال</div>
                <div style={{color:C.gold,fontSize:12}}>✦</div>
              </div>
            </div>

            <div style={{background:C.navyLight,borderRadius:16,padding:'24px',border:'1px solid #ef444440'}}>
                <div style={{color:'#ef4444',fontSize:16,fontWeight:700,marginBottom:16}}>⚠️ Top Risks — مرتبة بالتأثير</div>
                {(aiReport?.risks || report.risks).map((risk: any, i: number) => {
                  const imp = risk.impact || 5;
                  const rc = imp>=7?'#ef4444':imp>=5?C.gold:'#22c55e';
                  return (
                    <div key={i} style={{padding:'14px 0',borderBottom:i<(aiReport?.risks||report.risks).length-1?`1px solid ${C.border}`:'none'}}>
                      <div style={{display:'flex',alignItems:'flex-start',gap:12,marginBottom:risk.action?8:0}}>
                        <div style={{minWidth:32,height:32,borderRadius:'50%',background:rc+'20',border:`1px solid ${rc}`,display:'flex',alignItems:'center',justifyContent:'center',color:rc,fontSize:12,fontWeight:900}}>{i+1}</div>
                        <div style={{flex:1}}><div style={{color:C.white,fontSize:14,lineHeight:1.6}}>{risk.text}</div></div>
                        <div style={{textAlign:'center',minWidth:60}}>
                          <div style={{color:C.gray,fontSize:10,marginBottom:2}}>التأثير</div>
                          <div style={{color:rc,fontSize:16,fontWeight:900}}>{imp}/10</div>
                        </div>
                      </div>
                      {risk.action && (
                        <div style={{marginRight:44}}>
                          <div style={{background:'#3b82f620',borderRadius:8,padding:'8px 12px',marginBottom:4,borderRight:'3px solid #3b82f6'}}>
                            <div style={{color:'#3b82f6',fontSize:12,marginBottom:2}}>⚡ الإجراء</div>
                            <div style={{color:C.white,fontSize:13}}>{risk.action}</div>
                          </div>
                          <div style={{background:'#22c55e15',borderRadius:8,padding:'8px 12px',borderRight:'3px solid #22c55e'}}>
                            <div style={{color:'#22c55e',fontSize:12,marginBottom:2}}>💡 النتيجة</div>
                            <div style={{color:'#22c55e',fontSize:13}}>{risk.result}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

            {(aiReport?.risks||[]).filter((r:any)=>r.action).length > 0 && (
              <div style={{background:C.navyLight,borderRadius:16,padding:'24px',border:'1px solid #3b82f640'}}>
                <div style={{color:'#3b82f6',fontSize:16,fontWeight:700,marginBottom:16}}>⚡ Action Engine — افعل هذا الأسبوع</div>
                {(aiReport.risks||[]).filter((r:any)=>r.action).map((r:any,i:number) => (
                  <div key={i} style={{color:C.white,fontSize:14,padding:'12px 0',borderBottom:i<(aiReport.risks||[]).filter((x:any)=>x.action).length-1?`1px solid ${C.border}`:'none',lineHeight:1.6}}>⚡ {r.action}</div>
                ))}
              </div>
            )}
            {(aiReport?.risks||[]).filter((r:any)=>r.result).length > 0 && (
              <div style={{background:C.navyLight,borderRadius:16,padding:'24px',border:'1px solid #a855f740'}}>
                <div style={{color:'#a855f7',fontSize:16,fontWeight:700,marginBottom:16}}>🎯 Impact Engine — ماذا سيحدث إذا تحركت</div>
                {(aiReport.risks||[]).filter((r:any)=>r.result).map((r:any,i:number) => (
                  <div key={i} style={{color:C.white,fontSize:14,padding:'12px 0',borderBottom:i<(aiReport.risks||[]).filter((x:any)=>x.result).length-1?`1px solid ${C.border}`:'none',lineHeight:1.6}}>💡 {r.result}</div>
                ))}
              </div>
            )}

            <div style={{background:C.navyLight,borderRadius:16,padding:'24px',border:`1px solid ${fundingColor(report.fundingScore)}40`}}>
              <div style={{color:fundingColor(report.fundingScore),fontSize:16,fontWeight:700,marginBottom:16}}>🏦 Funding Readiness Engine — جاهزية التمويل</div>
              <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:16}}>
                <div style={{fontSize:52,fontWeight:900,color:fundingColor(report.fundingScore)}}>{report.fundingScore}</div>
                <div>
                  <div style={{color:C.gray,fontSize:13}}>جاهزية التمويل</div>
                  <div style={{color:C.white,fontSize:12}}>من 100 نقطة</div>
                  <div style={{color:fundingColor(report.fundingScore),fontSize:13,fontWeight:700,marginTop:4}}>{report.fundingScore >= 70 ? 'جاهز للتمويل ✅' : report.fundingScore >= 50 ? 'جاهزية متوسطة ⚠️' : 'غير جاهز بعد 🔴'}</div>
                </div>
              </div>
              {report.fundingWeaknesses.length > 0 && (
                <div style={{marginBottom:16}}>
                  <div style={{color:C.gray,fontSize:12,marginBottom:8}}>أسباب الضعف:</div>
                  {report.fundingWeaknesses.map((w:string,i:number) => <div key={i} style={{color:C.white,fontSize:13,padding:'6px 0',borderBottom:i<report.fundingWeaknesses.length-1?`1px solid ${C.border}`:'none'}}>{w}</div>)}
                </div>
              )}
              <div style={{background:C.navy,borderRadius:10,padding:'14px',border:`1px solid ${C.border}`}}>
                <div style={{color:C.gray,fontSize:12,marginBottom:4}}>الإجراء المطلوب للتمويل</div>
                <div style={{color:C.white,fontSize:14,fontWeight:700,marginBottom:6}}>{report.topFundingAction}</div>
                <div style={{color:'#22c55e',fontSize:13}}>النتيجة: جاهزيتك ترتفع إلى {report.fundingImpact}/100</div>
              </div>
            </div>

            {/* Funding Opportunities */}
            <div style={{background:C.navyLight,borderRadius:16,padding:'24px',border:`2px solid ${C.gold}60`}}>
              <div style={{color:C.gold,fontSize:16,fontWeight:800,marginBottom:8}}>🏦 فرص التمويل المتاحة لشركتك</div>
              <div style={{color:C.gray,fontSize:13,marginBottom:16}}>بناءً على منهجية د. عبدالحكيم — تحليل حقيقي من سوق التمويل السعودي</div>
              {!fundingOpp ? (
                <button onClick={getFundingOpportunities} disabled={loadingFunding} style={{width:'100%',padding:'14px',borderRadius:10,border:`1px solid ${C.gold}`,background:'transparent',color:C.gold,fontSize:14,fontWeight:700,cursor:'pointer'}}>
                  {loadingFunding ? '⏳ جاري البحث في منتجات التمويل...' : '🔍 اكتشف فرص التمويل المتاحة لشركتك'}
                </button>
              ) : (
                <div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
                    <div style={{background:C.navy,borderRadius:10,padding:'16px',textAlign:'center',border:'1px solid #22c55e40'}}>
                      <div style={{fontSize:36,fontWeight:900,color:'#22c55e'}}>{fundingOpp.qualifiedCount||0}</div>
                      <div style={{color:C.gray,fontSize:12}}>منتج مؤهل له</div>
                    </div>
                    <div style={{background:C.navy,borderRadius:10,padding:'16px',textAlign:'center',border:`1px solid ${C.gold}40`}}>
                      <div style={{fontSize:36,fontWeight:900,color:C.gold}}>{fundingOpp.nearQualifiedCount||0}</div>
                      <div style={{color:C.gray,fontSize:12}}>قريب من التأهل</div>
                    </div>
                  </div>
                  {fundingOpp.mainBarrier && (
                    <div style={{background:'#ef444415',borderRadius:10,padding:'12px',marginBottom:12,border:'1px solid #ef444430'}}>
                      <div style={{color:'#ef4444',fontSize:12,marginBottom:4}}>⚠️ العائق الرئيسي</div>
                      <div style={{color:C.white,fontSize:13}}>{fundingOpp.mainBarrier}</div>
                    </div>
                  )}
                  {(fundingOpp.opportunities||[]).map((opp:any,i:number) => (
                    <div key={i} style={{background:C.navy,borderRadius:10,padding:'14px',marginBottom:8,border:`1px solid ${opp.status==='qualified'?'#22c55e':'#F5C842'}40`}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                        <div style={{color:C.white,fontSize:14,fontWeight:700}}>{opp.type}</div>
                        <div style={{color:opp.status==='qualified'?'#22c55e':C.gold,fontSize:12,fontWeight:700}}>{opp.status==='qualified'?'✅ مؤهل':'🎯 قريب'}</div>
                      </div>
                      {opp.amount && <div style={{color:C.gold,fontSize:13,marginBottom:4}}>💰 {opp.amount}</div>}
                      <div style={{color:C.gray,fontSize:12}}>{opp.requirement}</div>
                    </div>
                  ))}
                  {fundingOpp.advisorNote && (
                    <div style={{background:'linear-gradient(135deg,#0d2a5e,#112244)',borderRadius:10,padding:'16px',marginTop:12,border:`1px solid ${C.gold}40`}}>
                      <div style={{color:C.gold,fontSize:13,fontWeight:700,marginBottom:8}}>📞 رسالة من Murdi</div>
                      <div style={{color:C.white,fontSize:14,lineHeight:1.8}}>{fundingOpp.advisorNote}</div>
                      <button onClick={()=>window.open('https://wa.me/966500000000?text=أريد معرفة فرص التمويل لشركتي','_blank')} style={{marginTop:12,width:'100%',padding:'12px',borderRadius:8,border:'none',background:`linear-gradient(135deg,${C.gold},${C.goldLight})`,color:C.navy,fontSize:14,fontWeight:700,cursor:'pointer'}}>
                        تواصل مع فريق د. عبدالحكيم
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {report.strengths.length > 0 && (
              <div style={{background:C.navyLight,borderRadius:16,padding:'24px',border:'1px solid #22c55e40'}}>
                <div style={{color:'#22c55e',fontSize:16,fontWeight:700,marginBottom:16}}>💪 نقاط القوة</div>
                {report.strengths.map((s:string,i:number) => <div key={i} style={{color:C.white,fontSize:14,padding:'12px 0',borderBottom:i<report.strengths.length-1?`1px solid ${C.border}`:'none',lineHeight:1.6}}>{s}</div>)}
              </div>
            )}

            <div style={{background:C.navyLight,borderRadius:16,padding:'24px',border:`1px solid ${C.gold}40`}}>
              <div style={{color:C.gold,fontSize:16,fontWeight:700,marginBottom:16}}>🚀 Opportunity Engine — فرصك الآن</div>
              {report.opportunities.map((o:string,i:number) => <div key={i} style={{color:C.white,fontSize:14,padding:'12px 0',borderBottom:i<report.opportunities.length-1?`1px solid ${C.border}`:'none',lineHeight:1.6}}>{o}</div>)}
            </div>

            <div style={{background:C.navyLight,borderRadius:16,padding:'32px',border:`2px solid ${scoreColor(report.score)}40`,textAlign:'center'}}>
              <div style={{color:C.gray,fontSize:14,marginBottom:8}}>Murdi Score لشركة {profile?.company_name}</div>
              <div style={{fontSize:80,fontWeight:900,color:scoreColor(report.score),lineHeight:1}}>{report.score}</div>
              <div style={{color:C.gray,fontSize:13,marginBottom:12}}>من 85 نقطة</div>
              <div style={{color:C.white,fontSize:16,fontWeight:700,background:scoreColor(report.score)+'20',padding:'10px 20px',borderRadius:8,display:'inline-block'}}>{report.scoreLabel}</div>
              <div style={{marginTop:16,color:C.gray,fontSize:13,background:C.navy,padding:'12px',borderRadius:8}}>📊 {report.vsMarket}</div>
              {lastMonth && (
                <div style={{marginTop:16,display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,background:C.navy,borderRadius:12,padding:'16px'}}>
                  <div style={{textAlign:'center'}}>
                    <div style={{color:C.gray,fontSize:12,marginBottom:4}}>التغيير عن الشهر الماضي</div>
                    <div style={{fontSize:24,fontWeight:900,color:lastMonth?.murdi_score != null ? (report.score>lastMonth.murdi_score?'#22c55e':report.score<lastMonth.murdi_score?'#ef4444':C.gold) : C.gold}}>
                      {lastMonth?.murdi_score != null ? `${report.score > lastMonth.murdi_score ? '↑' : '↓'} ${Math.abs(report.score - lastMonth.murdi_score)} نقطة` : 'أول شهر 🎉'}
                    </div>
                  </div>
                  <div style={{textAlign:'center'}}>
                    <div style={{color:C.gray,fontSize:12,marginBottom:4}}>التوقع بعد 3 أشهر</div>
                    <div style={{color:C.white,fontSize:13,lineHeight:1.5}}>{report.forecast3m}</div>
                  </div>
                </div>
              )}
            </div>

            <div style={{background:C.navyLight,borderRadius:16,padding:'20px',border:`1px solid ${C.border}`}}>
              <div style={{color:C.gold,fontSize:15,fontWeight:700,marginBottom:12}}>🔬 Analysis Depth — عمق التحليل</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {[
                  {label:'المخاطر المحددة', value:`${report.risks.length} خطر`},
                  {label:'الإجراءات المقترحة', value:`${report.actions.length} إجراء`},
                  {label:'نقاط القوة', value:`${report.strengths.length} نقطة`},
                  {label:'الفرص المتاحة', value:`${report.opportunities.length} فرصة`},
                ].map((item,i) => (
                  <div key={i} style={{background:C.navy,borderRadius:8,padding:'10px 14px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div style={{color:C.gray,fontSize:12}}>{item.label}</div>
                    <div style={{color:C.white,fontSize:14,fontWeight:700}}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cash Runway Countdown */}
            {report.cashRunwayDate && (
              <div style={{background:'#1a0a0a',borderRadius:16,padding:'24px',border:'2px solid #ef444460'}}>
                <div style={{color:'#ef4444',fontSize:16,fontWeight:800,marginBottom:12}}>⏱️ Cash Runway Countdown™️</div>
                <div style={{color:C.gray,fontSize:13,marginBottom:8}}>بناءً على معدل صرفك اليومي: {Math.round(report.dailyBurn).toLocaleString('ar-SA')} ريال/يوم</div>
                <div style={{color:'#ef4444',fontSize:18,fontWeight:900,marginBottom:8}}>
                  ⚠️ سيولتك ستصل صفر بتاريخ: {report.cashRunwayDate}
                </div>
                <div style={{color:C.gray,fontSize:14,marginBottom:12}}>أي خلال {Math.round(report.daysLeft)} يوم من الآن</div>
                <div style={{color:'#22c55e',fontSize:14,background:'#22c55e10',padding:'10px 14px',borderRadius:8,border:'1px solid #22c55e30'}}>
                  {report.rec > 0 ? `✅ إذا حصّلت ${Math.round(report.rec * 0.5).toLocaleString('ar-SA')} ريال هذا الأسبوع — ترفع التغطية إلى ${Math.round(report.daysLeft + (report.rec*0.5)/report.dailyBurn)} يوم` : `✅ خفّض مصروفاتك ${Math.round(report.dailyBurn * 10).toLocaleString('ar-SA')} ريال هذا الأسبوع — تربح 10 أيام إضافية`}
                </div>
              </div>
            )}



            {/* كاشف الربح الوهمي — يظهر فقط عند وجود فجوة */}
            {report.hasPhantomProfit && (
              <div style={{background:'linear-gradient(135deg,#2d1f0a,#1f1505)',borderRadius:16,padding:'24px',border:`1px solid #f59e0b60`}}>
                <div style={{color:'#fbbf24',fontSize:16,fontWeight:800,marginBottom:6}}>👻 كاشف الربح الوهمي™️</div>
                <div style={{color:C.gray,fontSize:13,marginBottom:18,lineHeight:1.6}}>ربحك على الورق شيء، وما في جيبك شيء آخر — Murdi يكشف الفرق</div>

                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
                  <div style={{background:C.navy,borderRadius:12,padding:'16px',textAlign:'center',border:`1px solid ${C.border}`}}>
                    <div style={{color:C.gray,fontSize:12,marginBottom:6}}>ربحك على الورق</div>
                    <div style={{color:'#94a3b8',fontSize:22,fontWeight:900}}>{fmt(report.paperProfit)}</div>
                  </div>
                  <div style={{background:C.navy,borderRadius:12,padding:'16px',textAlign:'center',border:`1px solid #22c55e40`}}>
                    <div style={{color:C.gray,fontSize:12,marginBottom:6}}>ربحك في يدك فعلاً</div>
                    <div style={{color:'#4ade80',fontSize:22,fontWeight:900}}>{fmt(report.cashProfit)}</div>
                  </div>
                </div>

                <div style={{background:C.navy,borderRadius:12,padding:'16px',marginBottom:14}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                    <span style={{color:C.white,fontSize:13,fontWeight:700}}>جودة ربحك (كم منه نقد حقيقي)</span>
                    <span style={{color:report.profitQuality>=60?'#4ade80':report.profitQuality>=30?'#fbbf24':'#fca5a5',fontSize:18,fontWeight:900}}>{Math.round(report.profitQuality)}%</span>
                  </div>
                  <div style={{height:8,background:'#0a1420',borderRadius:6,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${Math.round(report.profitQuality)}%`,background:report.profitQuality>=60?'#22c55e':report.profitQuality>=30?'#f59e0b':'#ef4444',transition:'width 0.4s'}}/>
                  </div>
                </div>

                <div style={{background:'#1f1505',borderRadius:10,padding:'16px',borderRight:`3px solid #f59e0b`}}>
                  <div style={{color:C.white,fontSize:14,lineHeight:1.8}}>
                    لديك <span style={{color:'#fbbf24',fontWeight:800}}>{fmt(report.uncollectibleGap)}</span> ربح معلّق في ذمم غير قابلة للتحصيل فوراً. ربحك المعلن {fmt(report.paperProfit)}، لكن النقد الحقيقي في يدك {fmt(report.cashProfit)} فقط. <span style={{color:'#fbbf24'}}>لا تبنِ قراراتك على ربح لم تقبضه بعد.</span>
                  </div>
                </div>
              </div>
            )}

            {/* محرك المستخلصات */}
            <div style={{background:'linear-gradient(135deg,#0d2818,#0a1f12)',borderRadius:16,padding:'24px',border:`1px solid #22c55e50`}}>
              <div style={{color:'#4ade80',fontSize:16,fontWeight:800,marginBottom:6}}>📋 محرك المستخلصات™️ — سيولتك المجمّدة</div>
              <div style={{color:C.gray,fontSize:13,marginBottom:16,lineHeight:1.6}}>كم من فلوسك محتجزة في مستخلصات حكومية؟ أدخلها ودع Murdi يتابعها معك</div>

              {invoices.map((inv,idx)=>(
                <div key={idx} style={{background:C.navy,borderRadius:10,padding:'14px',marginBottom:10,border:`1px solid ${C.border}`}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                    <input value={inv.value} onChange={e=>{const n=[...invoices];n[idx].value=e.target.value;setInvoices(n)}} placeholder="قيمة المستخلص" type="number" style={{padding:'9px 11px',borderRadius:8,border:`1px solid ${C.border}`,background:C.navyLight,color:C.white,fontSize:13,boxSizing:'border-box'}} />
                    <input value={inv.submittedDaysAgo} onChange={e=>{const n=[...invoices];n[idx].submittedDaysAgo=e.target.value;setInvoices(n)}} placeholder="قُدّم قبل كم يوم؟" type="number" style={{padding:'9px 11px',borderRadius:8,border:`1px solid ${C.border}`,background:C.navyLight,color:C.white,fontSize:13,boxSizing:'border-box'}} />
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    <select value={inv.status} onChange={e=>{const n=[...invoices];n[idx].status=e.target.value;setInvoices(n)}} style={{padding:'9px 11px',borderRadius:8,border:`1px solid ${C.border}`,background:C.navyLight,color:C.white,fontSize:13,boxSizing:'border-box',fontFamily:'inherit'}}>
                      <option>قيد المراجعة</option>
                      <option>قيد الاعتماد</option>
                      <option>معتمد بانتظار الصرف</option>
                      <option>عليه ملاحظات فنية</option>
                    </select>
                    <input value={inv.entity} onChange={e=>{const n=[...invoices];n[idx].entity=e.target.value;setInvoices(n)}} placeholder="الجهة (اختياري)" style={{padding:'9px 11px',borderRadius:8,border:`1px solid ${C.border}`,background:C.navyLight,color:C.white,fontSize:13,boxSizing:'border-box'}} />
                  </div>
                  {invoices.length>1 && (
                    <button onClick={()=>setInvoices(invoices.filter((_,i)=>i!==idx))} style={{marginTop:8,background:'transparent',border:'none',color:'#fca5a5',fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>× حذف</button>
                  )}
                </div>
              ))}

              <div style={{display:'flex',gap:8,marginBottom:14}}>
                <button onClick={()=>setInvoices([...invoices,{value:'',submittedDaysAgo:'',status:'قيد المراجعة',entity:''}])} style={{flex:1,padding:'10px',borderRadius:8,border:`1px dashed #22c55e60`,background:'transparent',color:'#4ade80',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>+ أضف مستخلصاً</button>
              </div>

              <button onClick={runIstikhlas} disabled={istikhlasLoading||invoices.every(i=>!parseFloat(i.value))}
                style={{width:'100%',padding:'14px',borderRadius:10,border:'none',background:invoices.some(i=>parseFloat(i.value)>0)?'linear-gradient(135deg,#16a34a,#22c55e)':'#333',color:'#fff',fontSize:15,fontWeight:800,cursor:invoices.some(i=>parseFloat(i.value)>0)?'pointer':'default',fontFamily:'inherit'}}>
                {istikhlasLoading?'📋 Murdi يتابع مستخلصاتك...':'حلّل مستخلصاتي'}
              </button>

              {istikhlasResult && !istikhlasResult.error && (
                <div style={{marginTop:18,display:'flex',flexDirection:'column',gap:12}}>
                  {[
                    {t:'🧊 سيولتك المجمّدة',v:istikhlasResult.frozenLiquidity,c:'#fca5a5'},
                    {t:'🚨 الأعجل للمتابعة',v:istikhlasResult.criticalInvoice,c:'#fbbf24'},
                    {t:'⏱️ توقيت الصرف',v:istikhlasResult.expectedTiming,c:'#4ade80'},
                    {t:'🔒 ضمان حسن التنفيذ المحتجز',v:istikhlasResult.guaranteeHeld,c:'#94a3b8'},
                    {t:'🔓 لو صُرف الأقرب',v:istikhlasResult.cashUnlock,c:'#4ade80'},
                  ].map((it,i)=>it.v&&(
                    <div key={i} style={{padding:'14px',borderRadius:10,background:C.navy,border:`1px solid ${C.border}`}}>
                      <div style={{color:it.c,fontSize:13,fontWeight:700,marginBottom:6}}>{it.t}</div>
                      <div style={{color:C.white,fontSize:13,lineHeight:1.7}}>{it.v}</div>
                    </div>
                  ))}
                  {istikhlasResult.actions?.length>0 && (
                    <div style={{padding:'14px',borderRadius:10,background:C.navy,border:`1px solid ${C.border}`}}>
                      <div style={{color:'#4ade80',fontSize:13,fontWeight:700,marginBottom:8}}>✅ متابعتك هذا الأسبوع</div>
                      {istikhlasResult.actions.map((a:string,i:number)=>(
                        <div key={i} style={{color:C.white,fontSize:13,lineHeight:1.8}}>• {a}</div>
                      ))}
                    </div>
                  )}
                  {istikhlasResult.advisorNote && (
                    <div style={{padding:'16px',borderRadius:12,background:'#0a2540',borderRight:`3px solid ${C.gold}`}}>
                      <div style={{color:C.gold,fontSize:13,fontWeight:700,marginBottom:6}}>🎓 د. عبدالحكيم المرضي</div>
                      <div style={{color:C.white,fontSize:13,lineHeight:1.7}}>{istikhlasResult.advisorNote}</div>
                    </div>
                  )}
                </div>
              )}
              {istikhlasResult?.error && (
                <div style={{marginTop:14,padding:'12px',borderRadius:8,background:'#2d1a0a',color:'#fca5a5',fontSize:13}}>{istikhlasResult.error}</div>
              )}
            </div>

            {/* مؤشر جاهزية العطاء */}
            <div style={{background:'linear-gradient(135deg,#0d1f2d,#0a151f)',borderRadius:16,padding:'24px',border:`1px solid #38bdf850`}}>
              <div style={{color:'#7dd3fc',fontSize:16,fontWeight:800,marginBottom:6}}>🎯 مؤشر جاهزية العطاء™️</div>
              <div style={{color:C.gray,fontSize:13,marginBottom:16,lineHeight:1.6}}>تفكّر في التقديم على عطاء؟ Murdi يقيّم جاهزيتك ويحسب أقل سعر آمن قبل أن تقدّم</div>

              <textarea value={tender.description} onChange={e=>setTender({...tender,description:e.target.value})}
                placeholder="وصف العطاء — مثال: إنشاء مدرسة ابتدائية، وزارة التعليم"
                style={{width:'100%',padding:'12px 14px',borderRadius:10,border:`1px solid ${C.border}`,background:C.navy,color:C.white,fontSize:14,boxSizing:'border-box',minHeight:60,fontFamily:'inherit',marginBottom:12}} />

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
                <input value={tender.value} onChange={e=>setTender({...tender,value:e.target.value})} placeholder="قيمة المشروع (ريال)" type="number" style={{padding:'10px 12px',borderRadius:8,border:`1px solid ${C.border}`,background:C.navy,color:C.white,fontSize:13,boxSizing:'border-box'}} />
                <input value={tender.duration} onChange={e=>setTender({...tender,duration:e.target.value})} placeholder="مدة التنفيذ (أشهر)" type="number" style={{padding:'10px 12px',borderRadius:8,border:`1px solid ${C.border}`,background:C.navy,color:C.white,fontSize:13,boxSizing:'border-box'}} />
              </div>
              <input value={tender.entity} onChange={e=>setTender({...tender,entity:e.target.value})} placeholder="الجهة (اختياري)" style={{width:'100%',padding:'10px 12px',borderRadius:8,border:`1px solid ${C.border}`,background:C.navy,color:C.white,fontSize:13,boxSizing:'border-box',marginBottom:14}} />

              <button onClick={runBid} disabled={bidLoading||!tender.description.trim()}
                style={{width:'100%',padding:'14px',borderRadius:10,border:'none',background:tender.description.trim()?'linear-gradient(135deg,#0284c7,#38bdf8)':'#333',color:'#fff',fontSize:15,fontWeight:800,cursor:tender.description.trim()?'pointer':'default',fontFamily:'inherit'}}>
                {bidLoading?'🎯 Murdi يقيّم جاهزيتك...':'قيّم جاهزيتي للعطاء'}
              </button>

              {bidResult && !bidResult.error && (
                <div style={{marginTop:18,display:'flex',flexDirection:'column',gap:12}}>
                  <div style={{padding:'16px',borderRadius:12,background:bidResult.readiness==='ready'?'#0a2d1a':bidResult.readiness==='notReady'?'#2d0a0a':'#2d1f0a',border:`1px solid ${bidResult.readiness==='ready'?'#22c55e':bidResult.readiness==='notReady'?'#ef4444':'#f59e0b'}60`}}>
                    <div style={{fontSize:13,fontWeight:800,marginBottom:6,color:bidResult.readiness==='ready'?'#22c55e':bidResult.readiness==='notReady'?'#ef4444':'#f59e0b'}}>
                      {bidResult.readiness==='ready'?'✅ جاهز — قدّم':bidResult.readiness==='notReady'?'🛑 غير جاهز':'⚠️ جاهز بشروط'}
                    </div>
                    <div style={{color:C.white,fontSize:14,lineHeight:1.7}}>{bidResult.readinessText}</div>
                  </div>
                  {[
                    {t:'🏗️ قدرتك على التنفيذ',v:bidResult.capacityCheck,c:'#7dd3fc'},
                    {t:'💵 أقل سعر آمن (لا تنزل تحته)',v:bidResult.pricingFloor,c:'#fbbf24'},
                  ].map((it,i)=>it.v&&(
                    <div key={i} style={{padding:'14px',borderRadius:10,background:C.navy,border:`1px solid ${C.border}`}}>
                      <div style={{color:it.c,fontSize:13,fontWeight:700,marginBottom:6}}>{it.t}</div>
                      <div style={{color:C.white,fontSize:13,lineHeight:1.7}}>{it.v}</div>
                    </div>
                  ))}
                  {bidResult.risks?.length>0 && (
                    <div style={{padding:'14px',borderRadius:10,background:C.navy,border:`1px solid ${C.border}`}}>
                      <div style={{color:'#fca5a5',fontSize:13,fontWeight:700,marginBottom:8}}>⚠️ مخاطر هذا العطاء</div>
                      {bidResult.risks.map((rk:string,i:number)=>(<div key={i} style={{color:C.white,fontSize:13,lineHeight:1.8}}>• {rk}</div>))}
                    </div>
                  )}
                  {bidResult.conditions?.length>0 && (
                    <div style={{padding:'14px',borderRadius:10,background:C.navy,border:`1px solid ${C.border}`}}>
                      <div style={{color:'#7dd3fc',fontSize:13,fontWeight:700,marginBottom:8}}>📋 شروط التقديم</div>
                      {bidResult.conditions.map((c:string,i:number)=>(<div key={i} style={{color:C.white,fontSize:13,lineHeight:1.8}}>• {c}</div>))}
                    </div>
                  )}
                  {bidResult.advisorNote && (
                    <div style={{padding:'16px',borderRadius:12,background:'#0a2540',borderRight:`3px solid ${C.gold}`}}>
                      <div style={{color:C.gold,fontSize:13,fontWeight:700,marginBottom:6}}>🎓 د. عبدالحكيم المرضي</div>
                      <div style={{color:C.white,fontSize:13,lineHeight:1.7}}>{bidResult.advisorNote}</div>
                    </div>
                  )}
                </div>
              )}
              {bidResult?.error && (
                <div style={{marginTop:14,padding:'12px',borderRadius:8,background:'#2d1a0a',color:'#fca5a5',fontSize:13}}>{bidResult.error}</div>
              )}
            </div>

            {/* Murdi Twin — التوأم المالي */}
            <div style={{background:'linear-gradient(135deg,#0d1b2e,#13243d)',borderRadius:16,padding:'24px',border:`1px solid #a855f7${'50'}`}}>
              <div style={{color:'#c084fc',fontSize:16,fontWeight:800,marginBottom:6}}>🧬 Murdi Twin™️ — توأمك المالي</div>
              <div style={{color:C.gray,fontSize:13,marginBottom:16,lineHeight:1.6}}>تفكّر في مشروع أو قرار كبير؟ شغّل نسخة افتراضية من شركتك وشوف الأثر قبل أن تقرّر</div>

              <textarea value={twinProject.description} onChange={e=>setTwinProject({...twinProject,description:e.target.value})}
                placeholder="اوصف القرار — مثال: مشروع حكومي قيمته 2 مليون، دفعاته كل 3 أشهر"
                style={{width:'100%',padding:'12px 14px',borderRadius:10,border:`1px solid ${C.border}`,background:C.navy,color:C.white,fontSize:14,boxSizing:'border-box',minHeight:70,fontFamily:'inherit',marginBottom:12}} />

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                <input value={twinProject.value} onChange={e=>setTwinProject({...twinProject,value:e.target.value})} placeholder="قيمة المشروع (ريال)" type="number" style={{padding:'10px 12px',borderRadius:8,border:`1px solid ${C.border}`,background:C.navy,color:C.white,fontSize:13,boxSizing:'border-box'}} />
                <input value={twinProject.margin} onChange={e=>setTwinProject({...twinProject,margin:e.target.value})} placeholder="هامش الربح %" type="number" style={{padding:'10px 12px',borderRadius:8,border:`1px solid ${C.border}`,background:C.navy,color:C.white,fontSize:13,boxSizing:'border-box'}} />
                <input value={twinProject.duration} onChange={e=>setTwinProject({...twinProject,duration:e.target.value})} placeholder="مدة التنفيذ (أشهر)" type="number" style={{padding:'10px 12px',borderRadius:8,border:`1px solid ${C.border}`,background:C.navy,color:C.white,fontSize:13,boxSizing:'border-box'}} />
                <input value={twinProject.paymentDelay} onChange={e=>setTwinProject({...twinProject,paymentDelay:e.target.value})} placeholder="تأخر الدفعات (يوم)" type="number" style={{padding:'10px 12px',borderRadius:8,border:`1px solid ${C.border}`,background:C.navy,color:C.white,fontSize:13,boxSizing:'border-box'}} />
              </div>

              <label style={{display:'flex',alignItems:'center',gap:8,marginBottom:14,cursor:'pointer',color:C.white,fontSize:13}}>
                <input type="checkbox" checked={twinProject.needsFunding} onChange={e=>setTwinProject({...twinProject,needsFunding:e.target.checked})} style={{width:16,height:16,cursor:'pointer'}} />
                سأحتاج تمويلاً لهذا المشروع
              </label>
              {twinProject.needsFunding && (
                <input value={twinProject.fundingAmount} onChange={e=>setTwinProject({...twinProject,fundingAmount:e.target.value})} placeholder="مبلغ التمويل (ريال)" type="number" style={{width:'100%',padding:'10px 12px',borderRadius:8,border:`1px solid ${C.border}`,background:C.navy,color:C.white,fontSize:13,boxSizing:'border-box',marginBottom:14}} />
              )}

              <button onClick={runTwin} disabled={twinLoading||!twinProject.description.trim()}
                style={{width:'100%',padding:'14px',borderRadius:10,border:'none',background:twinProject.description.trim()?'linear-gradient(135deg,#a855f7,#c084fc)':'#333',color:'#fff',fontSize:15,fontWeight:800,cursor:twinProject.description.trim()?'pointer':'default',fontFamily:'inherit'}}>
                {twinLoading?'🧬 التوأم يحاكي شركتك...':'شغّل المحاكاة'}
              </button>

              {twinResult && !twinResult.error && (
                <div style={{marginTop:18,display:'flex',flexDirection:'column',gap:12}}>
                  <div style={{padding:'16px',borderRadius:12,background:twinResult.verdict==='go'?'#0a2d1a':twinResult.verdict==='stop'?'#2d0a0a':'#2d1f0a',border:`1px solid ${twinResult.verdict==='go'?'#22c55e':twinResult.verdict==='stop'?'#ef4444':'#f59e0b'}60`}}>
                    <div style={{fontSize:13,fontWeight:800,marginBottom:6,color:twinResult.verdict==='go'?'#22c55e':twinResult.verdict==='stop'?'#ef4444':'#f59e0b'}}>
                      {twinResult.verdict==='go'?'✅ الحكم: ادخل':twinResult.verdict==='stop'?'🛑 الحكم: لا تدخل':'⚠️ الحكم: بحذر'}
                    </div>
                    <div style={{color:C.white,fontSize:14,lineHeight:1.7}}>{twinResult.verdictText}</div>
                  </div>
                  {[
                    {t:'💵 أثر السيولة',v:twinResult.cashImpact},
                    {t:'📉 أصعب شهر',v:twinResult.worstMonth},
                    {t:'💰 الربح الحقيقي',v:twinResult.profitReality},
                  ].map((it,i)=>it.v&&(
                    <div key={i} style={{padding:'14px',borderRadius:10,background:C.navy,border:`1px solid ${C.border}`}}>
                      <div style={{color:'#c084fc',fontSize:13,fontWeight:700,marginBottom:6}}>{it.t}</div>
                      <div style={{color:C.white,fontSize:13,lineHeight:1.7}}>{it.v}</div>
                    </div>
                  ))}
                  {twinResult.conditions?.length>0 && (
                    <div style={{padding:'14px',borderRadius:10,background:C.navy,border:`1px solid ${C.border}`}}>
                      <div style={{color:'#c084fc',fontSize:13,fontWeight:700,marginBottom:8}}>📋 شروط الدخول</div>
                      {twinResult.conditions.map((c:string,i:number)=>(
                        <div key={i} style={{color:C.white,fontSize:13,lineHeight:1.8}}>• {c}</div>
                      ))}
                    </div>
                  )}
                  {twinResult.advisorNote && (
                    <div style={{padding:'16px',borderRadius:12,background:'#0a2540',borderRight:`3px solid ${C.gold}`}}>
                      <div style={{color:C.gold,fontSize:13,fontWeight:700,marginBottom:6}}>🎓 د. عبدالحكيم المرضي</div>
                      <div style={{color:C.white,fontSize:13,lineHeight:1.7}}>{twinResult.advisorNote}</div>
                    </div>
                  )}
                </div>
              )}
              {twinResult?.error && (
                <div style={{marginTop:14,padding:'12px',borderRadius:8,background:'#2d1a0a',color:'#fca5a5',fontSize:13}}>{twinResult.error}</div>
              )}
            </div>

            {/* What If Engine — متعدد السيناريوهات */}
            <div style={{background:C.navyLight,borderRadius:16,padding:'24px',border:`1px solid ${C.gold}40`}}>
              <div style={{color:C.gold,fontSize:16,fontWeight:800,marginBottom:6}}>🔮 What If Engine™️</div>
              <div style={{color:C.gray,fontSize:13,marginBottom:14}}>جرّب قراراً — وشوف أثره على شركتك</div>

              <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
                {[
                  {k:'collect',label:'💰 أحصّل ذمم'},
                  {k:'cut',label:'✂️ أخفّض مصروفات'},
                  {k:'funding',label:'🏦 آخذ تمويل'},
                ].map(o=>(
                  <button key={o.k} onClick={()=>{setWhatIfMode(o.k as any);setWhatIfAmount('')}}
                    style={{flex:1,minWidth:110,padding:'10px',borderRadius:8,border:`1px solid ${whatIfMode===o.k?C.gold:C.border}`,background:whatIfMode===o.k?C.gold:'transparent',color:whatIfMode===o.k?C.navy:C.white,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>{o.label}</button>
                ))}
              </div>

              <input value={whatIfAmount} onChange={e=>setWhatIfAmount(e.target.value)}
                placeholder={whatIfMode==='collect'?'كم ستحصّل من ذممك؟':whatIfMode==='cut'?'كم ستخفّض من مصروفاتك الشهرية؟':'كم مبلغ التمويل؟'}
                style={{width:'100%',padding:'10px 14px',borderRadius:8,border:`1px solid ${C.border}`,background:C.navy,color:C.white,fontSize:14,boxSizing:'border-box',marginBottom:16}} />

              {whatIfAmount && parseFloat(whatIfAmount) > 0 && (() => {
                const amt = parseFloat(whatIfAmount)||0;
                const bal = parseFloat(form.bank_balance)||0;
                const exp = parseFloat(form.expenses)||0;
                const rev = parseFloat(form.revenue)||1;
                const debts = parseFloat(form.debts)||0;
                const margin = report.margin;
                const recRealLocal = report.recReal||0;
                // حساب الأثر حسب نوع القرار
                let newBalance = bal, newExp = exp, newDebts = debts, label = '', caution = '';
                if (whatIfMode==='collect') {
                  const capped = Math.min(amt, recRealLocal);
                  newBalance = bal + capped;
                  label = `إذا حصّلت ${fmt(capped)} من ذممك القابلة للتحصيل`;
                  if (amt > recRealLocal) caution = `⚠️ ذممك القابلة للتحصيل فعلاً ${fmt(recRealLocal)} فقط — حسبنا على أساسها`;
                } else if (whatIfMode==='cut') {
                  newExp = Math.max(0, exp - amt);
                  newBalance = bal + amt;
                  label = `إذا خفّضت مصروفاتك ${fmt(amt)} شهرياً`;
                } else {
                  newBalance = bal + amt;
                  newDebts = debts + amt;
                  label = `إذا أخذت تمويلاً ${fmt(amt)}`;
                  caution = `⚠️ التمويل يرفع سيولتك الآن لكنه يزيد ديونك — انتبه للقسط القادم`;
                }
                const newDailyBurn = newExp/30;
                const newLiq = newExp>0 ? newBalance/newExp : 0;
                const newDays = newDailyBurn>0 ? newBalance/newDailyBurn : 999;
                const newMargin = whatIfMode==='cut' ? ((rev-newExp)/rev*100) : margin;
                const dso = recRealLocal/rev*30;
                const newDr = newDebts/(rev*12)*100;
                let newScore=0;
                if (newLiq>=3) newScore+=25; else if (newLiq>=1) newScore+=15; else if (newLiq>0) newScore+=5;
                if (newMargin>=15) newScore+=25; else if (newMargin>0) newScore+=15;
                if (dso<=60) newScore+=20; else if (dso<=90) newScore+=10;
                if (newDr<=50) newScore+=15; else if (newDr<=100) newScore+=8;
                newScore=Math.min(newScore,85);
                const dDays = Math.round(newDays)-Math.round(report.daysLeft);
                const dScore = newScore-report.score;
                return (
                  <div style={{background:C.navy,borderRadius:10,padding:'16px',border:`1px solid ${C.gold}30`}}>
                    <div style={{color:C.gold,fontSize:13,marginBottom:12,fontWeight:700}}>{label}:</div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
                      <div style={{textAlign:'center',background:C.navyLight,borderRadius:8,padding:'10px'}}>
                        <div style={{color:C.gray,fontSize:10,marginBottom:4}}>Murdi Score</div>
                        <div style={{color:dScore>=0?'#22c55e':'#ef4444',fontSize:18,fontWeight:900}}>{newScore}/85</div>
                        <div style={{color:dScore>=0?'#22c55e':'#ef4444',fontSize:11}}>{dScore>=0?'+':''}{dScore} نقطة</div>
                      </div>
                      <div style={{textAlign:'center',background:C.navyLight,borderRadius:8,padding:'10px'}}>
                        <div style={{color:C.gray,fontSize:10,marginBottom:4}}>أيام البقاء</div>
                        <div style={{color:dDays>=0?'#22c55e':'#ef4444',fontSize:18,fontWeight:900}}>{Math.round(newDays)>=999?'999+':Math.round(newDays)}</div>
                        <div style={{color:dDays>=0?'#22c55e':'#ef4444',fontSize:11}}>{dDays>=0?'+':''}{dDays} يوم</div>
                      </div>
                      <div style={{textAlign:'center',background:C.navyLight,borderRadius:8,padding:'10px'}}>
                        <div style={{color:C.gray,fontSize:10,marginBottom:4}}>{whatIfMode==='cut'?'الهامش':'السيولة'}</div>
                        <div style={{color:'#22c55e',fontSize:18,fontWeight:900}}>{whatIfMode==='cut'?newMargin.toFixed(0)+'%':newLiq.toFixed(1)}</div>
                        <div style={{color:C.gray,fontSize:11}}>{whatIfMode==='cut'?'هامش الربح':'شهر تغطية'}</div>
                      </div>
                    </div>
                    {caution && <div style={{color:'#f9a826',fontSize:12,marginTop:12,lineHeight:1.6}}>{caution}</div>}
                  </div>
                );
              })()}
            </div>

            {/* Murdi Chat */}
            <div style={{background:C.navyLight,borderRadius:16,padding:'24px',border:`1px solid ${C.gold}40`}}>
              <div style={{color:C.gold,fontSize:16,fontWeight:800,marginBottom:16}}>💬 Murdi Chat™️ — اسأل عن أي شيء</div>
              <div style={{marginBottom:12,display:'flex',gap:8,flexWrap:'wrap'}}>
                {['وش لو أخذت قرض 500 ألف؟','هل أدخل مشروع جديد؟','متى أقدر أطلب تمويل؟','ليش درجتي كذا؟'].map((q,i) => (
                  <button key={i} onClick={()=>setChatInput(q)} style={{padding:'6px 12px',borderRadius:20,border:`1px solid ${C.border}`,background:'transparent',color:C.gray,cursor:'pointer',fontSize:12}}>{q}</button>
                ))}
              </div>
              {chatMessages.length > 0 && (
                <div style={{marginBottom:12,maxHeight:300,overflowY:'auto'}}>
                  {chatMessages.map((m,i) => (
                    <div key={i} style={{marginBottom:12}}>
                      <div style={{background:'#ffffff10',borderRadius:'12px 12px 4px 12px',padding:'10px 14px',color:C.white,fontSize:13,marginBottom:4,textAlign:'left'}}>{m.q}</div>
                      <div style={{background:`${C.gold}15`,borderRadius:'4px 12px 12px 12px',padding:'10px 14px',color:C.white,fontSize:13,lineHeight:1.6,borderRight:`3px solid ${C.gold}`}}>{m.a}</div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{display:'flex',gap:8}}>
                <input
                  value={chatInput}
                  onChange={e=>setChatInput(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&sendChat()}
                  placeholder="اسأل Murdi عن شركتك..."
                  style={{flex:1,padding:'12px 14px',borderRadius:10,border:`1px solid ${C.border}`,background:C.navy,color:C.white,fontSize:14}}
                />
                <button onClick={sendChat} disabled={loadingChat} style={{padding:'12px 20px',borderRadius:10,border:'none',background:C.gold,color:C.navy,cursor:'pointer',fontSize:14,fontWeight:700}}>
                  {loadingChat ? '...' : 'إرسال'}
                </button>
              </div>
            </div>

            <button onClick={handleSave} style={{width:'100%',padding:'16px',borderRadius:12,border:'none',background:`linear-gradient(135deg,${C.gold},${C.goldLight})`,color:C.navy,fontSize:16,fontWeight:800,cursor:'pointer'}}>
              {saved ? '✓ تم الحفظ في Company Memory!' : '💾 احفظ التقرير في Company Memory'}
            </button>
            <button onClick={sendAlert} disabled={sendingAlert} style={{width:'100%',padding:'14px',borderRadius:12,border:'1px solid #38bdf8',background:'transparent',color:'#38bdf8',fontSize:15,fontWeight:700,cursor:'pointer',marginTop:8}}>
              {sendingAlert ? '⏳ Murdi يجهز تنبيهك...' : alertSent ? '✓ وصلك التنبيه على بريدك!' : '🔔 أرسل لي تنبيه Murdi الذكي على الإيميل'}
            </button>
            <button onClick={()=>{sessionStorage.setItem('murdi_report',JSON.stringify(report));sessionStorage.setItem('murdi_company',profile?.company_name||'');router.push('/dashboard/report')}} style={{width:'100%',padding:'14px',borderRadius:12,border:'1px solid #F5C842',background:'transparent',color:'#F5C842',fontSize:15,fontWeight:700,cursor:'pointer',marginTop:8}}>
              📄 عرض وتحميل PDF
            </button>

          </div>
        )}
      </div>
    </div>
  )
}

