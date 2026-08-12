import type { IdentityStore, SecurityAuditEvent, Session, User } from "./types";

export interface IdentityRepository {
  read():IdentityStore;
  findUserByEmail(email:string):User|undefined;
  findUserById(id:string):User|undefined;
  saveUser(user:User):void;
  saveSession(session:Session):void;
  findSessionByTokenHash(tokenHash:string):Session|undefined;
  deleteSession(id:string):void;
  appendAudit(event:SecurityAuditEvent):void;
  update(mutator:(store:IdentityStore)=>void):void;
}
export class MemoryIdentityRepository implements IdentityRepository {
  constructor(protected store:IdentityStore){}
  read(){return this.store}
  findUserByEmail(email:string){return this.store.users.find(user=>user.email.toLowerCase()===email.toLowerCase())}
  findUserById(id:string){return this.store.users.find(user=>user.id===id)}
  saveUser(user:User){this.store.users=this.store.users.filter(item=>item.id!==user.id);this.store.users.push(user);this.persist()}
  saveSession(session:Session){this.store.sessions=this.store.sessions.filter(item=>item.id!==session.id&&item.tokenHash!==session.tokenHash);this.store.sessions.push(session);this.persist()}
  findSessionByTokenHash(tokenHash:string){return this.store.sessions.find(session=>session.tokenHash===tokenHash)}
  deleteSession(id:string){this.store.sessions=this.store.sessions.filter(session=>session.id!==id);this.persist()}
  appendAudit(event:SecurityAuditEvent){this.store.auditEvents.push(event);this.persist()}
  update(mutator:(store:IdentityStore)=>void){mutator(this.store);this.persist()}
  protected persist(){}
}
