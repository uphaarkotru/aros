"use client";
import { createContext,useContext,type ReactNode } from "react";
import type { Permission } from "./permissions";
import type { OrganizationMembership,PublicUser,RevenueRole } from "./types";
import type {ApplicationMode} from "./application-mode";
export interface SessionContextValue {user:PublicUser;viewUser:PublicUser;membership:OrganizationMembership;organization:{id:string;name:string;slug:string};permissions:Permission[];scope:{organizationId:string;userIds:string[];accountIds:string[];opportunityIds:string[];teamIds:string[]}|null;applicationMode:ApplicationMode;isViewingAs:boolean;viewAsRole:RevenueRole|null;effectiveRole:RevenueRole|null}
const SessionContext=createContext<SessionContextValue|null>(null);
export function SessionProvider({value,children}:{value:SessionContextValue;children:ReactNode}){return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>}
export function useSession(){const value=useContext(SessionContext);if(!value)throw new Error("useSession must be used within SessionProvider");return value}
export function useOptionalSession(){return useContext(SessionContext)}
