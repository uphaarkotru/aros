import { NextResponse } from "next/server";
import { recordAudit } from "@/auth/audit.server";
import { getRawSessionUser,destroySession } from "@/auth/session.server";
export async function POST(){const actor=await getRawSessionUser();if(actor)recordAudit(actor,{event:"auth.logout",resourceType:"session",resourceId:actor.id});await destroySession();return NextResponse.json({ok:true})}
