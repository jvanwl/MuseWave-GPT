// Rebuild the self-contained widget: MCP embeds cannot fetch relative JS modules.
import { readFileSync, writeFileSync } from 'node:fs';
const root=new URL('../',import.meta.url);
const files=['src/history-data.mjs','src/earth-map.mjs','src/history-engine.mjs','src/history-ui.js'];
const code=files.map(path=>readFileSync(new URL(path,root),'utf8').replace(/^export /gm,'')).join('\n');
const target=new URL('public/music-studio.html',root),html=readFileSync(target,'utf8');
const from='  // HISTORY_BUNDLE_START',to='  // HISTORY_BUNDLE_END';
const start=html.indexOf(from),end=html.indexOf(to);
if(start<0||end<start)throw Error('History bundle markers missing');
const expected=html.slice(0,start)+from+'\n'+code+'\n'+html.slice(end);
if(process.argv.includes('--check')){if(expected!==html)throw Error('Run node scripts/build-history.mjs to update the history bundle');}
else writeFileSync(target,expected);
