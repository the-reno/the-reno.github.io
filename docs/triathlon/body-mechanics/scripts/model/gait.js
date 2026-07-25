const DEG=Math.PI/180;

const LEG_KEYFRAMES=Object.freeze([
  {phase:0.00,hip:22,knee:18,foot:-4,lift:0,label:'initial contact'},
  {phase:0.12,hip:10,knee:34,foot:2,lift:2,label:'loading'},
  {phase:0.25,hip:-8,knee:28,foot:8,lift:5,label:'mid stance'},
  {phase:0.40,hip:-24,knee:42,foot:18,lift:3,label:'toe off'},
  {phase:0.55,hip:-12,knee:92,foot:-12,lift:8,label:'early swing'},
  {phase:0.70,hip:18,knee:68,foot:-8,lift:11,label:'mid swing'},
  {phase:0.86,hip:32,knee:34,foot:-6,lift:5,label:'late swing'},
  {phase:1.00,hip:22,knee:18,foot:-4,lift:0,label:'initial contact'}
]);

function wrapPhase(value){return((value%1)+1)%1;}
function smooth(value){return value*value*(3-2*value);}

function interpolateLeg(phase){
  const value=wrapPhase(phase);
  let start=LEG_KEYFRAMES[0];
  let end=LEG_KEYFRAMES.at(-1);
  for(let index=0;index<LEG_KEYFRAMES.length-1;index+=1){
    if(value>=LEG_KEYFRAMES[index].phase&&value<=LEG_KEYFRAMES[index+1].phase){start=LEG_KEYFRAMES[index];end=LEG_KEYFRAMES[index+1];break;}
  }
  const ratio=smooth((value-start.phase)/(end.phase-start.phase||1));
  const blend=key=>start[key]+(end[key]-start[key])*ratio;
  return{hip:blend('hip')*DEG,knee:blend('knee')*DEG,foot:blend('foot')*DEG,lift:blend('lift'),label:ratio<.5?start.label:end.label};
}

export function gaitAngles(phase){
  const normalized=wrapPhase(phase);
  const rightLeg=interpolateLeg(normalized);
  const leftLeg=interpolateLeg(normalized+.5);
  const wave=Math.sin(normalized*Math.PI*2);
  const doubleWave=Math.sin(normalized*Math.PI*4);
  const supportSide=normalized<.5?'right':'left';
  const supportLeg=supportSide==='right'?rightLeg:leftLeg;
  return{
    phase:normalized,
    phaseName:supportLeg.label,
    supportSide,
    pelvisLift:3+2.5*doubleWave,
    torso:(6+1.2*Math.sin(normalized*Math.PI*2-Math.PI/4))*DEG,
    leftShoulder:(-30*wave)*DEG,
    rightShoulder:(30*wave)*DEG,
    leftElbow:(82+7*Math.cos(normalized*Math.PI*2))*DEG,
    rightElbow:(82-7*Math.cos(normalized*Math.PI*2))*DEG,
    leftHip:leftLeg.hip,
    rightHip:rightLeg.hip,
    leftKnee:leftLeg.knee,
    rightKnee:rightLeg.knee,
    leftFoot:leftLeg.foot,
    rightFoot:rightLeg.foot
  };
}

export function phaseRateFromCadence(cadence){return cadence/120;}
