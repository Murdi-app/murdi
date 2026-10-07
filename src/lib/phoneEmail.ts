// ★ ٧ أكتوبر (بأمر المالك — «مسار العميل واحد»): عميلٌ بلا بريد يُفتح حسابه على جواله بعنوانٍ داخلي
//   لا صندوق له. فلا يُراسَل بريداً أبداً (sendMail يرفضه، و`party` لا يعيده)، ورسائله واتساب من الموظفة.
export const PHONE_EMAIL_DOMAIN = 'wa.murdi.sa';
export const phoneEmail = (phone: string) => 'c' + String(phone || '').replace(/\D/g, '') + '@' + PHONE_EMAIL_DOMAIN;
export const isPhoneEmail = (email: unknown) => String(email || '').toLowerCase().endsWith('@' + PHONE_EMAIL_DOMAIN);
