import { describe, it, expect, vi } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { analyzeAudio } from "../app/src/main/bpm/pipeline";
import { models, validateModel, analyzeStyle, classifyFeatures } from "../app/src/main/style/analyzer/api.js";

describe("portable review style integration",()=>{
  it("ships the exact validated portable-review models",()=>{
    for(const [stage,hash] of Object.entries({vals:"4f076941250acb567552e46aadaf62bfad9c71164c74251039567b0bf7af7fa5",milonga:"44666a079b62c66e9e3bb1bbcfb42fcd33f2a4d2743fd1703f9934905f53c2ee"})) {
      expect(createHash("sha256").update(readFileSync(`app/src/main/style/analyzer/${stage}-v1.json`)).digest("hex")).toBe(hash);
      expect(validateModel(models[stage],stage)).toBe(models[stage]);
    }
    expect(()=>validateModel({...models.vals,coeff:[0]},"vals")).toThrow();
  });
  it("abstains on unusable tempo and insufficient passages",()=>{
    expect(()=>analyzeStyle(new Float32Array(11025*30),null)).toThrow();
    expect(()=>analyzeStyle(new Float32Array(11025*5),60)).toThrow();
    expect(()=>classifyFeatures([])).toThrow();
  });
  it("decodes once and passes the same audio plus acoustic tempo to style",async()=>{
    const samples=new Float32Array(128);
    const decode=vi.fn(async()=>samples);
    const tempo=vi.fn(()=>({bpm:65.2,warnings:[]}));
    const style=vi.fn(()=>({style:"Vals"}));
    expect(await analyzeAudio(decode,tempo,style)).toMatchObject({bpm:65.2,style:"Vals"});
    expect(decode).toHaveBeenCalledTimes(1);
    expect(tempo).toHaveBeenCalledWith(samples);
    expect(style).toHaveBeenCalledWith(samples,65.2);
  });
  it("retains valid BPM when style fails and reports decode failure without fabricating values",async()=>{
    const result=await analyzeAudio(async()=>new Float32Array(),()=>({bpm:61,warnings:[]}),()=>{throw Error("Not enough audio");});
    expect(result).toEqual({bpm:61,warnings:[],style:null,styleError:"Not enough audio"});
    const tempo=vi.fn();
    expect(await analyzeAudio(async()=>{throw Error("missing file");},tempo)).toEqual({error:"missing file"});
    expect(tempo).not.toHaveBeenCalled();
  });
});
