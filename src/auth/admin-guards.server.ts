import {redirect} from "next/navigation";import {requireIdentity} from "./guards.server";import {getRawSessionUser} from "./session.server";
export async function requireOrganizationAdmin(){const identity=await requireIdentity();if(identity.membership.adminRole!=="ORG_OWNER"&&identity.membership.adminRole!=="ORG_ADMIN")redirect("/access-denied");return identity}
export async function requirePlatformAdmin(){const actor=await getRawSessionUser();if(!actor)redirect("/login");if(actor.platformRole!=="SUPER_ADMIN")redirect("/access-denied");return actor}
