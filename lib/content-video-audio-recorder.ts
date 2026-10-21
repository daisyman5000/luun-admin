import {IDEA_RECORDING_SECONDS,IDEA_RECORDING_BYTES,recordedAudioSeconds} from './content-video-recording-limits';
export const RECORDING_MIMES=['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg;codecs=opus'];
export async function startAudioRecording(onDone:(file:File)=>void,onError:(message:string)=>void,env={getUserMedia:()=>navigator.mediaDevices.getUserMedia({audio:true}),Recorder:MediaRecorder},limits:{seconds:number;bytes:number;now?:()=>number;schedule?:(fn:()=>void,ms:number)=>ReturnType<typeof setTimeout>}={seconds:IDEA_RECORDING_SECONDS,bytes:IDEA_RECORDING_BYTES}){
 const mime=RECORDING_MIMES.find(t=>env.Recorder.isTypeSupported(t));if(!mime)throw Error('Audio recording is unavailable in this browser.');
 const stream=await env.getUserMedia();let recorder:MediaRecorder;try{recorder=new env.Recorder(stream,{mimeType:mime,audioBitsPerSecond:24000});}catch(e){stream.getTracks().forEach(t=>t.stop());throw e;}
 const now=limits.now||(()=>performance.now()),started=now();let cancelled=false,size=0;const chunks:BlobPart[]=[];const timer:{id?:ReturnType<typeof setTimeout>}={};const release=()=>{if(timer.id)clearTimeout(timer.id);stream.getTracks().forEach(t=>t.stop());};
 recorder.ondataavailable=e=>{if(e.data.size){size+=e.data.size;chunks.push(e.data);if(size>=limits.bytes-5*1024*1024&&recorder.state!=='inactive')recorder.stop();}};
 recorder.onerror=()=>{onError('Recording interrupted. Save the captured audio before retrying.');if(recorder.state!=='inactive')recorder.stop();};
 recorder.onstop=()=>{release();if(cancelled)return;const type=recorder.mimeType||mime,ext=type.includes('mp4')?'m4a':type.includes('ogg')?'ogg':'webm';if(!size){onError('No audio was captured. Record again.');return;}const file=new File(chunks,'idea-recording.'+ext,{type});recordedAudioSeconds.set(file,Math.max(.001,(now()-started)/1000));onDone(file);};
 try{recorder.start(5000);}catch(e){release();throw e;}timer.id=(limits.schedule||((fn:()=>void,ms:number)=>setTimeout(fn,ms)))(()=>{if(recorder.state!=='inactive')recorder.stop();},limits.seconds*1000);
 return {stop:()=>{if(recorder.state!=='inactive')recorder.stop();},cancel:()=>{cancelled=true;if(recorder.state!=='inactive')recorder.stop();release();}};
}
