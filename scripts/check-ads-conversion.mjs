import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function requireText(source, expected, message) {
  if (!source.includes(expected)) throw new Error(message);
}

const layout = read('src/app/layout.tsx');
const conversion = read('src/lib/adsConversion.ts');
const inquiryApi = read('src/app/api/services/inquiry/route.ts');

requireText(layout, 'googletagmanager.com/gtag/js?id=AW-17947401948', 'وسم Google Ads غير محمّل في التخطيط الجذر');
requireText(layout, "gtag('config', 'AW-17947401948')", 'تهيئة Google Ads مفقودة');
requireText(conversion, "const ADS_ID = 'AW-17947401948'", 'معرّف حساب Google Ads تغيّر أو حُذف');
requireText(conversion, 'PWyPCLb8s_YcENy9_uIc', 'ملصق تحويل العميل المحتمل تغيّر أو حُذف');
requireText(conversion, "g('set', 'user_data', ud)", 'بيانات الإحالة المحسّنة لا تُرسل');
requireText(conversion, "g('event', 'conversion', payload)", 'حدث التحويل لا يُطلق');
requireText(conversion, 'send_to: sendTo', 'وجهة التحويل لا تُرسل');
requireText(conversion, 'whenTagReady', 'حدث التحويل لا ينتظر جاهزية وسم Google');
requireText(inquiryApi, 'already: true', 'حماية الطلبات المكررة أو الوهمية مفقودة');

const entrypoints = [
  'src/app/services/request/page.tsx',
  'src/app/jadwa/page.tsx',
  'src/app/uqud/page.tsx',
  'src/app/test/page.tsx',
  'src/components/MiniAssessment.tsx',
];

for (const path of entrypoints) {
  const source = read(path);
  requireText(source, 'fireConversion', `${path}: استدعاء التحويل مفقود`);
  requireText(source, 'LEAD_SUBMITTED', `${path}: معرّف تحويل العميل المحتمل مفقود`);
}

for (const path of entrypoints.slice(0, 3)) {
  const source = read(path);
  requireText(source, '!d?.already', `${path}: الطلب المكرر قد يُحتسب تحويلاً جديداً`);
}

console.log('✅ تتبع Google Ads سليم في الوسم ومسارات العملاء الخمسة.');
