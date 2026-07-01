export const metadata = { title: 'إخلاء المسؤولية — مُرضي' }

export default function Page() {
  return (
    <div style={{minHeight:'100vh',background:'#F4F8F6',direction:'rtl',fontFamily:'system-ui,-apple-system,Segoe UI,Tahoma,Arial'}}>
      <div style={{background:'#1A3D34',padding:'28px 24px',textAlign:'center'}}>
        <a href="/" style={{color:'#2E9E7B',fontSize:'22px',fontWeight:900,textDecoration:'none'}}>مُرضي Murdi</a>
      </div>
      <div style={{maxWidth:'860px',margin:'0 auto',padding:'48px 24px 80px'}}>
        <h1 style={{color:'#1A3D34',fontSize:'26px',fontWeight:900,marginBottom:'6px'}}>إخلاء المسؤولية</h1>
        <p style={{color:'#6B8A80',fontSize:'14px',marginBottom:'32px'}}>إشعار مهم بشأن طبيعة خدمات مُرضي.</p>
        <section style={{marginBottom:'28px'}}>
          <h2 style={{color:'#1A3D34',fontSize:'19px',fontWeight:800,marginBottom:'10px'}}>إخلاء المسؤولية</h2>
          <div style={{color:'#3A4D47',fontSize:'15px',lineHeight:2}}>تقدّم منصة مُرضي خدمات تقييم الجاهزية والاستشارات وتجهيز الملفات، ولا تقدّم أي ضمان بالحصول على التمويل أو الاستثمار أو الطرح أو أي موافقات من أي جهة. وتعتمد النتائج على البيانات التي يقدّمها العميل، وعلى الجهات ذات العلاقة، والأنظمة والإجراءات المعمول بها. لا تتحمّل الشركة مسؤولية أي قرار يتخذه العميل أو أي جهة خارجية بناءً على مخرجات المنصة.</div>
        </section>
        <p style={{color:'#9DB3AB',fontSize:'12px',borderTop:'1px solid #E0EAE5',paddingTop:'20px',marginTop:'32px'}}>آخر تحديث: يوليو 2026 · شركة حلول المرضي للاستشارات المالية · السجل التجاري 7039663724 · رخصة FL-457927015</p>
        <p style={{textAlign:'center',marginTop:'28px'}}><a href="/" style={{color:'#2E9E7B',fontSize:'14px',fontWeight:700,textDecoration:'none'}}>← العودة للرئيسية</a></p>
      </div>
    </div>
  )
}
