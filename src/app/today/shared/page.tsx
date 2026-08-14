import {redirect} from "next/navigation";import {requireIdentity} from "@/auth/guards.server";import {RoleToday} from "@/components/role-today";
export default async function SharedTodayPage(){const identity=await requireIdentity();if(!identity.effectiveRole)redirect("/access-denied");return <RoleToday role={identity.effectiveRole} name={identity.viewUser.firstName}/>}
