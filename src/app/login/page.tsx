import { Suspense } from "react";
import { LoginForm } from "./login-form";
import {isDemoApplication} from "@/auth/application-mode";
export default function LoginPage(){const demoMode=isDemoApplication();return <main className="auth-page"><section className="auth-card"><div className="brand"><strong>CogniVit<span>.ai</span></strong><small>AROS · AUTONOMOUS REVENUE OS</small></div><h1>Welcome back</h1><p>{demoMode?"Demo environment · seeded identities and role simulation are enabled.":"Production environment · sign in with your organization credentials."}</p><Suspense><LoginForm demoMode={demoMode}/></Suspense></section></main>}
