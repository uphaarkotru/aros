"use client";
import {revenueRoles,type RevenueRole} from "@/auth/types";
import {roleDisplay,todayPath} from "@/auth/permissions";
export function DemoRoleSwitcher(){async function select(role:RevenueRole){const response=await fetch("/api/auth/view-as",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({role})});if(response.ok)window.location.assign(todayPath[role])}return <label className="admin-role-switcher">Demo role<select aria-label="Simulate revenue role" defaultValue="" onChange={event=>event.target.value&&select(event.target.value as RevenueRole)}><option value="" disabled>Select experience…</option>{revenueRoles.map(role=><option key={role} value={role}>{roleDisplay[role]}</option>)}</select></label>}
