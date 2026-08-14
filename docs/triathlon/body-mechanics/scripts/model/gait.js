const DEG=Math.PI/180;

const LEG_KEYFRAMES=Object.freeze([
  // Values grounded in published running-gait kinematics (Physiopedia: Running Biomechanics):
  // hip 50° flexion at heel strike -> 10° hyperextension after toe-off -> 55° peak flexion in late swing;
  // knee 40° at heel strike -> 60° loading peak -> 125° peak flexion at mid-swing -> 40° for landing;
  // ankle ~10° dorsiflexion at strike -> ~25° dorsiflexion peak -> plantarflexes through stance ->
  // ~25° plantarflexion peak at toe-off -> back to ~10° dorsiflexion for landing.
  {phase:0.00,hip:50,knee:40,foot:-10,lift:0,label:'initial contact'},
  {phase:0.08,hip:42,knee:60,foot:-18,lift:2,label:'loading response'},
  {phase:0.30,hip:10,knee:22,foot:8,lift:4,label:'mid stance'},
  {phase:0.45,hip:-5,knee:8,foot:16,lift:1,label:'terminal stance'},
  {phase:0.52,hip:-10,knee:26,foot:22,lift:3,label:'toe off'},
  {phase:0.65,hip:16,knee:88,foot:2,lift:10,label:'initial swing'},
  {phase:0.78,hip:38,knee:125,foot:-14,lift:14,label:'mid swing'},
  {phase:0.90,hip:55,knee:40,foot:-10,lift:4,label:'terminal swing'},
  {phase:1.00,hip:50,knee:40,foot:-10,lift:0,label:'initial contact'}
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
  const supportSide=normalized<.5?'right':'left';
  const supportLeg=supportSide==='right'?rightLeg:leftLeg;
  return{
    phase:normalized,
    phaseName:supportLeg.label,
    supportSide,
    pelvisLift:Math.max(rightLeg.lift,leftLeg.lift)*.55,
    torso:(6+1.2*Math.sin(normalized*Math.PI*2-Math.PI/4))*DEG,
    leftShoulder:(-30*wave)*DEG,
    rightShoulder:(30*wave)*DEG,
    leftElbow:(95-22*wave)*DEG,
    rightElbow:(95+22*wave)*DEG,
    leftHip:leftLeg.hip,
    rightHip:rightLeg.hip,
    leftKnee:leftLeg.knee,
    rightKnee:rightLeg.knee,
    leftFoot:leftLeg.foot,
    rightFoot:rightLeg.foot
  };
}

export function phaseRateFromCadence(cadence){return cadence/120;}
