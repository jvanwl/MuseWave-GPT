export const NEXUS_OFFERS=Object.freeze([
  {id:"solo",name:"NEXUS Solo",price:19,features:["Local LLM workspace","Research memory","20 monthly projects"]},
  {id:"builder",name:"NEXUS Builder",price:49,features:["Code improvement lab","100 monthly projects","Priority model routing"]},
  {id:"business",name:"NEXUS Business",price:149,features:["Team workspace","Audit exports","Commercial automation API"]},
]);
export function revenueStatus(){return{currency:"USD",billingEnabled:Boolean(process.env.NEXUS_CHECKOUT_BASE_URL),offers:NEXUS_OFFERS,principles:["Revenue must come from a disclosed customer offer","No guaranteed returns","No spending or checkout without owner/customer confirmation"]}}
export function checkoutForNexus(planId){const offer=NEXUS_OFFERS.find(x=>x.id===planId);if(!offer)throw Error("Unknown NEXUS offer");const base=process.env.NEXUS_CHECKOUT_BASE_URL;if(!base)throw Error("NEXUS billing is not configured");const url=new URL(base);url.searchParams.set("plan",offer.id);return{enabled:true,url:url.toString(),offer}}
export function evaluateRevenueExperiment({visitors,signups,customers,revenue,cost}){for(const value of [visitors,signups,customers,revenue,cost])if(!Number.isFinite(value)||value<0)throw Error("Revenue metrics must be non-negative numbers");return{conversionRate:visitors?customers/visitors:0,signupRate:visitors?signups/visitors:0,averageRevenuePerCustomer:customers?revenue/customers:0,profit:revenue-cost,validated:customers>=3&&revenue>cost}}
