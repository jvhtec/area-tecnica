import{s as r}from"./index-NZ6jJLfQ.js";const i=async t=>{try{const{error:e}=await r.from("job_assignments").delete().eq("job_id",t);if(e)throw e}catch(e){throw e}},n=async t=>{try{const{error:e}=await r.from("job_departments").delete().eq("job_id",t);if(e)throw e}catch(e){throw e}},l=async t=>{try{const{error:e}=await r.from("job_date_types").delete().eq("job_id",t);if(e)throw e}catch(e){throw e}},d=async t=>{try{const{error:e}=await r.from("festival_logos").delete().eq("job_id",t);if(e)throw e}catch(e){throw e}},w=async t=>{try{const{error:e}=await r.from("flex_folders").delete().eq("job_id",t);if(e)throw e}catch(e){throw e}},f=async t=>{try{const{data:e,error:a}=await r.from("flex_crew_calls").select(`
        id,
        department,
        flex_crew_assignments (
          id,
          technician_id,
          flex_line_item_id
        )
      `).eq("job_id",t);if(a||!e||e.length===0)return;for(const o of e)for(const c of o.flex_crew_assignments)try{const{error:s}=await r.functions.invoke("manage-flex-crew-assignments",{body:{job_id:t,technician_id:c.technician_id,department:o.department,action:"remove"}})}catch{}}catch{}},h=async t=>{try{let e=null;try{const{data:o}=await r.from("jobs").select("title").eq("id",t).single();e=(o==null?void 0:o.title)||null}catch{}await f(t),await i(t),await n(t),await l(t),await d(t),await w(t);const{error:a}=await r.from("jobs").delete().eq("id",t);if(a)throw a;try{r.functions.invoke("push",{body:{action:"broadcast",type:"job.deleted",job_id:t,title:e}})}catch{}}catch(e){throw e}},y=async t=>{try{return await h(t),{success:!0,details:"Job deleted successfully and cleanup completed"}}catch(e){return{success:!1,error:e.message||"Unknown deletion error"}}};export{l as a,y as d};
