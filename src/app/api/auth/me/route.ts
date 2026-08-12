import { NextResponse } from "next/server";
import { getAuthenticatedIdentity } from "@/auth/session.server";
export async function GET(){const identity=await getAuthenticatedIdentity();return identity?NextResponse.json(identity):NextResponse.json({error:"Unauthenticated"},{status:401})}
