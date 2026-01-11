import{l as b,r as i,s as r}from"./index-NZ6jJLfQ.js";import{l}from"./logo-url-cache-eY6nfvu7.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const O=b("FileCheck",[["path",{d:"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",key:"1rqfz7"}],["path",{d:"M14 2v4a2 2 0 0 0 2 2h4",key:"tnqrlb"}],["path",{d:"m9 15 2 2 4-4",key:"1grp1n"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const E=b("FilePlus",[["path",{d:"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",key:"1rqfz7"}],["path",{d:"M14 2v4a2 2 0 0 0 2 2h4",key:"tnqrlb"}],["path",{d:"M9 15h6",key:"cctwl0"}],["path",{d:"M12 18v-6",key:"17g6i2"}]]),F=y=>{const[j,f]=i.useState(!0),[_,m]=i.useState([]),[v,u]=i.useState(null);return i.useEffect(()=>{(async()=>{f(!0),u(null);try{const{data:g,error:p}=await r.from("festival_logos").select(`
            id,
            file_path,
            job_id,
            jobs:jobs(title)
          `).order("uploaded_at",{ascending:!1});if(p)throw p;const{data:k,error:c}=await r.from("tour_logos").select(`
            id, 
            file_path,
            tour_id,
            tours:tours(name)
          `).order("uploaded_at",{ascending:!1});if(c)throw c;const d=[];for(const o of(g||[]).filter(e=>e.jobs!==null)){let e="Unknown Job";o.jobs&&(Array.isArray(o.jobs)?e=o.jobs.length>0&&o.jobs[0]&&typeof o.jobs[0].title=="string"?o.jobs[0].title:"Unknown Job":o.jobs&&typeof o.jobs=="object"&&"title"in o.jobs&&(e=o.jobs.title||"Unknown Job"));let t=l.get("festival-logos",o.file_path);if(!t){const{data:s,error:a}=await r.storage.from("festival-logos").createSignedUrl(o.file_path,3600);if(s!=null&&s.signedUrl)t=s.signedUrl,l.set("festival-logos",o.file_path,t,27e5);else{const{data:n}=r.storage.from("festival-logos").getPublicUrl(o.file_path);t=(n==null?void 0:n.publicUrl)??"",t&&l.set("festival-logos",o.file_path,t,9e5)}}d.push({value:`job-${o.id}`,label:`Job: ${e}`,url:t,type:"job"})}const h=[];for(const o of(k||[]).filter(e=>e.tours!==null)){let e="Unknown Tour";o.tours&&(Array.isArray(o.tours)?e=o.tours.length>0&&o.tours[0]&&typeof o.tours[0].name=="string"?o.tours[0].name:"Unknown Tour":o.tours&&typeof o.tours=="object"&&"name"in o.tours&&(e=o.tours.name||"Unknown Tour"));let t=l.get("tour-logos",o.file_path);if(!t){const{data:s}=await r.storage.from("tour-logos").createSignedUrl(o.file_path,3600);if(s!=null&&s.signedUrl)t=s.signedUrl,l.set("tour-logos",o.file_path,t,27e5);else{const{data:a}=r.storage.from("tour-logos").getPublicUrl(o.file_path);t=(a==null?void 0:a.publicUrl)??"",t&&l.set("tour-logos",o.file_path,t,9e5)}}h.push({value:`tour-${o.id}`,label:`Tour: ${e}`,url:t,type:"tour"})}m([...d,...h])}catch{u("Failed to load logo options")}finally{f(!1)}})()},[y]),{logoOptions:_,isLoading:j,error:v}};export{O as F,E as a,F as u};
