const hex = (rgb: number[]) => '#' + rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
/** A bounded, one-shot palette. No image sampling runs during playback or scrolling. */
export function paletteFromPixels(pixels: Uint8ClampedArray, dark = true) {
    const bins = new Map<number, {
        count: number;
        sum: number[];
    }>();
    for (let i = 0; i < Math.min(pixels.length, 64 * 64 * 4); i += 4) {
        if (pixels[i + 3] < 128)
            continue;
        const rgb = [pixels[i], pixels[i + 1], pixels[i + 2]], max = Math.max(...rgb), min = Math.min(...rgb);
        if (max < 28 || min > 230 || max - min < 16)
            continue;
        const key = (rgb[0] >> 5) * 64 + (rgb[1] >> 5) * 8 + (rgb[2] >> 5), bin = bins.get(key) || { count: 0, sum: [0, 0, 0] };
        bin.count++;
        for (let n = 0; n < 3; n++)
            bin.sum[n] += rgb[n];
        bins.set(key, bin);
    }
    const dominant = [...bins.values()].sort((a, b) => b.count - a.count)[0], rgb = dominant ? dominant.sum.map(v => v / dominant.count) : [119, 143, 151], gray = rgb.reduce((a, b) => a + b) / 3, muted = rgb.map(v => gray + (v - gray) * .55);
    const accent = dark ? muted.map(v => v * .55 + 110) : muted.map(v => v * .42 + 23), surface = dark ? muted.map(v => v * .055 + 15) : muted.map(v => v * .025 + 239);
    return { accentColor: hex(accent), secondaryColor: hex(muted), surfaceColor: hex(surface), useThreeColors: true };
}
export async function paletteFromImage(src: string, dark = true) {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    let timer: ReturnType<typeof setTimeout>;
    await new Promise<void>((resolve, reject) => { timer = setTimeout(() => { image.src = ''; reject(Error('La imagen tardó demasiado.')); }, 8000); image.onload = () => { clearTimeout(timer); resolve(); }; image.onerror = () => { clearTimeout(timer); reject(Error('No se pudo leer el color de esta imagen.')); }; image.src = src; });
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context)
        throw Error('La lectura de color no está disponible.');
    context.drawImage(image, 0, 0, 64, 64);
    const pixels=context.getImageData(0,0,64,64).data,palette=paletteFromPixels(pixels,dark);
    let sumX=0,sumY=0,weight=0;for(let i=0;i<pixels.length;i+=16){const spread=Math.max(pixels[i],pixels[i+1],pixels[i+2])-Math.min(pixels[i],pixels[i+1],pixels[i+2]);sumX+=((i/4)%64)*spread;sumY+=Math.floor(i/256)*spread;weight+=spread;}
    const backdrop=document.createElement('canvas');backdrop.width=128;backdrop.height=128;const paint=backdrop.getContext('2d');if(paint){paint.filter='blur(8px)';paint.drawImage(image,-16,-16,160,160);}
    return {...palette,backdrop:paint?backdrop.toDataURL('image/webp',.7):undefined,position:(weight?Math.round(sumX/weight/64*100):50)+'% '+(weight?Math.round(sumY/weight/64*100):50)+'%'};
}
