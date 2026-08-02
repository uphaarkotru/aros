import type {AccountDigitalTwin} from "@/domain/accounts/account-digital-twin";import {AccountDetail} from "./account-detail";import {EvidenceAndConfidence} from "./evidence/evidence-and-confidence";
export function ReconciledAccountDetail({twin}:{twin:AccountDigitalTwin}){return <><AccountDetail twin={twin}/><div className="account-evidence-region"><EvidenceAndConfidence twin={twin}/></div></>}
