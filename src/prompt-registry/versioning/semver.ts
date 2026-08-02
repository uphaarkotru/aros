export const semverPattern=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export function compareSemver(a:string,b:string):number{const left=a.split(".").map(Number),right=b.split(".").map(Number);for(let index=0;index<3;index++){const delta=(left[index]??0)-(right[index]??0);if(delta)return delta;}return 0;}
export function compatibleMinimum(actual:string,minimum:string):boolean{const version=(value:string)=>Number(value.match(/v(\d+)$/)?.[1]??-1);return actual===minimum||version(actual)>=version(minimum);}
