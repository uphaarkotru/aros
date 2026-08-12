import {requireIdentity} from "@/auth/guards.server";
import {RoleToday} from "@/components/role-today";
export default async function SharedTodayPage(){const identity=await requireIdentity();return <RoleToday role={identity.effectiveRole} name={identity.viewUser.firstName}/>}
