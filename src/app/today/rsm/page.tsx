import { requireIdentity } from "@/auth/guards.server";import { RoleToday } from "@/components/role-today";import { redirect } from "next/navigation";
export default async function Page(){const identity=await requireIdentity();if(identity.effectiveRole!=="RSM")redirect("/access-denied");return <RoleToday role="RSM" name={identity.viewUser.firstName}/>}
