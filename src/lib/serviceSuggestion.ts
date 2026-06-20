// منطق اقتراح خدمة مُرضي الأنسب لكل عميل بناءً على وضعه المالي والمسار
type Track = 'funding' | 'investment' | 'ipo';

interface SuggestInput {
  repayment_status?: unknown;
  debt_status?: unknown;
  has_financial_statements?: unknown;
  audited_statements?: unknown;
  has_governance?: unknown;
  has_debt?: unknown;
  [key: string]: unknown;
}

// urgency: 'required' = ضروري قبل التقديم | 'recommended' = يقوّي فرصه | 'none' = ملف سليم، قدّمه مباشرة
interface ServiceSuggestion { service: string; icon: string; why: string; urgency: 'required' | 'recommended' | 'none'; }

export function suggestService(fd: SuggestInput, track: Track, score: number): ServiceSuggestion {
  const isDefaulted = fd?.repayment_status === 'default' || fd?.debt_status === 'late';
  const noStatements = fd?.has_financial_statements !== true && fd?.audited_statements !== true;
  const noGovernance = fd?.has_governance !== true;
  const hasDebt = fd?.has_debt === true;
  const qualified = score >= (track === 'ipo' ? 65 : 70);

  // ===== حالات ضرورية (يحتاج إصلاح قبل التقديم) =====
  if (isDefaulted) {
    return { urgency: 'required', icon: '🔧', service: 'إعادة الهيكلة المالية ومعالجة التعثّر', why: 'الشركة متعثّرة في السداد — لا يمكن التقديم لأي جهة قبل معالجة التعثّر. هذه أول خدمة ضرورية.' };
  }
  if (noStatements && (track === 'investment' || track === 'ipo')) {
    return { urgency: 'required', icon: '📊', service: 'إعداد القوائم المالية المعتمدة', why: 'لا توجد قوائم مالية معتمدة — وهي شرط أساسي للمستثمر والجهات الرقابية. ضرورية قبل التقديم.' };
  }
  if (noGovernance && track === 'ipo') {
    return { urgency: 'required', icon: '🏛️', service: 'بناء الحوكمة المؤسسية', why: 'لا يوجد نظام حوكمة — وهو شرط تشترطه هيئة السوق المالية للطرح. ضروري قبل التقدّم للإدراج.' };
  }

  // ===== ملف سليم + مؤهّل: قدّمه مباشرة، لا تُرهق العميل =====
  if (qualified && !hasDebt && !noStatements && !noGovernance) {
    const direct: Record<Track, string> = {
      funding: 'ملف الشركة سليم ومؤهّل للتمويل — قدّمه مباشرة للجهات التي رشّحها البحث، دون الحاجة لأي خدمة تجهيز. وفّر على العميل.',
      investment: 'ملف الشركة سليم وجاذب للمستثمر — قدّمه مباشرة للجهات المرشّحة، دون الحاجة لخدمة تجهيز. وفّر على العميل.',
      ipo: 'ملف الشركة سليم ومؤهّل للطرح — يمكن البدء برحلة الإدراج مع المستشار المرخّص مباشرة.',
    };
    return { urgency: 'none', icon: '✅', service: 'قدّمه مباشرة — لا حاجة لخدمة تجهيز', why: direct[track] };
  }

  // ===== موصى به (يقوّي فرصه، اختياري) =====
  if (noStatements && track === 'funding') {
    return { urgency: 'recommended', icon: '📊', service: 'إعداد القوائم المالية المعتمدة', why: 'بعض منتجات التمويل لا تشترط قوائم مدققة (نقاط بيع، كشف حساب). لكن إعدادها يفتح خيارات أوسع وبشروط أفضل — اعرضها إن رغب العميل.' };
  }
  if (hasDebt && !qualified) {
    return { urgency: 'recommended', icon: '🗓️', service: 'إعادة جدولة الديون', why: 'لدى الشركة ديون تضغط على وضعها — إعادة الجدولة تخفّف العبء وترفع فرص القبول. خدمة تقوّي ملفه.' };
  }
  if (noGovernance && track === 'investment') {
    return { urgency: 'recommended', icon: '🏛️', service: 'بناء الحوكمة المؤسسية', why: 'نظام الحوكمة يطمئن المستثمر ويرفع التقييم. ليست شرطاً إلزامياً لكنها تقوّي العرض كثيراً.' };
  }

  // ===== المؤهّل في مساره: خدمة تجهيز احترافية (تقوّي، اختيارية) =====
  if (track === 'funding') {
    return { urgency: 'recommended', icon: '🏦', service: 'تجهيز ملف التمويل والتفاوض', why: 'الشركة مؤهّلة. تجهيز الملف احترافياً والتفاوض نيابةً عنها يرفع فرص القبول وبشروط أفضل — خدمة بعمولة نجاح عند صدور الموافقة.' };
  }
  if (track === 'investment') {
    return { urgency: 'recommended', icon: '📈', service: 'تجهيز ملف عرض المستثمر والتفاوض', why: 'الشركة جاذبة. تجهيز ملف العرض والتفاوض نيابةً عنها يرفع فرص الصفقة وبتقييم أفضل — خدمة بعمولة نجاح عند إتمام الاستثمار.' };
  }
  return { urgency: 'recommended', icon: '📁', service: 'تجهيز ملف هيئة السوق المالية', why: 'الشركة في طريقها للطرح. تجهيز ملف الهيئة الكامل ومرافقة رحلة الإدراج خدمة عالية القيمة.' };
}

export function suggestionBox(s: ServiceSuggestion): string {
  const theme = s.urgency === 'required'
    ? { bg: '#FBECEC', border: '#C0564B', label: '🔴 خدمة ضرورية قبل التقديم', labelColor: '#A33' }
    : s.urgency === 'none'
    ? { bg: '#EAF7F0', border: '#2E9E7B', label: '✅ لا حاجة لخدمة — قدّمه مباشرة', labelColor: '#1E7A5A' }
    : { bg: '#FBF5E8', border: '#C9A84C', label: '💡 خدمة موصى بها (تقوّي فرصه)', labelColor: '#9A7B2E' };
  return '<div style="background:' + theme.bg + ';border:2px solid ' + theme.border + ';border-radius:12px;padding:16px 18px;margin:14px 0">'
    + '<div style="color:' + theme.labelColor + ';font-size:14px;font-weight:900;margin-bottom:6px">' + theme.label + '</div>'
    + '<div style="color:#1A3D34;font-size:15px;font-weight:900;margin-bottom:6px">' + s.icon + ' ' + s.service + '</div>'
    + '<div style="color:#5C4A1F;font-size:13.5px;line-height:1.8">' + s.why + '</div>'
    + '</div>';
}
