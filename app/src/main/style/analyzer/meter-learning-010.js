/** Experiment 010. Acoustic-only excerpt features and purely learned classifiers.
 * Does not access metadata, labels, or filenames. Requires the unchanged
 * extractMeterNovelty009() function's output and an approximate bar BPM.
 */
const PI=Math.PI;
export const FEATURE_NAMES_010 = [
  'coh2bass','coh3bass','coh4bass','coh2mid','coh3mid','coh4mid',
  'coh2upper','coh3upper','coh4upper','ratio3to2','ratio3to4',
  'bassMidPhase2','bassMidPhase3','bassMidPhase4',
  'bassPulseDominance2','bassPulseDominance3',
  'midOffbeat2','midOffbeat3',
  'bassMidContrast2','bassMidContrast3',
  'bassActivity','midActivity','upperActivity',
  'barBpmNormalized'
];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function sampleBand(vec,from,to){
 const n=Math.max(0,to-from),out=new Float64Array(n);
 let mean=0;for(let i=0;i<n;i++){const v=Math.log1p(Math.max(0,vec[from+i])*200);out[i]=v;mean+=v;}
 mean/=Math.max(1,n);let variance=0;
 for(let i=0;i<n;i++){out[i]-=mean;variance+=out[i]**2;}
 const std=Math.sqrt(variance/Math.max(1,n))||1;
 for(let i=0;i<n;i++)out[i]=out[i]/std*(.5-.5*Math.cos(2*PI*i/Math.max(1,n-1)));
 return {values:out,activity:Math.sqrt(variance/Math.max(1,n))};
}
function fourier(values,fps,f){
 let re=0,im=0,norm=0;
 for(let i=0;i<values.length;i++){
  const x=values[i],a=2*PI*f*i/fps;
  re+=x*Math.cos(a);im+=x*Math.sin(a);norm+=Math.abs(x);
 }
 return {re,im,score:Math.hypot(re,im)/(norm+1e-9)};
}
function peakPeriod(values,fps,f){
 let best=null;
 for(const factor of [.88,.92,.96,1,1.04,1.08,1.12]){
  const v=fourier(values,fps,f*factor);
  if(!best||v.score>best.score)best=v;
 }
 return best;
}
function phaseAgreement(a,b){return (a.re*b.re+a.im*b.im)/(Math.hypot(a.re,a.im)*Math.hypot(b.re,b.im)+1e-9);}
function foldedBeatProfile(band,fps,bpm,m){
 // Fold onto a candidate M-beat bar, with four bins per beat. Circularly
 // rotate the profile so the bass maximum serves as an anchor; never use
 // a reference downbeat or manually annotated beats.
 const bins=m*4,profile=new Float64Array(bins),count=new Uint32Array(bins);
 const secondsPerBar=60/bpm;
 for(let i=0;i<band.length;i++){
  const phase=(i/fps/secondsPerBar)%1;
  const k=Math.floor(phase*bins)%bins;
  profile[k]+=Math.max(0,band[i]);count[k]++;
 }
 for(let i=0;i<bins;i++)profile[i]/=Math.max(1,count[i]);
 return profile;
}
function patternedFeatures(bass,mid,fps,bpm,m){
 const b=foldedBeatProfile(bass,fps,bpm,m),c=foldedBeatProfile(mid,fps,bpm,m);
 const beats=Array.from({length:m},(_,i)=>[0,1,2,3].reduce((s,k)=>s+b[i*4+k],0)/4);
 const chords=Array.from({length:m},(_,i)=>[0,1,2,3].reduce((s,k)=>s+c[i*4+k],0)/4);
 let anchor=0;for(let i=1;i<m;i++)if(beats[i]>beats[anchor])anchor=i;
 const bs=beats.map((_,i)=>beats[(i+anchor)%m]);
 const cs=chords.map((_,i)=>chords[(i+anchor)%m]);
 const off=cs.slice(1).reduce((s,x)=>s+x,0)/Math.max(1,m-1);
 const bassOthers=bs.slice(1).reduce((s,x)=>s+x,0)/Math.max(1,m-1);
 const dominance=(bs[0]-bassOthers)/(Math.abs(bs[0])+Math.abs(bassOthers)+1e-5);
 const offbeat=(off-cs[0])/(Math.abs(off)+Math.abs(cs[0])+1e-5);
 let contrast=0;for(let i=0;i<m;i++)contrast+=bs[i]*cs[i];
 return [clamp(dominance,-3,3),clamp(offbeat,-3,3),clamp(-contrast/m,-3,3)];
}
/** Extract features from just the requested seconds. Does not assume an audible onset per beat. */
export function featuresForPassage010(feature,bpm,start,duration){
 if(!(bpm>=20&&bpm<=230)||!(duration>=3.5))throw Error('Invalid BPM or passage length');
 const a=Math.max(0,Math.ceil((start-feature.timeOriginSeconds)*feature.fps));
 const z=Math.min(feature.bands.bass.length,Math.floor((start+duration-feature.timeOriginSeconds)*feature.fps));
 if(z-a<200)throw Error('Too little audio for excerpt features');
 const bands=['bass','mid','upper'].map(k=>sampleBand(feature.bands[k],a,z));
 const [b,m,u]=bands.map(x=>x.values),hz=bpm/60;
 const Fourier=[b,m,u].map(v=>[2,3,4].map(n=>peakPeriod(v,feature.fps,n*hz)));
 const scores=Fourier.map(a=>a.map(x=>x.score));
 const p2=patternedFeatures(b,m,feature.fps,bpm,2);
 const p3=patternedFeatures(b,m,feature.fps,bpm,3);
 const v=[...scores.flat(),
  Math.log((scores[0][1]+scores[1][1]+scores[2][1]+.02)/(scores[0][0]+scores[1][0]+scores[2][0]+.02)),
  Math.log((scores[0][1]+scores[1][1]+scores[2][1]+.02)/(scores[0][2]+scores[1][2]+scores[2][2]+.02)),
  ...[0,1,2].map(i=>phaseAgreement(Fourier[0][i],Fourier[1][i])),
  p2[0],p3[0],p2[1],p3[1],p2[2],p3[2],
  ...bands.map(x=>Math.log1p(x.activity)),
  Math.log(bpm/65)
 ];
 if(v.length!==FEATURE_NAMES_010.length||v.some(x=>!Number.isFinite(x)))throw Error('Non-finite feature');
 return v.map(x=>Number(x.toFixed(6)));
}
export function excerptStarts010(availableSeconds,length,count=12){
 if(!(availableSeconds>=length))return [];
 const n=Math.max(1,Math.min(count,Math.floor(availableSeconds/length)));
 if(n===1)return [Math.max(0,(availableSeconds-length)/2)];
 const usable=availableSeconds-length;
 return Array.from({length:n},(_,i)=>Number((i*usable/(n-1)).toFixed(3)));
}

