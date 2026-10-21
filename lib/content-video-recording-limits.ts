// Idea capture is independent of the finished script and paid-transcription envelope.
export const IDEA_RECORDING_SECONDS=4*60*60;
export const IDEA_RECORDING_BYTES=90*1024*1024; // below existing private bucket100MiB
export const recordedAudioSeconds=new WeakMap<File,number>();
