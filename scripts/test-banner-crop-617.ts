import assert from 'node:assert/strict';
import {bannerFrame,normalizeBannerCrop} from '../src/lib/bannerCrop.ts';
for(const [iw,ih]of [[1200,900],[1120,490],[500,1400],[2000,400]])for(const zoom of [1,1.5,3])for(const x of [-1,0,1])for(const y of [-1,0,1]){const crop={zoom,x,y},a=bannerFrame(560,245,iw,ih,crop),b=bannerFrame(1120,490,iw,ih,crop);assert.ok(a.left<=.001&&a.top<=.001);assert.ok(a.left+a.width>=559.999&&a.top+a.height>=244.999);assert.ok(Math.abs(a.left*2-b.left)<.00001&&Math.abs(a.top*2-b.top)<.00001);}
assert.deepEqual(normalizeBannerCrop({zoom:Infinity,x:99,y:NaN}),{zoom:1,x:1,y:0});console.log('PASS normalized banner geometry: responsive/export agreement, original and legacy ratios, zoom/edge clamping and no empty corners');
