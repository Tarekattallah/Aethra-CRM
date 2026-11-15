import { RefObject,useEffect,useRef } from 'react';
export function useDialogFocus(open:boolean,ref:RefObject<HTMLElement>,onClose:()=>void) {
  const close=useRef(onClose);close.current=onClose;
  useEffect(()=>{
    const node=ref.current;if(!open||!node)return;
    const previous=document.activeElement as HTMLElement|null;
    const controls=()=>Array.from(node.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(element=>element.getClientRects().length>0);
    (node.querySelector<HTMLElement>('[data-modal-focus]')||controls()[0])?.focus();
    const keys=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();close.current();}else if(event.key==='Tab'){const items=controls();const first=items[0],last=items[items.length-1];if(!first){event.preventDefault();return;}if(event.shiftKey&&(document.activeElement===first||!node.contains(document.activeElement))){event.preventDefault();last.focus();}else if(!event.shiftKey&&(document.activeElement===last||!node.contains(document.activeElement))){event.preventDefault();first.focus();}}};
    document.addEventListener('keydown',keys);return()=>{document.removeEventListener('keydown',keys);if(previous&&document.contains(previous))previous.focus();};
  },[open,ref]);
}
