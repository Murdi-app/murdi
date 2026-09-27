<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# اقرأ هذا قبل أي شيء

**١) الردّ على مالك المشروع بالعربية دائماً** — هو يكتب بالعربية، ويُردّ عليه بها، ولو كان السؤال تقنياً بحتاً. ولا تُعرض عليه قائمة خيارات في عملٍ تقني: يُقرَّر أمتنُ إصلاحٍ ويُنفَّذ ويُبلَّغ به.

**٢) نقطة الاستئناف وحالةُ العمل كلُّها في:**

```
Claude outputs/نقطة-الاستئناف.md
```

**افتحه أولاً** — فيه القسمة بين الموظفتين، وخطُّ المال، وما ينتظر كلمة المالك، وعائلتا العطب المتكرّرتان في هذا المستودع، وما بقي بناؤه.
والمجلد `Claude outputs/` **مُستثنى من Git** عمداً: فيه أسماء عملاء وأرقام، والمستودع عام. فلا يُنقل منه شيءٌ إلى ملفٍّ يُدفع.

**٣) لا تُنشئ ملفَّ استئنافٍ جديداً** — حدِّث ذاك الملف نفسه في آخر جلستك.

**٤) الفحص الحقيقي `npx tsc --noEmit`.** و`npx next build` يفشل في الحاويات السحابية لأن خطوط Google محجوبة — وليس ذلك عطباً في الكود.
