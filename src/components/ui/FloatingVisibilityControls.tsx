import { FLOATING_FONTS } from '../../lib/floatingFonts';
import { DigitSVG, ColonSVG } from '../LEDDigits';
import React from 'react';
import { BookOpen, Circle, Leaf, Sprout, Star, Waves } from 'lucide-react';
import { ANIMATIONS } from '../FloatingAnimations';
const icons={plant:Sprout,books:BookOpen,stars:Star,waves:Waves,leaves:Leaf,breathing:Circle};
export default function FloatingVisibilityControls({hidden,animation,color,font,onChange}: {hidden:boolean;animation:string;color:string;font:string;onChange:(patch:{floatingHideInFocus?:boolean;floatingAnimationType?:string})=>void}) {
 const selected=ANIMATIONS[animation] ? animation : 'plant';const Preview=ANIMATIONS[selected].component;
 return <section className="floating-visibility-controls">
  <label className="floating-visibility-toggle"><span><strong>Discreción durante el enfoque</strong><small>Sustituye el reloj por una animación mientras estudias.</small></span><input type="checkbox" aria-label="Ocultar tiempo durante el enfoque" checked={hidden} onChange={event=>onChange({floatingHideInFocus:event.target.checked})}/></label>
  <div className="floating-preview" aria-label="Vista previa del flotante"><div>{hidden ? <Preview color={color}/> : font==='led' ? <span className="floating-preview-led">{'25:00'.split('').map((character,index)=>character===':' ? <ColonSVG key={index} color={color} width={6} height={30}/> : <DigitSVG key={index} d={character} color={color} width={18} height={30}/>)}</span> : <span className="floating-preview-time" style={{fontFamily:FLOATING_FONTS[font]?.family || FLOATING_FONTS.inter.family,color}}>25:00</span>}</div><p>{hidden ? ANIMATIONS[selected].label : 'Reloj visible'}<small>Vista previa del enfoque en curso</small></p></div>
  <div className="floating-animation-options" aria-label="Animaciones del modo discreto">{Object.entries(ANIMATIONS).map(([key,item])=>{const Icon=icons[key as keyof typeof icons];return <button type="button" key={key} aria-label={`Animación: ${item.label}`} aria-pressed={selected===key} onClick={()=>onChange({floatingAnimationType:key})}><Icon size={17}/><span>{item.label}</span></button>;})}</div>
 </section>;
}
