import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../public/music-studio.html',import.meta.url),'utf8');
const data=html.slice(html.indexOf('  const provinceBlueprint='),html.indexOf('  // STRATEGY_ENGINE_START'));
const engine=html.split('// STRATEGY_ENGINE_START')[1].split('// STRATEGY_ENGINE_END')[0];
const make=new Function(data+engine+'return createStrategyEngine(provinceBlueprint,adjacency);');

test('complete studio script parses and all DOM IDs are unique',()=>{
  new vm.Script(html.split('<script type="module">')[1].split('</script>')[0]);
  const ids=[...html.split('<script')[0].matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length);
});
test('recruitment consumes treasury, food, population and action',()=>{
  const e=make(),s=e.fresh(),p=s.provinces.sunspire,before=p.population;
  assert.equal(e.action(s,'recruit').ok,true);
  assert.equal(s.nations.player.gold,145);assert.equal(s.nations.player.food,188);
  assert.equal(p.army,28);assert.equal(p.population,before-400);
  assert.equal(e.action(s,'recruit').ok,false);
});
test('unaffordable and foreign orders cannot mutate the game',()=>{
  const e=make(),s=e.fresh();s.nations.player.gold=0;const before=JSON.stringify(s);
  assert.equal(e.action(s,'fortify').ok,false);
  assert.equal(e.action(s,'recruit',{source:'redmarch'}).ok,false);
  assert.equal(JSON.stringify(s),before);
});
test('attack requires a shared border and declared war',()=>{
  const e=make(),s=e.fresh();
  assert.equal(e.action(s,'attack',{target:'heartland'}).ok,false);
  assert.equal(e.action(s,'war',{target:'heartland'}).ok,true);
  assert.equal(e.action(s,'attack',{target:'eastbay'}).ok,false);
  assert.equal(e.action(s,'attack',{target:'heartland'}).ok,true);
  assert.equal(e.action(s,'attack',{target:'heartland'}).ok,false);
});
test('peace establishes an enforced five-season truce',()=>{
  const e=make(),s=e.fresh();assert.equal(e.action(s,'peace',{target:'redmarch'}).ok,true);
  assert.equal(e.relation(s,'player','ember'),'paz');
  assert.equal(e.action(s,'war',{target:'redmarch'}).ok,false);
  s.turn+=5;assert.equal(e.action(s,'war',{target:'redmarch'}).ok,true);
});
test('mountains and fortifications improve defense; winter cuts production',()=>{
  const e=make(),s=e.fresh(),a=s.provinces.sunspire,d=s.provinces.heartland;
  const normal=e.forecast(s,a,d);d.terrain='montaña';d.fort=2;
  assert.ok(e.forecast(s,a,d).defend>normal.defend*2);
  const harvest=e.budget(s,'player').harvest;s.turn=4;
  assert.ok(e.budget(s,'player').harvest<harvest*.36);
  assert.ok(e.forecast(s,a,d).attack<normal.attack);
});
test('isolated provinces cannot recruit and suffer attrition',()=>{
  const e=make(),s=e.fresh();s.provinces.westhaven.owner='neutral';
  assert.equal(e.supply(s,'player').has('goldcoast'),false);
  assert.equal(e.action(s,'recruit',{source:'goldcoast'}).ok,false);
  const army=s.provinces.goldcoast.army;e.nextTurn(s);assert.ok(s.provinces.goldcoast.army<army);
});
test('troop transfers conserve troops and prevent relay moves',()=>{
  const e=make(),s=e.fresh(),total=()=>e.lands(s,'player').reduce((a,p)=>a+p.army,0),before=total();
  assert.equal(e.action(s,'move',{target:'westhaven'}).ok,true);
  assert.equal(total(),before);
  assert.equal(e.action(s,'move',{source:'westhaven',target:'goldcoast'}).ok,false);
});
test('high taxes worsen stability compared with low taxes',()=>{
  const e=make(),high=e.fresh(),low=e.fresh();
  e.action(high,'tax',{value:1.35});e.action(low,'tax',{value:.75});
  e.nextTurn(high);e.nextTurn(low);
  assert.ok(high.provinces.sunspire.stability<low.provinces.sunspire.stability);
});
test('save validation rejects corrupt data and restores deterministic state',()=>{
  const e=make(),s=e.fresh();e.nextTurn(s);
  assert.deepEqual(e.restore(JSON.parse(JSON.stringify(s))),s);
  assert.throws(()=>e.restore({version:3}));
  const bad=structuredClone(s);bad.provinces.sunspire.army='many';assert.throws(()=>e.restore(bad));
  const a=structuredClone(s),b=e.restore(s);e.nextTurn(a);e.nextTurn(b);assert.deepEqual(a,b);
});
test('one hundred seasons preserve resource and ownership invariants',()=>{
  const e=make(),s=e.fresh();
  for(let i=0;i<100;i++){
    e.nextTurn(s);
    for(const n of Object.values(s.nations)){assert.ok(Number.isFinite(n.gold)&&n.gold>=0);assert.ok(Number.isFinite(n.food)&&n.food>=0)}
    for(const p of Object.values(s.provinces)){assert.ok(p.army>=1);assert.ok(p.stability>=0&&p.stability<=100);assert.ok(Object.hasOwn(e.names,p.owner))}
  }
});

class Element {
  children=[];attributes={};value='';disabled=false;hidden=false;textContent='';
  classList={toggle(){},add(){},remove(){}};
  setAttribute(k,v){this.attributes[k]=v}
  append(...items){this.children.push(...items);if(!this.value&&items[0]?.value)this.value=items[0].value}
  replaceChildren(...items){this.children=[];this.value='';this.append(...items)}
  get options(){return this.children}
}
for(const storageMode of ['normal','blocked','corrupt'])test('game UI renders and responds with '+storageMode+' storage',()=>{
  const nodes=new Map([...html.split('<script')[0].matchAll(/\bid="([^"]+)"/g)].map(m=>['#'+m[1],new Element()]));
  let saved=storageMode==='corrupt'?'{broken':null;
  const context={document:{createElementNS:()=>new Element(),createElement:()=>new Element()},$:id=>{assert.ok(nodes.has(id),'unknown ID '+id);return nodes.get(id)},localStorage:{getItem(){if(storageMode==='blocked')throw Error('denied');return saved},setItem(k,v){if(storageMode==='blocked')throw Error('denied');saved=v}}};
  const ui=html.split('// STRATEGY_ENGINE_END')[1].split('  call("get_musewave_account").catch')[0];
  vm.runInNewContext(data+engine+ui,context);
  assert.equal(nodes.get('#g-gold').textContent,'180');
  nodes.get('#g-recruit').onclick();assert.equal(nodes.get('#g-gold').textContent,'145');
  nodes.get('#end-turn').onclick();assert.match(nodes.get('#game-turn').textContent,/Verano/);
  assert.equal(nodes.get('#world-map').children.filter(x=>x.attributes.role==='button').length,16);
  if(storageMode==='corrupt')assert.equal(saved,'{broken');
});
