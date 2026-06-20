// منطق اقتراح خدمة مرضي الأنسب لكل عميل بناءً على وضعه المالي والمسار
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

interface ServiceSuggestion { service: string; icon: string; why: string; }

export function suggestService(fd: SuggestInput, track: Track, score: number): ServiceSuggestion {
  const isDefaulted = fd?.repayment_status === 'default' || fd?.debt_status === 'late';
  const noStatements = fd?.has_financial_statements !== true && fd?.audited_statements !== true;
  const noGovernance = fd?.has_governance !== true;
  const hasDebt = fd?.has_debt === true;
  const qualified = score >= (track === 'ipo' ? 65 : 70);

  if (isDefaulted) {
    return { icon: '🔧', service: 'إعادة الهيكلة المالية ومعالجة التعثّر', why: 'الشركة متعثّرة في السداد — هذه أول خدمة تعيد لها الانتظام وتمهّد لأي خطوة قادمة. ابدأ بها قبل أي شيء.' };
  }
  if (noStatements) {
    return { icon: '📊', service: 'إعداد القوائم المالية المعتمدة', why: 'لا توجد قوائم مالية معتمدة — وهي شرط أساسي لأي ممول أو مستثمر أو جهة رقابية. أوضح خدمة تبدأ بها.' };
  }
  if (noGovernance && (track === 'investment' || track === 'ipo')) {
    return { icon: '🏛️', service: 'بناء الحوكمة المؤسسية', why: 'لا يوجد نظام حوكمة — وهو ما يطمئن المستثمر وتشترطه هيئة السوق المالية. خدمة محورية لرفع جاهزية العميل.' };
  }
  if (hasDebt && !qualified) {
    return { icon: '🗓️', service: 'إعادة جدولة الديون', why: 'لدى الشركة ديون قائمة تضغط على وضعها — إعادة الجدولة تخفّف العبء وترفع جاهزيتها قبل الخطوة الكبيرة.' };
  }
  if (track === 'funding') {
    return { icon: '🏦', service: 'تجهيز ملف التمويل والتفاوض', why: qualified ? 'الشركة مؤهّلة للتمويل — جهّز ملفها وتولَّ التفاوض مع الجهات. فرصة خدمة مباشرة عالية القيمة.' : 'وجّه العميل لتجهيز ملف تمويلي أقوى يرفع فرص قبوله.' };
  }
  if (track === 'investment') {
    return { icon: '📈', service: 'تجهيز ملف عرض المستثمر والتفاوض', why: qualified ? 'الشركة جاذبة للمستثمر — جهّز ملف العرض وتولَّ التفاوض حتى إتمام الصفقة. فرصة خدمة مباشرة عالية القيمة.' : 'ابنِ خطة جذب المستثمر ترفع جاذبية الشركة قبل العرض.' };
  }
  return { icon: '📁', service: 'تجهيز ملف هيئة السوق المالية', why: qualified ? 'الشركة مؤهّلة للطرح — جهّز ملف الهيئة الكامل ورافق العميل في رحلة الإدراج. أعلى خدمة قيمةً.' : 'جهّز الشركة مؤسسياً (حوكمة، لجان، خارطة طريق) لترتقي لمتطلبات الإدراج.' };
}

export function suggestionBox(s: ServiceSuggestion): string {
  return '<div style="background:#FBF5E8;border:2px solid #C9A84C;border-radius:12px;padding:16px 18px;margin:14px 0">'
    + '<div style="color:#9A7B2E;font-size:15px;font-weight:900;margin-bottom:6px">💡 الفرصة البيعية — خدمة مُرضي المقترحة</div>'
    + '<div style="color:#1A3D34;font-size:15px;font-weight:900;margin-bottom:6px">' + s.icon + ' ' + s.service + '</div>'
    + '<div style="color:#6B5A2E;font-size:13.5px;line-height:1.8">' + s.why + '</div>'
    + '</div>';
}
