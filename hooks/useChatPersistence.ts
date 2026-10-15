"use client";
import type { UIMessage } from 'ai';
import { useEffect, useState } from 'react';
import { readChatSession, writeChatSession } from '../lib/chat/session';

// Storage access happens after mount, avoiding SSR/hydration differences.
export function useChatPersistence(messages:UIMessage[],setMessages:(messages:UIMessage[])=>void,input:string,updateInput:(text:string)=>void) {
  const [restored,setRestored]=useState(false);
  useEffect(()=>{
    try {
      const saved=readChatSession(window.sessionStorage);
      if(saved){setMessages(saved.messages);updateInput(saved.input);}
    }catch{/* sessionStorage getter itself can throw in restricted browsers. */}
    setRestored(true);
  },[setMessages,updateInput]);
  useEffect(()=>{
    if(!restored)return; // Never overwrite stored history with the initial empty render.
    try{writeChatSession(window.sessionStorage,{messages,input});}catch{}
  },[restored,messages,input]);
}
