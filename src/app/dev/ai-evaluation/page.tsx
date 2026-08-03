import {notFound} from "next/navigation";
import {ApplicationShell} from "@/components/application-shell";
import {AIEvaluationDashboard} from "@/features/dev/ai-evaluation-dashboard/ai-evaluation-dashboard";
import {createCoinbaseQualityFixture} from "@/data/ai-quality-fixtures/coinbase-renewal";
import {calculateQualityHistory,compareEvaluationArtifacts,createEvaluationArtifact,createInMemoryArtifactRepository,replayEvaluationArtifact,submitArtifact,validateArtifactInCI,verifyArtifactIntegrity} from "@/evaluation-artifacts";
import {createFilesystemArtifactRepository} from "@/evaluation-artifacts/repository/filesystem.server";

export default async function AIEvaluationPage(){
 if(process.env.NODE_ENV==="production")notFound();
 const{report}=createCoinbaseQualityFixture(),preview=createEvaluationArtifact({report}),durable=createFilesystemArtifactRepository(),stored=await durable.list(),repository=stored.length?durable:createInMemoryArtifactRepository();
 if(!stored.length)await submitArtifact({repository,artifact:preview,now:preview.createdAt});
 const artifacts=stored.length?stored:[preview],artifact=artifacts[0]!,baselines=await repository.listBaselines(artifact.scenarioId),events=await repository.listEvents(),replay=replayEvaluationArtifact({artifact}),ci=await validateArtifactInCI({repository,candidate:artifact,now:artifact.createdAt}),summaries=artifacts.map(item=>({artifactId:item.artifactId,runId:item.runId,scenarioId:item.scenarioId,promptVersion:item.promptVersion,modelVersion:item.modelVersion,promotionOutcome:item.promotionDecision.outcome,overallScore:item.evaluationResult.overallScore,createdAt:item.createdAt,archived:false,integrityValid:verifyArtifactIntegrity(item)}));
 return <ApplicationShell active="accounts"><AIEvaluationDashboard initialReport={report} artifactData={{artifacts:summaries,baselines,events,history:calculateQualityHistory(artifacts),replay,ci,comparisonExplanation:compareEvaluationArtifacts({baseline:artifact,candidate:artifact}).explanation,promptVersions:[...new Set(artifacts.map(item=>item.promptVersion))],modelVersions:[...new Set(artifacts.map(item=>item.modelVersion))]}}/></ApplicationShell>;
}
