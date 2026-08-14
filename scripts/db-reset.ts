import { Pool } from "pg";
async function main(){if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (process.env.ALLOW_DATABASE_RESET !== "true") throw new Error("Set ALLOW_DATABASE_RESET=true to confirm reset");
const pool = new Pool({connectionString:process.env.DATABASE_URL});
await pool.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public`);
await pool.end();
console.log("Database schema reset. Run npm run db:migrate and npm run db:seed.");
}main().catch(error=>{console.error(error);process.exitCode=1});
