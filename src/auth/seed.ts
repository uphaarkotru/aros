import { hashPassword } from "./password";
import type { IdentityStore, RevenueRole, User } from "./types";
import {migrateIdentityStore} from "./store-migration";
export const DEMO_PASSWORD="ArosDemo!2026";
const now="2026-08-12T16:00:00.000Z",organizationId="org-cognivit-demo",passwordHash=hashPassword(DEMO_PASSWORD,"aros-deterministic-demo-salt");
function user(id:string,firstName:string,lastName:string,email:string,role:RevenueRole,managerUserId:string|null,teamId:string|null,options:Partial<User>={}):User{return{id,organizationId,email,firstName,lastName,displayName:`${firstName} ${lastName}`,role,status:"ACTIVE",platformRole:null,managerUserId,teamId,regionId:"region-na",timezone:"America/Los_Angeles",avatarUrl:null,isDemoUser:true,isAdmin:false,passwordHash,createdAt:now,updatedAt:now,lastLoginAt:null,...options}}
export function createDemoIdentityStore():IdentityStore{return migrateIdentityStore({
 organizations:[{id:organizationId,name:"CogniVit Demo Enterprise",slug:"cognivit-demo-enterprise",status:"ACTIVE",createdAt:now,updatedAt:now},{id:"org-isolation-test",name:"Isolation Test Corp",slug:"isolation-test",status:"ACTIVE",createdAt:now,updatedAt:now}],
 users:[
  user("user-platform-admin","Morgan","Reed","platform.admin@cognivit.ai","AE",null,null,{platformRole:"SUPER_ADMIN",isAdmin:false}),
  user("user-org-admin","Avery","Stone","admin@demo.cognivit.ai","CRO",null,null,{isAdmin:true}),
  user("user-cro-michael","Michael","Roberts","michael.roberts@demo.cognivit.ai","CRO",null,"team-revenue"),
  user("user-vp-jennifer","Jennifer","Lee","jennifer.lee@demo.cognivit.ai","VP_SALES","user-cro-michael","team-enterprise"),
  user("user-rsm-mark","Mark","Davis","mark.davis@demo.cognivit.ai","RSM","user-vp-jennifer","team-west"),
  user("user-rsm-other","Olivia","Grant","olivia.grant@demo.cognivit.ai","RSM","user-vp-jennifer","team-east"),
  user("user-ae-sarah","Sarah","Chen","sarah.chen@demo.cognivit.ai","AE","user-rsm-mark","team-west"),
  user("user-ae-daniel","Daniel","Ross","daniel.ross@demo.cognivit.ai","AE","user-rsm-mark","team-west"),
  user("user-ae-priya","Priya","Nair","priya.nair@demo.cognivit.ai","AE","user-rsm-other","team-east"),
  user("user-sdr-alex","Alex","Morgan","alex.morgan@demo.cognivit.ai","SDR","user-sdr-manager-david","team-marketing"),
  user("user-sdr-manager-david","David","Wilson","david.wilson@demo.cognivit.ai","RSM",null,"team-marketing"),
  user("user-se-manager-anita","Anita","Sharma","anita.sharma@demo.cognivit.ai","SALES_ENGINEER_MANAGER","user-cro-michael","team-se"),
  user("user-se-raj","Raj","Patel","raj.patel@demo.cognivit.ai","SALES_ENGINEER","user-se-manager-anita","team-se"),
  user("user-partner-priya","Priya","Shah","priya.shah@demo.cognivit.ai","PARTNER_SALES","user-vp-jennifer","team-partners"),
  user("user-field-cto-david","David","Lee","david.lee@demo.cognivit.ai","FIELD_CTO","user-cro-michael","team-se"),
  user("user-cs-maria","Maria","Gomez","maria.gomez@demo.cognivit.ai","CUSTOMER_SUCCESS","user-cro-michael","team-revenue"),
  user("user-value-jason","Jason","Wu","jason.wu@demo.cognivit.ai","VALUE_ENGINEERING","user-cro-michael","team-revenue"),
  user("user-other-tenant","Taylor","Brooks","taylor@isolation.demo","AE",null,null,{organizationId:"org-isolation-test",regionId:null,isDemoUser:false}),
 ],
 teams:[
  {id:"team-revenue",organizationId,name:"Revenue",managerUserId:"user-cro-michael",parentTeamId:null,type:"REVENUE",createdAt:now,updatedAt:now},
  {id:"team-enterprise",organizationId,name:"Enterprise Sales",managerUserId:"user-vp-jennifer",parentTeamId:"team-revenue",type:"SALES",createdAt:now,updatedAt:now},
  {id:"team-west",organizationId,name:"Enterprise West",managerUserId:"user-rsm-mark",parentTeamId:"team-enterprise",type:"SALES",createdAt:now,updatedAt:now},
  {id:"team-east",organizationId,name:"Enterprise East",managerUserId:"user-rsm-other",parentTeamId:"team-enterprise",type:"SALES",createdAt:now,updatedAt:now},
  {id:"team-partners",organizationId,name:"Partner Revenue",managerUserId:"user-partner-priya",parentTeamId:"team-revenue",type:"PARTNER",createdAt:now,updatedAt:now},
  {id:"team-se",organizationId,name:"Solutions Engineering",managerUserId:"user-se-manager-anita",parentTeamId:"team-revenue",type:"SALES_ENGINEERING",createdAt:now,updatedAt:now},
  {id:"team-marketing",organizationId,name:"Marketing · Sales Development",managerUserId:"user-sdr-manager-david",parentTeamId:null,type:"MARKETING",createdAt:now,updatedAt:now},
 ],
 regions:[{id:"region-na",organizationId,name:"North America",parentRegionId:null}],sessions:[],auditEvents:[],
 assignments:[
  {organizationId,resourceType:"account",resourceId:"acct-coinbase",userId:"user-ae-sarah",sharedWithUserIds:["user-sdr-alex","user-se-raj"],partnerUserId:"user-partner-priya"},
  {organizationId,resourceType:"opportunity",resourceId:"opp-coinbase-renewal",userId:"user-ae-sarah",sharedWithUserIds:["user-sdr-alex","user-se-raj","user-field-cto-david","user-cs-maria","user-value-jason"],partnerUserId:"user-partner-priya"},
  {organizationId,resourceType:"account",resourceId:"acct-paypal",userId:"user-ae-daniel"},
  {organizationId,resourceType:"account",resourceId:"acct-nvidia",userId:"user-ae-priya"},
  {organizationId,resourceType:"account",resourceId:"acct-franklin",userId:"user-ae-sarah"},
  {organizationId,resourceType:"account",resourceId:"acct-snowflake",userId:"user-ae-priya"},
  {organizationId:"org-isolation-test",resourceType:"account",resourceId:"acct-other-tenant",userId:"user-other-tenant"},
 ]} as unknown as IdentityStore);}
