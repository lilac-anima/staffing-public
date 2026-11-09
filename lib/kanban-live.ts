/** Preserve locally edited versions (including their original revision) until saved. */
export function mergeBoard<T extends {id:string}>(incoming:T[], current:T[], dirty:Set<string>):T[] {
 const local=new Map(current.filter(t=>dirty.has(t.id)).map(t=>[t.id,t]));
 return [...incoming.map(t=>local.get(t.id) ?? t),...current.filter(t=>dirty.has(t.id) && !incoming.some(v=>v.id===t.id))];
}
