import {NextResponse} from "next/server";
import {getApplicationMode,setApplicationMode,type ApplicationMode} from "@/auth/application-mode";
import {recordAudit} from "@/auth/audit.server";
import {identityRepository} from "@/auth/repository.server";
import {getAuthenticatedIdentity,getRawSessionUser} from "@/auth/session.server";

const parseMode=(value:unknown):ApplicationMode|null=>value==="DEMO"||value==="PRODUCTION"?value:null;

export async function PUT(request:Request){
 const actor=await getRawSessionUser(),identity=await getAuthenticatedIdentity();
 if(!actor||!identity||!["ORG_OWNER","ORG_ADMIN"].includes(identity.membership.adminRole))return NextResponse.json({error:"Organization administrator access is required."},{status:403});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"Invalid request."},{status:400})}
 const mode=parseMode((body as {mode?:unknown})?.mode);
 if(!mode)return NextResponse.json({error:"Choose Demo or Production mode."},{status:400});
 const before=getApplicationMode();
 if(mode!==before){
  setApplicationMode(mode);
  if(mode==="PRODUCTION")for(const session of identityRepository.read().sessions)if(session.viewAsRole)identityRepository.saveSession({...session,viewAsRole:null,lastSeenAt:new Date().toISOString()});
  recordAudit(actor,{event:"application.mode.updated",resourceType:"organization",resourceId:identity.organization.id,before:{mode:before},after:{mode}},identity.organization.id);
 }
 return NextResponse.json({mode});
}
