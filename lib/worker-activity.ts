export type ActivityObservation={id:number;observedAt:string;validUntil:string;activeIds:string};
const zone='America/Los_Angeles';
const formatter=new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
export function laMidnight(date:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Invalid date');const [y,m,d]=date.split('-').map(Number);const desired=Date.UTC(y,m-1,d);if(new Date(desired).toISOString().slice(0,10)!==date)throw Error('Invalid date');let guess=desired;
 for(let i=0;i<4;i++){const p=Object.fromEntries(formatter.formatToParts(new Date(guess)).map(x=>[x.type,x.value]));const local=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);guess+=desired-local;}return guess;
}
export function nextDate(date:string){const t=Date.parse(date+'T00:00:00Z');if(!Number.isFinite(t))throw Error('Invalid date');return new Date(t+86400000).toISOString().slice(0,10);}
export function activityBuckets(rows:ActivityObservation[],start:number,end:number,stepMs:number,now=Date.now()){
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||![60000,300000,600000,3600000].includes(stepMs))throw Error('Invalid activity range');
 const effectiveEnd=Math.min(end,now),count=Math.max(0,Math.ceil((effectiveEnd-start)/stepMs));if(count>20000)throw Error('Range is too large for that interval; choose a shorter range or longer interval.');
 const buckets=Array.from({length:count},(_,i)=>({start:start+i*stepMs,end:start+(i+1)*stepMs,knownMs:0,instanceMs:0}));
 const data=rows.map(r=>({...r,t:Date.parse(r.observedAt),until:Date.parse(r.validUntil)})).sort((a,b)=>a.id-b.id);
 for(let i=0;i<data.length;i++){const r=data[i],next=data[i+1],prev=data[i-1];if(!Number.isFinite(r.t)||!Number.isFinite(r.until)||(next&&next.t<r.t)||(prev&&r.t<prev.t))continue;let ids:unknown;try{ids=JSON.parse(r.activeIds)}catch{continue}if(!Array.isArray(ids)||ids.some(x=>typeof x!=='string'||!x))continue;
  const count=new Set(ids).size,a=Math.max(start,r.t),b=Math.min(effectiveEnd,r.until,next?.t??Infinity);if(b<=a)continue;
  let j=Math.max(0,Math.floor((a-start)/stepMs));while(j<buckets.length&&buckets[j].start<b){const x=buckets[j],duration=Math.max(0,Math.min(b,x.end)-Math.max(a,x.start));x.knownMs+=duration;x.instanceMs+=duration*count;j++;}
 }
 return buckets.map(b=>({start:new Date(b.start).toISOString(),end:new Date(b.end).toISOString(),coverage:Math.min(1,b.knownMs/stepMs),average:b.knownMs===stepMs?b.instanceMs/stepMs:null,partialAverage:b.knownMs>0?b.instanceMs/b.knownMs:null,knownMs:b.knownMs}));
}
