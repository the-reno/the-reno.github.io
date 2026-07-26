const DEG=Math.PI/180;
const AMPLITUDES=Object.freeze({small:28,average:38,large:48});
const TIMING_OFFSETS=Object.freeze({early:-.04,synchronized:0,late:.04});
const ELBOW_PROFILES=Object.freeze({
  compact:{neutral:88,extreme:72},
  neutral:{neutral:100,extreme:82},
  open:{neutral:112,extreme:96}
});

export function wrapPhase(value){return((value%1)+1)%1;}

export function armAngles(phase,{amplitudeProfile='average',elbowProfile='neutral',timing='synchronized'}={}){
  const adjusted=wrapPhase(phase+TIMING_OFFSETS[timing]);
  const swing=value=>{const angle=value*Math.PI*2;return(-Math.cos(angle)+.08*Math.sin(angle*2))/1.08;};
  const rightNorm=swing(adjusted);
  const leftNorm=swing(wrapPhase(adjusted+.5));
  const amplitude=AMPLITUDES[amplitudeProfile]*DEG;
  const elbow=ELBOW_PROFILES[elbowProfile];
  const elbowAngle=norm=>{const factor=(1-Math.exp(-3*norm*norm))/(1-Math.exp(-3));return(elbow.neutral-(elbow.neutral-elbow.extreme)*factor)*DEG;};
  return{
    left:{shoulder:leftNorm*amplitude,elbow:elbowAngle(leftNorm),norm:leftNorm},
    right:{shoulder:rightNorm*amplitude,elbow:elbowAngle(rightNorm),norm:rightNorm}
  };
}

export function legAngles(phase){
  const leg=value=>{const angle=wrapPhase(value)*Math.PI*2;return{
    hip:(4+25*Math.cos(angle)-12*Math.sin(angle)+5*Math.sin(angle*2))*DEG,
    knee:(54-34*Math.cos(angle)+8*Math.sin(angle*2))*DEG
  };};
  return{right:leg(phase),left:leg(phase+.5)};
}

export function strideDurationSeconds(cadence){return 120/Number(cadence);}
export function stridePhaseName(phase){
  const value=wrapPhase(phase);
  if(value<.12)return'Initial contact';if(value<.25)return'Loading';if(value<.40)return'Mid stance';
  if(value<.52)return'Toe-off';if(value<.66)return'Early swing';if(value<.80)return'Mid swing';
  if(value<.94)return'Late swing';return'Initial contact';
}
