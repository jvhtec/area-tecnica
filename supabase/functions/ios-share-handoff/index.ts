import {PAGE} from "./page.ts";

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {ROOT,SOURCE,MAX,BUCKET,HEAD,admin,auth,filename,seal,unseal,escapeHtml,ErrorCode,type Ticket} from "./security.ts";
async function rateHash(value:string){const bytes=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)));return [...bytes].map(b=>b.toString(16).padStart(2,"0")).join("")}
function json(data:unknown,status=200){return Response.json(data,{status,headers:HEAD})}
async function readMultipart(req:Request){
 const ct=req.headers.get("content-type")||"";
 if(!ct.startsWith("multipart/form-data;"))throw new ErrorCode(415,"multipart_required");
 const max=MAX+1048576;
 if(Number(req.headers.get("content-length")||0)>max)throw new ErrorCode(413,"file_too_large");
 if(!req.body)throw new ErrorCode(400,"missing_file");
 const reader=req.body.getReader();const parts:Uint8Array[]=[];let size=0;
 for(;;){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;
  if(size>max){await reader.cancel();throw new ErrorCode(413,"file_too_large")}parts.push(r.value)}
 const all=new Uint8Array(size);let i=0;for(const p of parts){all.set(p,i);i+=p.length}
 try{return await new Request(req.url,{method:"POST",headers:{"content-type":ct},body:all}).formData()}
 catch{throw new ErrorCode(400,"invalid_multipart")}
}
async function purgeExpired(){
 const storage=admin().storage.from(BUCKET);
 const cutoff=new Date(Date.now()-2*86400000).toISOString().slice(0,10);
 const {data:days,error}=await storage.list("ios-stage",{limit:100});
 if(error)return;
 for(const day of (days||[]).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d.name)&&d.name<cutoff).slice(0,3)){
  const prefix="ios-stage/"+day.name;
  const {data:files}=await storage.list(prefix,{limit:200});
  const paths=(files||[]).filter(f=>f.id).map(f=>prefix+"/"+f.name);
  if(paths.length)await storage.remove(paths);
 }
}

async function readRawFile(req:Request):Promise<File>{
 const length=Number(req.headers.get("content-length")||"0");
 if(length>MAX)throw new ErrorCode(413,"file_too_large");
 const stream=req.body?.getReader();
 if(!stream)throw new ErrorCode(400,"missing_file");
 let total=0;const buffers:ArrayBuffer[]=[];
 for(;;){
  const chunk=await stream.read();if(chunk.done)break;
  total+=chunk.value.byteLength;
  if(total>MAX){await stream.cancel();throw new ErrorCode(413,"file_too_large")}
  const copy=new Uint8Array(chunk.value.byteLength);
  copy.set(chunk.value);buffers.push(copy.buffer);
 }
 if(total===0)throw new ErrorCode(400,"missing_file");
 const url=new URL(req.url);
 const original=url.searchParams.get("filename")||"";
 const decoded=/%[a-f0-9]{2}/i.test(original)?decodeURIComponent(original):original;
 const safe=filename(decoded);
 return new File(buffers,safe,{type:req.headers.get("content-type")||"application/octet-stream"});
}

