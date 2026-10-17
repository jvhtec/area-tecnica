import plist from "npm:plist@3.1.0";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const DATA="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";
const shortName="Enviar a Área Técnica actualizado";
Deno.serve(async (req: Request)=>{
 if(req.method !== "GET") return new Response("Method not allowed",{status:405});
 try {
   const bytes=Uint8Array.from(atob(DATA),c=>c.charCodeAt(0));
   const decompressed=new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"));
   let xml=await new Response(decompressed).text(); 
   
   const w=plist.parse(xml);
   const a=w.WFWorkflowActions;
   if(a.length!==44)throw Error("Unexpected shortcut source version");
   const tokenVar=(name)=>({WFSerializationType:"WFTextTokenAttachment",Value:{Type:"Variable",VariableName:name}});
   const outVar=(uuid)=>({Type:"ActionOutput",OutputUUID:uuid});
   const plainURL="https://syldobdcdsgfgjtbuwxm.supabase.co/functions/v1/ios-share-handoff?raw=1&plain=1&filename=";
   const encodingId=crypto.randomUUID().toUpperCase();
   const postId=crypto.randomUUID().toUpperCase();
   const urlId=crypto.randomUUID().toUpperCase();
   const openId=crypto.randomUUID().toUpperCase();
   const encodedName={
     WFWorkflowActionIdentifier:"is.workflow.actions.urlencode",
     WFWorkflowActionParameters:{UUID:encodingId,WFEncodeMode:"Encode",WFInput:tokenVar("FileName")}
   };
   const url={WFSerializationType:"WFTextTokenString",Value:{
     string:plainURL+"\uFFFC",
     attachmentsByRange:{["{"+plainURL.length+", 1}"]:outVar(encodingId)}
   }};
   const post={
     WFWorkflowActionIdentifier:"is.workflow.actions.downloadurl",
     WFWorkflowActionParameters:{
       UUID:postId,
       WFURL:url,
       WFHTTPMethod:"POST",
       WFHTTPBodyType:"File",
       WFHTTPHeaders:a[36].WFWorkflowActionParameters.WFHTTPHeaders,
       WFRequestVariable:tokenVar("File"),
       WFFormValues:{WFSerializationType:"WFDictionaryFieldValue",Value:{WFDictionaryFieldValueItems:[]}}
     }
   };
   const asURL={
     WFWorkflowActionIdentifier:"is.workflow.actions.url",
     WFWorkflowActionParameters:{
       UUID:urlId,
       WFURLActionURL:{WFSerializationType:"WFTextTokenString",Value:{
         string:"\uFFFC",attachmentsByRange:{"{0, 1}":outVar(postId)}
       }}
     }
   };
   const open={
     WFWorkflowActionIdentifier:"is.workflow.actions.openurl",
     WFWorkflowActionParameters:{UUID:openId,
       WFInput:{WFSerializationType:"WFTextTokenAttachment",Value:outVar(urlId)}}
   };
   w.WFWorkflowActions=[a[2],a[3],a[4],a[5],a[6],encodedName,post,asURL,open];
   w.WFWorkflowName="Enviar a Área Técnica (v4)";
   w.WFWorkflowImportQuestions=[];
   w.WFWorkflowTypes=["ActionExtension"];
   xml=plist.build(w);
   if(!xml.startsWith("<?xml"))throw Error("Template decode failed");
   if(new URL(req.url).searchParams.has("xml")) return new Response(xml,{headers:{"Content-Type":"application/xml"}});
   const form=new FormData();
   form.append("file",new File([xml],"Enviar_Area_Tecnica_v4.shortcut",{type:"application/octet-stream"}));
   const resp=await fetch("https://sign.shortcuty.app/api/v1/sign",{method:"POST",body:form});
   const result=await resp.arrayBuffer();
   const header=String.fromCharCode(...new Uint8Array(result).slice(0,4));
   if(!resp.ok || header!=="AEA1") {
      const msg=new TextDecoder().decode(result).slice(0,500);
      return Response.json({ok:false,status:resp.status,header,detail:msg},{status:502});
   }
   if(new URL(req.url).searchParams.has("check")) return Response.json({ok:true,status:resp.status,signed:true,size:result.byteLength,actions:9,uploadType:"File",responseType:"plain URL"});
   return new Response(result,{headers:{"Content-Type":"application/octet-stream","Content-Disposition":'attachment; filename="Enviar_Area_Tecnica_v4.shortcut"',"Cache-Control":"private, max-age=300"}});
 } catch(e) {return Response.json({ok:false,error:String(e)},{status:500})}
});