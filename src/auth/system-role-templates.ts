import type {RevenueRole,SystemRoleTemplate} from "./types";
import {rolePermissions} from "./permissions";

const definitions:Record<RevenueRole,Omit<SystemRoleTemplate,"id"|"code"|"defaultPermissions"|"isActive">>={
 SDR:{name:"Sales Development Representative",category:"SALES_DEVELOPMENT",description:"Prospecting and qualification",defaultExperienceKey:"sdr",capabilities:["prospecting","qualification"]},
 AE:{name:"Account Executive",category:"SALES",description:"Commercial opportunity owner",defaultExperienceKey:"ae",capabilities:["account-ownership","opportunity-management"]},
 RSM:{name:"Regional Sales Manager",category:"SALES",description:"Commercial seller manager",defaultExperienceKey:"rsm",capabilities:["seller-coaching","forecast-review"]},
 SALES_ENGINEER:{name:"Sales Engineer",category:"SALES_ENGINEERING",description:"Technical opportunity collaborator",defaultExperienceKey:"sales-engineer",capabilities:["technical-context","poc-tracking","security-blockers"]},
 SALES_ENGINEER_MANAGER:{name:"Sales Engineer Manager",category:"SALES_ENGINEERING",description:"Technical team and portfolio manager",defaultExperienceKey:"sales-engineer-manager",capabilities:["technical-coaching","resource-allocation"]},
 PARTNER_SALES:{name:"Partner Sales",category:"PARTNERS",description:"Partner and co-sell orchestration",defaultExperienceKey:"partner",capabilities:["partner-context","co-sell"]},
 VP_SALES:{name:"VP Sales",category:"EXECUTIVE",description:"Sales leadership",defaultExperienceKey:"vp-sales",capabilities:["sales-leadership","forecast-management"]},
 CRO:{name:"Chief Revenue Officer",category:"EXECUTIVE",description:"Revenue executive",defaultExperienceKey:"cro",capabilities:["revenue-leadership","governance"]},
};
export const systemRoleTemplates:SystemRoleTemplate[]=Object.entries(definitions).map(([code,item])=>({...item,id:`system-role-${code.toLowerCase().replaceAll("_","-")}`,code:code as RevenueRole,defaultPermissions:[...rolePermissions[code as RevenueRole]],isActive:true}));
export function templateForCode(code:RevenueRole){return systemRoleTemplates.find(item=>item.code===code)!}

export const defaultRoleNames:Record<RevenueRole,string>={SDR:"SDR",AE:"Account Executive",RSM:"Regional Sales Manager",SALES_ENGINEER:"Sales Engineer",SALES_ENGINEER_MANAGER:"Sales Engineer Manager",PARTNER_SALES:"Partner Sales",VP_SALES:"VP Sales",CRO:"Chief Revenue Officer"};
