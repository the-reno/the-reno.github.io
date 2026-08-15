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

// Periodic Catmull-Rom (finite-difference tangents, non-uniform spacing).
// Unlike per-segment smoothstep, velocity stays continuous through every
// keyframe, so the motion flows instead of pulsing at each pose.
const UNIQUE_KEYFRAMES=LEG_KEYFRAMES.slice(0,-1);
function keyframeAt(index){
  const n=UNIQUE_KEYFRAMES.length;
  const wrapped=((index%n)+n)%n;
  const cycleOffset=Math.floor(index/n);
  const kf=UNIQUE_KEYFRAMES[wrapped];
  return{phase:kf.phase+cycleOffset,hip:kf.hip,knee:kf.knee,foot:kf.foot,lift:kf.lift,label:kf.label};
}
function interpolateLeg(phase){
  const value=wrapPhase(phase);
  const n=UNIQUE_KEYFRAMES.length;
  let seg=n-1;
  for(let index=0;index<n;index+=1){
    const next=keyframeAt(index+1);
    if(value>=UNIQUE_KEYFRAMES[index].phase&&value<next.phase){seg=index;break;}
  }
  const p0=keyframeAt(seg-1),p1=keyframeAt(seg),p2=keyframeAt(seg+1),p3=keyframeAt(seg+2);
  const t=(value-p1.phase)/(p2.phase-p1.phase);
  const t2=t*t,t3=t2*t;
  const h00=2*t3-3*t2+1,h10=t3-2*t2+t,h01=-2*t3+3*t2,h11=t3-t2;
  const span=p2.phase-p1.phase;
  const blend=key=>{
    const m1=((p2[key]-p1[key])/(p2.phase-p1.phase)+(p1[key]-p0[key])/(p1.phase-p0.phase))/2*span;
    const m2=((p3[key]-p2[key])/(p3.phase-p2.phase)+(p2[key]-p1[key])/(p2.phase-p1.phase))/2*span;
    return h00*p1[key]+h10*m1+h01*p2[key]+h11*m2;
  };
  return{hip:blend('hip')*DEG,knee:blend('knee')*DEG,foot:blend('foot')*DEG,lift:blend('lift'),label:t<.5?p1.label:p2.label};
}

export function gaitAngles(phase){
  const normalized=wrapPhase(phase);
  const rightLeg=interpolateLeg(normalized);
  const leftLeg=interpolateLeg(normalized+.5);
  const wave=Math.sin((normalized-.15)*Math.PI*2);
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
