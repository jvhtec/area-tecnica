import{u as n}from"./useQuery-kdg2pmgf.js";import{s as _}from"./index-NZ6jJLfQ.js";const f=()=>n({queryKey:["jobs-for-selection"],queryFn:async()=>{const r=new Date;r.setHours(0,0,0,0);const{data:e,error:a}=await _.from("jobs").select(`
          id,
          title,
          start_time,
          end_time,
          tour_date_id,
          job_type,
          status,
          tour_date:tour_dates!tour_date_id (
            id,
            tour:tours (
              id,
              name
            )
          )
        `).gte("start_time",r.toISOString()).in("job_type",["single","festival","tourdate"]).neq("status","Completado").order("start_time",{ascending:!0});if(a)throw a;return e==null?void 0:e.map(t=>{var o,s,d,i,u;return{id:t.id,title:t.title,start_time:t.start_time,end_time:t.end_time,tour_date_id:t.tour_date_id,tour_date:t.tour_date?{id:(o=t.tour_date[0])==null?void 0:o.id,tour:{id:(d=(s=t.tour_date[0])==null?void 0:s.tour[0])==null?void 0:d.id,name:(u=(i=t.tour_date[0])==null?void 0:i.tour[0])==null?void 0:u.name}}:null}})}});export{f as u};
