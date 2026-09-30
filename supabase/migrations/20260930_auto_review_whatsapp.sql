-- (١) المراجعة الآلية بقواعد (src/lib/autoReview.ts): ما يحسمه المنطق يُحسم، والباقي ينتظر إنساناً.
-- (٢) واتساب المنصة (WhatsApp Business Cloud API) بدل ضي عند غيابها — موقوفٌ حتى يُربط الحساب.
insert into public.award_settings (key, value) values
  ('auto_review_enabled', 'true'),
  ('auto_review_min_confidence', '0.6'),
  ('auto_review_contact_min_confidence', '0.8'),
  ('auto_review_trusted_domains', 'muqawil.org,mc.gov.sa,cr.mc.gov.sa,etimad.sa,tenders.etimad.sa,saudiexchange.sa,argaam.com,sbc.gov.sa'),
  ('whatsapp_api_enabled', 'false'),
  ('whatsapp_phone_number_id', ''),
  ('whatsapp_api_template', ''),
  ('whatsapp_api_lang', 'ar'),
  ('dhai_backup_after_hours', '24')
on conflict (key) do nothing;
alter table public.award_outbox drop constraint if exists award_outbox_channel_check;
alter table public.award_outbox add constraint award_outbox_channel_check check (channel in ('email', 'whatsapp'));
-- الاستشارة التجريبية للشبكات الكبرى نموذجٌ طلبه المالك — لا «جاهزة» تنتظر الإرسال (لم يردّوا)
update public.consultations set status = 'model'
 where assessment_type = 'award_gap' and status = 'ready'
   and award_id in (select id from contract_awards where org_key = 'الشبكاتالكبريللمقاولات');
