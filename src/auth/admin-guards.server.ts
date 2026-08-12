import {redirect} from "next/navigation";
import {requireIdentity} from "./guards.server";
export async function requireOrganizationAdmin(){const identity=await requireIdentity();if(identity.membership.adminRole!=="ORG_OWNER"&&identity.membership.adminRole!=="ORG_ADMIN")redirect("/access-denied");return identity}
export async function requirePlatformAdmin(){const identity=await requireIdentity();if(identity.user.platformRole!=="SUPER_ADMIN")redirect("/access-denied");return identity}
