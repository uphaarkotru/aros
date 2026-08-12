import { redirect } from "next/navigation";
import { requireIdentity } from "@/auth/guards.server";
import { identityRepository } from "@/auth/repository.server";
import { toPublicUser } from "@/auth/types";
import { UserAdmin } from "./user-admin";
import {DemoRoleSwitcher} from "./demo-role-switcher";
import {isDemoApplication} from "@/auth/application-mode";
import {getApplicationMode} from "@/auth/application-mode";
import {ApplicationModeControl} from "./application-mode-control";

export default async function UsersAdminPage(){const identity=await requireIdentity();if(!["ORG_OWNER","ORG_ADMIN"].includes(identity.membership.adminRole))redirect("/access-denied");const membershipUserIds=new Set(identityRepository.read().memberships.filter(item=>item.organizationId===identity.organization.id).map(item=>item.userId)),users=identityRepository.read().users.filter(user=>membershipUserIds.has(user.id)).map(toPublicUser);return <>{isDemoApplication()&&<DemoRoleSwitcher/>}<div className="admin-mode-wrap"><ApplicationModeControl initialMode={getApplicationMode()}/></div><UserAdmin initialUsers={users} organizationName={identity.organization.name} actorId={identity.user.id}/></>}
