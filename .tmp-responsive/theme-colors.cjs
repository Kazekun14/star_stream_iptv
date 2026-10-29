// Migrate existing declarations to semantic tokens with their original dark values as fallbacks.
const fs = require('fs'), path = require('path');
const postcss = require('../admin-ui/node_modules/postcss');
const token = (name, original) => `var(--theme-${name}, ${original})`;
function rgb(value) {
  if (value.startsWith('#')) {
    let s = value.slice(1); if (s.length < 5) s = [...s].map(c => c+c).join('');
    return [parseInt(s.slice(0,2),16),parseInt(s.slice(2,4),16),parseInt(s.slice(4,6),16),s.length === 8 ? parseInt(s.slice(6),16)/255 : 1];
  }
  const n = value.match(/[\d.]+/g).map(Number); return [n[0],n[1],n[2],n[3] ?? 1];
}
function convert(d, value) {
  const [r,g,b,a] = rgb(value), max = Math.max(r,g,b), min = Math.min(r,g,b);
  const prop = d.prop, selector = d.parent.selector || '';
  const text = ['color','fill','--text','--muted','--accent','--danger','--ok','--warn','--ap-blue','--ap-yellow'].includes(prop);
  const border = /^(border|outline)/.test(prop) || prop === 'stroke' || prop === '--border';
  const surface = /^(background)/.test(prop) || ['--bg','--panel','--panel2'].includes(prop);
  if (text) {
    if (/confirm-btn\.is-danger/.test(selector)) return value;
    if (max < 100) return value; // Dark text on solid action buttons stays dark.
    if (r > 220 && g > 100 && g < 215 && b < 160) return token('accent-ink',value);
    if (r > 220 && b > g + 10) return token('danger-ink',value);
    if (g > r + 20 && g > b) return token('success-ink',value);
    if (r > 230 && g > 170 && b < 160) return token('warning-ink',value);
    if (prop === '--ap-blue' || prop === '--accent') return token('info-ink',value);
    return token(a < .85 || max < 190 ? 'text-muted' : max < 230 ? 'text-secondary' : 'text-primary',value);
  }
  if (border && max-min < 100) return token('border',value);
  if (surface) {
    if (/overlay|backdrop/i.test(selector)) return value;
    if (max < 100 && (b >= r || max-min < 20)) return token(max < 34 ? 'canvas' : max < 50 ? 'surface' : 'surface-raised',value);
    if (min > 230 && a < .3) return token('surface-tint',value);
  }
  return value;
}
function walk(dir) {
  for (const f of fs.readdirSync(dir,{withFileTypes:true})) {
    const file=path.join(dir,f.name);
    if(f.isDirectory()) walk(file);
    else if(file.endsWith('.css') && !file.endsWith('theme.css')) {
      const css=postcss.parse(fs.readFileSync(file,'utf8'));
      css.walkDecls(d=>{
        if(d.prop === 'color-scheme') { d.value='var(--theme-color-scheme, dark)'; return; }
        d.value=d.value.replace(/#[\da-f]{3,8}\b|rgba?\([\d\s.,]+\)/gi,v=>convert(d,v));
      });
      fs.writeFileSync(file,css.toString());
    }
  }
}
walk('admin-ui/src');
