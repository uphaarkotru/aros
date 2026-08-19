import { verifyPassword } from "./password";import type { IdentityRepository } from "./repository";
const demoLoginAliases: Record<string, string> = {
  "lisa.wong@demo.cognivit.ai": "jennifer.lee@demo.cognivit.ai",
  "john.smith@demo.cognivit.ai": "michael.roberts@demo.cognivit.ai",
};
const canonicalLoginEmail = (email: string) =>
  demoLoginAliases[email.trim().toLowerCase()] ?? email;
export function authenticateCredentials(repository:IdentityRepository,email:string,password:string){const user=repository.findUserByEmail(canonicalLoginEmail(email));if(!user||user.status!=="ACTIVE"||!verifyPassword(password,user.passwordHash))return null;if(user.platformRole==="SUPER_ADMIN")return user;const organization=repository.read().organizations.find(item=>item.id===user.organizationId);return organization?.status==="ACTIVE"?user:null}
export function authenticateTenantCredentials(repository:IdentityRepository,email:string,password:string,tenantSlug:string){const store=repository.read(),user=repository.findUserByEmail(canonicalLoginEmail(email)),organization=store.organizations.find(item=>item.slug===tenantSlug&&item.status==="ACTIVE");if(!user||user.status!=="ACTIVE"||!organization||!verifyPassword(password,user.passwordHash))return null;const membership=store.memberships.find(item=>item.userId===user.id&&item.organizationId===organization.id&&item.status==="ACTIVE");return membership?{user,organization,membership}:null}
