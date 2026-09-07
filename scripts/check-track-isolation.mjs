#!/usr/bin/env node
// حارس عزل المسارات — يُشغَّل قبل أي دفع يمسّ المطابقة:
//   node scripts/check-track-isolation.mjs
//
// السبب: جدول match_results مشترك بين مساري التمويل والاستثمار ومسار دراسة الجدوى.
// أي استعلام يقرأ الجدول بلا تقييد بالمسار سيرى صفوف الجدوى، فتظهر في لوحة التقديم
// أو في عدّادات العميل أو تحجبه عن فتح مساره. هذا الحارس يمنع ذلك من التسلل صامتاً.
//
// المسموح بلا تقييد بالمسار:
//   1) الإدخال .insert(...) — كل صف يحمل مساره في بياناته، فلا معنى لمُرشِّح هنا
//   2) تحديث صف واحد بعينه عبر .eq('id', ...) لأنه مأخوذ أصلاً من استعلام مقيَّد
// وما عدا ذلك يجب أن يحمل .eq('track', ...) أو .in('track', [...]).

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'src';
// المقطع المفحوص بعد اسم الجدول: يجب أن يسع سلسلة نداءات طويلة —
// في enrich مثلاً يقع .eq('id', row.id) بعد كائن تحديث من ثلاثة عشر سطراً
const WINDOW = 1500;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const offenders = [];
let checked = 0;

for (const file of walk(ROOT)) {
  const src = readFileSync(file, 'utf8');
  let i = -1;
  while ((i = src.indexOf("from('match_results')", i + 1)) !== -1) {
    checked++;
    // نافذتان لا واحدة، لأن الشرطين ليسا سواءً:
    //
    // • قيدُ المسار قد يُضاف على سطرٍ لاحق حين يُبنى الاستعلام على متغيّر
    //   (`let q = …` ثم `q = q.eq('track', track)`) — فيُبحث عنه في نافذة واسعة.
    // • أما `.eq('id', …)` فيُبحث عنه في الجملة وحدها: كان يُبحث عنه في
    //   النافذة الواسعة، فيقع فيها معرّفٌ من استعلامٍ آخر لا علاقة له فيُبرَّأ
    //   استعلامٌ يقرأ كل المسارات. وقع فعلاً على `contract-file` فمرّ وهو مذنب.
    const wide = src.slice(i, i + WINDOW).replace(/\s+/g, ' ');
    const raw = src.slice(i, i + WINDOW);
    const end = raw.indexOf(';');
    const stmt = (end === -1 ? raw : raw.slice(0, end)).replace(/\s+/g, ' ');
    const chunk = stmt;
    // الإدخال يحمل المسار في صفوفه نفسها
    if (/^from\('match_results'\)\s*\.insert\(/.test(chunk)) continue;
    // التحديث الموجَّه لصفٍّ واحد بمعرّفه آمنٌ بالبناء، ولو طال جسمه فتجاوز
    // النافذة قبل أن يصل إلى `.eq('id')`. فيُقبل حين يظهر المعرّف في الواسعة.
    if (/^from\('match_results'\)\s*\.update\(/.test(chunk) && wide.includes(".eq('id'")) continue;
    const scoped = wide.includes(".eq('track'") || wide.includes(".in('track'");
    const byId = stmt.includes(".eq('id'");
    if (scoped || byId) continue;
    offenders.push({ file, line: src.slice(0, i).split('\n').length, chunk: chunk.slice(0, 140) });
  }
}

if (offenders.length === 0) {
  console.log(`✅ عزل المسارات سليم — ${checked} استعلاماً على match_results، كلها مقيّدة بالمسار أو موجّهة لصف واحد.`);
  process.exit(0);
}

console.error(`❌ ${offenders.length} استعلاماً على match_results بلا تقييد بالمسار — صفوف دراسة الجدوى ستظهر فيها:\n`);
for (const o of offenders) console.error(`   ${o.file}:${o.line}\n      ${o.chunk}\n`);
console.error("العلاج: أضف .in('track', ['funding', 'investment']) لمسارات التمويل، أو .eq('track', 'feasibility') لمسار الجدوى.");
process.exit(1);
