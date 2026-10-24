'use client';
import type {AdFinal} from './content-ad-lab';
import {adVoiceChunks} from './content-ad-lab-voice-chunks';

let model:Promise<import('kokoro-js').KokoroTTS>|undefined;
export async function localAdVoice(final:AdFinal,onProgress?:(message:string)=>void){
 if(!final.script||final.beats.map(b=>b.line).join(' ').replace(/\s+/g,' ').trim()!==final.script.replace(/\s+/g,' ').trim())throw Error('Voice requires the complete saved script');
 onProgress?.('Loading the free local voice model (about 90 MB on first use)…');
 const {KokoroTTS}=await import('kokoro-js');model||=KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX',{dtype:'q8',device:'wasm'}).catch(e=>{model=undefined;throw e;});const tts=await model,chunks:Float32Array[]=[],durations:number[]=[],rate=24000;
 for(let i=0;i<final.beats.length;i++){onProgress?.(`Generating voice locally… ${i+1} of ${final.beats.length}`);let samples=0;for(const text of adVoiceChunks(final.beats[i].line)){const audio=await tts.generate(text.replace(/Luun\.ca/gi,'Loon dot C A').replace(/Luun/g,'Loon'),{voice:'af_heart',speed:1.06});if(audio.sampling_rate!==rate||audio.audio.length<rate*.15||audio.audio.some(v=>!Number.isFinite(v)))throw Error('Local voice output is incomplete');chunks.push(audio.audio);samples+=audio.audio.length;const gap=new Float32Array(Math.round(rate*.12));chunks.push(gap);samples+=gap.length;}durations.push(samples/rate);}
 const count=chunks.reduce((n,c)=>n+c.length,0);if(count>rate*120)throw Error('Generated narration exceeds two minutes');const bytes=new ArrayBuffer(44+count*2),v=new DataView(bytes);const text=(offset:number,s:string)=>{for(let i=0;i<s.length;i++)v.setUint8(offset+i,s.charCodeAt(i));};text(0,'RIFF');v.setUint32(4,36+count*2,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,count*2,true);let at=44;for(const chunk of chunks)for(const value of chunk){v.setInt16(at,Math.round(Math.max(-1,Math.min(1,value))*32767),true);at+=2;}return {file:new File([bytes],'Luun-local-AI-voice.wav',{type:'audio/wav'}),durations};
}
