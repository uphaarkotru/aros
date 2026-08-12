"use client";
import {useState} from "react";
import type {ApplicationMode} from "@/auth/application-mode";

export function ApplicationModeControl({initialMode}:{initialMode:ApplicationMode}){
 const[mode,setMode]=useState(initialMode),[pending,setPending]=useState(false),[error,setError]=useState("");
 async function change(nextMode:ApplicationMode){
  if(nextMode===mode)return;
  if(nextMode==="PRODUCTION"&&!window.confirm("Switch to Production mode? Demo credentials and role simulation will be disabled for everyone."))return;
  setPending(true);setError("");
  try{const response=await fetch("/api/admin/application-mode",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({mode:nextMode})}),result=await response.json().catch(()=>({}));if(!response.ok){setError(result.error??"Unable to update application mode.");return}setMode(result.mode);window.location.reload()}catch{setError("Unable to reach the administration service.")}finally{setPending(false)}
 }
 return <section className="admin-mode-card" aria-labelledby="application-mode-heading"><div><span className="eyebrow">ENVIRONMENT</span><h2 id="application-mode-heading">Application mode</h2><p>Demo enables seeded credential hints and role simulation. Production disables both for every user.</p></div><label>Current mode<select aria-label="Application mode" value={mode} disabled={pending} onChange={event=>change(event.target.value as ApplicationMode)}><option value="DEMO">Demo</option><option value="PRODUCTION">Production</option></select></label>{error&&<p className="admin-message error" role="alert">{error}</p>}</section>
}
