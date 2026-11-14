import {test,expect} from "@playwright/test";
import {launchSeededApp,relaunchSeededApp} from "./support/electron-app";
import fs from "fs";
import path from "path";

const pulseWav = () => {
  const rate=11025, frames=rate*25;
  const buffer=Buffer.alloc(44+frames*2);
  buffer.write("RIFF",0);buffer.writeUInt32LE(buffer.length-8,4);buffer.write("WAVEfmt ",8);
  buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);
  buffer.writeUInt32LE(rate,24);buffer.writeUInt32LE(rate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);
  buffer.write("data",36);buffer.writeUInt32LE(frames*2,40);
  for(let t=.3;t<25;t+=.5) for(let j=0;j<250;j++) {
    const frame=Math.round(t*rate)+j;
    if(frame<frames)buffer.writeInt16LE(Math.round(24000*Math.sin(j*.7)*Math.exp(-j/40)),44+frame*2);
  }
  return buffer;
};

test("BPM setup, confirmed tap correction, disable and restart preserve entered BPM",async({},testInfo)=>{
  let launched=await launchSeededApp("full");
  try {
    let {page}=launched;
    await expect.poll(()=>page.evaluate(()=>window.tanda!.getBpmStatus().then(s=>s.enabled))).toBe(false);
    await page.locator("#open-settings").click();
    await page.locator('button[data-tab="system"]').click();
    await page.locator("#bpm-enabled").check();
    const choice=page.locator("dialog[open]");
    await expect(choice).toBeVisible();
    await choice.locator("select").selectOption("derived-only");
    await choice.getByRole("button",{name:"Enable automatic BPM analysis",exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>window.tanda!.getBpmStatus().then(s=>s.preference))).toBe("derived-only");
    // Pause so the intentionally empty seed audio doesn't race this editor test.
    await page.locator("#bpm-pause").click();
    await page.locator("#close-settings").click();
    await page.locator("#search-input").fill("Alberto Gomez Tango Uno");
    await page.locator("#search-button").click();
    const row=page.locator('#search-tracks [data-track-id="t1"]').first();
    await expect(row).toBeVisible();
    const menu=row.locator('button[data-action="row-menu"]');
    if(await menu.count())await menu.click();
    await page.locator('button[data-action="edit-track"]:visible').first().click();
    await expect(page.locator("#track-editor")).toHaveAttribute("aria-hidden","false");
    await expect(page.locator("#track-editor-bpm")).toHaveValue("66");
    // Exercise the existing tap button; then use a deterministic corrected figure.
    await page.locator("#track-editor-tap").click();
    await page.waitForTimeout(500);
    await page.locator("#track-editor-tap").click();
    await expect(page.locator("#track-editor-derived-bpm")).not.toHaveValue("");
    await expect(page.locator("#track-editor-bpm")).toHaveValue("66");
    await page.locator("#track-editor-derived-bpm").fill("72.7");
    await page.locator("#track-editor-derived-bpm").blur();
    await expect(page.locator("#track-editor-derived-bpm")).toHaveValue("73");
    await page.screenshot({path:testInfo.outputPath("bpm-editor.png")});
    await page.locator("#track-editor-save").click();
    await expect(page.locator(".confirm-modal").filter({hasText:"Use 73 BPM"})).toBeVisible();
    await page.locator(".confirm-modal").getByRole("button",{name:"Cancel",exact:true}).click();
    expect(await page.evaluate(()=>window.tanda!.getTrackBpm("t1"))).toMatchObject({user_bpm:66,bpm_override:null});
    await page.locator("#track-editor-save").click();
    await page.locator(".confirm-modal").getByRole("button",{name:"OK",exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>window.tanda!.getTrackBpm("t1"))).toMatchObject({user_bpm:66,bpm_override:73,bpm:73});
    await page.evaluate(async()=>{
      const config=await window.tanda!.getBpmStatus();await window.tanda!.configureBpm({...config,enabled:false});
    });
    expect(await page.evaluate(()=>window.tanda!.getTrackBpm("t1"))).toMatchObject({user_bpm:66,bpm_override:73,bpm:66});
    const root=launched.tempRoot;await launched.close({cleanup:false});launched=await relaunchSeededApp(root);page=launched.page;
    expect(await page.evaluate(()=>window.tanda!.getTrackBpm("t1"))).toMatchObject({user_bpm:66,bpm_override:73,bpm:66});
    await page.evaluate(async()=>{const config=await window.tanda!.getBpmStatus();await window.tanda!.configureBpm({...config,enabled:true});});
    expect(await page.evaluate(()=>window.tanda!.getTrackBpm("t1"))).toMatchObject({user_bpm:66,bpm_override:73,bpm:73});
  } finally {await launched.close();}
});

