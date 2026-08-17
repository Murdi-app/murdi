const {createClient}=require("@supabase/supabase-js");
const c=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
const ID="d3557269-8b2e-4132-8b2b-8219c2018aa0";
const snap=async()=>{
 const co=await c.from("companies").select("match_notice").eq("id",ID).single();
 const n=await c.from("match_results").select("id",{count:'exact',head:true}).eq("company_id",ID);
 const e=await c.from("match_results").select("id",{count:'exact',head:true}).eq("company_id",ID).not("apply_channel","is",null);
 return {st:co.data?.match_notice, rows:n.count, rich:e.count};
};
(async()=>{
 let prev=await snap();
 console.log("البداية → الحالة:",prev.st,"| صفوف:",prev.rows,"| مُثراة:",prev.rich);
 for(let i=1;i<=6;i++){
  await new Promise(r=>setTimeout(r,30000));
  const n=await snap();
  const grew = n.rows>prev.rows || n.rich>prev.rich;
  console.log(" +"+(i*30)+"ث →",n.st,"| صفوف:",n.rows,"| مُثراة:",n.rich, grew?"↑":"—");
  if(n.st==="ready"){console.log("\n✅ اكتملت المطابقة");break;}
  prev=n;
 }
})();
