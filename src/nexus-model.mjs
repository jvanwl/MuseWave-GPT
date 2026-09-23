const LABELS=["strategist","builder","repair","revenue","research"];
const TOKENS=1024;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hash=text=>{let h=2166136261;for(const c of text){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
const softmax=values=>{const max=Math.max(...values),exps=values.map(v=>Math.exp(v-max)),sum=exps.reduce((a,b)=>a+b,0);return exps.map(v=>v/sum)};

export class NexusModel{
  constructor(snapshot){this.version="nexus-intent-1";this.examples=0;this.weights=LABELS.map(()=>new Float64Array(TOKENS));this.bias=new Float64Array(LABELS.length);if(snapshot)this.restore(snapshot)}
  vectorize(text){const vector=new Float64Array(TOKENS),words=String(text).toLowerCase().normalize("NFKD").replace(/[^a-z0-9áéíóúñü]+/gi," ").trim().split(/\s+/).filter(Boolean);for(const word of words){vector[hash(word)%TOKENS]+=1;vector[hash(`pair:${word.slice(0,4)}`)%TOKENS]+=.35}const norm=Math.sqrt(vector.reduce((s,v)=>s+v*v,0))||1;return vector.map(v=>v/norm)}
  predict(text){const x=this.vectorize(text),scores=this.weights.map((w,i)=>w.reduce((s,v,j)=>s+v*x[j],this.bias[i])),probabilities=softmax(scores),index=probabilities.indexOf(Math.max(...probabilities));return{label:LABELS[index],confidence:probabilities[index],probabilities:Object.fromEntries(LABELS.map((label,i)=>[label,probabilities[i]])),version:this.version,examples:this.examples}}
  learn(text,label,{rate=.18}={}){const target=LABELS.indexOf(label);if(target<0)throw Error("Unknown learning label");const x=this.vectorize(text),prediction=this.predict(text),probabilities=LABELS.map(l=>prediction.probabilities[l]);for(let i=0;i<LABELS.length;i++){const error=(i===target?1:0)-probabilities[i];this.bias[i]=clamp(this.bias[i]+rate*error,-8,8);for(let j=0;j<TOKENS;j++)this.weights[i][j]=clamp(this.weights[i][j]+rate*error*x[j],-8,8)}this.examples++;return this.predict(text)}
  seed(){const examples={strategist:["create a strategy and objective","plan priorities and roadmap","decide goals milestones execution"],builder:["build an application and write code","create a system architecture","implement product feature software"],repair:["fix this bug and repair broken code","diagnose error failure","debug broken server crash"],revenue:["make money find customers pricing","revenue business monetization","sell subscription profit offer"],research:["investigate sources and evidence","research compare information","study facts verify sources"]};for(let epoch=0;epoch<30;epoch++)for(const [label,texts] of Object.entries(examples))for(const text of texts)this.learn(text,label,{rate:.14});return this}
  snapshot(){return{version:this.version,examples:this.examples,bias:[...this.bias],weights:this.weights.map(w=>[...w])}}
  restore(data){if(data?.version!==this.version||!Array.isArray(data.weights)||data.weights.length!==LABELS.length)return false;this.examples=Number(data.examples)||0;this.bias=Float64Array.from(data.bias||[]);this.weights=data.weights.map(w=>Float64Array.from(w));return true}
}

export const NEXUS_LABELS=LABELS;
