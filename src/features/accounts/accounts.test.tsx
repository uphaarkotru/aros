import { render,screen } from "@testing-library/react";import userEvent from "@testing-library/user-event";import { accountDigitalTwins } from "@/data/synthetic/final-account-digital-twins";import { AccountsList } from "./accounts-list";import { AccountDetail } from "./account-detail";import AccountPage from "@/app/accounts/[accountId]/page";import { describe,expect,it } from "vitest";
describe("Accounts experience",()=>{
it("renders five accounts",()=>{render(<AccountsList twins={accountDigitalTwins}/>);expect(screen.getAllByRole("link")).toHaveLength(5)});
it("loads selected account detail",()=>{render(<AccountDetail twin={accountDigitalTwins[0]}/>);expect(screen.getByRole("heading",{name:"Coinbase",level:1})).toBeVisible()});
it("displays active decisions",()=>{render(<AccountDetail twin={accountDigitalTwins[0]}/>);expect(screen.getByText("Coinbase renewal risk increased")).toBeVisible()});
it("shows stakeholder roles",()=>{render(<AccountDetail twin={accountDigitalTwins[0]}/>);expect(screen.getAllByText("economic buyer").length).toBeGreaterThan(0);expect(screen.getAllByText("champion").length).toBeGreaterThan(0)});
it("shows all eight MEDDPICC fields",()=>{render(<AccountDetail twin={accountDigitalTwins[0]}/>);expect(screen.getAllByText(/confirmed|partial|missing/)).toHaveLength(8)});
it("filters the timeline",async()=>{render(<AccountDetail twin={accountDigitalTwins[0]}/>);await userEvent.click(screen.getByRole("button",{name:"support"}));expect(screen.getByText("No timeline events match this filter.")).toBeVisible()});
it("provides mobile-safe account workspace class",()=>{const {container}=render(<AccountDetail twin={accountDigitalTwins[0]}/>);expect(container.querySelector("article")).toBeInTheDocument()});
it("renders account not found safely",async()=>{render(await AccountPage({params:Promise.resolve({accountId:"missing"})}));expect(screen.getByRole("heading",{name:"Account not found"})).toBeVisible()});
});