// Deterministic, training-only normalisation and weighted logistic regression.
const sigmoid=x=>1/(1+Math.exp(-clamp(x,-35,35)));
export function trainLogistic010(tracks,{iterations=360,lambda=.025}={}){
 const train=tracks.filter(t=>[0,1].includes(t.y)&&t.passages?.length);
 if(!train.some(t=>t.y===1)||!train.some(t=>t.y===0))throw Error('Training split needs both classes');
 const dim=train[0].passages[0].features.length;
 const rows=train.flatMap(t=>t.passages.map(p=>({x:p.features,y:t.y,group:t})));
 const means=Array(dim).fill(0),sd=Array(dim).fill(0);
 for(const r of rows)for(let j=0;j<dim;j++)means[j]+=r.x[j]/rows.length;
 for(const r of rows)for(let j=0;j<dim;j++)sd[j]+=(r.x[j]-means[j])**2/rows.length;
 for(let j=0;j<dim;j++)sd[j]=Math.max(.0001,Math.sqrt(sd[j]));
 const count=[train.filter(t=>t.y===0).length,train.filter(t=>t.y===1).length];
 const weights=rows.map(r=>1/(2*count[r.y]*r.group.passages.length));
 const xs=rows.map(r=>r.x.map((v,j)=>clamp((v-means[j])/sd[j],-6,6)));
 const coeff=Array(dim+1).fill(0);
 for(let it=0;it<iterations;it++){
  const grad=Array(dim+1).fill(0);
  for(let i=0;i<rows.length;i++){
   const x=xs[i],err=(sigmoid(coeff[0]+x.reduce((s,v,j)=>s+v*coeff[j+1],0))-rows[i].y)*weights[i];
   grad[0]+=err;for(let j=0;j<dim;j++)grad[j+1]+=err*x[j];
  }
  const lr=1.5/Math.sqrt(1+it/70);
  coeff[0]-=lr*grad[0];
  for(let j=0;j<dim;j++)coeff[j+1]-=lr*(grad[j+1]+lambda*coeff[j+1]);
 }
 return {type:'logistic',means,sd,coeff,trainingTracks:train.length};
}
export function predictLogistic010(model,x){
 const v=model.coeff[0]+x.reduce((s,x,j)=>s+model.coeff[j+1]*clamp((x-model.means[j])/model.sd[j],-6,6),0);
 return sigmoid(v);
}
// Exemplar baseline: each training track contributes one average feature vector.
// Classification uses a distance-weighted mixture of nearest neighbours, not labels
// for test tracks. It is intentionally simpler than a neural network.
export function trainExemplar010(tracks){
 const data=tracks.filter(t=>[0,1].includes(t.y)&&t.passages?.length);
 if(!data.some(t=>t.y===0)||!data.some(t=>t.y===1))throw Error('Training split needs both classes');
 const dim=data[0].passages[0].features.length;
 const means=Array(dim).fill(0),sd=Array(dim).fill(0);
 const centers=data.map(t=>({y:t.y,id:t.filename,x:Array.from({length:dim},(_,j)=>t.passages.reduce((s,p)=>s+p.features[j],0)/t.passages.length)}));
 for(const t of centers)for(let j=0;j<dim;j++)means[j]+=t.x[j]/centers.length;
 for(const t of centers)for(let j=0;j<dim;j++)sd[j]+=(t.x[j]-means[j])**2/centers.length;
 for(let j=0;j<dim;j++)sd[j]=Math.max(.0001,Math.sqrt(sd[j]));
 return {type:'exemplar',centers:centers.map(c=>({...c,x:c.x.map((v,j)=>clamp((v-means[j])/sd[j],-6,6))})),means,sd};
}
export function predictExemplar010(model,x,k=11){
 const v=x.map((a,j)=>clamp((a-model.means[j])/model.sd[j],-6,6));
 const nearest=model.centers.map(c=>({y:c.y,d:c.x.reduce((s,a,j)=>s+(a-v[j])**2,0)})).sort((a,b)=>a.d-b.d).slice(0,k);
 let num=0,den=0;for(const p of nearest){const w=1/(1+p.d);num+=w*p.y;den+=w;}
 return den?num/den:.5;
}
export function votePassages010(probabilities,{positive=.65,negative=.35,minVotes=2,minMargin=.2}={}){
 let positiveVotes=0,negativeVotes=0;
 const votes=probabilities.map(p=>p>=positive?'vals':p<=negative?'non-vals':'uncertain');
 for(const vote of votes){if(vote==='vals')positiveVotes++;if(vote==='non-vals')negativeVotes++;}
 const valid=positiveVotes+negativeVotes;
 const margin=valid?Math.abs(positiveVotes-negativeVotes)/valid:0;
 const prediction=valid<minVotes||margin<minMargin||positiveVotes===negativeVotes?'undecided':positiveVotes>negativeVotes?'vals':'non-vals';
 return {prediction,positiveVotes,negativeVotes,uncertainVotes:probabilities.length-valid,decisiveVotes:valid,margin:Number(margin.toFixed(4)),votes};
}
