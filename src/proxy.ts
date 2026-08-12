import { NextRequest,NextResponse } from "next/server";
const SESSION_COOKIE="aros_session";
const publicPrefixes=["/login","/api/auth/login","/api/auth/invitations/accept","/_next","/favicon.ico"];
export function proxy(request:NextRequest){const {pathname,search}=request.nextUrl;if(publicPrefixes.some(prefix=>pathname.startsWith(prefix)))return NextResponse.next();if(!request.cookies.has(SESSION_COOKIE)){const url=new URL("/login",request.url);if(request.method==="GET")url.searchParams.set("next",`${pathname}${search}`);return pathname.startsWith("/api/")?NextResponse.json({error:"Unauthenticated"},{status:401}):NextResponse.redirect(url)}return NextResponse.next()}
export const config={matcher:["/((?!_next/static|_next/image).*)"]};
