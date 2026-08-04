import type { AIConsoleRedactionPolicy } from "../config";

const secretKey = /(authorization|api[-_]?key|access[-_]?token|refresh[-_]?token|client[-_]?secret|credential|password|cookie|set-cookie)/i;
const sensitiveNoteKey = /(private|sensitive|confidential).*(note|comment)|rawsource|raw_source/i;
const email = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const phone = /(?:\+?\d[\d .()-]{7,}\d)/g;

export function redactAIConsoleValue(value: unknown, policy: AIConsoleRedactionPolicy): unknown {
  const ancestors = new WeakSet<object>();
  const visit = (current: unknown, key = ""): unknown => {
    if ((policy.maskCredentials || policy.maskAuthorizationHeaders) && secretKey.test(key)) return "[REDACTED]";
    if (policy.redactSensitiveNotes && sensitiveNoteKey.test(key)) return "[REDACTED SENSITIVE NOTE]";
    if (typeof current === "string") {
      let result = current;
      if (policy.maskEmailAddresses) result = result.replace(email, "[REDACTED EMAIL]");
      if (policy.maskPhoneNumbers) result = result.replace(phone, "[REDACTED PHONE]");
      return result;
    }
    if (typeof current === "function" || typeof current === "symbol") return "[NON-SERIALIZABLE REMOVED]";
    if (!current || typeof current !== "object") return current;
    if (ancestors.has(current)) return "[CIRCULAR REFERENCE REMOVED]";
    ancestors.add(current);
    if (Array.isArray(current)) { const output=current.map((item) => visit(item));ancestors.delete(current);return output; }
    const output: Record<string, unknown> = {};
    for (const [childKey, child] of Object.entries(current)) output[childKey] = visit(child, childKey);
    ancestors.delete(current);
    return output;
  };
  return visit(value);
}

export function stableStringify(value: unknown): string {
  const normalize = (current: unknown): unknown => Array.isArray(current) ? current.map(normalize) : current && typeof current === "object" ? Object.fromEntries(Object.entries(current).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,normalize(item)])) : current;
  return JSON.stringify(normalize(value), null, 2);
}

export function containsAIConsoleSecret(value: unknown): boolean {
  const text = typeof value === "string" ? value : stableStringify(value);
  return /bearer\s+(?!\[redacted\])[a-z0-9._-]+|(?:^|["'\s:])sk-[a-z0-9_-]{8,}/i.test(text);
}
