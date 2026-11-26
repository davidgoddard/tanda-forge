import {readFileSync} from 'node:fs';
import {extractMeterNovelty009} from './meter-periodicity-009.js';
import {FEATURE_NAMES_010,featuresForPassage010,excerptStarts010,predictLogistic010,votePassages010} from './meter-learning-010.js';
import {FEATURE_NAMES_014,featuresForPassage014} from './meter-habanera-014.js';
import {FEATURE_NAMES_015,featuresForPassage015} from './meter-patterns-015.js';
import {FEATURE_NAMES_016,extractPassages016} from './meter-vocal-ablation-016.js';
export const MODEL_VERSION='dtoty-rhythm-1';
export const MILONGA_FEATURES=[...FEATURE_NAMES_010,...FEATURE_NAMES_014,...FEATURE_NAMES_015,...FEATURE_NAMES_016];
export function validateModel(model,stage){
 const names=stage==='vals'?FEATURE_NAMES_010:MILONGA_FEATURES;
 if(model.schema!==1||model.version!==MODEL_VERSION||model.stage!==stage||model.type!=='logistic'||
    JSON.stringify(model.featureNames)!==JSON.stringify(names)||!(model.trainingTracks>0))throw Error('Invalid style model identity/features');
 for(const [key,length] of [['means',names.length],['sd',names.length],['coeff',names.length+1]])
  if(!Array.isArray(model[key])||model[key].length!==length||model[key].some(x=>!Number.isFinite(x)||(key==='sd'&&x<=0)))throw Error('Invalid style model parameters');
 if(!model.coeff.some(x=>x!==0))throw Error('Untrained style model');
 if(JSON.stringify(model.thresholds)!==JSON.stringify({positive:.65,negative:.35,minVotes:2,minMargin:.2})||
    JSON.stringify(model.settings)!==JSON.stringify({sampleRate:11025,offset:20,duration:150,passage:6,count:16}))throw Error('Unsupported style model settings');
 return model;
}
export const models=Object.fromEntries(['vals','milonga'].map(stage=>[stage,validateModel(JSON.parse(readFileSync(new URL(`${stage}-v1.json`,import.meta.url),'utf8')),stage)]));
const mean=xs=>xs.reduce((s,x)=>s+x,0)/Math.max(1,xs.length);
/** Takes the already-decoded 20..170 second segment, exactly as the experiments. */
export function extractFeatures(pcm,bpm){
 if(!(pcm instanceof Float32Array)||pcm.some(x=>!Number.isFinite(x)))throw Error('Invalid style PCM');
 if(!Number.isFinite(bpm)||bpm<20||bpm>230)throw Error('Style analysis requires bar BPM between 20 and 230');
 const novelty=extractMeterNovelty009(pcm);
 const filtered=extractPassages016(pcm,bpm);
 return excerptStarts010(novelty.durationSeconds,6,16).map((start,index)=>{
  const vals=featuresForPassage010(novelty,bpm,start,6);
  return {seconds:+(20+start).toFixed(3),vals,milonga:[...vals,...featuresForPassage014(novelty,bpm,start,6),...featuresForPassage015(novelty,bpm,start,6),...filtered[index].features]};
 });
}
export function classifyFeatures(passages,frozen=models){
 if(!passages.length)throw Error('No usable style passages');
 for(const p of passages)for(const [key,length] of [['vals',24],['milonga',112]])
  if(!Array.isArray(p[key])||p[key].length!==length||p[key].some(x=>!Number.isFinite(x)))throw Error('Invalid style feature vector');
 const valsScores=passages.map(p=>predictLogistic010(frozen.vals,p.vals));
 const vals=votePassages010(valsScores,frozen.vals.thresholds);
 const milongaScores=vals.prediction==='vals'?[]:passages.map(p=>predictLogistic010(frozen.milonga,p.milonga));
 const milonga=milongaScores.length?votePassages010(milongaScores,frozen.milonga.thresholds):null;
 const style=vals.prediction==='vals'?'Vals':milonga?.prediction==='vals'?'Milonga':'Tango';
 const fallback=style==='Tango'&&(vals.prediction!=='non-vals'||milonga?.prediction!=='non-vals');
 return {style,modelVersion:MODEL_VERSION,fallback,decisionSource:style==='Vals'?'vals-vote':style==='Milonga'?'milonga-vote':fallback?'tango-fallback':'tango-vote',
  score:style==='Vals'?mean(valsScores):style==='Milonga'?mean(milongaScores):1-mean(milongaScores),
  valsScore:mean(valsScores),milongaScore:milongaScores.length?mean(milongaScores):null,
  valsVotes:vals,milongaVotes:milonga,uncalibrated:true,trainingDomain:'DTOTY; nontraditional music is not validated',
  passages:passages.map((p,i)=>({seconds:p.seconds,valsScore:valsScores[i],milongaScore:milongaScores[i]??null}))};
}
export function analyzeStyle(samples,bpm){
 const start=performance.now();
 // Share the full bounded BPM decode. A subarray adds no second PCM buffer.
 const passages=extractFeatures(samples.subarray(20*11025,170*11025),bpm);
 const extracted=performance.now();const result=classifyFeatures(passages);
 return {...result,timings:{featureMs:extracted-start,inferenceMs:performance.now()-extracted}};
}
