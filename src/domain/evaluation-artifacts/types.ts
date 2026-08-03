import type {AgentEvaluationResult} from "@/domain/agent-evaluation/types";
import type {DecisionCandidate,GovernedDecision} from "@/domain/decisions/types";
import type {HumanReviewOutcome,PromotionGateDecision,QualityMetricResult} from "@/domain/ai-quality/types";
import type {AgentType} from "@/domain/agents/types";

export type ArtifactLifecycleEventType="Submitted"|"Review Started"|"Approved"|"Conditionally Approved"|"Rejected"|"Superseded"|"Revoked"|"Baseline Promoted"|"Baseline Retired";
export type BaselineState="Candidate"|"Approved"|"Preferred"|"Retired"|"Superseded";
export type CIValidationOutcome="PASS"|"FAIL"|"MANUAL REVIEW REQUIRED";
export type CohortDimension="prompt-version"|"model-version"|"provider-version"|"evaluation-version"|"scenario"|"context-fixture"|"agent-type";

export interface Reviewer{reviewerId:string;displayName:string;role:string;developmentIdentity:true;}
export interface ArtifactReview{reviewId:string;reviewer:Reviewer;reviewTimestamp:string;decision:HumanReviewOutcome;comments:string;flags:string[];}
export interface ArtifactLifecycleEvent{eventId:string;artifactId:string;scenarioId:string;type:ArtifactLifecycleEventType;timestamp:string;reviewer?:Reviewer;comments:string;previousEventId?:string;metadata:Record<string,string|number|boolean>;}
export interface EvaluationArtifact{
 artifactId:string;artifactVersion:string;runId:string;scenarioId:string;accountId:string;agentType:AgentType;contextFixtureId:string;
 promptId:string;promptVersion:string;providerId:string;providerVersion:string;modelId:string;modelVersion:string;contextVersion:string;evaluationVersion:string;schemaVersion:string;
 decisionCandidate:DecisionCandidate;evaluationResult:AgentEvaluationResult;promotionDecision:PromotionGateDecision;evaluationMetrics:QualityMetricResult[];reviews:ArtifactReview[];
 observability:{latencyMs:number;inputTokens:number;outputTokens:number;totalTokens:number;responseVariance:number;};createdAt:string;artifactHash:string;previousArtifactHash?:string;
 metadata:{developmentOnly:true;immutableSnapshot:true;scenarioVersion:string;policyVersion:string;source:"evaluation-run"|"artifact-replay";};
}
export interface BaselineRecord{baselineId:string;artifactId:string;scenarioId:string;state:BaselineState;createdAt:string;updatedAt:string;promotedBy?:Reviewer;supersedesBaselineId?:string;version:string;}
export interface ArtifactSearchQuery{scenarioId?:string;accountId?:string;agentType?:AgentType;promptVersion?:string;modelVersion?:string;providerVersion?:string;evaluationVersion?:string;archived?:boolean;}
export interface ArtifactSummary{artifactId:string;runId:string;scenarioId:string;promptVersion:string;modelVersion:string;promotionOutcome:string;overallScore:number;createdAt:string;archived:boolean;integrityValid:boolean;}
export interface ArtifactComparison{baselineArtifactId:string;candidateArtifactId:string;scenarioId:string;addedClaims:string[];removedClaims:string[];improvedGrounding:number;reducedGrounding:number;hallucinationDifference:number;recommendationDifference:string;eligibilityDifference:string;evaluationScoreDifference:number;latencyDifference:number;tokenDifference:number;humanApprovalDifference:number;regressed:boolean;explanation:string;}
export interface ComparisonCohort{cohortId:string;name:string;scenarioId:string;dimension:CohortDimension;artifactIds:string[];values:string[];createdAt:string;}
export interface MetricTrendPoint{artifactId:string;createdAt:string;grounding:number;hallucination:number;eligibility:number;recommendationQuality:number;latency:number;tokenUsage:number;variance:number;humanApproval:number;}
export interface ArtifactReplayResult{artifactId:string;integrityValid:boolean;parseSuccess:boolean;evaluationMatches:boolean;promotionMatches:boolean;candidate?:DecisionCandidate;evaluation?:AgentEvaluationResult;promotionDecision?:PromotionGateDecision;governedDecisions:GovernedDecision[];errors:string[];}
export interface CIValidationResult{outcome:CIValidationOutcome;scenarioId:string;baselineArtifactId?:string;candidateArtifactId:string;replayPassed:boolean;regressions:string[];manualReviewReasons:string[];validatedAt:string;explanation:string;}
export interface ArtifactRepository{
 save(artifact:EvaluationArtifact):Promise<void>;load(artifactId:string):Promise<EvaluationArtifact|undefined>;list():Promise<EvaluationArtifact[]>;search(query:ArtifactSearchQuery):Promise<EvaluationArtifact[]>;archive(artifactId:string):Promise<void>;
 appendEvent(event:ArtifactLifecycleEvent):Promise<void>;listEvents(artifactId?:string):Promise<ArtifactLifecycleEvent[]>;saveBaseline(record:BaselineRecord):Promise<void>;listBaselines(scenarioId?:string):Promise<BaselineRecord[]>;
}
