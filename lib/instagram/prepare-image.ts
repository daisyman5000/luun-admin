// Resize locally before transfer; the original stays on the owner's device.
export function instagramImageSize(width:number,height:number){const ratio=width/height;if(!Number.isFinite(ratio)||width<320||height<1||ratio<.8||ratio>1.91)throw Error(`This image is ${width} × ${height}. Choose a portrait, square or landscape image between 4:5 and 1.91:1.`);const target=Math.min(width,1440);return {width:target,height:Math.round(height*target/width)};}
export async function prepareInstagramImage(file:File){
 if(!['image/jpeg','image/png'].includes(file.type))throw Error('Choose a PNG or JPEG image.');if(file.size>20*1024*1024)throw Error('Choose an image under 20 MB.');
 let image:ImageBitmap;try{image=await createImageBitmap(file,{imageOrientation:'from-image'});}catch{throw Error('This image could not be opened. Export it as PNG or JPEG and try again.');}
 try{if(image.width*image.height>40000000)throw Error('Choose an image under 40 megapixels.');const size=instagramImageSize(image.width,image.height),canvas=document.createElement('canvas');canvas.width=size.width;canvas.height=size.height;const context=canvas.getContext('2d');if(!context)throw Error('Image preparation failed. Try another browser.');context.fillStyle='#ffffff';context.fillRect(0,0,size.width,size.height);context.drawImage(image,0,0,size.width,size.height);
  for(const quality of [.92,.8,.65]){const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));if(blob&&blob.size<=4*1024*1024)return new File([blob],'instagram.jpg',{type:'image/jpeg'});}throw Error('This image is too large to upload. Export a smaller JPEG and try again.');
 }finally{image.close();}
}
