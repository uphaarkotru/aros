import type {ReactNode} from "react";import {requirePlatformAdmin} from "@/auth/admin-guards.server";import {AdminLogoutButton} from "@/app/admin/logout-button";
export default async function PlatformAdminLayout({children}:{children:ReactNode}){await requirePlatformAdmin();return <>{children}<AdminLogoutButton/></>}
