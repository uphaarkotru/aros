import {afterAll,beforeAll,describe,expect,it} from "vitest";
import {Pool} from "pg";
import {PostgresRevenueRepository} from "./revenue-repository";
import {closeDatabase} from "./client";
import {PostgresIdentityRepository} from "./postgres-identity-repository";

const connectionString=process.env.TEST_DATABASE_URL;
describe.skipIf(!connectionString)("PostgreSQL tenant persistence",()=>{
 let pool:Pool;let repository:PostgresRevenueRepository;
 beforeAll(()=>{process.env.DATABASE_URL=connectionString;pool=new Pool({connectionString});repository=new PostgresRevenueRepository()});
 afterAll(async()=>{await pool.end();await closeDatabase()});
 it("reads accounts, opportunities, twins, signals and actions only inside the requested tenant",async()=>{
  expect((await repository.getAccount("org-acme","acct-acme"))?.name).toBe("Acme Design Account");
  expect(await repository.getAccount("org-acme","acct-globex")).toBeNull();
  expect((await repository.getOpportunity("org-acme","opp-acct-acme"))?.accountId).toBe("acct-acme");
  expect(await repository.getOpportunity("org-acme","opp-acct-globex")).toBeNull();
  expect((await repository.getTwin("org-acme","twin-acct-acme"))?.accountId).toBe("acct-acme");
  expect(await repository.getTwin("org-acme","twin-acct-globex")).toBeNull();
  expect((await repository.listSignals("org-acme","acct-acme"))).toHaveLength(1);
  expect((await repository.listSignals("org-acme","acct-globex"))).toHaveLength(0);
  expect(await repository.getAction("org-acme","action-acct-globex")).toBeNull();
 });
 it("database rejects a cross-tenant opportunity/account pair",async()=>{
  await expect(pool.query(`INSERT INTO opportunities(id,organization_id,account_id,name) VALUES('invalid-cross-opportunity','org-acme','acct-globex','Invalid')`)).rejects.toMatchObject({code:"23503"});
 });
 it("database rejects a cross-tenant Twin/account pair",async()=>{
  await expect(pool.query(`INSERT INTO revenue_digital_twins(id,organization_id,account_id) VALUES('invalid-cross-twin','org-acme','acct-globex')`)).rejects.toMatchObject({code:"23503"});
 });
 it("database rejects a cross-tenant revenue-team membership",async()=>{
  await expect(pool.query(`INSERT INTO revenue_team_assignments(id,organization_id,account_id,membership_id,participation_type,is_primary_owner,created_at) VALUES('invalid-cross-team','org-acme','acct-acme','membership-globex-technologies','OWNER',true,now())`)).rejects.toMatchObject({code:"23503"});
 });
 it("persists identity and revenue records across new connections",async()=>{
  await pool.query(`UPDATE action_decisions SET status='APPROVED' WHERE organization_id='org-acme' AND id='action-acct-acme'`);
  const independent=new Pool({connectionString});
  const result=await independent.query(`SELECT a.name,d.status,m.admin_role FROM accounts a JOIN action_decisions d ON(d.organization_id=a.organization_id AND d.account_id=a.id) JOIN organization_memberships m ON m.organization_id=a.organization_id WHERE a.organization_id='org-acme'`);
  await independent.end();expect(result.rows[0]).toMatchObject({name:"Acme Design Account",status:"APPROVED",admin_role:"ORG_OWNER"});
 });
 it("loads and durably updates identity through the PostgreSQL runtime adapter",async()=>{
  const identity=await PostgresIdentityRepository.connect(connectionString!);const user=identity.findUserById("user-ae-sarah");expect(user?.email).toBe("sarah.chen@demo.cognivit.ai");identity.saveUser({...user!,displayName:"Sarah Chen Persisted",updatedAt:new Date().toISOString()});await identity.close();
  const restarted=await PostgresIdentityRepository.connect(connectionString!);expect(restarted.findUserById("user-ae-sarah")?.displayName).toBe("Sarah Chen Persisted");restarted.saveUser({...restarted.findUserById("user-ae-sarah")!,displayName:"Sarah Chen",updatedAt:new Date().toISOString()});await restarted.close();
 });
 it("persists expanded semantic templates and Coinbase cross-functional coverage",async()=>{const templates=await pool.query(`SELECT code FROM system_role_templates WHERE code=ANY($1::text[])`,[["FIELD_CTO","CUSTOMER_SUCCESS","VALUE_ENGINEERING","PRODUCT_SPECIALIST","SERVICES","REVOPS","COMMERCIAL","FIELD_MARKETING"]]);expect(templates.rowCount).toBe(8);const coverage=new Set((await pool.query(`SELECT participation_type FROM revenue_team_assignments WHERE organization_id='org-cognivit-demo' AND opportunity_id='opp-coinbase-renewal'`)).rows.map(row=>row.participation_type));for(const type of ["PRIMARY_SELLER","PROSPECTING","SALES_ENGINEERING","PARTNER","TECHNICAL_EXECUTIVE","EXECUTIVE_SPONSOR","CUSTOMER_SUCCESS","VALUE_ENGINEERING"])expect(coverage.has(type)).toBe(true)});
 it("allows multiple contextual roles but rejects identical and cross-tenant assignments",async()=>{const source=(await pool.query(`SELECT * FROM revenue_team_assignments WHERE organization_id='org-cognivit-demo' AND opportunity_id='opp-coinbase-renewal' AND participation_type='TECHNICAL_EXECUTIVE' LIMIT 1`)).rows[0];await expect(pool.query(`INSERT INTO revenue_team_assignments(id,organization_id,account_id,opportunity_id,membership_id,organization_role_definition_id,participation_type,is_primary_owner,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,false,now())`,[crypto.randomUUID(),source.organization_id,source.account_id,source.opportunity_id,source.membership_id,source.organization_role_definition_id,source.participation_type])).rejects.toMatchObject({code:"23505"});const foreignRole=(await pool.query(`SELECT id FROM organization_role_definitions WHERE organization_id='org-cognivit-demo' LIMIT 1`)).rows[0].id;await expect(pool.query(`INSERT INTO revenue_team_assignments(id,organization_id,account_id,membership_id,organization_role_definition_id,participation_type,is_primary_owner,created_at) VALUES($1,'org-acme','acct-acme','membership-acme-software',$2,'OVERLAY',false,now())`,[crypto.randomUUID(),foreignRole])).rejects.toMatchObject({code:"23503"})});
});
