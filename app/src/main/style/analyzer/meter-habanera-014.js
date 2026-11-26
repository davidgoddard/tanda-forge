/** Experiment 014: label-free, phase-searching predictive rhythmic recurrence.
 * Input: 009 spectral novelty, BPM assumed to be an approximate cycle/bar rate.
 * Only each passage's onset activity is used. No title, artist or reference style.
 */
import {excerptStarts010} from './meter-learning-010.js';
export const FEATURE_NAMES_014 = [
 'habBassFit','habMidFit','habWideFit','habCoverage','habPhaseStability',
 'habPredictiveFit','habVsStraight','tresilloFit','recurrenceLift',
 'cyclesObserved','selectedPeriodFactor','meanBassActivity','meanMidActivity'
];
const PERIOD_FACTORS=[.5,1,2];
const TEMPLATE_HAB=[1,0,0,1,1,0,1,0]; // 3-1-2-2 intervals in 8 subdivisions
const TEMPLATE_TRES=[1,0,0,1,0,0,1,0];
const TEMPLATE_STRAIGHT=[1,0,1,0,1,0,1,0];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mean=a=>a.reduce((s,x)=>s+x,0)/Math.max(1,a.length);
function centeredTemplate(t){const m=mean(t),v=t.map(x=>x-m),n=Math.hypot(...v);return v.map(x=>x/(n||1));}
const H=centeredTemplate(TEMPLATE_HAB),T=centeredTemplate(TEMPLATE_TRES),S=centeredTemplate(TEMPLATE_STRAIGHT);
function correlation(profile,template){const m=mean(profile),v=profile.map(x=>x-m),n=Math.hypot(...v);return n<1e-7?0:v.reduce((s,x,i)=>s+x*template[i],0)/n;}
function rotate(profile,k){return profile.map((_,i)=>profile[(i+k)%profile.length]);}
/** Build eight-position cycles for a chosen cycle length and onset-band.
 * Shift by a *fraction of the cycle*, independently of reference annotations.
 */
export function cycles014(novelty,band,start,duration,period,shift=0){
 const v=novelty.bands[band],fps=novelty.fps,origin=novelty.timeOriginSeconds;
 if(!v||!Number.isFinite(period)||period<=0)throw Error('Bad novelty or period');
 const n=Math.floor(duration/period),out=[];
 for(let c=0;c<n;c++){
  const cell=Array(8).fill(0),cnt=Array(8).fill(0);
  // The phase shifts the measured cycle boundary, not the raw beat BPM.
  const from=start+c*period+shift*period/8;
  const until=Math.min(start+duration,from+period);
  if(until-from<period*.92)continue;
  const a=Math.max(0,Math.ceil((from-origin)*fps)),z=Math.min(v.length,Math.floor((until-origin)*fps));
  for(let i=a;i<z;i++){
   const k=Math.min(7,Math.floor(((i/fps+origin-from)/period)*8));
   if(k<0)continue;
   const x=Math.log1p(Math.max(0,v[i])*200);
   cell[k]+=x;cnt[k]++;
  }
  if(cnt.some(x=>x<1))continue;
  out.push(cell.map((x,i)=>x/cnt[i]));
 }
 return out;
}
function stats014(cycles){
 if(cycles.length<3)return null;
 const train=cycles.slice(0,Math.max(1,Math.floor(cycles.length/2)));
 const test=cycles.slice(train.length);
 const avg=Array.from({length:8},(_,i)=>mean(train.map(c=>c[i])));
 // Orientation chosen using training cycles ONLY; evaluate on subsequent cycles.
 let phase=0,fit=-Infinity;
 for(let p=0;p<8;p++){const x=correlation(rotate(avg,p),H);if(x>fit){fit=x;phase=p;}}
 const tr=rotate(avg,phase),scores=test.map(c=>correlation(rotate(c,phase),H));
 const straights=test.map(c=>correlation(rotate(c,phase),S));
 const tresillos=test.map(c=>correlation(rotate(c,phase),T));
 const coverage=scores.filter(x=>x>=.30).length/test.length;
 const profileScores=test.map(c=>{let b=-Infinity;for(let p=0;p<8;p++)b=Math.max(b,correlation(rotate(c,p),H));return b;});
 const stability=mean(scores.map((s,i)=>Math.max(0,s)/(Math.max(0,profileScores[i])+.0001)));
 return {fit:mean(scores),coverage,stability,straight:mean(straights),tresillo:mean(tresillos),trainFit:correlation(tr,H),cycles:cycles.length};
}
/** Input novelty and approximate stored bar BPM. Searches 0.5x/1x/2x cycle.
 * Period selection is intentionally driven by *first-half* recurrence evidence;
 * second-half evaluation never selects the phase or period.
 */
export function featuresForPassage014(novelty,bpm,start,duration=6){
 if(!(bpm>=20&&bpm<=230)||duration<4)throw Error('Bad BPM or passage duration');
 const candidates=[];
 for(const factor of PERIOD_FACTORS){
  const period=60/bpm*factor;
  // At least 4 complete cycles, to permit held-forward predictions.
  if(Math.floor(duration/period)<4)continue;
  for(let shift=0;shift<8;shift++){
   const bass=cycles014(novelty,'bass',start,duration,period,shift);
   const mid=cycles014(novelty,'mid',start,duration,period,shift);
   const wide=cycles014(novelty,'wide',start,duration,period,shift);
   const b=stats014(bass),m=stats014(mid),w=stats014(wide);
   if(!b||!m||!w)continue;
   // Select ONLY from first-half fits, preventing selection of lucky test cycles.
   const selector=.35*b.trainFit+.40*m.trainFit+.25*w.trainFit;
   candidates.push({factor,shift,b,m,w,selector});
  }
 }
 if(!candidates.length)return Array(FEATURE_NAMES_014.length).fill(0);
 candidates.sort((a,b)=>b.selector-a.selector);
 const {factor,b,m,w}=candidates[0];
 const predictive=.35*b.fit+.40*m.fit+.25*w.fit;
 const straight=.35*b.straight+.40*m.straight+.25*w.straight;
 const tresillo=.35*b.tresillo+.40*m.tresillo+.25*w.tresillo;
 const coverage=.35*b.coverage+.40*m.coverage+.25*w.coverage;
 const stability=.35*b.stability+.40*m.stability+.25*w.stability;
 const lift=predictive-mean(candidates.filter(c=>c.factor===factor).map(c=>.35*c.b.fit+.40*c.m.fit+.25*c.w.fit));
 const out=[b.fit,m.fit,w.fit,coverage,stability,predictive,predictive-straight,tresillo,lift,w.cycles,factor,b.trainFit,m.trainFit];
 if(out.some(x=>!Number.isFinite(x)))throw Error('Non-finite 014 feature');
 return out.map(x=>+clamp(x,-100,100).toFixed(6));
}
export function extractPassages014(novelty,bpm,{offset=20,passage=6,count=16}={}){
 return excerptStarts010(novelty.durationSeconds,passage,count).map((start,index)=>({index,sourceStartSeconds:+(offset+start).toFixed(3),features:featuresForPassage014(novelty,bpm,start,passage)}));
}
