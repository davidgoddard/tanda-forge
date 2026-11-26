import {test,expect} from "@playwright/test";
import {launchSeededApp,relaunchSeededApp} from "./support/electron-app";
import fs from "fs";
import path from "path";

const pulseWav = () => {
  const rate=11025, frames=rate*40;
  const buffer=Buffer.alloc(44+frames*2);
  buffer.write("RIFF",0);buffer.writeUInt32LE(buffer.length-8,4);buffer.write("WAVEfmt ",8);
  buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);
  buffer.writeUInt32LE(rate,24);buffer.writeUInt32LE(rate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);
  buffer.write("data",36);buffer.writeUInt32LE(frames*2,40);
  for(let t=.3;t<40;t+=.5) for(let j=0;j<250;j++) {
    const frame=Math.round(t*rate)+j;
    if(frame<frames)buffer.writeInt16LE(Math.round(24000*Math.sin(j*.7)*Math.exp(-j/40)),44+frame*2);
  }
  return buffer;
};

test("analysis panels, editor provenance, three policies and restart preserve manual values",async({},testInfo)=>{
  let launched=await launchSeededApp("full");
  try {
    let {page}=launched;
    await page.locator("#open-settings").click();
    await page.locator('button[data-tab="system"]').click();
    for(const kind of ["bpm","style"]) {
      await page.locator(`#${kind}-preference`).selectOption("prefer-user");
      await page.locator(`#${kind}-enabled`).check();
      await expect(page.locator(`#${kind}-analyse`)).toBeEnabled();
      await expect(page.locator(`#${kind}-preference option`)).toHaveCount(3);
    }
    await page.locator("#close-settings").click();
    await page.locator("#search-input").fill("Alberto Gomez Tango Uno");
    await page.locator("#search-button").click();
    const row=page.locator('#search-tracks [data-track-id="t1"]').first();
    await expect(row).toBeVisible();
    const menu=row.locator('button[data-action="row-menu"]');
    if(await menu.count())await menu.click();
    await page.locator('button[data-action="edit-track"]:visible').first().click();
    await expect(page.locator("#track-editor-bpm")).toHaveValue("66");
    await expect(page.locator("#track-editor-genre")).toHaveValue("Tango");
    await expect(page.locator("#track-editor-bpm-details")).toContainText("Using: 66");
    await expect(page.locator("#track-editor-bpm-details")).not.toContainText("User:");
    await page.locator("#track-editor-notes").fill("Metadata-only edit");
    await page.locator("#track-editor-save").click();
    await expect.poll(()=>page.evaluate(()=>window.tanda!.getTrackBpm("t1"))).toMatchObject({bpm:66,bpm_override:null});
    expect(await page.evaluate(()=>window.tanda!.getTrackStyle("t1"))).toMatchObject({genre:"Tango",user_style:null});
    if(await menu.count())await menu.click();
    await page.locator('button[data-action="edit-track"]:visible').first().click();
    for(const kind of ["style","bpm"]) {
      const header=page.locator(`#track-editor-${kind}-details`).locator("..");
      const label=await header.locator("label").boundingBox();
      const details=await header.locator("p").boundingBox();
      expect(Math.abs(label!.y-details!.y)).toBeLessThan(10);
      expect(details!.x).toBeGreaterThan(label!.x);
    }
    const styleWidth=await page.locator("#track-editor-genre").evaluate(el=>el.getBoundingClientRect().width/el.parentElement!.getBoundingClientRect().width);
    expect(styleWidth).toBeGreaterThan(.8);
    await expect(page.locator("#track-editor-bpm-details")).toContainText("Imported: 66");
    await page.locator("#track-editor-tap").click();await page.waitForTimeout(500);await page.locator("#track-editor-tap").click();
    await expect(page.locator("#track-editor-bpm")).not.toHaveValue("");
    await page.locator("#track-editor-bpm").fill("72.7");await page.locator("#track-editor-bpm").blur();
    await expect(page.locator("#track-editor-bpm")).toHaveValue("73");
    await page.locator("#track-editor-genre").selectOption("Milonga");
    await expect(page.locator("#track-editor-style-details")).toContainText("User: Milonga");
    await expect(page.locator("#track-editor-style-details")).not.toContainText("Imported:");
    await expect(page.locator("#track-editor-bpm-details")).toContainText("User: 73");
    await expect(page.locator("#track-editor-bpm-details")).not.toContainText("Imported:");
    await page.screenshot({path:testInfo.outputPath("analysis-editor.png")});
    await page.locator("#track-editor-save").click();
    await expect.poll(()=>page.evaluate(()=>window.tanda!.getTrackBpm("t1"))).toMatchObject({user_bpm:66,bpm_override:73,bpm:73});
    expect(await page.evaluate(()=>window.tanda!.getTrackStyle("t1"))).toMatchObject({user_style:"Milonga",genre:"Milonga"});
    await page.evaluate(async()=>{
      await window.tanda!.configureBpm({...await window.tanda!.getBpmStatus(),enabled:false});
      await window.tanda!.configureStyle({...await window.tanda!.getStyleStatus(),enabled:false});
      await window.tanda!.configureBpm({...await window.tanda!.getBpmStatus(),enabled:true,preference:"derived-only"});
      await window.tanda!.configureStyle({...await window.tanda!.getStyleStatus(),enabled:true,preference:"derived-only"});
    });
    expect(await page.evaluate(()=>window.tanda!.getTrackBpm("t1"))).toMatchObject({bpm_override:73,bpm:null});
    expect(await page.evaluate(()=>window.tanda!.getTrackStyle("t1"))).toMatchObject({user_style:"Milonga",genre:null});
    await page.evaluate(async()=>{
      await window.tanda!.configureBpm({...await window.tanda!.getBpmStatus(),preference:"default-only",enabled:false});
      await window.tanda!.configureStyle({...await window.tanda!.getStyleStatus(),preference:"default-only",enabled:false});
    });
    const root=launched.tempRoot;await launched.close({cleanup:false});launched=await relaunchSeededApp(root);page=launched.page;
    expect(await page.evaluate(()=>window.tanda!.getTrackBpm("t1"))).toMatchObject({user_bpm:66,bpm_override:73,bpm:73});
    expect(await page.evaluate(()=>window.tanda!.getTrackStyle("t1"))).toMatchObject({user_style:"Milonga",genre:"Milonga"});
  } finally {await launched.close();}
});

