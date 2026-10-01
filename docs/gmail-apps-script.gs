// مُرضي — جسر بريد partners@murdi.sa إلى المنصة (Google Apps Script داخل الصندوق نفسه).
// يعمل كل ١٥ دقيقة على خوادم Google — والجهاز مغلق — فيرسل الوارد الجديد إلى
// https://murdi.sa/api/inbound/gmail ومعه رمز هوية توقّعه Google. لا سرّ فيه.
// الصلاحيات (appsscript.json): gmail.readonly · script.external_request · script.scriptapp · openid · userinfo.email
// التشغيل الأول: setup() — يُنشئ المؤقّت ويرسل الدفعة الأولى.

var ENDPOINT = 'https://murdi.sa/api/inbound/gmail';

function decode_(data) {
  return Utilities.newBlob(Utilities.base64DecodeWebSafe(data)).getDataAsString('UTF-8');
}

function textOf_(p) {
  if (p.mimeType === 'text/plain' && p.body && p.body.data) return decode_(p.body.data);
  var parts = p.parts || [];
  for (var i = 0; i < parts.length; i++) { var t = textOf_(parts[i]); if (t) return t; }
  if (p.mimeType === 'text/html' && p.body && p.body.data) {
    return decode_(p.body.data).replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
  }
  return '';
}

function header_(m, name) {
  var hs = (m.payload && m.payload.headers) || [];
  for (var i = 0; i < hs.length; i++) if (hs[i].name.toLowerCase() === name) return hs[i].value;
  return '';
}

function pushInbox() {
  var props = PropertiesService.getScriptProperties();
  var seen = JSON.parse(props.getProperty('seen') || '[]');
  var list = Gmail.Users.Messages.list('me', { q: 'in:inbox newer_than:2d -from:me', maxResults: 40 });
  var fresh = (list.messages || []).map(function (m) { return m.id; }).filter(function (id) { return seen.indexOf(id) < 0; });
  if (!fresh.length) return;
  var mails = fresh.map(function (id) {
    var m = Gmail.Users.Messages.get('me', id, { format: 'full' });
    return { id: m.id, threadId: m.threadId, from: header_(m, 'from'), to: header_(m, 'to'), subject: header_(m, 'subject'), date: header_(m, 'date'), text: textOf_(m.payload).slice(0, 12000) };
  });
  var res = UrlFetchApp.fetch(ENDPOINT, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + ScriptApp.getIdentityToken() },
    payload: JSON.stringify({ mails: mails }),
  });
  if (res.getResponseCode() !== 200) throw new Error('murdi ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 200));
  props.setProperty('seen', JSON.stringify(seen.concat(fresh).slice(-600)));
}

function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('pushInbox').timeBased().everyMinutes(15).create();
  pushInbox();
}