test("BPM worker analyses existing music and a subsequently scanned track",async()=>{
  const launched=await launchSeededApp("full");
  const {page}=launched;
  try {
    const existing=await page.evaluate(async()=> (await window.tanda!.getTracksByIds(["t1"]))[0]);
    fs.writeFileSync(existing.full_path,pulseWav());
    await page.evaluate(async()=>{
      const config=await window.tanda!.getBpmStatus();
      await window.tanda!.configureBpm({...config,enabled:true,preference:"derived-only",paused:false});
    });
    await expect.poll(()=>page.evaluate(()=>window.tanda!.getTrackBpm("t1").then(t=>t?.derived_bpm)),{timeout:30000}).toBeGreaterThan(0);
    const analysed=await page.evaluate(()=>window.tanda!.getTrackBpm("t1"));
    expect(analysed?.user_bpm).toBe(66);
    expect(analysed?.bpm).toBe(analysed?.derived_bpm);
    expect(Number.isInteger(analysed?.derived_bpm)).toBe(true);
    const addedPath=path.join(path.dirname(existing.full_path),"new-bpm-pulse.wav");
    fs.writeFileSync(addedPath,pulseWav());
    await page.evaluate(()=>window.tanda!.scanKind("music"));
    const added=await page.evaluate(async file=>(await window.tanda!.listTracks()).find(t=>t.full_path===file),addedPath);
    expect(added).toBeTruthy();
    await expect.poll(()=>page.evaluate(id=>window.tanda!.getTrackBpm(id).then(t=>t?.derived_bpm),added!.id),{timeout:30000}).toBeGreaterThan(0);
    expect(await page.evaluate(id=>window.tanda!.getTrackBpm(id),added!.id)).toMatchObject({user_bpm:null,bpm_error:null});
  } finally {await launched.close();}
});

test("System and Playlist group related controls and use matching dropdown styling",async({},testInfo)=>{
  const launched=await launchSeededApp("empty");
  const {page}=launched;
  try {
    await page.locator("#open-settings").click();
    await page.locator('button[data-tab="system"]').click();
    const bpm=page.locator("#bpm-settings");
    await expect(bpm.locator("h4")).toHaveText("BPM");
    expect(await bpm.evaluate(panel=>panel.nextElementSibling?.querySelector("h4")?.textContent)).toBe("Data");
    await expect(page.locator('.settings-tab[data-tab="system"] #tanda-size-input')).toHaveCount(0);
    expect(await page.locator("#clear-play-counts").evaluate(button=>button.closest("section")?.querySelector("h4")?.textContent)).toBe("Collections");
    const selectStyles=await page.evaluate(()=>["language-select","bpm-preference"].map(id=>{
      const style=getComputedStyle(document.getElementById(id)!);
      return {borderRadius:style.borderRadius,padding:style.padding,background:style.backgroundColor,color:style.color};
    }));
    expect(selectStyles[1]).toEqual(selectStyles[0]);
    await bpm.scrollIntoViewIfNeeded();
    await page.screenshot({path:testInfo.outputPath("bpm-system-panel.png")});
    await page.locator('button[data-tab="playlist"]').click();
    const size=page.locator('.settings-tab[data-tab="playlist"] #tanda-size-input');
    await expect(size).toBeVisible();
    const sequence=page.locator("#playlist-sequence");
    const sizeBox=await size.boundingBox(),sequenceBox=await sequence.boundingBox();
    expect(sizeBox!.x).toBeGreaterThan(sequenceBox!.x);
    expect(Math.abs(sizeBox!.y-sequenceBox!.y)).toBeLessThan(3);
    await size.fill("4");await size.blur();
    await page.locator('button[data-tab="system"]').click();
    await page.locator('button[data-tab="playlist"]').click();
    await expect(size).toHaveValue("4");
  } finally {await launched.close();}
});