test("shared worker analyses BPM and style, reanalyses, and handles future imports",async()=>{
  const launched=await launchSeededApp("full");
  const {page}=launched;
  try {
    const existing=await page.evaluate(async()=> (await window.tanda!.getTracksByIds(["t1"]))[0]);
    fs.writeFileSync(existing.full_path,pulseWav());
    await page.evaluate(async()=>{
      const config=await window.tanda!.getBpmStatus();
      await window.tanda!.configureBpm({...config,enabled:true,preference:"derived-only",paused:false});
      await window.tanda!.configureStyle({...await window.tanda!.getStyleStatus(),enabled:true,preference:"prefer-user",paused:false});
      await window.tanda!.analyseBpm();await window.tanda!.analyseStyle();
    });
    await expect.poll(()=>page.evaluate(()=>window.tanda!.getTrackBpm("t1").then(t=>t?.derived_bpm)),{timeout:30000}).toBeGreaterThan(0);
    const analysed=await page.evaluate(()=>window.tanda!.getTrackBpm("t1"));
    expect(analysed?.user_bpm).toBe(66);
    await expect.poll(()=>page.evaluate(()=>window.tanda!.getTrackStyle("t1").then(t=>t?.derived_style)),{timeout:30000}).toBeTruthy();
    const beforeStyle=await page.evaluate(()=>window.tanda!.getTrackStyle("t1"));
    expect(beforeStyle?.style_error).toBeNull();
    // Later deliberate edits take priority even in Always mode and survive reanalysis.
    await page.evaluate(async()=>{
      const track=(await window.tanda!.getTracksByIds(["t1"]))[0];
      await window.tanda!.updateTrack({...track,bpm:77,genre:"Milonga"});
      await window.tanda!.analyseBpm();await window.tanda!.analyseStyle();
    });
    await expect.poll(()=>page.evaluate(()=>window.tanda!.getStyleStatus().then(s=>s.completed+s.failed)),{timeout:30000}).toBeGreaterThan(0);
    expect(await page.evaluate(()=>window.tanda!.getTrackStyle("t1"))).toMatchObject({user_style:"Milonga",genre:"Milonga"});
    expect(analysed?.bpm).toBe(analysed?.derived_bpm);
    expect(await page.evaluate(()=>window.tanda!.getTrackBpm("t1"))).toMatchObject({bpm:77,bpm_override:77});
    expect(Number.isInteger(analysed?.derived_bpm)).toBe(true);
    const addedPath=path.join(path.dirname(existing.full_path),"new-bpm-pulse.wav");
    fs.writeFileSync(addedPath,pulseWav());
    await page.evaluate(()=>window.tanda!.scanKind("music"));
    const added=await page.evaluate(async file=>(await window.tanda!.listTracks()).find(t=>t.full_path===file),addedPath);
    expect(added).toBeTruthy();
    await expect.poll(()=>page.evaluate(id=>window.tanda!.getTrackBpm(id).then(t=>t?.derived_bpm),added!.id),{timeout:30000}).toBeGreaterThan(0);
    expect(await page.evaluate(id=>window.tanda!.getTrackBpm(id),added!.id)).toMatchObject({user_bpm:null,bpm_error:null});
    await expect.poll(()=>page.evaluate(id=>window.tanda!.getTrackStyle(id).then(t=>t?.derived_style),added!.id),{timeout:30000}).toBeTruthy();
    const fresh=await page.evaluate(id=>window.tanda!.getTrackStyle(id),added!.id);
    expect(fresh?.genre).toBe(fresh?.derived_style);
    // Invalid seed audio must leave derived style unset and remain retryable.
    await expect.poll(()=>page.evaluate(()=>window.tanda!.getStyleStatus().then(s=>s.failed)),{timeout:30000}).toBeGreaterThan(0);
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
    const bpmBox=await bpm.boundingBox();
    const styleBox=await page.locator("#style-settings").boundingBox();
    expect(Math.abs(bpmBox!.y-styleBox!.y)).toBeLessThan(2);
    expect(styleBox!.x).toBeGreaterThan(bpmBox!.x+bpmBox!.width);
    expect(await bpm.evaluate(panel=>panel.nextElementSibling?.querySelector("h4")?.textContent)).toBe("Style");
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

test("Library setup separates roots, style definitions and optional legacy mapping",async({},testInfo)=>{
  const launched=await launchSeededApp("full");
  const {page}=launched;
  try {
    await page.locator("#open-settings").click();
    await page.locator('button[data-tab="library"]').click();
    await page.locator('[data-step-expand="roots"]').click();
    await page.locator("#library-roots-done").click();
    await expect(page.locator("#library-workflow-panel-styles")).toBeVisible();
    await expect(page.locator("#style-families-section")).toBeVisible();
    await expect(page.locator('[data-step="legacy-styles"]')).toBeHidden();
    await expect(page.locator('[data-step="legacy-import"]')).toBeHidden();
    await expect(page.locator("#style-family-list")).not.toContainText("Traditional");
    await page.screenshot({path:testInfo.outputPath("library-style-step.png")});
    await page.locator("#library-styles-done").click();
    await expect(page.locator("#library-workflow-panel-analysis")).toBeVisible();
  } finally { await launched.close(); }
});
