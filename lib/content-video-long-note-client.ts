'use client';
import {Input,UrlSource,ALL_FORMATS,AudioBufferSink} from 'mediabunny';
// Decode one source interval at a time; never allocate a full multi-hour PCM buffer.
export async function savedIdeaChunk(url:string,start:number,seconds:number,total:number){
 const input=new Input({source:new UrlSource(url,{requestInit:{credentials:'same-origin'},getRetryDelay:()=>null,maxCacheSize:16*1024*1024,parallelism:1}),formats:ALL_FORMATS});
 try{
  const track=await input.getPrimaryAudioTrack();if(!track||!await track.canDecode())throw Error('Saved note codec cannot be decoded in this browser; original retained');
  const origin=await track.getFirstTimestamp(),duration=await track.computeDuration();if(Math.abs(duration-origin-total)>1)throw Error('Saved note duration differs from its retained recording; no truncation performed');
  const count=Math.round(seconds*48000),pcm=new Float32Array(count);let covered=start;
  for await(const item of new AudioBufferSink(track).buffers(origin+start,origin+start+seconds)){
   const begin=item.timestamp-origin,end=begin+item.buffer.duration;
   if(begin>covered+.1)throw Error('Saved note has an undecoded audio gap; original retained');
   const lo=Math.max(0,Math.ceil((begin-start)*48000)),hi=Math.min(count,Math.floor((end-start)*48000));
   const channels=Array.from({length:item.buffer.numberOfChannels},(_,c)=>item.buffer.getChannelData(c));
   for(let i=lo;i<hi;i++){const pos=Math.max(0,Math.min(item.buffer.length-1,Math.round((start+i/48000-begin)*item.buffer.sampleRate)));let value=0;for(const channel of channels)value+=channel[pos];pcm[i]=value/channels.length;}
   covered=Math.max(covered,end);
  }
  if(covered<start+seconds-.1)throw Error('Saved note ends before the requested interval; original retained');
  const bytes=new ArrayBuffer(44+count*2),v=new DataView(bytes),word=(at:number,s:string)=>{for(let i=0;i<s.length;i++)v.setUint8(at+i,s.charCodeAt(i));};
  word(0,'RIFF');v.setUint32(4,bytes.byteLength-8,true);word(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,48000,true);v.setUint32(28,96000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);word(36,'data');v.setUint32(40,count*2,true);for(let i=0;i<count;i++)v.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,pcm[i]))*32767),true);
  return new File([bytes],'idea-chunk.wav',{type:'audio/wav'});
 }finally{input.dispose();}
}
