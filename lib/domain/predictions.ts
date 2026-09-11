export const predictionHorizons=["INTRADAY","SWING","ONE_YEAR","THREE_YEAR","FIVE_YEAR"] as const;
export const predictionScenarios=["BULL","BASE","BEAR"] as const;
export type PredictionHorizon=(typeof predictionHorizons)[number];
export type PredictionScenario=(typeof predictionScenarios)[number];

export type PredictionPointInput={scenario:PredictionScenario;pointAt:string;priceCents:string;lowerCents?:string|null;upperCents?:string|null};
export type PredictionInput={accountId?:string|null;symbol:string;horizon:PredictionHorizon;modelVersion:string;featureFingerprint:string;inputSnapshot:Record<string,unknown>;scenarios:Record<string,unknown>;confidence:number;evidenceAsOf:string;expiresAt:string;points:PredictionPointInput[]};

const positiveCents=(value:string|null|undefined,field:string,allowNull=false)=>{if(allowNull&&(value===null||value===undefined))return null;if(!/^\d+$/.test(String(value)))throw new Error(`${field} must be a non-negative integer-cent string`);return BigInt(String(value)).toString()};
export function validatePrediction(input:PredictionInput):PredictionInput{
 const symbol=String(input.symbol||"").trim().toUpperCase();
 if(!/^[A-Z0-9.-]{1,12}$/.test(symbol))throw new Error("A valid symbol is required");
 if(!predictionHorizons.includes(input.horizon))throw new Error("A valid prediction horizon is required");
 if(!String(input.modelVersion||"").trim()||!String(input.featureFingerprint||"").trim())throw new Error("Model version and feature fingerprint are required");
 if(!Number.isInteger(input.confidence)||input.confidence<0||input.confidence>100)throw new Error("Confidence must be an integer from 0 to 100");
 if(!Number.isFinite(Date.parse(input.evidenceAsOf))||!Number.isFinite(Date.parse(input.expiresAt))||Date.parse(input.expiresAt)<=Date.parse(input.evidenceAsOf))throw new Error("Prediction evidence and expiration timestamps are invalid");
 if(!input.points?.length)throw new Error("At least one scenario point is required");
 const points=input.points.map(point=>{if(!predictionScenarios.includes(point.scenario))throw new Error("Invalid prediction scenario");if(!Number.isFinite(Date.parse(point.pointAt)))throw new Error("Invalid prediction point timestamp");const priceCents=positiveCents(point.priceCents,"priceCents")!,lowerCents=positiveCents(point.lowerCents,"lowerCents",true),upperCents=positiveCents(point.upperCents,"upperCents",true);if(lowerCents!==null&&upperCents!==null&&(BigInt(lowerCents)>BigInt(priceCents)||BigInt(upperCents)<BigInt(priceCents)))throw new Error("Prediction interval must contain the scenario price");return{...point,priceCents,lowerCents,upperCents}});
 return{...input,symbol,modelVersion:input.modelVersion.trim(),featureFingerprint:input.featureFingerprint.trim(),points};
}

export function evaluatePrediction(input:{basePriceCents:string;lowerCents?:string|null;upperCents?:string|null;startingPriceCents:string;actualPriceCents:string}){
 const base=BigInt(input.basePriceCents),start=BigInt(input.startingPriceCents),actual=BigInt(input.actualPriceCents),lower=input.lowerCents==null?null:BigInt(input.lowerCents),upper=input.upperCents==null?null:BigInt(input.upperCents),direction=(value:bigint)=>value>0n?1:value<0n?-1:0,predictedDirection=direction(base-start),actualDirection=direction(actual-start),absoluteErrorBps=base===0n?null:Number((actual>base?actual-base:base-actual)*10000n/base);
 return{directionCorrect:predictedDirection===actualDirection,insideExpectedRange:lower!==null&&upper!==null?actual>=lower&&actual<=upper:null,absoluteErrorBps};
}
