/** Experiment 015: competing phase-invariant rhythmic recurrence hypotheses.
 * The shapes are testable onset templates, NOT definitions of milonga.
 * Each template's phase/period is chosen on the first half of a passage;
 * all returned fit/coverage numbers use subsequent, unseen cycles.
 */
import {cycles014} from './meter-habanera-014.js';
import {excerptStarts010} from './meter-learning-010.js';
export const PATTERNS_015 = Object.freeze({
  habanera: [0,3,4,6],     // 3-1-2-2 (Exp 014 control)
  tresillo: [0,3,6],       // 3-3-2
  cinquillo: [0,2,3,5,6],  // 2-1-2-1-2
  syncopa: [0,2,3,4,6],    // 2-1-1-2-2 hypothesis
  anticipation: [0,3,4,7] // displaced duple / anticipation control
});
export const PATTERN_NAMES_015=Object.keys(PATTERNS_015);
const PERIOD_FACTORS=[.5,1,2], BANDS=['bass','mid','wide'], WEIGHTS=[.35,.40,.25];
export const FEATURE_NAMES_015=PATTERN_NAMES_015.flatMap(k=>[
 `${k}PredictiveFit`,`${k}Coverage`,`${k}PhaseStability`,`${k}VsStraight`,`${k}PeriodFactor`
]);
const mean=a=>a.reduce((s,x)=>s+x,0)/Math.max(1,a.length);
const unit=a=>{const mu=mean(a),z=a.map(x=>x-mu),n=Math.hypot(...z);return z.map(x=>x/(n||1));};
const TEMPLATES=Object.fromEntries(Object.entries(PATTERNS_015).map(([k,pos])=>[k,unit(Array.from({length:8},(_,i)=>pos.includes(i)?1:0))]));
const STRAIGHT=unit([1,0,1,0,1,0,1,0]);
function corr(profile,t,phase){const mu=mean(profile),v=profile.map(x=>x-mu),n=Math.hypot(...v);if(n<1e-9)return 0;return v.reduce((s,_,i)=>s+v[(i+phase)%8]*t[i],0)/n;}
function oriented(cycles,t){const n=Math.floor(cycles.length/2);if(n<2||cycles.length-n<2)return null;
 const training=cycles.slice(0,n),held=cycles.slice(n),avg=Array.from({length:8},(_,i)=>mean(training.map(c=>c[i])));
 let phase=0,trainFit=-Infinity;
 for(let p=0;p<8;p++){const score=corr(avg,t,p);if(score>trainFit){trainFit=score;phase=p;}}
 const scores=held.map(c=>corr(c,t,phase));
 const best=held.map(c=>Math.max(...Array.from({length:8},(_,p)=>corr(c,t,p))));
 return {trainFit,fit:mean(scores),coverage:mean(scores.map(x=>x>=.3?1:0)),stability:mean(scores.map((x,i)=>Math.max(0,x)/(Math.max(0,best[i])+.0001))),straight:mean(held.map(c=>corr(c,STRAIGHT,phase))),n:cycles.length};
}
/** Return independent template evidence. Search must never access any style labels. */
export function featuresForPassage015(novelty,bpm,start,duration=6){
 if(!(bpm>=20&&bpm<=230)||duration<4)throw Error('Invalid BPM/passage');
 const candidates=[];
 for(const factor of PERIOD_FACTORS){const period=60/bpm*factor;if(Math.floor(duration/period)<4)continue;
  for(let shift=0;shift<8;shift++){
   const cs=BANDS.map(b=>cycles014(novelty,b,start,duration,period,shift));
   if(cs.some(c=>c.length<4))continue;
   candidates.push({factor,cs});
  }
 }
 if(!candidates.length)return Array(FEATURE_NAMES_015.length).fill(0);
 const result=[];
 for(const key of PATTERN_NAMES_015){
  const template=TEMPLATES[key];let best=null;
  for(const candidate of candidates){
   const byBand=candidate.cs.map(c=>oriented(c,template));if(byBand.some(s=>!s))continue;
   const selection=byBand.reduce((s,v,i)=>s+WEIGHTS[i]*v.trainFit,0);
   if(!best||selection>best.selection)best={selection,factor:candidate.factor,byBand};
  }
  if(!best){result.push(0,0,0,0,0);continue;}
  const weighted=k=>best.byBand.reduce((s,v,i)=>s+WEIGHTS[i]*v[k],0);
  const fit=weighted('fit'),coverage=weighted('coverage'),stability=weighted('stability');
  result.push(fit,coverage,stability,fit-weighted('straight'),best.factor);
 }
 if(result.length!==FEATURE_NAMES_015.length||result.some(x=>!Number.isFinite(x)))throw Error('Bad 015 features');
 return result.map(x=>Number(Math.max(-100,Math.min(100,x)).toFixed(6)));
}
export function extractPassages015(novelty,bpm,{offset=20,passage=6,count=16}={}){
 return excerptStarts010(novelty.durationSeconds,passage,count).map((start,index)=>({index,sourceStartSeconds:Number((offset+start).toFixed(3)),features:featuresForPassage015(novelty,bpm,start,passage)}));
}
