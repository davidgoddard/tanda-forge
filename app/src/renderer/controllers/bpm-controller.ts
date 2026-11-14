import { roundBpm } from "../../shared/bpm.js";
import type { AppApi } from "../../shared/types.js";
import type { BpmConfig, BpmStatus, BpmTrack, BpmPreference } from "../../shared/bpm.js";

export const createBpmController = (options: {
  api:AppApi;
  t:(key:string,params?:Record<string,string|number>)=>string;
  confirm:(message:string)=>Promise<boolean>;
  permitted:()=>boolean;
  refresh:()=>Promise<void>;
  error:(message:string)=>void;
}) => {
  const {api,t}=options;
  const enabled=document.querySelector<HTMLInputElement>("#bpm-enabled")!;
  const preference=document.querySelector<HTMLSelectElement>("#bpm-preference")!;
  const pause=document.querySelector<HTMLButtonElement>("#bpm-pause")!;
  const retry=document.querySelector<HTMLButtonElement>("#bpm-retry")!;
  const statusElement=document.querySelector<HTMLElement>("#bpm-status")!;
  const derived=document.querySelector<HTMLInputElement>("#track-editor-derived-bpm")!;
  const section=document.querySelector<HTMLElement>("#track-editor-derived-section")!;
  const details=document.querySelector<HTMLElement>("#track-editor-bpm-details")!;
  let status:BpmStatus;
  let track:BpmTrack|null=null;
  let baseline="";
  let editorEnabled=false;
  let polling=false;
  let configuring=false;
  let lastPermit:boolean|undefined;
  const permissionChanged=()=>{
    const allowed=options.permitted();
    if(allowed!==lastPermit){lastPermit=allowed;void api.permitBpm(allowed).catch(report);}
  };
  const report=(error:unknown)=>options.error(t("bpmFailed",{message:error instanceof Error?error.message:String(error)}));
  const render=()=>{
    enabled.checked=status.enabled;
    preference.value=status.preference;
    pause.disabled=!status.enabled;
    retry.disabled=!status.enabled;
    pause.textContent=t(status.paused?"bpmResume":"bpmPause");
    const state=!status.enabled?"bpmDisabled":status.paused?"bpmPaused":status.suspended?"bpmSuspended":status.running?"bpmRunning":"bpmReady";
    statusElement.textContent=t(state)+" · "+t("bpmProgress",{completed:status.completed,total:status.total,failed:status.failed});
  };
  const choosePreference=()=>new Promise<BpmPreference|null>(resolve=>{
    const dialog=document.createElement("dialog");dialog.className="confirm-dialog";
    dialog.setAttribute("aria-labelledby","bpm-first-enable-title");
    const heading=document.createElement("h3");heading.id="bpm-first-enable-title";heading.textContent=t("bpmPreference");
    const select=document.createElement("select");select.style.maxWidth="100%";select.setAttribute("aria-label",t("bpmPreference"));
    for(const value of ["prefer-user","derived-only"] as const) {
      const option=document.createElement("option");option.value=value;option.textContent=t(value==="prefer-user"?"bpmPreferUser":"bpmDerivedOnly");select.append(option);
    }
    select.value=preference.value;
    const preferenceField=document.createElement("div");
    preferenceField.className="settings-field";
    preferenceField.style.maxWidth="none";
    preferenceField.style.margin="0";
    preferenceField.append(select);
    const help=document.createElement("p");help.textContent=t("bpmFirstEnableHelp");
    const confirm=document.createElement("button");confirm.textContent=t("bpmEnable");
    const cancel=document.createElement("button");cancel.textContent=t("bpmCancel");
    const finish=(value:BpmPreference|null)=>{dialog.close();dialog.remove();resolve(value);};
    confirm.onclick=()=>finish(select.value as BpmPreference);cancel.onclick=()=>finish(null);
    dialog.addEventListener("cancel",event=>{event.preventDefault();finish(null);});
    dialog.append(heading,preferenceField,help,confirm,cancel);document.body.append(dialog);dialog.showModal();select.focus();
  });
  const configure=async(config:BpmConfig)=>{
    status=await api.configureBpm(config);render();await options.refresh();
  };
  const action=(fn:()=>Promise<void>)=>async()=>{
    if(configuring)return;configuring=true;
    try{await fn();}catch(error){report(error);}finally{configuring=false;if(status)render();}
  };
  enabled.addEventListener("change",action(async()=>{
    const next=enabled.checked;
    let choice=status.preference;
    if(next&&!status.configured) {
      const selected=await choosePreference();if(!selected)return;choice=selected;
    }
    await configure({...status,enabled:next,preference:choice});
  }));
  preference.addEventListener("change",action(async()=>{
    if(!status.configured){status={...status,preference:preference.value as BpmPreference};return;}
    await configure({...status,preference:preference.value as BpmPreference});
  }));
  pause.addEventListener("click",action(async()=>{await configure({...status,paused:!status.paused});}));
  retry.addEventListener("click",action(async()=>{status=await api.retryBpm();}));
  const poll=async()=>{
    if(polling||configuring)return;polling=true;
    try {
      await api.permitBpm(options.permitted());
      const next=await api.getBpmStatus();
      const changed=status&&next.revision!==status.revision;
      status=next;render();if(changed)await options.refresh();
    } catch(error){report(error);} finally{polling=false;}
  };
  derived.addEventListener("change", () => {
    const value=Number(derived.value);
    if(derived.value.trim()!=="" && Number.isFinite(value) && value>=1 && value<=1000) {
      derived.value=String(roundBpm(value));
    }
  });
  return {
    permissionChanged,
    async start(){await poll();window.setInterval(()=>{void poll();},2000);},
    async load(id:string){
      [track,status]=await Promise.all([api.getTrackBpm(id),api.getBpmStatus()]);
      editorEnabled=status.enabled;
    },
    fill(){
      section.hidden=!editorEnabled;
      derived.value=String(roundBpm(track?.bpm_override??track?.derived_bpm)??"");
      baseline=derived.value;
      details.textContent=t("bpmDetails",{original:roundBpm(track?.derived_bpm)??"—",effective:roundBpm(track?.bpm)??"—"})+(track?.bpm_override!=null?" · "+t("bpmCorrected"):"");
      if(track?.bpm_error) details.textContent+=" · "+t("bpmFailed",{message:track.bpm_error});
      return track?.user_bpm??null;
    },
    tap(bpm:number){if(!editorEnabled)return false;derived.value=String(roundBpm(bpm)??"");return true;},
    dirty(){return editorEnabled&&derived.value!==baseline;},
    async correction():Promise<{cancelled:boolean;derivedBpm?:number|null}>{
      if(!editorEnabled||derived.value===baseline)return {cancelled:false};
      const raw=derived.value.trim()===""?null:Number(derived.value);
      const value=raw===null?null:Math.round(raw);
      if(value!==null&&(!Number.isFinite(raw)||(raw ?? 0)<1||(raw ?? 0)>1000)){report(Error(t("bpmInvalid")));return {cancelled:true};}
      if(!await options.confirm(t(value===null?"bpmClearConfirm":"bpmCorrectionConfirm",{value:value??""})))return {cancelled:true};
      return {cancelled:false,derivedBpm:value};
    },
  };
};
