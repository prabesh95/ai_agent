import type { UIMessage } from 'ai';
export const CHAT_SESSION_KEY = 'kings-ai.chat-session.v1';
export type ChatSession = { messages:UIMessage[]; input:string };
export function readChatSession(storage: Pick<Storage,'getItem'>): ChatSession | null {
  try {
    const raw=storage.getItem(CHAT_SESSION_KEY);if(!raw || raw.length>4000000)return null;
    const data=JSON.parse(raw);
    if(data.version!==1 || !Array.isArray(data.messages) || typeof data.input!=='string')return null;
    const messages=data.messages.filter((m: UIMessage)=>m && typeof m.id==='string' && ['user','assistant','system'].includes(m.role) && Array.isArray(m.parts) && m.parts.every(p=>p && typeof p.type==='string'));
    return {messages,input:data.input};
  }catch{return null;}
}
export function writeChatSession(storage: Pick<Storage,'setItem'|'removeItem'>, session:ChatSession) {
  try {
    if(!session.messages.length && !session.input){storage.removeItem(CHAT_SESSION_KEY);return;}
    const value=JSON.stringify({version:1,...session});
    if(value.length>4000000)return;
    storage.setItem(CHAT_SESSION_KEY,value);
  }catch{/* Storage may be disabled or full; live chat must continue working. */}
}
