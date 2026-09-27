-- الفرص الساخنة: خطّ المال
--
-- (١) «طلب ولم يدفع» كان يُقاس بـ`paid_at` على مستوى المنشأة كلها. فالعميل
--     الذي حوّل وينتظر تأكيدنا يظهر «لم يدفع» ويُطلب من الموظفة أن «تذكّره
--     برابطه» — وقع فعلاً: عميلٌ حوّل وبقي في القائمة خمسة أيام بنصٍّ
--     يطالبه بما دفعه. والعميل الذي دفع خدمةً ثم طلب أخرى
--     يختفي طلبه الثاني لأن للمنشأة دفعةً ما. صار القياس بالطلب نفسه.
-- (٢) التحويل المنتظر تأكيده صار صفّاً في الدرجة الأولى: مالٌ وصل ولم يُقيَّد.
-- (٣) عقدٌ لم يُربط بطلبه كان لا يرى دفعته أبداً، فيظهر «لم تُحصّل أتعابه» وقد
--     دُفعت — وقع على عميلٍ دفع يوماً ثم وقّع عقداً بلا ربط في اليوم التالي.
-- (٤) عقد أتعاب النجاح (نسبة من التمويل) لا يُستحقّ فيه شيء قبل الصرف، وكان
--     يظهر «لم تُحصّل أتعابه» بمبلغ صفر فتُطلب من صاحبه حوالةٌ لا يدين بها
--     (وقع على عقدين). صار الصفّ للعقد ذي المبلغ الثابت وحده.
-- (٥) الافتتاح باسم ضي: الفرص الساخنة صفّها بقسمة المالك (٢٧ سبتمبر)،
--     وكانت نصوصه كلها «معك رغد».
create or replace view public.hot_list as
 WITH frozen AS (
         SELECT companies.id
           FROM companies
          WHERE COALESCE(companies.admin_note, ''::text) ~~ '⛔%'::text
        ), client_phones AS (
         SELECT regexp_replace(COALESCE(companies.phone, ''::text), '\D'::text, ''::text, 'g'::text) AS p
           FROM companies
          WHERE COALESCE(companies.phone, ''::text) <> ''::text
        ), live_req AS (
         SELECT sr.id,
            sr.company_id,
            sr.service_title,
            sr.price,
            sr.status,
            sr.created_at
           FROM service_requests sr
          WHERE COALESCE(sr.status, ''::text) <> ALL (ARRAY['completed'::text, 'cancelled'::text, 'rejected'::text])
        ), unpaid_req AS (
         SELECT DISTINCT ON (r.company_id) r.company_id,
            r.service_title,
            r.price,
            r.created_at
           FROM live_req r
          WHERE r.status = 'priced'::text
            AND NOT (EXISTS ( SELECT 1
                   FROM payments p
                  WHERE p.service_request_id = r.id
                    AND p.status = ANY (ARRAY['paid'::text, 'awaiting_confirmation'::text])))
            AND NOT (EXISTS ( SELECT 1
                   FROM payments p
                  WHERE p.service_request_id IS NULL AND p.company_id = r.company_id
                    AND p.paid_at IS NOT NULL AND COALESCE(p.kind, ''::text) <> 'subscription'::text))
          ORDER BY r.company_id, r.created_at DESC
        ), one_assessment AS (
         SELECT DISTINCT ON (("right"(regexp_replace(m.phone, '\D'::text, ''::text, 'g'::text), 9))) m.id,
            m.created_at,
            m.full_name,
            m.phone,
            m.track,
            m.score,
            m.answers,
            m.contacted,
            m.src,
            m.completed,
            m.contacted_at,
            m.outcome,
            m.contact_note,
            m.next_action_at,
            m.company_name
           FROM mini_assessments m
          WHERE m.completed IS TRUE AND m.phone IS NOT NULL AND length(regexp_replace(m.phone, '\D'::text, ''::text, 'g'::text)) >= 9
          ORDER BY ("right"(regexp_replace(m.phone, '\D'::text, ''::text, 'g'::text), 9)), (m.contacted IS TRUE) DESC, m.created_at DESC
        )
 SELECT 'contract'::text AS source,
    c.id::text AS ref_id,
    co.company_name AS name,
    co.owner_name AS person,
    co.phone,
    u.email,
    co.id AS company_id,
    1 AS tier,
    'عقد موقّع لم تُحصّل أتعابه'::text AS reason,
    COALESCE(c.fixed_amount, 0::numeric) AS money,
    c.signed_at AS at,
    'اتصل واطلب التحويل، وأرسل رابط الدفع في نفس المكالمة'::text AS next_step,
    'السلام عليكم، معك مكتب مُرضي. عقدكم موقّع وجاهز للتنفيذ، ونحتاج إتمام التحويل لنبدأ. أرسل لك رابط الدفع الآن؟'::text AS opener
   FROM contracts c
     JOIN companies co ON co.id = c.company_id
     LEFT JOIN auth.users u ON u.id = co.user_id
  WHERE c.signed_at IS NOT NULL AND COALESCE(c.fixed_amount, 0::numeric) > 0::numeric AND NOT (co.id IN ( SELECT frozen.id
           FROM frozen)) AND NOT (EXISTS ( SELECT 1
           FROM payments p
          WHERE p.paid_at IS NOT NULL AND COALESCE(p.kind, ''::text) <> 'subscription'::text AND (p.service_request_id = c.service_request_id OR (p.service_request_id IS NULL OR c.service_request_id IS NULL) AND p.company_id = c.company_id)))
