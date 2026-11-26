// Experiment 009. Continuous-interval spectral pulse diagnostics, independent of bar phase.
// Reference styles, track identities, and human taps are NEVER read here.
// Pure JS; only raw mono PCM and an approximate BAR-rate BPM are inputs.
export const METERS_009 = [2,3,4];
export const ANALYSIS_RATE_009 = 11025;
export const FFT_SIZE_009 = 1024;
export const HOP_009 = 128;
const TWO_PI=2*Math.PI;
const BANDS=[['bass',45,210],['mid',210,900],['upper',900,4200],['wide',45,4200]];
const round=(x,n=3)=>Number.isFinite(x)?Number(x.toFixed(n)):null;
const median=a=>{if(!a.length)return null;const b=[...a].sort((x,y)=>x-y),n=b.length;return n%2?b[n>>1]:(b[n/2-1]+b[n/2])/2;};
const quantile=(a,p)=>{if(!a.length)return null;const b=[...a].sort((x,y)=>x-y),z=(b.length-1)*p,i=Math.floor(z);return b[i]+(b[Math.ceil(z)]-b[i])*(z-i);};
function fft(r,im){
 const n=r.length;for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[r[i],r[j]]=[r[j],r[i]];[im[i],im[j]]=[im[j],im[i]];}}
 for(let len=2;len<=n;len<<=1){const ang=-TWO_PI/len,ca=Math.cos(ang),sa=Math.sin(ang);
  for(let i=0;i<n;i+=len){let c=1,s=0;for(let k=0;k<len/2;k++){const u=i+k,v=u+len/2,tr=r[v]*c-im[v]*s,ti=r[v]*s+im[v]*c;r[v]=r[u]-tr;im[v]=im[u]-ti;r[u]+=tr;im[u]+=ti;const q=c*ca-s*sa;s=c*sa+s*ca;c=q;}}
 }
}
function smoothGaussian(v){const out=new Float32Array(v.length);const weights=[0.024,0.10,0.226,0.30,0.226,0.10,0.024];for(let i=0;i<v.length;i++){let s=0;for(let j=-3;j<=3;j++)s+=weights[j+3]*v[Math.max(0,Math.min(v.length-1,i+j))];out[i]=s;}return out;}
function localMedianSubtract(v,radius=22){const out=new Float32Array(v.length),tmp=[];for(let i=0;i<v.length;i++){tmp.length=0;for(let j=Math.max(0,i-radius);j<=Math.min(v.length-1,i+radius);j++)tmp.push(v[j]);tmp.sort((a,b)=>a-b);out[i]=Math.max(0,v[i]-tmp[tmp.length>>1]);}return out;}
export function extractMeterNovelty009(pcm,rate=ANALYSIS_RATE_009){
 if(!(pcm instanceof Float32Array)||rate!==ANALYSIS_RATE_009||pcm.length<rate*8)throw Error('Expected >=8s mono Float32Array PCM sampled at 11025 Hz');
 const n=FFT_SIZE_009,hop=HOP_009,win=new Float64Array(n),r=new Float64Array(n),im=new Float64Array(n),prev=new Float32Array(n/2+1);
 for(let k=0;k<n;k++)win[k]=0.5-0.5*Math.cos(TWO_PI*k/(n-1));
 const nFrames=1+Math.floor((pcm.length-n)/hop),novelty=Object.fromEntries(BANDS.map(([k])=>[k,new Float32Array(nFrames)]));
 const binRanges=BANDS.map(([,a,b])=>[Math.ceil(a*n/rate),Math.floor(b*n/rate)]);
 for(let i=0;i<nFrames;i++){
  const start=i*hop;for(let j=0;j<n;j++){r[j]=pcm[start+j]*win[j];im[j]=0;}fft(r,im);
  const sums=[0,0,0,0];for(let k=4;k<n/2;k++){
   const x=Math.log1p(Math.hypot(r[k],im[k])*300/n);const diff=Math.max(0,x-prev[k]);prev[k]=x;
   for(let b=0;b<4;b++)if(k>=binRanges[b][0]&&k<=binRanges[b][1])sums[b]+=diff;
  }
  BANDS.forEach(([key],b)=>{novelty[key][i]=i?sums[b]/Math.max(1,binRanges[b][1]-binRanges[b][0]+1):0;});
 }
 const bands={};for(const [key] of BANDS)bands[key]=localMedianSubtract(smoothGaussian(novelty[key]));
 return {fps:rate/hop,timeOriginSeconds:n/(2*rate),bands,durationSeconds:pcm.length/rate};
}
// Phase-invariant Fourier concentration near an integer number of pulses/bar.
// For each passage, frequencies are scanned around a prior. A shared frequency
// maximises evidence across the bands, avoiding independent cherry-picking.
export function measureMeterWindow009(feature,bpm,begin,end,options={}){
 const searchFraction=options.searchFraction??0.11;
 if(!(bpm>0)||!(end-begin>=7)||!feature?.bands||!(feature.fps>0))return null;
 const entries=Object.entries(feature.bands).filter(([key])=>['bass','mid','upper','wide'].includes(key));
 const a=Math.max(0,Math.ceil((begin-feature.timeOriginSeconds)*feature.fps));
 const z=Math.min(entries[0][1].length,Math.floor((end-feature.timeOriginSeconds)*feature.fps));
 const n=z-a;if(n<150)return null;
 const time=Float64Array.from({length:n},(_,i)=>i/feature.fps);
 const normalized={};
 for(const [key,vec] of entries){const raw=Array.from(vec.subarray(a,z));const baseline=median(raw)||0;const scale=Math.max(.000001,baseline);let yy=raw.map(x=>Math.log1p(x/scale));const mean=yy.reduce((s,v)=>s+v,0)/yy.length;
  yy=yy.map((v,i)=>(v-mean)*(.5-.5*Math.cos(TWO_PI*i/(n-1))));
  const norm=yy.reduce((s,v)=>s+Math.abs(v),0)+1e-12;normalized[key]={data:yy,norm};
 }
 const output={startSeconds:round(begin),endSeconds:round(end),meters:{}};
 for(const m of METERS_009){const prior=m*bpm/60;let best=null;
  for(let factor=1-searchFraction;factor<=1+searchFraction+0.00001;factor+=0.005){
   const f=prior*factor;if(f>=feature.fps*.48)continue;
   let total=0;const energies={};
   // Adjacent channels are correlated, so the weights are an engineering choice,
   // NOT independent votes. 'wide' is included for diagnostics only.
   for(const key of ['bass','mid','upper']){const x=normalized[key];if(!x)continue;
    let re=0,im=0;const dr=TWO_PI*f/feature.fps;let cr=1,ci=0;const c=Math.cos(dr),s=Math.sin(dr);
    for(let i=0;i<n;i++){re+=x.data[i]*cr;im+=x.data[i]*ci;const cr1=cr*c-ci*s;ci=cr*s+ci*c;cr=cr1;}
    energies[key]=Math.hypot(re,im)/x.norm;
   }
   total=0.3*(energies.bass??0)+0.5*(energies.mid??0)+0.2*(energies.upper??0);
   if(!best||total>best.score)best={score:total,pulseHz:f,bandCoherences:energies};
  }
  if(best)output.meters[String(m)]={score:round(best.score),pulseHz:round(best.pulseHz),barBpmImplied:round(best.pulseHz*60/m),bands:Object.fromEntries(Object.entries(best.bandCoherences).map(([k,v])=>[k,round(v)]))};
 }
 return Object.keys(output.meters).length===3?output:null;
}
export function analyzeMeterPeriodicity009(feature,bpm,{windowSeconds=12,offsetSeconds=0,stableMinimumWindows=3,consensusRatio=1.3}={}){
 if(!Number.isFinite(bpm)||bpm<20||bpm>230)throw Error('Invalid bar-rate BPM');
 if(!Number.isFinite(windowSeconds)||windowSeconds<8||windowSeconds>30)throw Error('Window must be 8–30 seconds');
 const windows=[];for(let start=0;start+windowSeconds<=feature.durationSeconds+1e-6;start+=windowSeconds){const x=measureMeterWindow009(feature,bpm,start,start+windowSeconds);if(x){x.startSeconds=round(x.startSeconds+offsetSeconds);x.endSeconds=round(x.endSeconds+offsetSeconds);windows.push(x);}}
 const scores=Object.fromEntries(METERS_009.map(m=>[m,windows.map(w=>w.meters[m]?.score).filter(Number.isFinite)]));
 const wins=Object.fromEntries(METERS_009.map(m=>[m,windows.filter(w=>w.meters[m].score===Math.max(...METERS_009.map(k=>w.meters[k].score))).length]));
 const med=Object.fromEntries(METERS_009.map(m=>[m,round(median(scores[m]))]));
 const medHz=Object.fromEntries(METERS_009.map(m=>[m,round(median(windows.map(w=>w.meters[m].pulseHz)))]));
 // Three against the BEST of the two duple subdivisions, including worst-window
 // protection: an isolated 3-pulse phrase must not classify a whole recording.
 const ratios=windows.map(w=>w.meters[3].score/Math.max(0.01,w.meters[2].score,w.meters[4].score));
 const supporting=ratios.filter(x=>x>=consensusRatio).length;
 const medRatio=median(ratios);
 const stableTriple=windows.length>=stableMinimumWindows&&supporting>=Math.ceil(windows.length*.75)&&medRatio>=consensusRatio;
 const stableDuple=windows.length>=stableMinimumWindows&&ratios.filter(x=>x<=1/consensusRatio).length>=Math.ceil(windows.length*.75);
 const enoughSignal=Math.max(...Object.values(med).map(x=>x??0))>=0.08;
 const decision=!enoughSignal?'undecided':stableTriple?'three-subdivision':stableDuple?'duple-family':'undecided';
 return {decision,barRatePriorBpm:bpm,windowSeconds,windowCount:windows.length,
  summary:{medianCoherenceBySubdivision:med,medianPulseHzBySubdivision:medHz,winningWindows:wins,
   tripleVsBestDupleMedianRatio:round(medRatio),tripleSupportingWindows:supporting,
   tripleVsBestDupleWindowRatios:ratios.map(x=>round(x))},windows,
  caveat:'Three-subdivision is a vals clue, not a demonstrated 3/4 score; two and four remain metrically ambiguous; decisions require multiple consistent windows.'};
}
