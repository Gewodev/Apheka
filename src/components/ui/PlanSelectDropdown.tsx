import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';

interface Option { id: string; label: string; color?: string; }
export default function PlanSelectDropdown({ value, onChange, options, noneLabel, color, label, disabled = false, searchable = true }: {
  value: string; onChange: (value: string) => void; options: Option[]; noneLabel: string; color: string; label?: string; disabled?: boolean; searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({left:0,top:0,width:0,maxHeight:280,zIndex:20000});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const selected = options.find(option => option.id === value);
  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
  const filtered = options.filter(option => normalize(option.label).includes(normalize(query.trim())));
  const choices: Option[] = [{id:'',label:noneLabel},...filtered];
  const close = (restore = true) => { setOpen(false); setQuery(''); if (restore) buttonRef.current?.focus({preventScroll:true}); };
  const choose = (option: Option) => { onChange(option.id); close(); };
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = buttonRef.current?.getBoundingClientRect(); if (!rect) return;
      let layer = 20000;
      for (let owner: HTMLElement | null = buttonRef.current; owner; owner = owner.parentElement) {
        const z = Number.parseInt(getComputedStyle(owner).zIndex, 10);
        if (Number.isFinite(z)) layer = Math.max(layer, z + 2);
      }
      const width = Math.min(Math.max(rect.width,240),window.innerWidth-24);
      const below = innerHeight-rect.bottom-16;
      const above = rect.top-16;
      const up = below<200 && above>below;
      const height = Math.min(320,Math.max(120,up?above:below));
      setPosition({left:Math.min(Math.max(12,rect.left),innerWidth-width-12),top:up?Math.max(12,rect.top-height-6):rect.bottom+6,width,maxHeight:height,zIndex:layer});
    };
    place();window.addEventListener('resize',place);
    const dismiss = (event: Event) => { if (!(event.target instanceof Node) || popupRef.current?.contains(event.target) || buttonRef.current?.contains(event.target)) return; close(false); };
    const reposition = (event: Event) => {
      if (event.target instanceof Node && popupRef.current?.contains(event.target)) return;
      const trigger=buttonRef.current;if(!trigger)return;
      const rect=trigger.getBoundingClientRect();
      if(rect.bottom<=0||rect.top>=innerHeight){close(false);return;}
      for(let owner=trigger.parentElement;owner;owner=owner.parentElement){
        const style=getComputedStyle(owner);
        if(/auto|scroll|hidden|clip/.test(style.overflowY)){
          const bounds=owner.getBoundingClientRect();
          if(rect.bottom<=bounds.top||rect.top>=bounds.bottom){close(false);return;}
        }
      }
      place();
    };
    window.addEventListener('pointerdown',dismiss);window.addEventListener('scroll',reposition,true);
    return () => {window.removeEventListener('resize',place);window.removeEventListener('pointerdown',dismiss);window.removeEventListener('scroll',reposition,true);};
  },[open]);
  useEffect(() => { setActive(0); },[query]);
  useEffect(() => {
    if (open && position.width > 0) (popupRef.current?.querySelector<HTMLInputElement>('input')||popupRef.current?.querySelector<HTMLElement>('[role=listbox]'))?.focus({preventScroll:true});
  },[open,position.width]);
  useEffect(() => {
    const list=popupRef.current?.querySelector<HTMLElement>('.workspace-select-options');
    const option=popupRef.current?.querySelector<HTMLElement>(`#${CSS.escape(id+'-'+active)}`);
    if(!list||!option)return;
    const bounds=list.getBoundingClientRect(), item=option.getBoundingClientRect();
    if(item.top<bounds.top)list.scrollTop-=bounds.top-item.top;
    else if(item.bottom>bounds.bottom)list.scrollTop+=item.bottom-bounds.bottom;
  },[active,id,open,position.top]);
  const keyDown = (event: React.KeyboardEvent) => {
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setActive(index=>(index+(event.key==='ArrowDown'?1:-1)+choices.length)%choices.length);}
    if(event.key==='Enter'){event.preventDefault();if(choices[active])choose(choices[active]);}
    if(event.key==='Tab')close();
  };
  return <div className="workspace-select">
    <button ref={buttonRef} type="button" className="workspace-select-trigger" disabled={disabled} aria-label={label || noneLabel} aria-haspopup="listbox" aria-expanded={open} aria-controls={open?id:undefined}
      onClick={()=>{if(open)close();else {setActive(Math.max(0,choices.findIndex(option=>option.id===value)));setOpen(true);}}}
      onKeyDown={event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setOpen(true);}}}>
      {selected?.color && <span className="workspace-option-dot" style={{background:selected.color}}/>}
      <span>{selected?.label || noneLabel}</span><ChevronDown size={15} style={{transform:open?'rotate(180deg)':undefined,color}}/>
    </button>
    {open && createPortal(<div ref={popupRef} tabIndex={-1} className="workspace-select-popup" style={{left:position.left,top:position.top,width:position.width,maxHeight:position.maxHeight,zIndex:position.zIndex}} onClick={event=>event.stopPropagation()} onKeyDown={keyDown}>
      {searchable&&<label className="workspace-select-search"><Search size={15}/><input role="combobox" aria-label={`Buscar ${label || noneLabel}`} aria-expanded="true" aria-controls={id} aria-activedescendant={`${id}-${active}`} value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar una opción…"/></label>}
      <div id={id} role="listbox" tabIndex={searchable?undefined:-1} aria-activedescendant={searchable?undefined:`${id}-${active}`} aria-label={label || noneLabel} className="workspace-select-options">
        {choices.map((option,index)=><button id={`${id}-${index}`} key={option.id} type="button" role="option" aria-selected={value===option.id} tabIndex={-1} data-active={index===active} onMouseEnter={()=>setActive(index)} onClick={()=>choose(option)}>
          {option.color && <span className="workspace-option-dot" style={{background:option.color}}/>}<span>{option.label}</span>{value===option.id && <Check size={14}/>}</button>)}
        {filtered.length===0 && <p className="workspace-select-empty">No hay opciones que coincidan.</p>}
      </div>
    </div>,document.body)}
  </div>;
}
