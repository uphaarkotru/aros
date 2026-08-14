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
 FIELD_CTO:{name:"Field CTO",category:"SALES_ENGINEERING",description:"Senior customer-facing technical leadership and executive technical advisory",defaultExperienceKey:"shared",capabilities:["technical-executive","executive-advisory"]},
 CUSTOMER_SUCCESS:{name:"Customer Success",category:"CUSTOM",description:"Adoption, retention, customer health, and value realization",defaultExperienceKey:"shared",capabilities:["customer-health","adoption"]},
 VALUE_ENGINEERING:{name:"Value Engineering",category:"CUSTOM",description:"Business case, ROI, and value realization support",defaultExperienceKey:"shared",capabilities:["business-value","roi"]},
 PRODUCT_SPECIALIST:{name:"Product Specialist",category:"CUSTOM",description:"Deep product, domain, and overlay expertise",defaultExperienceKey:"shared",capabilities:["product-expertise","overlay"]},
 SERVICES:{name:"Services",category:"CUSTOM",description:"Professional services, consulting, implementation, and services architecture",defaultExperienceKey:"shared",capabilities:["implementation","services"]},
 REVOPS:{name:"Revenue Operations",category:"REVENUE_OPERATIONS",description:"Revenue, sales, and go-to-market operations",defaultExperienceKey:"shared",capabilities:["revenue-operations","process"]},
 COMMERCIAL:{name:"Commercial",category:"REVENUE_OPERATIONS",description:"Pricing, packaging, contracting, and deal-desk participation",defaultExperienceKey:"shared",capabilities:["commercial-strategy","pricing"]},
 FIELD_MARKETING:{name:"Field Marketing",category:"CUSTOM",description:"Account-based, regional, event, and field marketing support",defaultExperienceKey:"shared",capabilities:["field-marketing","abm"]},
};
export const systemRoleTemplates:SystemRoleTemplate[]=Object.entries(definitions).map(([code,item])=>({...item,id:`system-role-${code.toLowerCase().replaceAll("_","-")}`,code:code as RevenueRole,defaultPermissions:[...rolePermissions[code as RevenueRole]],isActive:true}));
export function templateForCode(code:RevenueRole){return systemRoleTemplates.find(item=>item.code===code)!}

export const defaultRoleNames:Record<RevenueRole,string>={SDR:"SDR",AE:"Account Executive",RSM:"Regional Sales Manager",SALES_ENGINEER:"Sales Engineer",SALES_ENGINEER_MANAGER:"Sales Engineer Manager",PARTNER_SALES:"Partner Sales",VP_SALES:"VP Sales",CRO:"Chief Revenue Officer",FIELD_CTO:"Field CTO",CUSTOMER_SUCCESS:"Customer Success",VALUE_ENGINEERING:"Value Engineering",PRODUCT_SPECIALIST:"Product Specialist",SERVICES:"Services",REVOPS:"Revenue Operations",COMMERCIAL:"Commercial",FIELD_MARKETING:"Field Marketing"};
