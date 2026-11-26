/** Experiment 016: fixed, label-blind filtering ablations, NOT vocal separation. */
import {extractMeterNovelty009} from './meter-periodicity-009.js';
import {featuresForPassage015,FEATURE_NAMES_015} from './meter-patterns-015.js';
import {excerptStarts010} from './meter-learning-010.js';
export const VARIANTS_016=['bass','treble'];
export const FEATURE_NAMES_016=VARIANTS_016.flatMap(v=>FEATURE_NAMES_015.map(k=>v+'_'+k));
const RATE=11025;
// Cascaded one-pole filters. Low-pass bass <= 250 Hz; high-pass treble >= 1700 Hz.
// Filtering happens BEFORE novelty extraction; no track labels are consulted.
export function filter016(pcm,variant,rate=RATE){
 if(!(pcm instanceof Float32Array)||rate!==RATE)throw Error('Expected 11025 Hz Float32Array');
 if(!VARIANTS_016.includes(variant))throw Error('Unknown variant');
 const cutoff=variant==='bass'?250:1700,alpha=Math.exp(-2*Math.PI*cutoff/rate);
 const out=new Float32Array(pcm.length);let lp1=0,lp2=0;
 for(let i=0;i<pcm.length;i++){
  const x=pcm[i];lp1=(1-alpha)*x+alpha*lp1;lp2=(1-alpha)*lp1+alpha*lp2;
  out[i]=variant==='bass'?lp2:x-lp2;
 }
 return out;
}
export function extractPassages016(pcm,bpm,{offset=20,passage=6,count=16}={}){
 const variants=Object.fromEntries(VARIANTS_016.map(v=>[v,extractMeterNovelty009(filter016(pcm,v))]));
 const starts=excerptStarts010(variants.bass.durationSeconds,passage,count);
 return starts.map((start,index)=>({index,sourceStartSeconds:+(offset+start).toFixed(3),features:VARIANTS_016.flatMap(v=>featuresForPassage015(variants[v],bpm,start,passage))}));
}
