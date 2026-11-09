'use client';
import {useSyncExternalStore} from 'react';
const subscribe=()=>()=>{};
const localSnapshot=()=>['127.0.0.1','localhost','[::1]','::1'].includes(window.location.hostname);
export default function LocalPreviewBanner(){
 const local=useSyncExternalStore(subscribe,localSnapshot,()=>false);
 if(!local)return null;
 return <div role="note" aria-label="Local preview notice" style={{position:'relative',zIndex:10,background:'#f5d982',color:'#241735',padding:'16px 24px',borderBottom:'3px solid #8d6238',fontSize:16,lineHeight:1.5}}><strong>Local preview — separate data</strong><br/>Assignments, worker capacity, and activity here are local development records. They do not show or update the live team. <a href="https://your-staffing-site.example" style={{color:'#36155b',fontWeight:700,textDecoration:'underline'}}>Open the live Staffing site</a>.</div>;
}
