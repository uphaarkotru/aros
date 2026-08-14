import type {IdentityRepository} from "./repository";
import {participationTypes,type ParticipationType} from "./types";

export type RevenueTeamCoverage=Record<ParticipationType,boolean>;

export function getRevenueTeamCoverage(repository:IdentityRepository,input:{organizationId:string;accountId?:string;opportunityId?:string}):RevenueTeamCoverage{
 const covered=new Set(repository.read().revenueTeamAssignments.filter(item=>item.organizationId===input.organizationId&&(!input.accountId||item.accountId===input.accountId)&&(!input.opportunityId||item.opportunityId===input.opportunityId)).map(item=>item.participationType));
 return Object.fromEntries(participationTypes.map(type=>[type,covered.has(type)])) as RevenueTeamCoverage;
}

export function getCoverageGaps(coverage:RevenueTeamCoverage,required:readonly ParticipationType[]){return required.filter(type=>!coverage[type])}
