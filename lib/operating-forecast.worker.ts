import {operatingTimeline} from './operating-timeline';
self.onmessage=event=>{
 try{self.postMessage({operatingPlan:operatingTimeline(event.data.baseline,event.data.choice)});}
 catch(error){self.postMessage({error:error instanceof Error?error.message:'Forecast recalculation failed'});}
};
