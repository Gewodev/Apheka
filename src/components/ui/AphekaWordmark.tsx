import React from 'react';

export default function AphekaWordmark() {
  return <span className="apheka-lettermark" aria-label="POUH">{'POUH'.split('').map((letter,index)=><span key={index} aria-hidden="true">{letter}</span>)}</span>;
}
