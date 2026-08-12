import {connection} from "next/server";
import {getApplicationMode} from "@/auth/application-mode";

export async function ApplicationModeBadge(){await connection();const mode=getApplicationMode();return <div className={`application-mode ${mode.toLowerCase()}`} title={mode==="DEMO"?"Demo data and role simulation are enabled.":"Live production access; role simulation is disabled."}><i/>{mode==="DEMO"?"Demo mode":"Production mode"}</div>}
