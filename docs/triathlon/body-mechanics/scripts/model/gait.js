const DEG=Math.PI/180;

const LEG_KEYFRAMES=Object.freeze([
  {phase:0.00,hip:25,knee:20,foot:-6},
  {phase:0.15,hip:8,knee:32,foot:0},
  {phase:0.35,hip:-20,knee:42,foot:22},
  {phase:0.50,hip:-8,knee:88,foot:-12},
  {phase:0.70,hip:24,knee:65,foot:-4},
  {phase:0.88,hip:35,knee:28,foot:-8},
  {phase:1.00,hip:25,knee:20,foot:-6}
]);

function wrapPhase(value){return((value%1)+1)%1;}

function interpolateLeg(phase){
  const value=wrapPhase(phase);
  let start=LEG_KEYFRAMES[0];
  let end=LEG_KEYFRAMES[LEG_KEYFRAMES.length-1];
  for(let index=0;index<LEG_KEYFRAMES.length-1;index+=1){
    if(value>=LEG_KEYFRAMES[index].phase&&value<=LEG_KEYFRAMES[index+1].phase){
      start=LEG_KEYFRAMES[index];
      end=LEG_KEYFRAMES[index+1];
      break;
    }
  }
  const range=end.phase-start.phase||1;
  const ratio=(value-start.phase)/range;
  return{
    hip:(start.hip+(end.hip-start.hip)*ratio)*DEG,
    knee:(start.knee+(end.knee-start.knee)*ratio)*DEG,
    foot:(start.foot+(end.foot-start.foot)*ratio)*DEG
  };
}

export function gaitAngles(phase){
  const normalized=wrapPhase(phase);
  const rightLeg=interpolateLeg(normalized);
  const leftLeg=interpolateLeg(normalized+0.5);
  const armWave=Math.sin(normalized*Math.PI*2);
  return{
    phase:normalized,
    supportSide:normalized<0.5?'right':'left',
    torso:6*DEG,
    leftShoulder:(-32*armWave)*DEG,
    rightShoulder:(32*armWave)*DEG,
    leftElbow:(80+6*Math.cos(normalized*Math.PI*2))*DEG,
    rightElbow:(80-6*Math.cos(normalized*Math.PI*2))*DEG,
    leftHip:leftLeg.hip,
    rightHip:rightLeg.hip,
    leftKnee:leftLeg.knee,
    rightKnee:rightLeg.knee,
    leftFoot:leftLeg.foot,
    rightFoot:rightLeg.foot
  };
}

export function phaseRateFromCadence(cadence){return cadence/120;}
