import { NextResponse } from 'next/server';
import { runAutoMatch, enrichApplyPaths } from '@/lib/matchEngine';
import { logError } from '@/lib/logError';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  const { secret, companyId, track } = await req.json().catch(() => ({}));
  if (!secret || secret !== process.env.WORKER_SECRET) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
  const t = track === 'investment' ? 'investment' : 'funding';
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
  try {
    let batch = 0;
    for (let i = 0; i < 40; i++) {
      const r = await runAutoMatch(companyId, t as 'funding' | 'investment', batch);
      if (r.done) break;
      batch = r.next;
    }
    await enrichApplyPaths(companyId, t);
    const { count } = await admin.from('match_results').select('id', { count: 'exact', head: true })
      .eq('company_id', companyId).eq('track', t).eq('status', 'new').gt('fit_score', 0);
    const { data: cpx } = await admin.from('companies').select('match_progress').eq('id', companyId).maybeSingle();
    const progx = (cpx?.match_progress || {}) as Record<string, unknown>;
    progx[t] = 'done';
    await admin.from('companies').update({ match_notice: 'ready', match_progress: progx }).eq('id', companyId);
    try {
      const { data: co2 } = await admin.from('companies').select('user_id').eq('id', companyId).single();
      const rec = (co2 || {}) as Record<string, unknown>;
      let to = '';
      if (rec.user_id) {
        const { data: pf } = await admin.from('profiles').select('email').eq('id', rec.user_id).maybeSingle();
        to = String((pf as Record<string, unknown> | null)?.email || '');
      }
      if (!to.includes('@')) await logError('match.noClientEmail', new Error('no client email'), { company_id: companyId });
      if (to.includes('@')) {
        const { Resend } = await import('resend');
        await new Resend(process.env.ANTHROPIC_API_KEY ? process.env.RESEND_API_KEY : process.env.RESEND_API_KEY).emails.send({
          from: '\u0645\u064f\u0631\u0636\u064a <noreply@murdi.sa>',
          to,
          subject: '\u062c\u0647\u0627\u062a\u0643 \u062c\u0627\u0647\u0632\u0629 \u2014 \u0645\u064f\u0631\u0636\u064a',
          html: '<div dir="rtl" style="font-family:Arial;line-height:1.9;color:#1A3D34">'
            + '<h2 style="color:#1A3D34">\u062c\u0647\u0627\u062a\u0643 \u062c\u0627\u0647\u0632\u0629</h2>'
            + '<p>\u0627\u0643\u062a\u0645\u0644\u062a \u0645\u0637\u0627\u0628\u0642\u0629 \u0645\u0644\u0641\u0643 \u0645\u0639 \u0634\u0628\u0643\u0629 \u062c\u0647\u0627\u062a \u0645\u064f\u0631\u0636\u064a\u060c \u0648\u0641\u0631\u064a\u0642 \u062f. \u0639\u0628\u062f\u0627\u0644\u062d\u0643\u064a\u0645 \u064a\u0631\u0627\u062c\u0639\u0647\u0627 \u0627\u0644\u0622\u0646 \u0648\u064a\u0628\u062f\u0623 \u0627\u0644\u062a\u0642\u062f\u064a\u0645 \u0646\u064a\u0627\u0628\u0629\u064b \u0639\u0646\u0643.</p>'
            + '<p><a href="https://murdi.sa/goal" style="background:#1A3D34;color:#fff;padding:12px 26px;border-radius:8px;text-decoration:none;font-weight:bold">\u0627\u0641\u062a\u062d \u0645\u0644\u0641\u0643</a></p></div>',
        });
      }
    } catch (e) { await logError('match.notifyClient', e, { company_id: companyId }); }
    return NextResponse.json({ ok: true, count: count || 0 });
  } catch (e) {
    await logError('match.worker', e, { company_id: companyId, entity: t });
    return NextResponse.json({ error: 'فشل' }, { status: 500 });
  }
}
