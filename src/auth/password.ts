import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
const KEY_LENGTH=64;
export function hashPassword(password:string,salt=randomBytes(16).toString("hex")){return `scrypt$${salt}$${scryptSync(password,salt,KEY_LENGTH).toString("hex")}`}
export function verifyPassword(password:string,encoded:string){const [algorithm,salt,digest]=encoded.split("$");if(algorithm!=="scrypt"||!salt||!digest)return false;const actual=scryptSync(password,salt,KEY_LENGTH),expected=Buffer.from(digest,"hex");return expected.length===actual.length&&timingSafeEqual(expected,actual)}
