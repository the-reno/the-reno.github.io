import{armAngles,legAngles,strideDurationSeconds,wrapPhase}from'./arm-gait.js';

const EPS=.0008;
const GRAVITY=9.80665;
const LEG_MASS_PERCENT=.32;
const THIGH_MASS_FRACTION=.68;
const LEG_LENGTH_RATIO=.53;
const THIGH_LENGTH_FRACTION=.46;
const SHOULDER_WIDTH_RATIO=.23;
const HIP_WIDTH_RATIO=.16;

function point(length,angle){return{x:length*Math.sin(angle),y:length*Math.cos(angle)};}
function add(a,b){return{x:a.x+b.x,y:a.y+b.y};}
function midpoint(a,b){return{x:(a.x+b.x)/2,y:(a.y+b.y)/2};}
function scale(a,k){return{x:a.x*k,y:a.y*k};}
function subtract(a,b){return{x:a.x-b.x,y:a.y-b.y};}
function cross2(a,b){return a.x*b.y-a.y*b.x;}
function angleDelta(a,b){return Math.atan2(Math.sin(a-b),Math.cos(a-b));}
function rms(values){return Math.sqrt(values.reduce((sum,value)=>sum+value*value,0)/(values.length||1));}
function clamp(value,min,max){return Math.min(max,Math.max(min,value));}

function armGeometry(model,angles){
  const shoulder={x:0,y:0};
  const elbow=point(model.upperArmLengthM,angles.shoulder);
  const bendMagnitude=Math.PI-angles.elbow;
  const bend=-bendMagnitude*Math.tanh(angles.norm/.42);
  const forearmAngle=angles.shoulder+bend;
  const hand=add(elbow,point(model.forearmHandLengthM,forearmAngle));
  return{shoulder,elbow,hand,upperCom:midpoint(shoulder,elbow),forearmCom:midpoint(elbow,hand),upperAngle:angles.shoulder,forearmAngle};
}

function legGeometry(model,angles){
  const hip={x:0,y:0};
  const totalLength=model.heightM*LEG_LENGTH_RATIO;
  const thighLength=totalLength*THIGH_LENGTH_FRACTION;
  const shankLength=totalLength-thighLength;
  const knee=point(thighLength,angles.hip);
  const shankAngle=angles.hip-angles.knee;
  const ankle=add(knee,point(shankLength,shankAngle));
  return{hip,knee,ankle,thighCom:midpoint(hip,knee),shankCom:midpoint(knee,ankle),thighAngle:angles.hip,shankAngle,thighLength,shankLength};
}

function derivative(before,after,cycleDuration){
  const dt=2*EPS*cycleDuration;
  return{
    upperVelocity:scale(subtract(after.upperCom,before.upperCom),1/dt),
    forearmVelocity:scale(subtract(after.forearmCom,before.forearmCom),1/dt),
    upperOmega:angleDelta(after.upperAngle,before.upperAngle)/dt,
    forearmOmega:angleDelta(after.forearmAngle,before.forearmAngle)/dt
  };
}

function armState(model,side,phase,profile,cadence){
  const cycleDuration=strideDurationSeconds(cadence);
  const currentAngles=armAngles(phase,profile)[side];
  const before=armGeometry(model,armAngles(wrapPhase(phase-EPS),profile)[side]);
  const current=armGeometry(model,currentAngles);
  const after=armGeometry(model,armAngles(wrapPhase(phase+EPS),profile)[side]);
  const motion=derivative(before,after,cycleDuration);
  const upperI=model.upperArmMassKg*model.upperArmLengthM**2/12;
  const forearmI=model.forearmHandMassKg*model.forearmHandLengthM**2/12;
  const sagittalH=upperI*motion.upperOmega+model.upperArmMassKg*cross2(current.upperCom,motion.upperVelocity)+forearmI*motion.forearmOmega+model.forearmHandMassKg*cross2(current.forearmCom,motion.forearmVelocity);
  const lateral=(side==='left'?-1:1)*model.heightM*SHOULDER_WIDTH_RATIO/2;
  const forwardMomentum=model.upperArmMassKg*motion.upperVelocity.x+model.forearmHandMassKg*motion.forearmVelocity.x;
  const yawH=lateral*forwardMomentum;
  const gravityTorque=-(model.upperArmMassKg*GRAVITY*current.upperCom.x+model.forearmHandMassKg*GRAVITY*current.forearmCom.x);
  return{...current,...motion,sagittalH,yawH,gravityTorque,shoulderAngle:currentAngles.shoulder,elbowAngle:currentAngles.elbow,norm:currentAngles.norm};
}

