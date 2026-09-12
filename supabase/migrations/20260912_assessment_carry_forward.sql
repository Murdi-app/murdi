-- ═══════════════════════════════════════════════════════════════════════
--  دمج التقييمات: التقييم الجديد يُكمّل القديم ولا يمحوه
--  (٢٠٢٦-٠٩-١٢)
-- ═══════════════════════════════════════════════════════════════════════
--
--  كل قارئٍ في المنصة يأخذ **أحدث صفّ** من `financial_data`: runMatch
--  و matchEngine و generate-file و credit-memo و credit-verdict كلها
--  `order by created_at desc limit 1`. فالصفّ الأحدث هو الحقيقة عملياً.
--
--  ومعنى ذلك أن العميل إذا أعاد التقييم — وهو يعيده كثيراً — غطّى صفُّه
--  الجديد كلَّ ما صُحِّح يدوياً في القديم: سردية دينه، وعدد نقاط بيعه،
--  وأسماء عملائه الكبار، وسنوات قوائمه المدقَّقة. لا يُحذف شيء من القاعدة،
--  لكنه يُحجب عن كل قارئ — والحجب هنا أثره أثر الحذف.
--
--  وقع هذا فعلاً على «شركة النفط السريع» في ١١ سبتمبر ٢٠٢٦: صفٌّ مُثرى في
--  السابعة مساءً، ثم تقييمٌ ثانٍ في العاشرة أخذ مكانه وفيه تمويلٌ واحدٌ من
--  ثلاثة، بلا سردية ولا عدد أجهزة.
--
--  فالقاعدة: ما لم يُجب عنه التقييم الجديد يُنسخ من **أحدث إجابةٍ سابقة**
--  للمنشأة في المسار نفسه — يُمشى على تقييماتها من الأحدث إلى الأقدم، لا على
--  الصفّ السابق وحده، لأن السابق قد يكون هو نفسه ناقصاً. وما أجاب عنه التقييم
--  الجديد يبقى كما أجاب. والفراغ وحده يُملأ — لا الصفر فهو إجابة، ولا `false`.
--
--  وموضعها القاعدة لا الكود عمداً: مسارات الإدراج ثلاثة (تمويل، استثمار،
--  طرح) ويُضاف إليها السكربتات والإدخال الإداري، فوضْعُها في مِشْبَك واحد
--  قبل الإدراج يجعلها تسري على كل طريقٍ إلى الجدول، حاضرِه وقادمِه.
--
--  ويبقى استثناءٌ لا بدّ منه: السؤال الفرعي لا يُورَّث إذا نفى العميل أصلَه.
--  من قال اليوم «لا ديون عليّ» لا تُنسخ إليه أقساط الأمس، وإلا صنع الدمجُ
--  كذبةً أدقَّ من الحذف.

create or replace function public.fd_carry_forward()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prev     jsonb;
  new_j    jsonb := to_jsonb(new);
  merged   jsonb;
  carried  text[] := '{}';
  k        text;
  v        jsonb;
  atype    text := coalesce(new.assessment_type, 'funding');
  never    text[] := array['id','company_id','created_at','updated_at','assessment_type'];
  child    text;

  -- السؤال الأصل ← أسئلته الفرعية التي تسقط عند نفيه
  debt_children   text[] := array['original_loan_amount','debt_remaining','remaining_debt',
                                  'total_financing','monthly_installment','monthly_installments',
                                  'lender_type','lender_name','debt_status','months_late',
                                  'debt_type','debt_type_other','debt_narrative','debt_details',
                                  'financing_type','financing_sources','repayment_status'];
  pos_children    text[] := array['pos_count','pos_types','pos_usage_pct'];
  parent_children text[] := array['parent_company_country','parent_can_guarantee'];
