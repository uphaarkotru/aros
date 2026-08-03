import {mkdir,readFile,readdir,rename,writeFile} from "node:fs/promises";
import path from "node:path";
import type {ArtifactLifecycleEvent,ArtifactRepository,ArtifactSearchQuery,BaselineRecord,EvaluationArtifact} from "@/domain/evaluation-artifacts/types";
import {containsSensitiveMaterial,verifyArtifactIntegrity} from "../integrity";

const parse=<T>(text:string):T=>JSON.parse(text) as T;
const safeId=(id:string)=>{if(!/^[a-zA-Z0-9._-]+$/.test(id))throw new Error("invalid-artifact-id");return id;};

export function createFilesystemArtifactRepository({rootDirectory=path.join(process.cwd(),".aros","evaluation-artifacts")}:{rootDirectory?:string}={}):ArtifactRepository{
 const artifacts=path.join(rootDirectory,"artifacts"),archive=path.join(rootDirectory,"archive"),eventsFile=path.join(rootDirectory,"approval-history.json"),baselinesFile=path.join(rootDirectory,"baselines.json");
 const ensure=()=>Promise.all([mkdir(artifacts,{recursive:true}),mkdir(archive,{recursive:true})]);
 const readJson=async<T>(file:string,fallback:T):Promise<T>=>{try{return parse<T>(await readFile(file,"utf8"));}catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")return fallback;throw error;}};
 const atomic=async(file:string,value:unknown)=>{const temp=`${file}.${process.pid}.${Date.now()}.tmp`;await writeFile(temp,JSON.stringify(value,null,2),{encoding:"utf8",flag:"wx"});await rename(temp,file);};
 const artifactPath=(id:string)=>path.join(artifacts,`${safeId(id)}.json`);
 return{
  async save(artifact){await ensure();if(!verifyArtifactIntegrity(artifact))throw new Error("artifact-integrity-invalid");if(containsSensitiveMaterial(artifact))throw new Error("artifact-sensitive-material-detected");await writeFile(artifactPath(artifact.artifactId),JSON.stringify(artifact,null,2),{encoding:"utf8",flag:"wx"});},
  async load(id){await ensure();try{return parse<EvaluationArtifact>(await readFile(artifactPath(id),"utf8"));}catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")return undefined;throw error;}},
  async list(){await ensure();return Promise.all((await readdir(artifacts)).filter(file=>file.endsWith(".json")).sort().map(async file=>parse<EvaluationArtifact>(await readFile(path.join(artifacts,file),"utf8"))));},
  async search(query:ArtifactSearchQuery){const items=query.archived?await Promise.all((await readdir(archive)).filter(file=>file.endsWith(".json")).map(async file=>parse<EvaluationArtifact>(await readFile(path.join(archive,file),"utf8")))):await this.list();return items.filter(item=>(!query.scenarioId||item.scenarioId===query.scenarioId)&&(!query.accountId||item.accountId===query.accountId)&&(!query.agentType||item.agentType===query.agentType)&&(!query.promptVersion||item.promptVersion===query.promptVersion)&&(!query.modelVersion||item.modelVersion===query.modelVersion)&&(!query.providerVersion||item.providerVersion===query.providerVersion)&&(!query.evaluationVersion||item.evaluationVersion===query.evaluationVersion));},
  async archive(id){await ensure();await rename(artifactPath(id),path.join(archive,`${safeId(id)}.json`));},
  async appendEvent(event){await ensure();const values=await readJson<ArtifactLifecycleEvent[]>(eventsFile,[]);if(values.some(item=>item.eventId===event.eventId))throw new Error("duplicate-lifecycle-event");await atomic(eventsFile,[...values,event]);},
  async listEvents(id){await ensure();return(await readJson<ArtifactLifecycleEvent[]>(eventsFile,[])).filter(item=>!id||item.artifactId===id);},
  async saveBaseline(record){await ensure();const values=await readJson<BaselineRecord[]>(baselinesFile,[]),next=[...values.filter(item=>item.baselineId!==record.baselineId),record];await atomic(baselinesFile,next);},
  async listBaselines(scenarioId){await ensure();return(await readJson<BaselineRecord[]>(baselinesFile,[])).filter(item=>!scenarioId||item.scenarioId===scenarioId);}
 };
}
