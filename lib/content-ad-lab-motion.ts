import {gsap} from 'gsap';
import {adBeatTimes,type AdFinal} from './content-ad-lab';

export type AdPhotos=Partial<Record<'frame'|'base'|'cushion',CanvasImageSource>>;
// A fixed renderer, not AI-generated code. It cannot fetch, execute, publish or animate a product.
export function adComposition(final:AdFinal,duration:number,photos:AdPhotos={}){
 if(!final.script||!final.beats.length)throw Error('Choose a retained script with a complete animation plan');
 const beats=adBeatTimes(final.beats,duration),states=beats.map(()=>({reveal:0,change:0})),timeline=gsap.timeline({paused:true});
 beats.forEach((b,i)=>{const seconds=b.end-b.start;timeline.to(states[i],{reveal:1,duration:Math.min(.35,seconds*.2),ease:'power2.out'},b.start);timeline.to(states[i],{change:1,duration:Math.max(.1,seconds*.65),ease:'none'},b.start+seconds*.15);});
 const label=(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,size:number,color='#f8f5ed')=>{ctx.font=`600 ${size}px Arial`;while(ctx.measureText(text).width>600&&size>24){size-=2;ctx.font=`600 ${size}px Arial`;}ctx.fillStyle=color;ctx.fillText(text,x,y);};
 function draw(ctx:CanvasRenderingContext2D,time:number){timeline.seek(Math.max(0,Math.min(duration,time)),false);const index=Math.max(0,beats.findIndex(b=>time>=b.start&&time<b.end)),b=beats[time>=duration?beats.length-1:index],state=states[time>=duration?beats.length-1:index];ctx.save();ctx.fillStyle='#111b20';ctx.fillRect(0,0,720,1280);ctx.textAlign='center';ctx.textBaseline='middle';
  if(b.kind==='static-proof'){
   const image=photos[b.asset as keyof AdPhotos];if(!image)throw Error(`Add the ${b.asset} photo for its proof shot`);
   const source=image as {width:number;height:number},scale=Math.min(720/source.width,1000/source.height),w=source.width*scale,h=source.height*scale;ctx.fillStyle='#f0ede7';ctx.fillRect(0,0,720,1280);ctx.drawImage(image,(720-w)/2,(1280-h)/2,w,h);if(b.labels.length){ctx.fillStyle='#111b20';ctx.fillRect(0,1040,720,160);b.labels.forEach((l,i)=>label(ctx,l,360,1090+i*42,30));}
  }else{
   ctx.globalAlpha=state.reveal;
   if(b.kind==='cross-out'){const spacing=130,start=640-(b.labels.length-1)*spacing/2;b.labels.forEach((word,i)=>{const y=start+i*spacing;label(ctx,word,360,y,62);const width=Math.min(600,ctx.measureText(word).width+32),progress=Math.max(0,Math.min(1,state.change*b.labels.length-i));ctx.strokeStyle='#ff805e';ctx.lineWidth=7;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(360-width/2,y);ctx.lineTo(360-width/2+width*progress,y);ctx.stroke();});}
   else if(b.kind==='count'){const count=b.from+(b.to-b.from)*state.change;label(ctx,String(Math.round(count)),360,600,190,'#b1ead5');if(b.labels[0])label(ctx,b.labels[0],360,770,38);const marks=Math.min(20,Math.round(count));for(let j=0;j<marks;j++){ctx.fillStyle='#b1ead5';ctx.fillRect(180+j*(360/Math.max(1,marks)),880,Math.min(30,300/Math.max(1,marks)),7);}}
   else if(b.kind==='compare'||b.kind==='not-equal'){b.labels.forEach((word,i)=>{ctx.globalAlpha=i===0?state.reveal:state.reveal*state.change;label(ctx,word,360,460+i*350,48,i===0?'#f8f5ed':'#b1ead5');});ctx.globalAlpha=state.change;label(ctx,b.kind==='not-equal'?'≠':'vs',360,635,100,'#ff805e');}
   else b.labels.forEach((word,i)=>label(ctx,word,360,610+i*90,54));
  }ctx.restore();
 }
 return {beats,draw,dispose:()=>timeline.kill()};
}
