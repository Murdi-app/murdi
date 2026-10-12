-- أسئلة الاستشارة المختصرة لكل من سجّل (١٢ أكتوبر، المالك): تُكتب لكل عميلٍ على وضعه،
-- وترسلها ضي واتساب، وتلصق إجاباته — فتُبنى عليها استشارته.
alter table public.service_inquiries
  add column if not exists ask_message text,
  add column if not exists ask_sent_at timestamptz,
  add column if not exists ask_reply text,
  add column if not exists ask_reply_at timestamptz;
