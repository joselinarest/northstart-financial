import type {PostgresDatabase} from '@/lib/db';
import {randomUUID} from 'node:crypto';
import {academyModules,academyReferences,makeExercise,makeMarketCase,publicExercise,gradeExercise,type Exercise,type AcademyBar} from '@/lib/academy-curriculum';
type Row=Record<string,any>;
export function skillProgress(rows:Row[],threshold=80,now=Date.now()){
 return [...new Set(academyModules.flatMap(m=>[...m[3]]))].map(concept=>{
 const all=rows.filter(r=>r.concept===concept&&r.answered_at),recent=all.slice(0,10),correct=recent.filter(r=>r.feedback_json?.correct).length,accuracy=recent.length?Math.round(correct/recent.length*100):0,last=recent[0];
 const delay=last?.feedback_json?.correct?Math.min(14,Math.max(2,correct))*86400000:86400000,due=last?new Date(last.answered_at).getTime()+delay:null;
 return {concept,attempts:all.length,accuracy,mastered:recent.length>=5&&accuracy>=threshold,dueAt:due?new Date(due).toISOString():null,due:due!==null&&due<=now};
 });
}
export async function academyDashboard(db:PostgresDatabase,household:string,user:string,includeTrades=true){
 const rows=(await db.prepare('SELECT id,module,concept,feedback_json,answered_at FROM academy_sessions WHERE household_id=? AND user_id=? AND answered_at IS NOT NULL ORDER BY answered_at DESC LIMIT 2000').bind(household,user).all()).results as Row[];
 const p=await db.prepare('SELECT mastery_threshold FROM academy_preferences WHERE household_id=? AND user_id=?').bind(household,user).first<Row>(),threshold=p?.mastery_threshold||80,skills=skillProgress(rows,threshold);
 const trades=includeTrades?(await db.prepare('SELECT e.id,s.ticker FROM trade_lifecycle_exits e JOIN securities s ON s.id=e.security_id JOIN post_trade_reviews p ON p.exit_id=e.id WHERE e.household_id=? ORDER BY e.created_at DESC LIMIT 30').bind(household).all()).results:[];
 return {modules:academyModules.map(m=>({id:m[0],title:m[1],level:m[2],concepts:m[3]})),skills,threshold,completed:rows.length,accuracy:rows.length?Math.round(rows.filter(r=>r.feedback_json?.correct).length/rows.length*100):0,references:academyReferences,trades};
}
export function historicalExercise(symbol:string,input:AcademyBar[],cutoff?:string):Exercise{
 const bars=input.filter(b=>[b.open,b.high,b.low,b.close,b.volume].every(Number.isFinite)&&Number.isFinite(Date.parse(b.time))).sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
 // Daily bars from the entry day include prices observed after an intraday entry. Exclude the entire day.
 const cutoffDay=cutoff?Date.parse(cutoff.slice(0,10)+'T00:00:00Z'):null;
 const split=cutoffDay!==null?bars.findIndex(b=>Date.parse(b.time)>=cutoffDay):bars.length-5;
 if(split<20||split>=bars.length)throw Error('No hay suficientes velas verificadas antes y después del corte. Elige otro escenario.');
 const visible=bars.slice(Math.max(0,split-30),split),future=bars.slice(split,split+8),last=visible.at(-1)!,prior=visible.slice(-10,-1),high=Math.max(...prior.map(b=>b.high)),low=Math.min(...prior.map(b=>b.low));
 const answer=last.close>high?0:last.close<low?1:2;
 return {id:'historical:'+symbol+':'+last.time,module:'structure',concept:'trend',title:symbol+' · estructura al corte',level:'Intermediate',explanation:'Compara el último close con el rango de las nueve velas anteriores.',task:'¿Dónde cierra la última vela respecto al rango de las nueve anteriores? Clasifica estructura observada; no predigas el futuro.',mode:'choice',choices:['Sobre el rango: breakout por confirmar','Bajo el rango: breakdown por confirmar','Dentro del rango: dirección sin confirmar'],answer,tolerance:0,reason:`Close ${last.close.toFixed(2)}; rango anterior ${low.toFixed(2)}–${high.toFixed(2)}. La ruptura exige contexto, volumen y riesgo antes de operar.`,wrong:['Compara el close con el máximo anterior; una mecha no basta.','Compara el close con el mínimo anterior; una mecha no basta.','Solo es rango si el close permanece entre ambos extremos.'],bars:visible,future,source:symbol+' · barras históricas guardadas · corte '+last.time,timeframe:'1D',connection:'Trading: distingue una observación confirmada de una predicción.',outcome:{label:'Movimiento observado después del corte; no demuestra por sí solo calidad del proceso.',first:last.close,last:future.at(-1)?.close}};
}
export async function startAcademy(db:PostgresDatabase,household:string,user:string,b:Row){
 let e:Exercise;
 if(b.source==='case'){e=makeMarketCase(Number(b.step||0));}else if(b.source==='market'||b.source==='trade'){
 let trade:Row|null=null;
 if(b.source==='trade'){trade=await db.prepare('SELECT p.input_json,p.review_json,s.ticker FROM post_trade_reviews p JOIN trade_lifecycle_exits e ON e.id=p.exit_id JOIN securities s ON s.id=e.security_id WHERE e.id=? AND e.household_id=?').bind(String(b.tradeId||''),household).first<Row>();if(!trade?.input_json?.entryAt)throw Error('No hay una entrada confirmada con fecha para este trade. No se fabricará un gráfico previo.');}
 const cache=trade?(await db.prepare('SELECT cache_key,payload_json FROM discovery_provider_cache WHERE cache_key=?').bind('research-v2:'+trade.ticker).all()).results:(await db.prepare("SELECT cache_key,payload_json FROM discovery_provider_cache WHERE cache_key LIKE 'research-v2:%' AND jsonb_typeof(payload_json->'bars')='array' AND jsonb_array_length(payload_json->'bars')>=35 AND fetched_at>CURRENT_TIMESTAMP-INTERVAL '7 days' ORDER BY fetched_at DESC LIMIT 40").all()).results;
 let found:Exercise|undefined;
 const past=await db.prepare("SELECT COUNT(*) AS n FROM academy_sessions WHERE household_id=? AND user_id=? AND exercise_json->>'id' LIKE 'historical:%'").bind(household,user).first<Row>();
 const offset=cache.length?Number(past?.n||0)%cache.length:0,rotated=[...cache.slice(offset),...cache.slice(0,offset)];
 for(const row of rotated as Row[]){try{const bars=row.payload_json?.bars;if(!Array.isArray(bars))continue;found=historicalExercise(row.cache_key.slice(12),bars,trade?.input_json.entryAt);break;}catch{}}
 if(!found)throw Error('No hay un escenario histórico con barras suficientes en el scanner. La práctica original sigue disponible.');
 e=found;if(trade)e.outcome={...(e.outcome as Row),originalRecommendation:trade.input_json.predicted,actualOutcome:trade.review_json};
 }else{
 const dashboard=await academyDashboard(db,household,user),module=academyModules.find(m=>m[0]===b.module);
 let candidates=dashboard.skills.filter(s=>!module||module[3].some(c=>c===s.concept));
 if(b.concept&&candidates.some(s=>s.concept===b.concept))candidates=candidates.filter(s=>s.concept===b.concept);
 candidates.sort((a,c)=>Number(c.due)-Number(a.due)||Number(a.mastered)-Number(c.mastered)||a.attempts-c.attempts||a.accuracy-c.accuracy);
 const skill=candidates[0],m=module||academyModules.find(m=>m[3].some(c=>c===skill.concept))!;
 // New chart variants, even when an incorrect concept returns tomorrow.
 const count=await db.prepare('SELECT COUNT(*) AS n FROM academy_sessions WHERE household_id=? AND user_id=? AND concept=?').bind(household,user,skill.concept).first<Row>();
 e=makeExercise(m[0],m[3].findIndex(c=>c===skill.concept),Number(count?.n||0));
 }
 const id=randomUUID();await db.prepare('INSERT INTO academy_sessions(id,household_id,user_id,module,concept,exercise_json) VALUES(?,?,?,?,?,?::jsonb)').bind(id,household,user,e.module,e.concept,JSON.stringify(e)).run();return {sessionId:id,question:publicExercise(e)};
}
export async function answerAcademy(db:PostgresDatabase,household:string,user:string,id:string,value:unknown){return db.transaction(async tx=>{
 const row=await tx.prepare('SELECT * FROM academy_sessions WHERE id=? AND household_id=? AND user_id=? FOR UPDATE').bind(id,household,user).first<Row>();if(!row)throw Error('Sesión no encontrada.');if(row.answered_at)return row.feedback_json;
 const feedback=gradeExercise(row.exercise_json,value);await tx.prepare('UPDATE academy_sessions SET answer_json=?::jsonb,feedback_json=?::jsonb,answered_at=CURRENT_TIMESTAMP WHERE id=?').bind(JSON.stringify(value),JSON.stringify(feedback),id).run();return feedback;
 });}
