import {describe,expect,it} from "vitest";
import {MemoryIdentityRepository} from "./repository";
import {createDemoIdentityStore} from "./seed";
import {createOrganizationRole} from "./tenant-model";
import {systemRoleTemplates} from "./system-role-templates";

describe("expanded semantic role taxonomy",()=>{
 it("preserves existing templates and adds the enterprise team-selling library",()=>{const codes=new Set(systemRoleTemplates.map(item=>item.code));for(const code of ["SDR","AE","RSM","PARTNER_SALES","VP_SALES","CRO","SALES_ENGINEER","SALES_ENGINEER_MANAGER","FIELD_CTO","CUSTOMER_SUCCESS","VALUE_ENGINEERING","PRODUCT_SPECIALIST","SERVICES","REVOPS","COMMERCIAL","FIELD_MARKETING"])expect(codes.has(code as never)).toBe(true);expect(codes.has("EXECUTIVE_SPONSOR" as never)).toBe(false)});
 it("allows mapped and unmapped tenant display roles",()=>{const repository=new MemoryIdentityRepository(createDemoIdentityStore()),owner=repository.read().memberships.find(item=>item.userId==="user-org-admin")!,create=(name:string,code:string,templateCode?:string)=>createOrganizationRole(repository,owner,{name,code,category:"CUSTOM",description:null,systemTemplateId:templateCode?systemRoleTemplates.find(item=>item.code===templateCode)?.id??null:null,defaultExperienceKey:null,permissions:[]});expect(create("Regional CTO","REGIONAL_CTO","FIELD_CTO").ok).toBe(true);expect(create("Customer Value Consultant","CUSTOMER_VALUE_CONSULTANT","VALUE_ENGINEERING").ok).toBe(true);const unmapped=create("Federal Compliance Liaison","FEDERAL_COMPLIANCE_LIAISON");expect(unmapped.ok&&unmapped.value.systemTemplateId).toBeNull()});
});
