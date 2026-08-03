import type {AIQualityRunSample,HumanQualityReview,PromotionPolicy,QualityMetricId,QualityMetricResult,StabilityStatistics} from "@/domain/ai-quality/types";
const average=(values:number[])=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;
const clamp=(value:number)=>Math.max(0,Math.min(100,Math.round(value)));
const category=(samples:AIQualityRunSample[],id:string)=>average(samples.flatMap(sample=>sample.evaluation?.categoryResults.filter(item=>item.category===id).map(item=>item.score)??[]));
const trend=(score:number,baseline?:number):QualityMetricResult["trend"]=>baseline===undefined?"unavailable":score>baseline+2?"improved":score<baseline-2?"regressed":"stable";
export function calculateQualityMetrics({samples,reviews,stability,policy,baselineScores={}}:{samples:AIQualityRunSample[];reviews:HumanQualityReview[];stability:StabilityStatistics;policy:PromotionPolicy;baselineScores?:Partial<Record<QualityMetricId,number>>}):QualityMetricResult[]{
 const evals=samples.flatMap(item=>item.evaluation?[item.evaluation]:[]);
 const latencyScore=average(samples.map(item=>clamp(100-Math.max(0,(item.response?.latencyMs??0)-10000)/200)));
 const tokenScore=average(samples.map(item=>{const total=item.response?.usage.totalTokens??0;return total<=28000?100:clamp(100-(total-28000)/200)}));
 const values:Record<QualityMetricId,{score:number;evidence:string[];explanation:string}>={
  grounding:{score:average(evals.map(item=>item.groundingSummary.coverageScore)),evidence:evals.map(item=>item.groundingSummary.explanation),explanation:"Average material-claim grounding coverage."},
  hallucination:{score:evals.length?100-average(evals.map(item=>item.hallucinationFindings.length?100:0)):0,evidence:evals.flatMap(item=>item.hallucinationFindings.map(finding=>finding.explanation)),explanation:"100 minus the percentage of samples containing hallucination findings."},
  "recommendation-specificity":{score:category(samples,"recommendation-specificity"),evidence:evals.flatMap(item=>item.recommendationFindings.filter(f=>f.category==="recommendation-specificity").map(f=>f.message)),explanation:"Existing recommendation-specificity category score."},
  "recommendation-actionability":{score:category(samples,"recommendation-actionability"),evidence:evals.flatMap(item=>item.recommendationFindings.filter(f=>f.category==="recommendation-actionability").map(f=>f.message)),explanation:"Existing recommendation-actionability category score."},
  "business-value":{score:category(samples,"financial-impact-grounding"),evidence:evals.flatMap(item=>item.findings.filter(f=>f.category==="financial-impact-grounding").map(f=>f.message)),explanation:"Financial-impact grounding and authoritative value agreement."},
  eligibility:{score:samples.length?average(samples.map(item=>item.eligibility?.eligible?100:0)):0,evidence:samples.map(item=>item.eligibility?.reason??"Eligibility unavailable."),explanation:"Percentage of samples eligible for Decision Control."},
  traceability:{score:average(evals.map(item=>item.traceabilitySummary.coverageScore)),evidence:evals.map(item=>item.traceabilitySummary.explanation),explanation:"Average traceability coverage."},
  "conflict-awareness":{score:category(samples,"conflict-awareness"),evidence:evals.flatMap(item=>item.conflictAwarenessFindings.map(f=>f.message)),explanation:"Existing conflict-awareness category score."},
  "freshness-awareness":{score:category(samples,"freshness-awareness"),evidence:evals.flatMap(item=>item.staleEvidenceFindings.map(f=>f.message)),explanation:"Existing freshness-awareness category score."},
  "schema-compliance":{score:samples.length?average(samples.map(item=>item.parseSuccess?100:0)):0,evidence:samples.filter(item=>!item.parseSuccess).map(item=>`${item.sampleId} failed parsing.`),explanation:"Percentage of samples parsed successfully."},
  latency:{score:latencyScore,evidence:samples.map(item=>`${item.sampleId}: ${item.response?.latencyMs??0}ms`),explanation:"Full credit through 10 seconds, declining toward zero by 30 seconds."},
  "token-usage":{score:tokenScore,evidence:samples.map(item=>`${item.sampleId}: ${item.response?.usage.totalTokens??0} tokens`),explanation:"Usage compared with configured 24k input plus 4k output budget."},
  "response-variance":{score:clamp(100-stability.standardDeviation*2),evidence:[`Standard deviation ${stability.standardDeviation}; eligibility consistency ${stability.eligibilityConsistency}%.`],explanation:"Penalizes score variance and is supplemented by consistency statistics."},
  "human-approval":{score:reviews.some(item=>item.outcome==="Approve"&&!item.flags.length)?100:reviews.some(item=>item.outcome==="Needs Improvement")?50:0,evidence:reviews.map(item=>`${item.reviewerId}: ${item.outcome}${item.flags.length?` (${item.flags.join(", ")})`:""}`),explanation:"Requires an explicit unflagged human approval."}
 };
 return(Object.keys(policy.metricDefinitions) as QualityMetricId[]).map(id=>{const definition=policy.metricDefinitions[id],value=values[id],score=clamp(value.score);return{id,definition:definition.definition,score,weight:definition.weight,threshold:definition.threshold,passed:score>=definition.threshold,trend:trend(score,baselineScores[id]),evidence:value.evidence,explanation:value.explanation}});
}
