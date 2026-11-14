// Octave-family consensus: reinforce recurring periods at half/double rate,
// while retaining the unpooled candidates for inspection.
export function selectConsensus(windows,{slow=.5,fast=.5,prior=.1,power=2,third=0}={}){
 const at=(a,b)=>{const x=(b-40)*2,i=Math.floor(x),f=x-i;return i<0||i+1>=a.length?0:a[i]*(1-f)+a[i+1]*f;};
 const summed=new Float64Array(401);let count=0;
 for(const {curve:a} of windows){const s=a.map((v,i)=>{const bpm=40+i*.5;return Math.max(0,v+slow*at(a,bpm/2)+fast*at(a,bpm*2)+third*at(a,bpm/3));});const max=Math.max(...s);if(max<.01)continue;count++;for(let i=0;i<s.length;i++)summed[i]+=(s[i]/max)**power;}
 const peaks=[];for(let i=0;i<summed.length;i++)summed[i]*=Math.exp(-prior*Math.log2((40+i*.5)/100)**2);
 for(let i=1;i<400;i++)if(summed[i]>=summed[i-1]&&summed[i]>summed[i+1]){const d=summed[i-1]-2*summed[i]+summed[i+1],delta=d?.5*(summed[i-1]-summed[i+1])/d:0;peaks.push({bpm:40+(i+delta)*.5,score:summed[i]/count});}peaks.sort((a,b)=>b.score-a.score);
 return {status:peaks.length?'ok':'insufficient_evidence',bpm:peaks[0]?.bpm??null,candidates:peaks.slice(0,12),margin:peaks.length>1?peaks[0].score-peaks[1].score:null};
}
