import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  getIdentityRepository,
  identityRepository,
} from "@/auth/repository.server";
import { LoginForm } from "@/app/login/login-form";
type TenantPageProps = { params: Promise<{ slug: string }> };
export async function generateMetadata({
  params,
}: TenantPageProps): Promise<Metadata> {
  await getIdentityRepository();
  const { slug } = await params,
    organization = identityRepository
      .read()
      .organizations.find((item) => item.slug === slug.toLowerCase());
  return {
    title: organization
      ? `Sign in to ${organization.name} | CogniVit AROS`
      : "Tenant not found | CogniVit AROS",
  };
}
export default async function TenantLandingPage({ params }: TenantPageProps) {
  await getIdentityRepository();
  const { slug } = await params,
    tenantSlug = slug.toLowerCase(),
    organization = identityRepository
      .read()
      .organizations.find(
        (item) => item.slug === tenantSlug && item.status === "ACTIVE",
      );
  if (!organization) notFound();
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand">
          <strong>
            CogniVit<span>.ai</span>
          </strong>
          <small>AROS · AUTONOMOUS REVENUE OS</small>
        </div>
        <span className="tenant-entry-label">TENANT WORKSPACE</span>
        <h1>{organization.name}</h1>
        <p>Sign in with your {organization.name} credentials.</p>
        <Suspense>
          <LoginForm tenantSlug={organization.slug} />
        </Suspense>
      </section>
    </main>
  );
}
