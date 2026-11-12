import assert from 'node:assert/strict';
import {paletteFromPixels} from '../src/lib/imagePalette.ts';
const pixels=new Uint8ClampedArray(64*64*4);for(let i=0;i<pixels.length;i+=4){pixels.set([30,130,170,255],i);}
const dark=paletteFromPixels(pixels),light=paletteFromPixels(pixels,false),empty=paletteFromPixels(new Uint8ClampedArray(0));
for(const color of [dark,light,empty]){for(const field of ['accentColor','surfaceColor','secondaryColor'] as const)assert.match(color[field],/^#[a-f0-9]{6}$/);assert.equal(color.useThreeColors,true);}
assert.notEqual(dark.surfaceColor,light.surfaceColor);assert.equal(dark.accentColor,paletteFromPixels(pixels).accentColor);
const appended=new Uint8ClampedArray(pixels.length*2);appended.set(pixels);appended.fill(255,pixels.length);assert.deepEqual(paletteFromPixels(appended),dark,'sampling stays bounded');
console.log('PASS one-shot bounded image palette, light/dark variants, empty/transparent fallback');
