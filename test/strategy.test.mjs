import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { HISTORY_CATALOG as catalog } from '../src/history-data.mjs';
import { EARTH_PATHS } from '../src/earth-map.mjs';
import { createHistoryEngine } from '../src/history-engine.mjs';
const engine=createHistoryEngine(catalog);
const html=()=>readFileSync(new URL('../public/music-studio.html',import.meta.url),'utf8');

test('history widget bundle is synchronized, parses and has unique IDs',()=>{
  execFileSync(process.execPath,[new URL('../scripts/build-history.mjs',import.meta.url).pathname,'--check']);
  const source=html();
  new vm.Script(source.split('<script type="module">')[1].split('</script>')[0]);
  const ids=[...source.split('<script')[0].matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length);
});
test('Earth geometry is bundled locally and scenarios cover ten starting dates',()=>{
  assert.equal(catalog.scenarios.length,10);assert.equal(catalog.regions.length,44);
  assert.ok(EARTH_PATHS.length>100);assert.ok(EARTH_PATHS.every(p=>p.startsWith('M')&&p.endsWith('Z')));
  assert.equal(catalog.scenarios[0].year,-10000);assert.equal(catalog.scenarios.at(-1).year,2000);
});
for(const scenario of catalog.scenarios)test('all factions in '+scenario.name+' start, advance, save and restore',()=>{
  const seen=new Set();
  for(const [id,,government,owned] of scenario.factions){
    assert.ok(government);
    for(const region of owned){assert.ok(!seen.has(region),'duplicate ownership');seen.add(region);}
    const s=engine.fresh(scenario.id,id);
    assert.equal(s.player,id);assert.equal(s.regions[s.source].owner,id);
    assert.equal(engine.eraAt(s.year),scenario.era);
    engine.nextTurn(s);
    assert.deepEqual(engine.restore(JSON.parse(JSON.stringify(s))),s);
  }
});
test('recruitment consumes people, provisions, treasury and mobilization',()=>{
  const s=engine.fresh('early'),p=s.regions[s.source],population=p.people;
  assert.equal(engine.action(s,'recruit').ok,true);
  assert.equal(s.nations[s.player].gold,185);assert.equal(s.nations[s.player].food,238);
  assert.equal(p.people,population-200);assert.equal(p.army,20);
  assert.equal(engine.action(s,'recruit').ok,false);
});
test('unaffordable and foreign orders leave state unchanged',()=>{
  const s=engine.fresh('early');s.nations[s.player].gold=0;const before=JSON.stringify(s);
  assert.equal(engine.action(s,'fortify').ok,false);
  assert.equal(engine.action(s,'recruit',{source:'france'}).ok,false);
  assert.equal(JSON.stringify(s),before);
});
test('economic extraction, repairs and diplomatic communication have bounded effects',()=>{
  const s=engine.fresh('classical','persian'),p=s.regions[s.source],gold=s.nations[s.player].gold,stability=p.stability;
  assert.equal(engine.action(s,'mine').ok,true);assert.ok(s.nations[s.player].gold>gold);assert.ok(p.stability<stability);
  p.acted=false;p.fort=0;assert.equal(engine.action(s,'repair').ok,true);assert.equal(p.fort,1);
  const foreign=engine.routes(s,p.id,s.player).map(x=>s.regions[x.id]).find(x=>x.owner!==s.player);assert.ok(foreign);s.target=foreign.id;
  const weariness=s.nations[s.player].weariness=20;assert.equal(engine.action(s,'envoy').ok,true);assert.ok(s.nations[s.player].weariness<weariness);
});
test('attacks require declaration, route and uncommitted forces',()=>{
  const s=engine.fresh('early');
  assert.equal(engine.action(s,'attack',{target:'levant'}).ok,false);
  assert.equal(engine.action(s,'war',{target:'levant'}).ok,true);
  assert.equal(engine.action(s,'attack',{target:'japan'}).ok,false);
  assert.equal(engine.action(s,'attack',{target:'levant'}).ok,true);
  assert.equal(engine.action(s,'attack',{target:'levant'}).ok,false);
});
test('peace enforces a five-turn truce; trade gives income and war cancels it',()=>{
  const s=engine.fresh('early');
  engine.action(s,'war',{target:'levant'});
  assert.equal(engine.action(s,'peace',{target:'levant'}).ok,true);
  assert.equal(engine.action(s,'war',{target:'levant'}).ok,false);
  const income=engine.budget(s,s.player).income;
  assert.equal(engine.action(s,'trade',{target:'levant'}).ok,true);
  assert.equal(engine.budget(s,s.player).income,income+8);
  s.turn+=5;assert.equal(engine.action(s,'war',{target:'levant'}).ok,true);
  assert.equal(engine.budget(s,s.player).income,income);
});
test('supply breaks across hostile centers and isolated armies suffer attrition',()=>{
  const s=engine.fresh('classical','persian');
  s.regions.mesopotamia.owner='local_mesopotamia';
  s.regions.indus.owner='local_indus';
  const p=s.regions.nile,old=p.army;
  assert.equal(engine.supply(s,s.player).has('nile'),false);
  assert.equal(engine.action(s,'recruit',{source:'nile'}).ok,false);
  engine.nextTurn(s);assert.ok(p.army<old);
});
test('mountains, fortifications and technology influence combat',()=>{
  const s=engine.fresh('early'),a=s.regions.anatolia,d=s.regions.levant;
  const normal=engine.forecast(s,a,d);d.terrain='hill';d.fort=3;
  assert.ok(engine.forecast(s,a,d).defend>normal.defend);
  s.nations[s.player].tech=4;
  assert.ok(engine.forecast(s,a,d).attack>normal.attack);
});
test('transfers conserve forces and cannot relay within the same turn',()=>{
  const s=engine.fresh('classical','persian'),total=()=>engine.lands(s,s.player).reduce((v,p)=>v+p.army,0),before=total();
  assert.equal(engine.action(s,'move',{source:'persia',target:'mesopotamia'}).ok,true);
  assert.equal(total(),before);
  assert.equal(engine.action(s,'move',{source:'mesopotamia',target:'levant'}).ok,false);
});
test('higher taxes worsen stability',()=>{
  const high=engine.fresh('early'),low=engine.fresh('early');
  engine.action(high,'tax',{value:1.35});engine.action(low,'tax',{value:.75});
  engine.nextTurn(high);engine.nextTurn(low);
  assert.ok(high.regions.anatolia.stability<low.regions.anatolia.stability);
});
test('ocean routes and research are unavailable before their era',()=>{
  const s=engine.fresh('early','castile');
  assert.equal(engine.action(s,'trade',{target:'caribbean'}).ok,false);
  assert.equal(engine.action(s,'war',{target:'caribbean'}).ok,false);
  assert.equal(engine.routes(s,'iberia',s.player).some(x=>x.id==='caribbean'),false);
  assert.equal(engine.action(s,'research').ok,false);
  engine.nextTurn(s);assert.equal(s.year,1450);
  const n=s.nations[s.player];n.science=100;
  assert.equal(engine.action(s,'research').ok,true);assert.equal(n.tech,4);
  assert.equal(engine.routes(s,'iberia',s.player).some(x=>x.id==='caribbean'),true);
  assert.equal(engine.action(s,'trade',{target:'caribbean'}).ok,true);
});
test('continuous calendar crosses every era without year zero or ownership reset',()=>{
  let year=-10000,count=0;const seen=new Set();
  while(year<2025&&count<1000){seen.add(engine.eraAt(year));const next=engine.advanceYear(year);assert.ok(next>year);assert.notEqual(next,0);year=next;count++;}
  assert.equal(year,2025);assert.equal(seen.size,10);
  assert.equal(engine.date(-1),'1 BCE');assert.equal(engine.date(1),'1 CE');
  const s=engine.fresh('early');engine.nextTurn(s);
  assert.equal(s.year,1450);assert.equal(s.regions.anatolia.owner,'ottoman');
  assert.equal(s.nations.ottoman.name,'Ottoman Empire');
});
test('saves reject corruption, anachronistic tech and older schemas',()=>{
  assert.throws(()=>engine.restore({version:3}));
  const s=engine.fresh('origins');s.nations[s.player].tech=9;assert.throws(()=>engine.restore(s));
  const bad=engine.fresh('early');bad.regions.anatolia.army='many';assert.throws(()=>engine.restore(bad));
  const a=engine.fresh('classical'),b=engine.restore(a);engine.nextTurn(a);engine.nextTurn(b);assert.deepEqual(a,b);
});
test('long simulations preserve bounded resources and valid ownership',()=>{
  for(const scenario of catalog.scenarios){
    const s=engine.fresh(scenario.id);
    for(let i=0;i<100&&!s.over;i++){
      engine.nextTurn(s);
      for(const n of Object.values(s.nations)){assert.ok(Number.isFinite(n.gold)&&n.gold>=0);assert.ok(Number.isFinite(n.food)&&n.food>=0);assert.ok(n.tech<=engine.eraAt(s.year));}
      for(const p of Object.values(s.regions)){assert.ok(p.army>=1);assert.ok(p.stability>=0&&p.stability<=100);assert.ok(Object.hasOwn(s.nations,p.owner));}
    }
  }
});
test('terminal saves retain completed status and cannot issue orders',()=>{
  const s=engine.fresh('contemporary');s.year=2024;engine.nextTurn(s);
  assert.equal(s.over,true);const restored=engine.restore(s);assert.equal(restored.over,true);
  assert.equal(engine.action(restored,'develop').ok,false);
});
class Element {
  children=[];attributes={};style={};value='';disabled=false;hidden=false;textContent='';
  classList={toggle(){},add(){},remove(){}};
  setAttribute(k,v){this.attributes[k]=v}
  after(){}
  scrollIntoView(){}
  append(...items){this.children.push(...items);if(!this.value&&items[0]?.value)this.value=items[0].value}
  replaceChildren(...items){this.children=[];this.value='';this.append(...items)}
  get options(){return this.children}
  get selectedOptions(){return this.children.filter(c=>c.value===this.value)}
}
for(const mode of ['normal','blocked','corrupt'])test('UI is usable with '+mode+' storage and confirms scenario replacement',()=>{
  const nodes=new Map([...html().split('<script')[0].matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element()]));
  const saves=new Map([['musewave-dominion-v3','legacy campaign'],['musewave-human-history-v4',mode==='corrupt'?'{broken':null]]);
  const context={HISTORY_CATALOG:catalog,EARTH_PATHS,createHistoryEngine,
    document:{getElementById:id=>{assert.ok(nodes.has(id),'Missing element '+id);return nodes.get(id)},createElementNS:()=>new Element(),createElement:()=>new Element(),createTextNode:text=>({textContent:text})},
    localStorage:{getItem(k){if(mode==='blocked')throw Error('denied');return saves.get(k)},setItem(k,v){if(mode==='blocked')throw Error('denied');saves.set(k,v)}}};
  vm.runInNewContext(readFileSync(new URL('../src/history-ui.js',import.meta.url),'utf8'),context);
  assert.equal(nodes.get('history-date').textContent,'1444 CE');
  const beforePreview=saves.get('musewave-human-history-v4');
  assert.equal(nodes.get('history-territories').children.length,1);
  assert.ok(nodes.get('history-world-ranking').children.length>=2);
  assert.match(nodes.get('history-world-pulse').textContent,/your rank #/);
  assert.equal(nodes.get('history-roadmap').children.length,10);
  nodes.get('history-region-select').onchange({target:{value:catalog.regions.find(p=>p[1]==='North China')[0]}});
  assert.equal(nodes.get('history-recruit').disabled,true,'Foreign inspection must not recruit at a hidden friendly source');
  nodes.get('history-select-source').onclick();
  assert.equal(nodes.get('history-recruit').disabled,false);
  if(mode==='normal')assert.equal(JSON.parse(saves.get('musewave-human-history-v4')).nations.ottoman.gold,JSON.parse(beforePreview).nations.ottoman.gold,'Action previews must not spend resources');
  nodes.get('history-recruit').onclick();assert.equal(nodes.get('history-treasury').textContent,'185');
  nodes.get('history-end-turn').onclick();assert.equal(nodes.get('history-date').textContent,'1450 CE');
  nodes.get('history-scenario').value='origins';nodes.get('history-scenario').onchange();
  assert.equal(nodes.get('history-date').textContent,'1450 CE');
  nodes.get('history-start').onclick();assert.equal(nodes.get('history-confirm-box').hidden,false);
  nodes.get('history-cancel').onclick();assert.equal(nodes.get('history-date').textContent,'1450 CE');
  nodes.get('history-start').onclick();nodes.get('history-confirm').onclick();assert.equal(nodes.get('history-date').textContent,'10000 BCE');
  assert.equal(saves.get('musewave-dominion-v3'),'legacy campaign');
});
