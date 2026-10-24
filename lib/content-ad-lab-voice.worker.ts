import {localAdVoice} from './content-ad-lab-voice-engine';
self.onmessage=async(event:MessageEvent)=>{try{const result=await localAdVoice(event.data.final,message=>self.postMessage({progress:message}));self.postMessage({result});}catch(e){self.postMessage({error:e instanceof Error?e.message:'Local voice generation failed'});}};