begin
  merged := new_j;

  -- (١) الفراغ يُملأ من أحدث إجابةٍ سابقة للمنشأة — لا من الصفّ السابق وحده.
  --     فالصفّ السابق قد يكون هو نفسه ناقصاً (وهو ما حصل للنفط السريع)،
  --     فيُمشى على التاريخ من الأحدث إلى الأقدم وتُؤخذ أول إجابةٍ غير فارغة.
  for prev in
    select to_jsonb(f)
    from public.financial_data f
    where f.company_id = new.company_id
      and coalesce(f.assessment_type, 'funding') = atype
      and f.id is distinct from new.id
    order by f.created_at desc
    limit 8
  loop
    for k, v in select key, value from jsonb_each(prev) loop
      continue when k = any(never);
      continue when jsonb_typeof(v) = 'null';
      continue when jsonb_typeof(v) = 'string' and btrim(v #>> '{}') = '';
      continue when (merged ? k)
        and jsonb_typeof(merged -> k) <> 'null'
        and not (jsonb_typeof(merged -> k) = 'string' and btrim(merged ->> k) = '');
      merged := jsonb_set(merged, array[k], v);
      carried := carried || k;
    end loop;
  end loop;

  if carried = '{}' then
    return new;
  end if;

  -- (٢) نفيُ الأصل يُسقط فروعه المورَّثة — لا الفروع التي أجاب عنها اليوم
  if lower(coalesce(new_j ->> 'has_debt', '')) in ('false','f','no') then
    foreach child in array debt_children loop
      if child = any(carried) then
        merged := jsonb_set(merged, array[child], coalesce(new_j -> child, 'null'::jsonb));
      end if;
    end loop;
  end if;

  if lower(coalesce(new_j ->> 'has_pos', '')) in ('false','f','no') then
    foreach child in array pos_children loop
      if child = any(carried) then
        merged := jsonb_set(merged, array[child], coalesce(new_j -> child, 'null'::jsonb));
      end if;
    end loop;
  end if;

  if lower(coalesce(new_j ->> 'has_parent_company', '')) in ('false','f','no') then
    foreach child in array parent_children loop
      if child = any(carried) then
        merged := jsonb_set(merged, array[child], coalesce(new_j -> child, 'null'::jsonb));
      end if;
    end loop;
  end if;

  if coalesce(new_j ->> 'activity_type', '') not in ('', 'other_activity')
     and 'activity_type_other' = any(carried) then
    merged := jsonb_set(merged, array['activity_type_other'],
                        coalesce(new_j -> 'activity_type_other', 'null'::jsonb));
  end if;

  if coalesce(new_j ->> 'funding_type', '') <> ''
     and position('other' in (new_j ->> 'funding_type')) = 0
     and 'funding_type_other' = any(carried) then
    merged := jsonb_set(merged, array['funding_type_other'],
                        coalesce(new_j -> 'funding_type_other', 'null'::jsonb));
  end if;

  if coalesce(new_j ->> 'debt_type', '') not in ('', 'other')
     and 'debt_type_other' = any(carried) then
    merged := jsonb_set(merged, array['debt_type_other'],
                        coalesce(new_j -> 'debt_type_other', 'null'::jsonb));
  end if;

  if coalesce(new_j ->> 'debt_status', '') not in ('', 'late') then
    foreach child in array array['months_late','months_late_inv'] loop
      if child = any(carried) then
        merged := jsonb_set(merged, array[child], coalesce(new_j -> child, 'null'::jsonb));
      end if;
    end loop;
  end if;

  new := jsonb_populate_record(new, merged);
  return new;
end;
$$;

drop trigger if exists fd_carry_forward_trg on public.financial_data;

create trigger fd_carry_forward_trg
  before insert on public.financial_data
  for each row execute function public.fd_carry_forward();

comment on function public.fd_carry_forward() is
  'التقييم الجديد يُكمّل أحدث تقييم سابق للمنشأة في المسار نفسه ولا يمحوه؛ والفرع لا يُورَّث إذا نُفي أصله.';
