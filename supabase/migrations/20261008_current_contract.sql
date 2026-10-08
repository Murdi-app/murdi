-- العقد القائم المسجّل للعميل (٨ أكتوبر): يُبنى عليه «قيمتك بعد تنفيذ عقودك» وتُملأ به بطاقة تمويل العقد.
-- الهامش اختياري: إن غاب يُؤخذ هامش الربح الصافي من القوائم (net_profit ÷ annual_revenue).
alter table public.financial_data
  add column if not exists current_contract_value numeric,
  add column if not exists current_contract_months integer,
  add column if not exists current_contract_collect_days integer,
  add column if not exists current_contract_margin numeric;
