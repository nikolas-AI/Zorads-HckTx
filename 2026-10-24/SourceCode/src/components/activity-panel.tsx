"use client";
import { useEffect, useState } from 'react';
import { X, Activity } from 'lucide-react';
import { browserDb } from '@/lib/supabase';
import { activitySummary, type Attempt } from '@/lib/activity';
const dollars = (n: number) => `$${n.toFixed(6)}`;
export default function ActivityPanel({ roomId, onClose }: { roomId: string; onClose: () => void }) {
 const [names,setNames]=useState<Record<string,string>>({});
 const [rows,setRows]=useState<Attempt[]>([]);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 const [now,setNow]=useState(Date.now());
 useEffect(()=>{
  let active=true; const db=browserDb();
  setRows([]); setLoading(true);
  const sync=async()=>{
   const [{data,error}, roster]=await Promise.all([db.from('ai_attempts').select('*').eq('room_id',roomId).order('created_at',{ascending:false}).limit(100), db.from('agents').select('id,name')]);
   if(!active)return;
   setNow(Date.now());setLoading(false);
   if(error){setError('Activity is unavailable. Check the connection and Phase 2 database migration.');return;}
   setError('');setRows(data || []); if(roster.data)setNames(Object.fromEntries(roster.data.map(a=>[a.id,a.name])));
  };
  void sync();
  const channel=db.channel(`activity-${roomId}`).on('postgres_changes',{event:'*',schema:'public',table:'ai_attempts',filter:`room_id=eq.${roomId}`},()=>void sync()).subscribe(status=>{if(status==='SUBSCRIBED')void sync();});
  const timer=setInterval(()=>void sync(),15000);
  return()=>{active=false;clearInterval(timer);void db.removeChannel(channel);};
 },[roomId]);
 useEffect(()=>{const key=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[onClose]);
 const summary=activitySummary(rows);
 return <aside className="activity-panel" aria-label="AI activity"><header><div><Activity size={19}/><h2>Behind the conversation</h2></div><button autoFocus aria-label="Close activity" onClick={onClose}><X size={20}/></button></header>
 <p className="activity-caption">AI activity and usage for this group.</p>
 {error && <p className="error" role="alert">{error}</p>}
 {loading ? <p>Loading activity…</p> : <>
 <h3 className="activity-section-title">Overview</h3>
 <div className="activity-metrics"><div><strong>{summary.requests}</strong><span>AI requests</span></div><div><strong>{rows.length}</strong><span>Model attempts</span></div><div><strong>{rows.length > summary.unknown ? dollars(summary.cost) : '—'}</strong><span>Known cost estimates</span></div><div><strong>{summary.savings===null?'—':dollars(summary.savings)}</strong><span>Estimated savings</span></div></div>
 <details className="activity-estimates"><summary>About these estimates</summary><p className="activity-caption">{summary.unknown ? `${summary.unknown} attempt(s) have unknown usage or unconfigured prices. Totals are incomplete; savings are hidden.` : 'Estimates use reported tokens and the prices configured at execution time.'} Output includes thinking tokens. Baseline uses the same tokens at the reference model’s prices—not a quality-equivalent benchmark. No tools or paid classifier calls are used.</p></details>
 {summary.averageLatency!==null && <p className="activity-caption">Average completed-attempt latency: {(summary.averageLatency/1000).toFixed(1)}s</p>}
 {rows.length>0 && <details className="activity-breakdown"><summary>Models, friends & task difficulty</summary>{[summary.byModel,summary.byAgent,summary.byComplexity].map((group,index)=><ul key={index}>{group.map(([name,count])=><li key={name}><span>{index===1 ? names[name] || 'AI friend' : name}</span><strong>{count}</strong></li>)}</ul>)}</details>}
 {!rows.length && !error && <p className="activity-empty">Ask a friend something. Their activity will appear here.</p>}
 <h3 className="activity-section-title">Recent activity</h3>
 <div className="activity-feed">{rows.map(row=><article key={row.id}><div className="activity-row"><strong>{names[row.agent_id] || 'AI friend'}</strong><span>{row.status==='running' && now-Date.parse(row.created_at)>90000?'Interrupted / unknown':row.status}</span></div><p>{row.model} · {row.complexity.toLowerCase()}{row.escalated?' · deeper follow-up':''}{row.attempt>1?' · fallback':''}</p><small>{row.reason}</small><dl><div><dt>Tokens in / out</dt><dd>{row.input_tokens??'?'} / {row.output_tokens??'?'}</dd></div><div><dt>Estimated cost</dt><dd>{row.estimated_cost===null?'Unknown':dollars(Number(row.estimated_cost))}</dd></div><div><dt>Reference estimate</dt><dd>{row.baseline_cost===null?'Unknown':dollars(Number(row.baseline_cost))}</dd></div><div><dt>Latency</dt><dd>{row.latency_ms===null?'—':`${(row.latency_ms/1000).toFixed(1)}s`}</dd></div></dl><small>Reference: {row.baseline_model || 'Not configured'} · {new Date(row.created_at).toLocaleTimeString()}</small>{row.error&&<p className="error">{row.error}</p>}</article>)}</div></>}
 </aside>;
}