UNION ALL
 SELECT 'transfer'::text AS source,
    p.id::text AS ref_id,
    co.company_name AS name,
    co.owner_name AS person,
    co.phone,
    u.email,
    co.id AS company_id,
    1 AS tier,
    -- ما دفعه العميل لا يُكتب للموظفة: المبلغ في `money` الذي يحذفه الخادم عنها
    'حوّل ثمن طلبه وينتظر تأكيد استلامه'::text AS reason,
    COALESCE(p.amount_sar, 0::numeric) AS money,
    p.created_at AS at,
    'طابِق المبلغ بكشف الحساب ثم أكّده من مكتب الطلبات — العميل دفع، والانتظار علينا لا عليه'::text AS next_step,
    ('السلام عليكم '::text || COALESCE(co.owner_name, ''::text)) || '، معك ضي من مُرضي. وصلنا تحويلك، ونؤكّد استلامه اليوم ونبدأ في طلبك مباشرة.'::text AS opener
   FROM payments p
     JOIN companies co ON co.id = p.company_id
     LEFT JOIN auth.users u ON u.id = co.user_id
  WHERE p.status = 'awaiting_confirmation'::text AND NOT (co.id IN ( SELECT frozen.id
           FROM frozen))
UNION ALL
 SELECT 'ordered'::text AS source,
    co.id::text AS ref_id,
    co.company_name AS name,
    co.owner_name AS person,
    co.phone,
    u.email,
    co.id AS company_id,
    2 AS tier,
    ('طلب «'::text || q.service_title) || '» ولم يدفع'::text AS reason,
    COALESCE(q.price, 0::numeric) AS money,
    q.created_at AS at,
    'ذكّره برابطه — طلبه جاهز عندنا وينتظر تحويله وحده'::text AS next_step,
    ((('السلام عليكم '::text || COALESCE(co.owner_name, ''::text)) || '، معك ضي من مُرضي. طلبك لـ'::text) || q.service_title) || ' جاهز عندنا وينتظر إتمام التحويل. أعيد لك الرابط الحين؟'::text AS opener
   FROM unpaid_req q
     JOIN companies co ON co.id = q.company_id
     LEFT JOIN auth.users u ON u.id = co.user_id
  WHERE NOT (co.id IN ( SELECT frozen.id
           FROM frozen))
UNION ALL
 SELECT 'inquiry'::text AS source,
    i.id::text AS ref_id,
    COALESCE(NULLIF(btrim(i.company_name), ''::text), i.full_name) AS name,
    i.full_name AS person,
    i.phone,
    i.email,
    NULL::uuid AS company_id,
    2 AS tier,
    ('طلب «'::text || i.service_title) || '» من الموقع'::text AS reason,
    0::numeric AS money,
    i.created_at AS at,
    'اتصل اليوم — طلبها بنفسه ويعرف حاجته. تأكّد أنها تخصّه قبل التسعير'::text AS next_step,
    ((((('السلام عليكم '::text || COALESCE(i.full_name, ''::text)) || '، معك ضي من مُرضي للاستشارات المالية. '::text) || 'وصلنا طلبك لـ'::text) || i.service_title) || COALESCE(' لـ'::text || NULLIF(btrim(i.company_name), ''::text), ''::text)) || '. أبي أفهم وضعك بدقيقتين وأقول لك الخطوة والسعر بالضبط. يناسبك الحين؟'::text AS opener
   FROM service_inquiries i
  WHERE COALESCE(i.contacted, false) = false
