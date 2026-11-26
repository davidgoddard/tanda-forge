import { analysisValueSource, resolveAnalysisValue, roundBpm } from "../../shared/bpm.js";
import type { AppApi } from "../../shared/types.js";
import type { BpmStatus, BpmTrack, BpmPreference } from "../../shared/bpm.js";
import { normalizeStyleValue } from "../../shared/style-analysis.js";
import type { StyleTrack } from "../../shared/style-analysis.js";

export const createBpmController = (options: {
  api:AppApi;
  t:(key:string,params?:Record<string,string|number>)=>string;
  confirm:(message:string)=>Promise<boolean>;
  permitted:()=>boolean;
  refresh:()=>Promise<void>;
  error:(message:string)=>void;
  styleBaselineChanged?:(style:string)=>void;
}) => {
  const {api,t}=options;
  let track:BpmTrack|null=null;
  let trackId:string|null=null;
  let styleTrack:StyleTrack|null=null;
  let baselineBpm="";
  let baselineStyle="";
  let polling=false;
  let configuring=false;
  let lastPermit:boolean|undefined;
  const input=document.querySelector<HTMLInputElement>("#track-editor-bpm")!;
  const styleInput=document.querySelector<HTMLSelectElement>("#track-editor-genre")!;
  const report=(error:unknown)=>options.error(t("analysisFailed",{message:error instanceof Error?error.message:String(error)}));
  const panels=(["bpm","style"] as const).map(kind=>{
    const enabled=document.querySelector<HTMLInputElement>(`#${kind}-enabled`)!;
    const preference=document.querySelector<HTMLSelectElement>(`#${kind}-preference`)!;
    const pause=document.querySelector<HTMLButtonElement>(`#${kind}-pause`)!;
    const retry=document.querySelector<HTMLButtonElement>(`#${kind}-retry`)!;
    const analyse=document.querySelector<HTMLButtonElement>(`#${kind}-analyse`)!;
    const label=document.querySelector<HTMLElement>(`#${kind}-status`)!;
    const get=()=>kind==="bpm"?api.getBpmStatus():api.getStyleStatus();
    let status:BpmStatus;
    const render=()=>{
      if(!status)return;
      enabled.checked=status.enabled;preference.value=status.preference;
      pause.disabled=retry.disabled=analyse.disabled=!status.enabled;
      pause.textContent=t(status.paused?"bpmResume":"bpmPause");
      const state=!status.enabled?"analysisDisabled":status.paused?"bpmPaused":status.suspended?"bpmSuspended":status.running?"bpmRunning":"bpmReady";
      label.textContent=t(state)+" · "+t("bpmProgress",{completed:status.completed,total:status.total,failed:status.failed});
    };
    const action=(fn:()=>Promise<BpmStatus>)=>async()=>{
      if(configuring)return;configuring=true;
      try { status=await fn();render();await options.refresh();await refreshTrackDetails();renderDetails(); }
      catch(error){report(error);} finally{configuring=false;render();}
    };
    const configure=(next:BpmStatus)=>kind==="bpm"?api.configureBpm(next):api.configureStyle(next);
    enabled.addEventListener("change",action(()=>configure({...status,enabled:enabled.checked})));
    preference.addEventListener("change",action(()=>configure({...status,preference:preference.value as BpmPreference})));
    pause.addEventListener("click",action(()=>configure({...status,paused:!status.paused})));
    retry.addEventListener("click",action(()=>kind==="bpm"?api.retryBpm():api.retryStyle()));
    analyse.addEventListener("click",action(async()=>{
      // Analyse is also an explicit request to resume a paused queue.
      if(status.paused) await configure({...status,paused:false});
      return kind==="bpm"?api.analyseBpm():api.analyseStyle();
    }));
    return {get,status:()=>status,set:(next:BpmStatus)=>{status=next;render();}};
  });
  const showDetails=<T>(kind:string,config:BpmStatus|undefined,imported:T|null,derived:T|null,user:T|null,error:string|null,manualActive:boolean)=>{
    if(!config)return;
    const source=analysisValueSource(config,imported,derived,user,manualActive);
    const value=resolveAnalysisValue(config,imported,derived,user,manualActive);
    document.querySelector<HTMLElement>(`#track-editor-${kind}-details`)!.textContent=t("analysisValues",{
      entered: user != null ? t("analysisUserValue",{user:String(user)})+" · "
        : imported != null ? t("analysisImportedValue",{imported:String(imported)})+" · " : "",
      derived:String(derived??"—"),
      effective:String(value??"—"),source:t(`analysisSource_${source}`),
    })+(error?" · "+t("analysisFailed",{message:error}):"");
  };
  const fillStyle=()=>{
    const value=normalizeStyleValue(styleTrack?.genre)??"";
    if(value && !Array.from(styleInput.options).some(option=>option.value===value)) {
      const option=document.createElement("option");
      option.value=option.textContent=value;
      styleInput.appendChild(option);
    }
    styleInput.value=baselineStyle=value;
  };
  const refreshTrackDetails=async()=>{
    const id=trackId;
    if(!id)return;
    const [b,s]=await Promise.all([api.getTrackBpm(id),api.getTrackStyle(id)]);
    if(trackId!==id)return;
    const untouchedStyle=styleInput.value===baselineStyle;
    track=b;styleTrack=s;
    if(untouchedStyle){fillStyle();options.styleBaselineChanged?.(baselineStyle);}
    renderDetails();
  };
  const renderDetails=()=>{
    const user=input.value !== baselineBpm && input.value.trim()?roundBpm(Number(input.value)):track?.bpm_override??null;
    showDetails("bpm",panels[0].status(),roundBpm(track?.user_bpm),roundBpm(track?.derived_bpm),user,track?.bpm_error??null,input.value !== baselineBpm || track?.bpm_override_active===1);
    showDetails("style",panels[1].status(),normalizeStyleValue(styleTrack?.imported_style),normalizeStyleValue(styleTrack?.derived_style),
      normalizeStyleValue(styleInput.value !== baselineStyle ? styleInput.value : null)||normalizeStyleValue(styleTrack?.user_style),styleTrack?.style_error??null,styleInput.value !== baselineStyle || styleTrack?.user_style_active===1);
  };
  input.addEventListener("input",renderDetails);
  styleInput.addEventListener("change",renderDetails);
  input.addEventListener("change",()=>{if(input.value.trim())input.value=String(roundBpm(Number(input.value))??"");renderDetails();});
  const permissionChanged=()=>{
    const allowed=options.permitted();
    if(allowed!==lastPermit){lastPermit=allowed;void api.permitBpm(allowed).catch(report);}
  };
  const poll=async()=>{
    if(polling||configuring)return;polling=true;
    try {
      await api.permitBpm(options.permitted());
      const next=await Promise.all(panels.map(panel=>panel.get()));
      const changed=next.some((value,i)=>panels[i].status()&&value.revision!==panels[i].status().revision);
      next.forEach((value,i)=>panels[i].set(value));
      if(changed) {
        await options.refresh();
        await refreshTrackDetails();
      }
    } catch(error){report(error);} finally{polling=false;}
  };
  return {
    permissionChanged,
    async start(){await poll();window.setInterval(()=>{void poll();},2000);},
    async load(id:string){
      trackId=id;
      const [b,s,bs,ss]=await Promise.all([api.getTrackBpm(id),api.getTrackStyle(id),api.getBpmStatus(),api.getStyleStatus()]);
      track=b;styleTrack=s;panels[0].set(bs);panels[1].set(ss);
    },
    fill(){
      input.value=baselineBpm=String(roundBpm(track?.bpm)??"");
      fillStyle();
      renderDetails();return track?.bpm??null;
    },
    tap(bpm:number){input.value=String(roundBpm(bpm)??"");renderDetails();return true;},
    editedValues(){
      return {
        ...(input.value !== baselineBpm ? {bpm:roundBpm(Number(input.value))} : {}),
        ...(styleInput.value !== baselineStyle ? {genre:styleInput.value} : {}),
      };
    },
    dirty(){return false;},
    async correction():Promise<{cancelled:boolean;derivedBpm?:number|null}>{
      const raw=input.value.trim();
      if(raw&&(!Number.isFinite(Number(raw))||Number(raw)<1||Number(raw)>1000)){
        report(Error(t("bpmInvalid")));return {cancelled:true};
      }
      return {cancelled:false};
    },
  };
};
