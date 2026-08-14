import {describe,expect,it} from "vitest";import {sha256} from "./sha256";
describe("browser-safe SHA-256",()=>{it("matches the standard SHA-256 test vector",()=>expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"))});
