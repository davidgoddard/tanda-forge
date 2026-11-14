import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {stat} from 'node:fs/promises';
import {fft} from './fft.js';
export const ALGORITHM='windowed-whitened-autocorrelation-v1';
const SR=11025,HOP=110,NFFT=1024,RATE=SR/HOP;
export async function decodeFile(filename,{ffmpegPath='ffmpeg',durationSeconds=600,timeoutMs=120000}={}) {
 if(!Number.isFinite(durationSeconds)||durationSeconds<=0||durationSeconds>1800||!Number.isFinite(timeoutMs)||timeoutMs<=0)throw Error('Invalid decode bounds');
 const path=resolve(filename);if(!(await stat(path)).isFile())throw Error('Input must be a regular file');
 return new Promise((yes,no)=>{
  const p=spawn(ffmpegPath,['-v','error','-nostdin','-i',path,'-map','0:a:0','-vn','-ac','1','-ar',String(SR),'-t',String(durationSeconds),'-f','f32le','pipe:1']);
  let chunks=[],bytes=0,err='',failure;const timer=setTimeout(()=>{failure=Error('Decode timeout');p.kill('SIGKILL');},timeoutMs);
  p.stdout.on('data',b=>{bytes+=b.length;if(bytes>SR*durationSeconds*4+65536){failure=Error('Decode exceeded bound');p.kill('SIGKILL');}else chunks.push(b);});
  p.stderr.on('data',b=>err=(err+b).slice(-4096));p.on('error',e=>{clearTimeout(timer);no(e);});
  p.on('close',code=>{clearTimeout(timer);if(failure||code!==0)return no(failure??Error(`FFmpeg exit ${code}: ${err}`));const b=Buffer.concat(chunks),x=new Float32Array(Math.floor(b.length/4));for(let i=0;i<x.length;i++)x[i]=b.readFloatLE(i*4);yes(x);});
 });
}
// Per-frequency adaptive whitening reduces dominance by sustained instruments.
// Positive spectral change is accumulated in six broad frequency regions.
export function onsetFeatures(samples){
 const frames=Math.max(0,1+Math.floor((samples.length-NFFT)/HOP)),bands=Array.from({length:6},()=>new Float64Array(frames));
 const edges=[0,150,350,700,1400,2800,5513],indices=Array.from({length:NFFT/2+1},(_,k)=>Math.max(0,edges.findIndex(e=>e>k*SR/NFFT)-1));
 const win=Float64Array.from({length:NFFT},(_,i)=>.5-.5*Math.cos(2*Math.PI*i/NFFT)),re=new Float64Array(NFFT),im=new Float64Array(NFFT),smooth=new Float64Array(NFFT/2+1),prev=new Float64Array(NFFT/2+1);
 for(let t=0;t<frames;t++){
  for(let j=0;j<NFFT;j++)re[j]=samples[t*HOP+j]*win[j];im.fill(0);fft(re,im);
  for(let k=3;k<=NFFT/2;k++){const mag=Math.hypot(re[k],im[k]);smooth[k]=Math.max(mag,smooth[k]*.995);const value=Math.log1p(10*mag/(smooth[k]+1e-8));bands[indices[k]][t]+=Math.max(0,value-prev[k]);prev[k]=value;}
 }
 return bands;
}
function acf(x){let n=1;while(n<x.length*2)n*=2;const re=new Float64Array(n),im=new Float64Array(n);re.set(x);fft(re,im);for(let i=0;i<n;i++){re[i]=re[i]*re[i]+im[i]*im[i];im[i]=0;}fft(re,im,true);const a=new Float64Array(601);for(let lag=0;lag<a.length;lag++)a[lag]=re[lag]/Math.max(1,x.length-lag);return a;}
function interp(a,x){const i=Math.floor(x),f=x-i;return i<0||i+1>=a.length?0:a[i]*(1-f)+a[i+1]*f;}
export function windowEvidence(bands){
 const frames=bands[0]?.length??0,w=Math.min(frames,Math.round(20*RATE)),step=Math.round(10*RATE),windows=[];
 if(w<8*RATE)return windows;
 for(let start=0;start+w<=frames;start+=step){
  const correlations=[];
  for(const band of bands){
   const x=band.slice(start,start+w),mean=x.reduce((a,b)=>a+b,0)/w;
   // Remove the onset noise floor; cap transients so a single click cannot dominate.
   for(let i=0;i<w;i++)x[i]=Math.min(x[i],mean*4)-mean;
   const a=acf(x);if(a[0]>1e-10){const z=a[0];for(let i=0;i<a.length;i++)a[i]/=z;correlations.push(a);}
  }
  if(!correlations.length)continue;
  const curve=[];
  for(let bpm=40;bpm<=240;bpm+=.5){const lag=60*RATE/bpm;let score=0;for(const a of correlations)score+=Math.max(0,interp(a,lag));curve.push(score/correlations.length);}
  windows.push({startSeconds:start/RATE,durationSeconds:w/RATE,curve});
 }
 return windows;
}
export function selectTempo(windows,{harmonicWeight=.5,prior=0,consensusPower=1}={}){
 if(!windows.length)return {status:'insufficient_evidence',bpm:null,candidates:[],windows:[]};
 const aggregate=new Float64Array(401),local=[];
 const at=(curve,bpm)=>interp(curve,(bpm-40)*2);
 for(const window of windows){const curve=window.curve,scores=curve.map((v,i)=>{const bpm=40+i*.5;return v+harmonicWeight*at(curve,bpm/2)+harmonicWeight*.5*at(curve,bpm/3);});const maximum=Math.max(...scores);if(maximum<.01)continue;let best=0;for(let i=0;i<scores.length;i++){const bpm=40+i*.5;const s=(scores[i]/maximum)**consensusPower*Math.exp(-prior*(Math.log2(bpm/110))**2);aggregate[i]+=s;if(scores[i]>scores[best])best=i;}local.push({startSeconds:window.startSeconds,bpm:40+best*.5,strength:maximum});}
 if(!local.length)return {status:'insufficient_evidence',bpm:null,candidates:[],windows:[]};
 const peaks=[];for(let i=1;i<400;i++)if(aggregate[i]>=aggregate[i-1]&&aggregate[i]>aggregate[i+1]){const d=aggregate[i-1]-2*aggregate[i]+aggregate[i+1],delta=d===0?0:.5*(aggregate[i-1]-aggregate[i+1])/d;peaks.push({bpm:40+(i+delta)*.5,score:aggregate[i]/local.length});}
 peaks.sort((a,b)=>b.score-a.score);const candidates=peaks.slice(0,12);return {status:candidates.length?'ok':'insufficient_evidence',bpm:candidates[0]?.bpm??null,candidates,windows:local,margin:candidates.length>1?candidates[0].score-candidates[1].score:null};
}
export function analyzeSamples(samples,options={}){
 if(!(samples instanceof Float32Array||samples instanceof Float64Array))throw Error('Expected floating mono PCM at 11025 Hz');
 for(const v of samples)if(!Number.isFinite(v))throw Error('Non-finite PCM');
 const evidence=windowEvidence(onsetFeatures(samples));return {algorithm:ALGORITHM,sampleRate:SR,actualDurationSeconds:samples.length/SR,...selectTempo(evidence,options),...(options.includeEvidence?{evidence}:{})};
}
export async function analyzeFile(filename,options={}){return analyzeSamples(await decodeFile(filename,options),options);}
