-- (١) اقتراح Codex لنصٍّ (قالب أو فرضية) إذا قُبل صار مسوّدةً تنتظر اعتماد المالك — لا يخرج قبله.
-- (٢) إشعار «نعم»/الرد يصل المالك مرةً واحدة لكل فرصة، أيّاً كان مسجّل الرد.
alter table public.contract_awards add column if not exists reply_notified_at timestamptz;
update public.contract_awards set reply_notified_at = replied_at where replied_at is not null and reply_notified_at is null;

create or replace function public.accept_template_rec(v jsonb) returns text
language plpgsql security definer set search_path = public as $$
begin
  if v->>'target' = 'hypothesis' then
    insert into award_hypotheses (category, stage, hypothesis, question, replies, approved, updated_at)
    values (v->>'category', v->>'stage', v->>'hypothesis', v->>'question', coalesce(v->'replies', '{}'), false, now())
    on conflict (category, stage) do update set hypothesis = excluded.hypothesis, question = excluded.question,
      replies = excluded.replies, approved = false, updated_at = now();
    return 'فرضية ' || coalesce(v->>'category', '') || '/' || coalesce(v->>'stage', '') || ' — مسوّدة تنتظر اعتماد المالك';
  elsif v->>'target' = 'template' then
    update award_message_templates set subject = coalesce(v->>'subject', subject),
      context_paragraph = coalesce(v->>'context_paragraph', context_paragraph), approved = false, updated_at = now()
     where category = v->>'category' and stage = v->>'stage';
    return 'قالب ' || coalesce(v->>'category', '') || '/' || coalesce(v->>'stage', '') || ' — ينتظر اعتماد المالك';
  end if;
  return 'اقتراحٌ بلا هدفٍ معروف (target: hypothesis | template) — لم يُكتب شيء';
end $$;
revoke all on function public.accept_template_rec(jsonb) from public, anon, authenticated;

-- accept_recommendation: نوع «template» يمرّ على accept_template_rec (مسوّدةٌ تنتظر الاعتماد)،
-- و«لا تتواصل» لا تمنع اقتراح النصوص. والتعديلات لا تكتب updated_at بنفسها (مشغّل award_set_updated_at).
-- النص الكامل للدالة كما طُبّق في القاعدة:
-- (انظر 20260929_awards_channel.sql للأصل؛ الفرق: elsif r.kind = 'template' then done := accept_template_rec(v);)
