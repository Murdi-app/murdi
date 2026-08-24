const {createClient}=require("@supabase/supabase-js");
const c=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
const CO={"HAMMAM":"d3557269-8b2e-4132-8b2b-8219c2018aa0","AFAQ":"faa8f932-09c6-4d3d-936b-6ca0c946cdee"};
(async()=>{
 for(const [name,id] of Object.entries(CO)){
  const r=await c.from("match_results").select("*").eq("company_id",id).order("fit_score",{ascending:false});
  if(r.error){ console.log(name,"ERROR:",r.error.message); continue; }
  const rows=(r.data||[]).map(o=>{
   const s={};
   for(const k of Object.keys(o)){
    if(["id","company_id","created_at","updated_at","match_run_id"].includes(k)) continue;
    let v=o[k]; if(typeof v==="string" && v.length>120) v=v.slice(0,120)+"…";
    if(v!==null && v!=="") s[k]=v;
   }
   return s;
  });
  require("fs").writeFileSync(`/tmp/${name}.json`,JSON.stringify(rows,null,1));
  console.log(name, rows.length, "rows →", `/tmp/${name}.json`);
 }
})();
