import { NextResponse } from "next/server";
import { parseLoginInput } from "@/auth/input";
import { identityRepository } from "@/auth/repository.server";
import { authenticateCredentials } from "@/auth/authenticate";
import { createSession } from "@/auth/session.server";
import { recordAudit } from "@/auth/audit.server";
export async function POST(request:Request){let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"Invalid request."},{status:400})}const input=parseLoginInput(body);if(!input)return NextResponse.json({error:"Enter a valid email and password."},{status:400});const user=authenticateCredentials(identityRepository,input.email,input.password);if(!user)return NextResponse.json({error:"Invalid email or password."},{status:401});identityRepository.saveUser({...user,lastLoginAt:new Date().toISOString()});await createSession(user);recordAudit(user,{event:"auth.login",resourceType:"session",resourceId:user.id});const membership=identityRepository.read().memberships.find(item=>item.userId===user.id&&item.organizationId===user.organizationId);return NextResponse.json({ok:true,redirectTo:user.platformRole==="SUPER_ADMIN"?"/platform/admin":membership&&["ORG_OWNER","ORG_ADMIN"].includes(membership.adminRole)?"/admin":"/today"})}
