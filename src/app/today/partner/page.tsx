import { requireIdentity } from "@/auth/guards.server";import { RoleToday } from "@/components/role-today";import { redirect } from "next/navigation";
export default async function Page(){const identity=await requireIdentity();if(identity.effectiveRole!=="PARTNER_SALES")redirect("/access-denied");return <RoleToday role="PARTNER_SALES" name={identity.viewUser.firstName}/>}
