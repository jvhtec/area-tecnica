
import {createClient} from "npm:@supabase/supabase-js@2";
import {isValidFileName} from "./filename.ts";
export const ROOT=Deno.env.get("SUPABASE_URL")||"";
const SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
export const SOURCE=ROOT+"/functions/v1/ios-share-import";
export const MAX=45*1024*1024;
export const BUCKET="job_documents";
export const HEAD={"Cache-Control":"no-store","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY","Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type,X-Share-Token"};
export class ErrorCode extends Error{constructor(public status:number,public code:string){super(code)}}
export const admin=()=>createClient(ROOT,SERVICE,{auth:{autoRefreshToken:false,persistSession:false}});
const hash=async(v:string)=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v)))].map(x=>x.toString(16).padStart(2,"0")).join("");
export async function auth(token:string){
 if(!/^ati_[0-9a-f]{64}$/.test(token))throw new ErrorCode(401,"invalid_token");
 const c=admin();
 const {data,error}=await c.from("ios_share_import_tokens").select("id,user_id,revoked_at,expires_at").eq("token_hash",await hash(token)).maybeSingle();
 if(error)throw new ErrorCode(503,"authorization_unavailable");
 if(!data||data.revoked_at||(data.expires_at&&Date.parse(data.expires_at)<Date.now()))throw new ErrorCode(401,"token_revoked");
 const {data:profile,error:err}=await c.from("profiles").select("role").eq("id",data.user_id).maybeSingle();
 if(err||!profile||!["admin","management","logistics","house_tech"].includes(profile.role))throw new ErrorCode(403,"not_authorized");
 return data.id as string;
}
export function filename(s:string){
 if(!isValidFileName(s))throw new ErrorCode(400,"invalid_file_name");
 return s;
}
export type Ticket={v:1,token:string,path:string,id:string,name:string,size:number,expiry:number};
async function aes(){
 const material=await crypto.subtle.digest("SHA-256",new TextEncoder().encode("area-tecnica-shortcut-handoff-v1:"+SERVICE));
 return crypto.subtle.importKey("raw",material,"AES-GCM",false,["encrypt","decrypt"]);
}
const b64=(data:Uint8Array)=>btoa(Array.from(data,x=>String.fromCharCode(x)).join("")).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
function unb64(s:string){
 if(!/^[A-Za-z0-9_-]+$/.test(s))throw new ErrorCode(401,"bad_ticket");
 try{return Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-s.length%4)%4)),c=>c.charCodeAt(0))}
 catch{throw new ErrorCode(401,"bad_ticket")}
}
export async function seal(t:Ticket){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},await aes(),new TextEncoder().encode(JSON.stringify(t))));
 const combined=new Uint8Array(12+encrypted.length);combined.set(iv);combined.set(encrypted,12);
 return b64(combined);
}
export async function unseal(raw:string|null):Promise<Ticket>{
 if(!raw||raw.length>2048)throw new ErrorCode(400,"missing_ticket");
 const bytes=unb64(raw);
 if(bytes.length<40)throw new ErrorCode(401,"bad_ticket");
 let t:Ticket;
 try{t=JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:bytes.slice(0,12)},await aes(),bytes.slice(12))))}
 catch{throw new ErrorCode(401,"bad_ticket")}
 if(t.v!==1||!/^ati_[0-9a-f]{64}$/.test(t.token)||!/^ios-stage\/\d{4}-\d{2}-\d{2}\/[a-f0-9-]{36}$/.test(t.path)||!Number.isSafeInteger(t.size)||t.size<1||t.size>MAX||!Number.isFinite(t.expiry))throw new ErrorCode(401,"bad_ticket");
 filename(t.name);
 if(Date.now()>t.expiry)throw new ErrorCode(410,"ticket_expired");
 await auth(t.token);
 return t;
}
export const escapeHtml=(s:string)=>s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));
