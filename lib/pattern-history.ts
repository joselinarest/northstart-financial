import {detectPatternEvidence,type PatternBar,type PatternEvidence} from './pattern-evidence';

// Replay only the candles known at each point. Consecutive detections are one episode.
export function patternHistory(bars:PatternBar[],timeframe:string):PatternEvidence[]{
 const episodes:PatternEvidence[]=[],lastSeen=new Map<string,number>();
 for(let end=25;end<=bars.length;end++){
  for(const pattern of detectPatternEvidence(bars.slice(Math.max(0,end-160),end),{timeframe})){
   const key=pattern.name+':'+pattern.direction;
   if(lastSeen.get(key)!==end-1)episodes.push(pattern);
   lastSeen.set(key,end);
  }
 }
 return episodes;
}
