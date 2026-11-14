import {selectConsensus} from './consensus.js';
export function selectHybrid(windows,{spectralWeight=.5,...options}={}){
 const transformed=windows.map(w=>{const max=Math.max(...w.spectral,1e-12);return {...w,curve:w.curve.map((v,i)=>v**(1-spectralWeight)*(w.spectral[i]/max)**spectralWeight)};});
 return selectConsensus(transformed,options);
}
