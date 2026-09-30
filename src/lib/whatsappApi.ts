import type { SupabaseClient } from '@supabase/supabase-js';

// واتساب من المنصة — WhatsApp Business Cloud API (Meta). قالبٌ معتمد من Meta لأول رسالة.
// ★ الرمز (token) في app_config.whatsapp_token — يضعه المالك من شاشته ولا يُعرض بعدها، ولا في الكود.
// ★ الرقم والقالب واللغة والتشغيل في award_settings. ما لم يُفعَّل لا يخرج شيء.

export type WaConfig = { enabled: boolean; phoneNumberId: string; template: string; lang: string; token: string };

export async function waConfig(sb: SupabaseClient): Promise<WaConfig> {
  const [{ data: s }, { data: t }] = await Promise.all([
    sb.from('award_settings').select('key, value').in('key', ['whatsapp_api_enabled', 'whatsapp_phone_number_id', 'whatsapp_api_template', 'whatsapp_api_lang']),
    sb.from('app_config').select('value').eq('key', 'whatsapp_token').maybeSingle(),
  ]);
  const m = Object.fromEntries((s || []).map((r) => [String(r.key), String(r.value)]));
  const token = String(t?.value || '');
  return {
    enabled: m.whatsapp_api_enabled === 'true' && !!token && !!m.whatsapp_phone_number_id && !!m.whatsapp_api_template,
    phoneNumberId: m.whatsapp_phone_number_id || '', template: m.whatsapp_api_template || '', lang: m.whatsapp_api_lang || 'ar', token,
  };
}

/** رسالة قالبٍ معتمد — params تملأ متغيّرات جسم القالب بالترتيب ({{1}} · {{2}} …) */
export async function sendWaTemplate(c: WaConfig, to: string, params: string[]): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
  try {
    const r = await fetch('https://graph.facebook.com/v21.0/' + c.phoneNumberId + '/messages', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + c.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', to, type: 'template',
        template: { name: c.template, language: { code: c.lang }, components: params.length ? [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }] : [] },
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, reason: 'Meta ' + r.status + ': ' + String(j?.error?.message || 'خطأ') };
    return { ok: true, id: String(j?.messages?.[0]?.id || '') };
  } catch (e) { return { ok: false, reason: e instanceof Error ? e.message : 'تعذّر الاتصال بـ Meta' }; }
}
