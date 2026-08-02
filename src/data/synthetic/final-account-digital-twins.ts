import { decisionControlResult } from "@/features/morning-briefing/data";import { buildSyntheticTwins } from "./account-digital-twins";
export const accountDigitalTwins=buildSyntheticTwins(decisionControlResult.acceptedDecisions);
export function getAccountDigitalTwin(id:string){return accountDigitalTwins.find((twin)=>twin.accountId===id);}
