import { ApplicationShell } from "@/components/application-shell";import { accountDigitalTwins } from "@/data/synthetic/final-account-digital-twins";import { AccountsList } from "@/features/accounts/accounts-list";
export default function AccountsPage(){return <ApplicationShell active="accounts"><AccountsList twins={accountDigitalTwins}/></ApplicationShell>}
