import {allowLocalLogoRequest,readLogoLibrary,readLogoOverrides,readLogoSource,approveLogo} from "@/server/local-logo-editor";
export const dynamic="force-dynamic";
export async function GET(request:Request){
  if(!allowLocalLogoRequest(request))return Response.json({error:"Editor hanya tersedia secara lokal."},{status:404});
  try{const slug=new URL(request.url).searchParams.get("variant");if(slug){const {source}=await readLogoSource(slug);return new Response(source,{headers:{"Content-Type":"image/svg+xml","Cache-Control":"no-store","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'"}});}
    return Response.json({variants:await readLogoLibrary(),overrides:await readLogoOverrides()},{headers:{"Cache-Control":"no-store"}});
  }catch{return Response.json({error:"Pustaka SVG lokal belum tersedia."},{status:400});}
}
export async function POST(request:Request){
  if(!allowLocalLogoRequest(request,true))return Response.json({error:"Permintaan lokal tidak valid."},{status:403});
  try{const text=await request.text();if(text.length>5000)return Response.json({error:"Permintaan terlalu besar."},{status:413});const result=await approveLogo(JSON.parse(text));return Response.json({selection:result},{headers:{"Cache-Control":"no-store"}});}
  catch{return Response.json({error:"Pilihan logo belum dapat disimpan. Periksa crop dan varian SVG."},{status:400});}
}
