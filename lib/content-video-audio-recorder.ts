export const RECORDING_MIMES=['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg;codecs=opus'];
export async function startAudioRecording(onDone:(file:File)=>void,onError:(message:string)=>void,env={getUserMedia:()=>navigator.mediaDevices.getUserMedia({audio:true}),Recorder:MediaRecorder}){
 const mime=RECORDING_MIMES.find(t=>env.Recorder.isTypeSupported(t));if(!mime)throw Error('Audio recording is unavailable in this browser. Choose an audio file instead.');
 const stream=await env.getUserMedia();let recorder:MediaRecorder;try{recorder=new env.Recorder(stream,{mimeType:mime,audioBitsPerSecond:128000});}catch(e){stream.getTracks().forEach(t=>t.stop());throw e;}
 let cancelled=false,size=0;const chunks:BlobPart[]=[];const timer:{id?:ReturnType<typeof setTimeout>}={};const release=()=>{if(timer.id)clearTimeout(timer.id);stream.getTracks().forEach(t=>t.stop());};
 recorder.ondataavailable=e=>{if(e.data.size){size+=e.data.size;if(size>25*1024*1024){cancelled=true;onError('Recording exceeds25MB. Record again.');if(recorder.state!=='inactive')recorder.stop();release();}else chunks.push(e.data);}};
 recorder.onerror=()=>{cancelled=true;release();onError('Audio recording failed. Record again.');};
 recorder.onstop=()=>{release();if(cancelled)return;const type=recorder.mimeType||mime,ext=type.includes('mp4')?'m4a':type.includes('ogg')?'ogg':'webm';if(!size){onError('No audio was captured. Record again.');return;}onDone(new File(chunks,'idea-recording.'+ext,{type}));};
 try{recorder.start(1000);}catch(e){release();throw e;}timer.id=setTimeout(()=>{if(recorder.state!=='inactive')recorder.stop();},120000);
 return {stop:()=>{if(recorder.state!=='inactive')recorder.stop();release();},cancel:()=>{cancelled=true;if(recorder.state!=='inactive')recorder.stop();release();}};
}
