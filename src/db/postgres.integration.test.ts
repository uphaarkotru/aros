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
});