async function stage(req:Request){
 const token=(req.headers.get("x-share-token")||"").trim();
 const tokenId=await auth(token);
 const {data:rate,error:lim}=await admin().rpc("consume_edge_rate_limit",{
  p_scope:"ios-shortcut-handoff",p_identifier_hash:await rateHash(tokenId),
  p_window_seconds:3600,p_max_requests:40
 });
 if(lim)throw new ErrorCode(503,"rate_limit_unavailable");
 if(!(Array.isArray(rate)?rate[0]:rate)?.allowed)throw new ErrorCode(429,"rate_limited");
 const isRaw=new URL(req.url).searchParams.get("raw")==="1";
 let file:File;
 let name:string;
 if(isRaw){file=await readRawFile(req);name=file.name}
 else{
  const form=await readMultipart(req);
  const candidate=form.get("file");
  if(!(candidate instanceof File)||!candidate.size)throw new ErrorCode(400,"missing_file");
  if(candidate.size>MAX)throw new ErrorCode(413,"file_too_large");
  file=candidate;name=filename(String(form.get("file_name")||file.name));
 }
 const id=crypto.randomUUID(),path="ios-stage/"+new Date().toISOString().slice(0,10)+"/"+id;
 const storage=admin().storage.from(BUCKET);
 const {error}=await storage.upload(path,file,{contentType:file.type||"application/octet-stream",upsert:false});
 if(error)throw new ErrorCode(503,"staging_failed");
 let ticket:string;
 try{ticket=await seal({v:1,token,path,id,name,size:file.size,expiry:Date.now()+3600000})}
 catch(e){await storage.remove([path]);throw e}
 const target=new URL(ROOT+"/functions/v1/ios-share-handoff");target.searchParams.set("ticket",ticket);
 try{await purgeExpired()}catch{/* best-effort retention */}
 if(new URL(req.url).searchParams.get("plain")==="1")
  return new Response(target.toString(),{headers:{...HEAD,"Content-Type":"text/plain;charset=utf-8"}});
 return json({ok:true,url:target.toString(),file_name:name,expires_in:3600});
}
async function jobs(req:Request,t:Ticket){
 const target=new URL(SOURCE);target.searchParams.set("action","jobs");
 const query=new URL(req.url);
 if(query.searchParams.get("destination")==="rider")target.searchParams.set("destination","rider");
 if(query.searchParams.get("q"))target.searchParams.set("q",query.searchParams.get("q")!.slice(0,80));
 const upstream=await fetch(target,{headers:{"X-Share-Token":t.token}});
 return new Response(await upstream.text(),{status:upstream.status,headers:{...HEAD,"Content-Type":"application/json"}});
}
async function commit(req:Request,t:Ticket){
 if(Number(req.headers.get("content-length")||0)>8192)throw new ErrorCode(413,"body_too_large");
 const raw=await req.text();if(raw.length>8192)throw new ErrorCode(413,"body_too_large");
 let input:Record<string,unknown>;
 try{input=JSON.parse(raw)}catch{throw new ErrorCode(400,"invalid_json")}
 const job=String(input.job_id||""),dest=String(input.destination||"");
 if(!/^[a-f0-9-]{36}$/i.test(job))throw new ErrorCode(400,"invalid_job");
 if(dest!=="document"&&dest!=="rider")throw new ErrorCode(400,"invalid_destination");
 const storage=admin().storage.from(BUCKET);
 const {data:file,error}=await storage.download(t.path);
 if(error||!file)throw new ErrorCode(410,"staged_file_missing");
 if(file.size!==t.size)throw new ErrorCode(409,"staged_file_changed");
 const body=new FormData();
 body.set("file",new File([file],t.name,{type:file.type||"application/octet-stream"}));
 body.set("file_name",t.name);body.set("job_id",job);body.set("request_id",t.id);body.set("destination",dest);
 if(dest==="document")body.set("department",String(input.department||""));
 else{body.set("artist_name",String(input.artist_name||""));
  if(input.artist_date)body.set("artist_date",String(input.artist_date));
  if(input.stage)body.set("stage",String(input.stage))}
 const response=await fetch(SOURCE,{method:"POST",headers:{"X-Share-Token":t.token},body});
 const text=await response.text();
 if(response.ok)await storage.remove([t.path]);
 return new Response(text,{status:response.status,headers:{...HEAD,"Content-Type":"application/json"}});
}
async function page(t:Ticket){
 const nonce=crypto.randomUUID().replaceAll("-","");
 const template=PAGE;
 const html=template.replaceAll("__NONCE__",nonce).replace("__FILENAME__",escapeHtml(t.name)).replace("__FILESIZE__",String(t.size));
 return new Response(html,{headers:{...HEAD,"Content-Type":"text/html;charset=utf-8","Content-Security-Policy":"default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'; img-src 'self' data:; style-src 'nonce-"+nonce+"'; script-src 'nonce-"+nonce+"'; connect-src 'self'"}});
}
Deno.serve(async req=>{
 try{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:HEAD});
  const url=new URL(req.url);

  if(req.method==="GET"&&url.searchParams.has("error")){
   const code=(url.searchParams.get("error")||"unknown_error").replace(/[^a-z0-9_]/g,"").slice(0,80);
   const info=code==="invalid_token"||code==="token_revoked"?"Comprueba la clave ati_ del primer bloque Texto de tu atajo.":code==="missing_file"?"Outlook no ha compartido un archivo. Abre el adjunto y usa Compartir.":code==="file_too_large"?"El límite es 45 MiB por adjunto.":"La transferencia no se completó; el archivo no se ha registrado.";
   return new Response("<!doctype html><html lang='es'><meta name='viewport' content='width=device-width,initial-scale=1'><body style='font:16px system-ui;padding:24px;background:#131e2b;color:white'><h2>No se pudo recibir el archivo</h2><p>Código: "+code+"</p><p>"+info+"</p></body></html>",{headers:{...HEAD,"Content-Type":"text/html;charset=utf-8"}});
  }
  if(req.method==="GET"&&url.searchParams.has("check"))return json({ok:true,service:"ios-shortcut-handoff"});
  if(req.method==="POST"&&!url.searchParams.has("mode"))return await stage(req);
  const t=await unseal(url.searchParams.get("ticket"));
  if(req.method==="GET"&&url.searchParams.get("mode")==="jobs")return await jobs(req,t);
  if(req.method==="POST"&&url.searchParams.get("mode")==="commit")return await commit(req,t);
  if(req.method==="POST"&&url.searchParams.get("mode")==="discard"){const x=await admin().storage.from(BUCKET).remove([t.path]);if(x.error)throw new ErrorCode(503,"discard_failed");return json({ok:true,discarded:true})}
  if(req.method==="GET"&&!url.searchParams.has("mode"))return await page(t);
  throw new ErrorCode(405,"invalid_method");
 }catch(e){
  const fail=e instanceof ErrorCode?e:new ErrorCode(500,"internal_error");
  const url=new URL(req.url);
  if(req.method==="POST"&&url.searchParams.get("plain")==="1"){
   const errorUrl=new URL(ROOT+"/functions/v1/ios-share-handoff");
   errorUrl.searchParams.set("error",fail.code);
   return new Response(errorUrl.toString(),{headers:{...HEAD,"Content-Type":"text/plain;charset=utf-8"}});
  }
  return json({ok:false,error:fail.code},fail.status);
 }
});