function legYawState(model,side,phase,cadence){
  const cycleDuration=strideDurationSeconds(cadence);const dt=2*EPS*cycleDuration;
  const oneLegMass=model.bodyMassKg*LEG_MASS_PERCENT/2;
  const thighMass=oneLegMass*THIGH_MASS_FRACTION;const shankMass=oneLegMass-thighMass;
  const before=legGeometry(model,legAngles(wrapPhase(phase-EPS))[side]);
  const after=legGeometry(model,legAngles(wrapPhase(phase+EPS))[side]);
  const thighVelocity=scale(subtract(after.thighCom,before.thighCom),1/dt);
  const shankVelocity=scale(subtract(after.shankCom,before.shankCom),1/dt);
  const lateral=(side==='left'?-1:1)*model.heightM*HIP_WIDTH_RATIO/2;
  return lateral*(thighMass*thighVelocity.x+shankMass*shankVelocity.x);
}

export function frameState(model,phase,profile,cadence){
  const left=armState(model,'left',phase,profile,cadence);const right=armState(model,'right',phase,profile,cadence);
  const legH=legYawState(model,'left',phase,cadence)+legYawState(model,'right',phase,cadence);
  const armH=left.yawH+right.yawH;
  return{left,right,armH,legH,residualH:armH+legH};
}

function shoulderTorque(model,side,phase,profile,cadence){
  const cycleDuration=strideDurationSeconds(cadence);const dt=2*EPS*cycleDuration;
  const before=armState(model,side,wrapPhase(phase-EPS),profile,cadence).sagittalH;
  const current=armState(model,side,phase,profile,cadence);
  const after=armState(model,side,wrapPhase(phase+EPS),profile,cadence).sagittalH;
  return(after-before)/dt+current.gravityTorque;
}

export function analyzeProfile(model,profile,cadence,samples=240){
  const armH=[],legH=[],residualH=[],leftH=[],rightH=[],leftTorque=[],rightTorque=[],leftOmega=[],rightOmega=[];
  const dt=strideDurationSeconds(cadence)/samples;
  for(let index=0;index<samples;index+=1){
    const phase=index/samples;const state=frameState(model,phase,profile,cadence);
    armH.push(state.armH);legH.push(state.legH);residualH.push(state.residualH);leftH.push(state.left.yawH);rightH.push(state.right.yawH);
    leftTorque.push(shoulderTorque(model,'left',phase,profile,cadence));rightTorque.push(shoulderTorque(model,'right',phase,profile,cadence));
    leftOmega.push(state.left.upperOmega);rightOmega.push(state.right.upperOmega);
  }
  const legMomentumRms=rms(legH);const residualMomentumRms=rms(residualH);
  let positiveWork=0;for(let i=0;i<samples;i+=1){positiveWork+=Math.max(0,leftTorque[i]*leftOmega[i])*dt+Math.max(0,rightTorque[i]*rightOmega[i])*dt;}
  const peakShoulderTorque=Math.max(...leftTorque.map(Math.abs),...rightTorque.map(Math.abs));
  const shoulderTorqueRms=Math.sqrt((leftTorque.reduce((s,v)=>s+v*v,0)+rightTorque.reduce((s,v)=>s+v*v,0))/(samples*2));
  const symmetry=100*(1-Math.abs(rms(leftH)-rms(rightH))/(Math.max(rms(leftH),rms(rightH),1e-9)));
  return{
    profile,armMomentumRms:rms(armH),legMomentumRms,residualMomentumRms,
    balancePercent:clamp((1-residualMomentumRms/(legMomentumRms||1))*100,-100,100),
    peakShoulderTorque,shoulderTorqueRms,positiveWork,symmetry,
    traces:{armH,legH,residualH}
  };
}

export function findSuggestedProfile(model,cadence){
  const profiles=[];
  for(const elbowProfile of['compact','neutral','open'])for(const amplitudeProfile of['small','average','large'])for(const timing of['early','synchronized','late'])profiles.push(analyzeProfile(model,{elbowProfile,amplitudeProfile,timing},cadence,180));
  const ranges={};for(const key of['residualMomentumRms','peakShoulderTorque','positiveWork']){const values=profiles.map(item=>item[key]);ranges[key]={min:Math.min(...values),max:Math.max(...values)};}
  const normalized=(value,key)=>{const range=ranges[key];return(value-range.min)/(range.max-range.min||1);};
  for(const item of profiles)item.score=.65*normalized(item.residualMomentumRms,'residualMomentumRms')+.2*normalized(item.peakShoulderTorque,'peakShoulderTorque')+.15*normalized(item.positiveWork,'positiveWork');
  return profiles.sort((a,b)=>a.score-b.score)[0];
}
