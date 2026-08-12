import {existsSync,mkdirSync,readFileSync,renameSync,writeFileSync} from "node:fs";
import {dirname,join} from "node:path";

export type ApplicationMode="DEMO"|"PRODUCTION";

const configFile=()=>process.env.AROS_APP_CONFIG_PATH??join(/*turbopackIgnore: true*/ process.cwd(),".aros-data","application.json");
const parseMode=(value:unknown):ApplicationMode|null=>typeof value==="string"&&value.trim().toUpperCase()==="PRODUCTION"?"PRODUCTION":typeof value==="string"&&value.trim().toUpperCase()==="DEMO"?"DEMO":null;

export function getApplicationMode():ApplicationMode{
  const path=configFile();
  if(existsSync(path))try{return parseMode(JSON.parse(readFileSync(path,"utf8")).mode)??"DEMO"}catch{}
  return parseMode(process.env.AROS_APP_MODE)??"DEMO";
}

export function setApplicationMode(mode:ApplicationMode){
  const path=configFile(),temporary=`${path}.${process.pid}.tmp`;
  mkdirSync(dirname(path),{recursive:true});
  writeFileSync(temporary,JSON.stringify({mode,updatedAt:new Date().toISOString()},null,2),{mode:0o600});
  renameSync(temporary,path);
}

export function isDemoApplication(){return getApplicationMode()==="DEMO"}