UNION ALL
 SELECT 'file'::text AS source,
    co.id::text AS ref_id,
    co.company_name AS name,
    co.owner_name AS person,
    co.phone,
    u.email,
    co.id AS company_id,
    2 AS tier,
    'ملف مالي مكتمل وما صدر له عقد'::text AS reason,
    0::numeric AS money,
    co.created_at AS at,
    'اعرض عليه نتيجة المطابقة واطلب الموافقة على العقد'::text AS next_step,
    ('السلام عليكم، معك ضي من منصة مُرضي. ملف '::text || COALESCE(co.company_name, 'منشأتكم'::text)) || ' مكتمل عندنا، وأبي أعطيك نتيجتك والخطوة اللي بعدها. عندك دقيقتين؟'::text AS opener
   FROM companies co
     JOIN financial_data f ON f.company_id = co.id
     LEFT JOIN auth.users u ON u.id = co.user_id
  WHERE NOT (co.id IN ( SELECT frozen.id
           FROM frozen)) AND NOT (EXISTS ( SELECT 1
           FROM contracts c
          WHERE c.company_id = co.id)) AND NOT (co.id IN ( SELECT unpaid_req.company_id
           FROM unpaid_req))
    -- من دفع أو حوّل خرج من صفّ ما قبل الدفع: ملفّه عند رغد لا هنا
    AND NOT (EXISTS ( SELECT 1
           FROM payments p
          WHERE p.company_id = co.id AND p.status = ANY (ARRAY['paid'::text, 'awaiting_confirmation'::text])))
UNION ALL
 SELECT 'assessment'::text AS source,
    m.id::text AS ref_id,
    COALESCE(NULLIF(btrim(m.company_name), ''::text), m.full_name) AS name,
    m.full_name AS person,
    m.phone,
    NULL::character varying AS email,
    NULL::uuid AS company_id,
    3 AS tier,
    'أنهى التقييم بدرجة '::text || COALESCE(m.score, 0)::text AS reason,
    0::numeric AS money,
    m.created_at AS at,
    'اتصل خلال ٤٨ ساعة — تقييمه جاهز وهو ينتظر أن يعرف نتيجته'::text AS next_step,
    ((((((('السلام عليكم '::text || COALESCE(m.full_name, ''::text)) || '، معك ضي من منصة مُرضي للاستشارات المالية. '::text) || 'كنت عبّيت عندنا تقييم الجاهزية'::text) || COALESCE(' لـ'::text || NULLIF(btrim(m.company_name), ''::text), ''::text)) || '، ودرجتك طلعت '::text) || COALESCE(m.score, 0)::text) || ' من ١٠٠. '::text) || 'أبي أعطيك نتيجتك وأقول لك وش الخطوة اللي بعدها. عندك دقيقتين؟'::text AS opener
   FROM one_assessment m
  WHERE NOT (regexp_replace(m.phone, '\D'::text, ''::text, 'g'::text) IN ( SELECT client_phones.p
           FROM client_phones))
UNION ALL
 SELECT 'signup'::text AS source,
    co.id::text AS ref_id,
    co.company_name AS name,
    co.owner_name AS person,
    co.phone,
    u.email,
    co.id AS company_id,
    4 AS tier,
    'سجّل منشأته ولم يُكمل بياناته المالية'::text AS reason,
    0::numeric AS money,
    co.created_at AS at,
    'اتصل واسأله ما الذي أوقفه، وأكملي معه البيانات في المكالمة'::text AS next_step,
    ('السلام عليكم، معك ضي من منصة مُرضي. سجّلت عندنا '::text || COALESCE(co.company_name, 'منشأتك'::text)) || ' وما أكملت التقييم. التقييم مجاني وياخذ دقايق، وأقدر أكمله معك بالمكالمة الحين إذا يناسبك.'::text AS opener
   FROM companies co
     LEFT JOIN auth.users u ON u.id = co.user_id
  WHERE NOT (co.id IN ( SELECT frozen.id
           FROM frozen)) AND NOT (EXISTS ( SELECT 1
           FROM financial_data f
          WHERE f.company_id = co.id)) AND NOT (EXISTS ( SELECT 1
           FROM live_req r
          WHERE r.company_id = co.id))
UNION ALL
 SELECT 'account'::text AS source,
    u.id::text AS ref_id,
    NULL::text AS name,
    NULL::text AS person,
    NULL::text AS phone,
    u.email,
    NULL::uuid AS company_id,
    5 AS tier,
    'أنشأ حساباً ولم يُكمل بيانات منشأته'::text AS reason,
    0::numeric AS money,
    u.created_at AS at,
    'راسله على بريده — لا جوال عنده. سؤال واحد يكشف ما أوقفه'::text AS next_step,
    ('السلام عليكم، معك فريق منصة مُرضي. لاحظنا إنك فتحت حساب عندنا وما أكملت بيانات منشأتك. '::text || 'التقييم مجاني بالكامل ويعطيك درجة جاهزيتك للتمويل ووش ينقصك بالضبط. '::text) || 'إذا واجهتك مشكلة أو عندك سؤال، ردّ على هالرسالة وأنا أساعدك.'::text AS opener
   FROM auth.users u
  WHERE NOT (EXISTS ( SELECT 1
           FROM companies c
          WHERE c.user_id = u.id)) AND u.email IS NOT NULL AND u.email::text !~~ '%@murdi.sa'::text AND u.email::text <> 'hololalmurdi.fs@gmail.com'::text AND NOT (EXISTS ( SELECT 1
           FROM staff s
          WHERE s.user_id = u.id));
