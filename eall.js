const {createClient}=require("@supabase/supabase-js");
const c=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
const ID="faa8f932-09c6-4d3d-936b-6ca0c946cdee";
const N=Number(process.argv[2]||3);
const KEY=process.env.ANTHROPIC_API_KEY;
(async()=>{
 const r=await c.from("match_results").select("id,provider,fit_score").eq("company_id",ID).gt("fit_score",0).is("apply_channel",null).order("fit_score",{ascending:false}).limit(N);
 const d=r.data||[];
 console.log("سنُثري",d.length,"صفاً بالتسلسل…\n");
 for(const o of d){
  process.stdout.write("  "+o.fit_score+" | "+String(o.provider).slice(0,34)+" … ");
  const res=await fetch("https://murdi.sa/api/match/enrich",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({track:"funding",rowId:o.id})});
  const ok=res.ok;
  const chk=await c.from("match_results").select("apply_channel").eq("id",o.id).single();
  console.log(chk.data?.apply_channel? "✓" : (ok?"لم يُكتب":"فشل "+res.status));
  await new Promise(x=>setTimeout(x,3000));
 }
})();
