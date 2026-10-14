// Coordinator scenarios use a small mocked hook/SDK boundary. These supplement
// the device-controller tests; they do not replace testing in a real React app.
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { SpeechPlaybackController } from '../lib/voice/speech.ts';
const root=fileURLToPath(new URL('..', import.meta.url));
const source=fs.readFileSync(root+'/hooks/useVoiceConversation.ts','utf8');
let passed=0;
function setup(){
 let slot=0,dirty=false,output=null,now=0,timerId=0,micOptions=null;
 const slots=[],effects=[],timers=new Map(),sent=[],requests=[],spoken=[];
 const same=(a,b)=>!!a&&!!b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const React={
  useState(initial){const i=slot++;if(!slots[i])slots[i]={value:typeof initial==='function'?initial():initial,set:v=>{slots[i].value=typeof v==='function'?v(slots[i].value):v;dirty=true;}};return [slots[i].value,slots[i].set];},
  useRef(value){const i=slot++;if(!slots[i])slots[i]={current:value};return slots[i];},
  useCallback(fn,deps){const i=slot++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={fn,deps};return slots[i].fn;},
  useEffect(fn,deps){const i=slot++;if(!slots[i]||!same(slots[i].deps,deps)){const old=slots[i];slots[i]={deps,cleanup:old?.cleanup};effects.push(()=>{old?.cleanup?.();slots[i].cleanup=fn();});}},
 };
 const speech=new SpeechPlaybackController({speak(text,events){spoken.push({text,events});return()=>{};}});
 const speechActions={stop:()=>speech.stop(),clearError:()=>speech.clearError(),beginResponse:(...a)=>speech.beginResponse(...a),consume:(...a)=>speech.consume(...a),endResponse:()=>speech.endResponse(),isBusy:()=>speech.isBusy(),replay:(...a)=>speech.replay(...a)};
 const mic={enabled:false,phase:'off',start:async()=>{mic.enabled=true;mic.phase='listening';dirty=true;},stop:()=>{mic.enabled=false;mic.phase='off';dirty=true;},isCapturing:()=>mic.phase==='listening'};
 const model={messages:[],status:'ready',error:null,options:null,pending:null};
 const api={sendMessage:async({text},options)=>{requests.push(options);sent.push(text);model.messages=[...model.messages,{id:'u'+sent.length,role:'user',parts:[{type:'text',text}]}];model.status='submitted';dirty=true;await new Promise(resolve=>model.pending=resolve);},stop:()=>{model.status='ready';model.options.onFinish({message:{id:'a',role:'assistant',parts:[]},isAbort:true});model.pending?.();dirty=true;},setMessages:messages=>{model.messages=messages;dirty=true;},clearError:()=>{model.error=null;dirty=true;}};
 const imports={'react':React,'@ai-sdk/react':{useChat:options=>{model.options=options;return {...model,...api};}},'./useSpeechPlayback':{useSpeechPlayback:()=>({...speech.snapshot(),...speechActions})},'./useMicrophone':{useMicrophone:options=>{micOptions=options;return {...mic};}}};
 const document={activeElement:null};
 const context={imports,document,fetch:async()=>({ok:true,json:async()=>({text:'What is the capital of Nepal?'})}),FormData,AbortController,Blob,Date:{now:()=>now},Math,Set,Error,console,setInterval:fn=>{const id=++timerId;timers.set(id,fn);return id;},clearInterval:id=>timers.delete(id)};
 let js=stripTypeScriptTypes(source,{mode:'strip'}).replace(/import\s*{([\s\S]*?)}\s*from\s*["']([^"']+)["'];/g,(_,names,path)=>`const {${names}}=imports[${JSON.stringify(path)}];`).replace(/export function/g,'function');
 vm.createContext(context);vm.runInContext(js+'\nthis.runHook=useVoiceConversation;',context);
 function render(){let attempts=0;do{dirty=false;slot=0;output=context.runHook();while(effects.length)effects.shift()();if(++attempts>20)throw Error('Render loop');}while(dirty);return output;}
 const finish=async()=>{for(let i=0;i<8;i++)await Promise.resolve();render();};
 render();output.textareaRef.current={};
 return {get api(){return output;},sent,requests,spoken,model,context,document,mic,speech,render,finish,get micOptions(){return micOptions;},async transcribe(){await micOptions.onAudio(new Blob(['audio'],{type:'audio/webm'}));await finish();},async advance(ms){for(let i=0;i<ms;i+=100){now+=100;for(const fn of [...timers.values()])fn();await finish();}},complete(text){const message={id:'a'+sent.length,role:'assistant',parts:[{type:'text',text}]};model.messages=[...model.messages,message];model.status='ready';model.options.onFinish({message,isAbort:false,isDisconnect:false,isError:false});model.pending?.();dirty=true;},stream(text){const message={id:'a'+sent.length,role:'assistant',parts:[{type:'text',text}]};model.messages=[...model.messages.filter(m=>m.id!==message.id),message];model.status='streaming';dirty=true;render();},unmount(){for(const s of slots)s?.cleanup?.();}};
}
for (const enabled of [false, true]) {
 const h=setup(); if(enabled){h.api.toggleWebSearch();h.render();}
 h.api.changeInput('Typed search');h.render();h.api.handleSubmit({preventDefault(){}});await h.finish();
 assert.equal(h.requests[0].body.webSearch,enabled);h.complete('Answer.');await h.finish();passed++;
}
{
 const h=setup();h.api.toggleWebSearch();h.render();h.api.toggleInstantSend();h.render();await h.transcribe();
 assert.equal(h.requests[0].body.webSearch,true);h.complete('Voice answer.');await h.finish();passed++;
}
{
 const h=setup();h.api.toggleWebSearch();h.render();await h.transcribe();await h.advance(3000);
 assert.equal(h.requests[0].body.webSearch,true);h.complete('Voice answer.');await h.finish();passed++;
}
console.log(`Passed ${passed} web-mode submission scenarios: typed off/on, immediate voice, review countdown.`);
