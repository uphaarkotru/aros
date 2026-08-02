import type {RedactionPolicy} from "@/domain/llm-context/types";
const email=/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,phone=/(?<!\d)(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}(?!\d)/g;
export function redactText(value:string,policy:RedactionPolicy){let result=value;if(policy.maskEmailAddresses)result=result.replace(email,"[email redacted]");if(policy.maskPhoneNumbers)result=result.replace(phone,"[phone redacted]");return result;}
export function redactStrings<T>(value:T,policy:RedactionPolicy):T{if(typeof value==="string")return redactText(value,policy) as T;if(Array.isArray(value))return value.map(item=>redactStrings(item,policy)) as T;if(value&&typeof value==="object"){const output:Record<string,unknown>={};for(const[key,item]of Object.entries(value)){if(policy.excludedFieldPaths.some(path=>key===path||path.endsWith(`.${key}`)))continue;output[key]=redactStrings(item,policy);}return output as T;}return value;}

