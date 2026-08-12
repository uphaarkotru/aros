import { redirect } from "next/navigation";
import { getAuthenticatedIdentity } from "./session.server";
export async function requireIdentity(){const identity=await getAuthenticatedIdentity();if(!identity)redirect("/login");return identity}
