import type { AccountContext } from "@/domain/accounts/types";

export const syntheticAccounts: AccountContext[] = [
  { id:"acct-coinbase",name:"Coinbase",ownerId:"owner-1",ownerName:"Maya Chen",segment:"strategic",annualContractValue:22_400_000,renewalDate:"2026-10-15T00:00:00.000Z",openOpportunityValue:1_200_000,strategicTier:1,healthScore:54,currency:"USD",executiveSponsor:"Elena Park",accountStatus:"active" },
  { id:"acct-paypal",name:"PayPal",ownerId:"owner-2",ownerName:"Daniel Ross",segment:"strategic",annualContractValue:6_800_000,renewalDate:"2027-02-01T00:00:00.000Z",openOpportunityValue:3_200_000,strategicTier:1,healthScore:82,currency:"USD",executiveSponsor:"Ravi Shah",accountStatus:"active" },
  { id:"acct-nvidia",name:"NVIDIA",ownerId:"owner-3",ownerName:"Priya Nair",segment:"strategic",annualContractValue:4_600_000,renewalDate:"2027-01-15T00:00:00.000Z",openOpportunityValue:7_500_000,strategicTier:1,healthScore:91,currency:"USD",executiveSponsor:"Jordan Lee",accountStatus:"active" },
  { id:"acct-franklin",name:"Franklin Templeton",ownerId:"owner-4",ownerName:"Noah Williams",segment:"enterprise",annualContractValue:2_100_000,renewalDate:"2026-09-30T00:00:00.000Z",openOpportunityValue:850_000,strategicTier:2,healthScore:61,currency:"USD",executiveSponsor:null,accountStatus:"active" },
  { id:"acct-snowflake",name:"Snowflake",ownerId:"owner-5",ownerName:"Ava Martinez",segment:"enterprise",annualContractValue:1_800_000,renewalDate:"2026-11-20T00:00:00.000Z",openOpportunityValue:1_400_000,strategicTier:2,healthScore:68,currency:"USD",executiveSponsor:"Morgan Yu",accountStatus:"active" },
];
