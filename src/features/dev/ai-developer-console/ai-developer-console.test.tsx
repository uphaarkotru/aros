import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createCoinbaseAIConsoleTraces } from "@/ai-developer-console/fixtures/coinbase-traces";
import { AIDeveloperConsole } from "./ai-developer-console";

describe("AI Developer Console UI",()=>{
 it("renders pipeline, context, prompt, provider, economics, diff, and timeline views",()=>{render(<AIDeveloperConsole initialTraces={createCoinbaseAIConsoleTraces()}/>);expect(screen.getByRole("heading",{name:"AI Developer Console"})).toBeInTheDocument();expect(screen.getByRole("button",{name:"Inspect Context"})).toBeInTheDocument();expect(screen.getByText("Prompt & recommendation comparison")).toBeInTheDocument();fireEvent.click(screen.getByRole("button",{name:"Inspect Prompt"}));expect(screen.getByText("Citation, uncertainty and prohibited behavior policies")).toBeInTheDocument();fireEvent.change(screen.getByLabelText("Execution mode"),{target:{value:"real-provider-development"}});fireEvent.click(screen.getByText("Real Provider Development",{selector:"strong"}));fireEvent.click(screen.getByRole("button",{name:"Inspect Provider"}));expect(screen.getByText(/REDACTED · Provider-neutral request/)).toBeInTheDocument();expect(screen.getByText(/No provider SDK object is exposed/)).toBeInTheDocument();});
 it("shows partial-stage explanations and scoped search",()=>{render(<AIDeveloperConsole initialTraces={createCoinbaseAIConsoleTraces()}/>);fireEvent.click(screen.getByRole("button",{name:"Inspect Provider"}));expect(screen.getByText("Stage unavailable")).toBeInTheDocument();fireEvent.change(screen.getByLabelText("Search safe trace"),{target:{value:"evidence"}});expect(screen.getByText("Search matches")).toBeInTheDocument();});
 it("replays without invoking a live provider",()=>{render(<AIDeveloperConsole initialTraces={createCoinbaseAIConsoleTraces()}/>);fireEvent.click(screen.getByRole("button",{name:"Replay artifact"}));expect(screen.getByRole("status")).toHaveTextContent("$0.00 incremental API cost");});
});

Object.assign(navigator,{clipboard:{writeText:vi.fn().mockResolvedValue(undefined)}});
