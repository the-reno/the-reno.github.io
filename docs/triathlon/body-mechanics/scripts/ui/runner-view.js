import{endpoint,pointAlong,wholeBodyCenterOfMass}from'../model/mechanics.js';

const SCALE=300;
const GROUND_Y=548;
const CENTER_X=300;

function svgElement(name,attributes={}){const element=document.createElementNS('http://www.w3.org/2000/svg',name);for(const[key,value]of Object.entries(attributes))element.setAttribute(key,value);return element;}
function drawLine(group,id,start,end,className='body-segment'){let line=group.querySelector(`#${id}`);if(!line){line=svgElement('line',{id});group.appendChild(line);}line.setAttribute('class',className);line.setAttribute('x1',start.x);line.setAttribute('y1',start.y);line.setAttribute('x2',end.x);line.setAttribute('y2',end.y);}
function drawCircle(group,id,center,radius,className){let circle=group.querySelector(`#${id}`);if(!circle){circle=svgElement('circle',{id});group.appendChild(circle);}circle.setAttribute('class',className);circle.setAttribute('cx',center.x);circle.setAttribute('cy',center.y);circle.setAttribute('r',radius);}
function segmentLength(model,id){return(model.segments.find(segment=>segment.id===id)?.lengthCm||1)/100*SCALE;}
function segmentMass(model,id){return model.segments.find(segment=>segment.id===id)?.massKg||0;}
function footPoints(ankle,length,angle){const direction={x:Math.cos(angle),y:Math.sin(angle)};return{heel:{x:ankle.x-direction.x*length*.25,y:ankle.y-direction.y*length*.25},toe:{x:ankle.x+direction.x*length*.75,y:ankle.y+direction.y*length*.75}};}
function shifted(point,dy){return{x:point.x,y:point.y+dy};}

export function renderRunner(group,comMarker,model,angles){
  const torsoLength=segmentLength(model,'torso');
  const pelvisWidth=Math.max(18,segmentLength(model,'pelvis')*.55);
  const headLength=segmentLength(model,'head');
  const upperArmLength=segmentLength(model,'upperArm');
  const forearmLength=segmentLength(model,'forearmHand');
  const thighLength=segmentLength(model,'thigh');
  const lowerLegLength=segmentLength(model,'lowerLeg');
  const footLength=segmentLength(model,'foot');

  const pelvisCenterRaw={x:CENTER_X,y:300-(angles.pelvisLift||0)};
  const torsoTopRaw=endpoint(pelvisCenterRaw,torsoLength,Math.PI-angles.torso);
  const shoulderCenterRaw=pointAlong(torsoTopRaw,pelvisCenterRaw,.16);
  const headCenterRaw=endpoint(torsoTopRaw,headLength*.48,Math.PI-angles.torso);
  const shoulderHalf=Math.max(10,pelvisWidth*.72);
  const hipHalf=Math.max(8,pelvisWidth*.5);
  const leftShoulderRaw={x:shoulderCenterRaw.x-shoulderHalf,y:shoulderCenterRaw.y};
  const rightShoulderRaw={x:shoulderCenterRaw.x+shoulderHalf,y:shoulderCenterRaw.y};
  const leftHipRaw={x:pelvisCenterRaw.x-hipHalf,y:pelvisCenterRaw.y};
  const rightHipRaw={x:pelvisCenterRaw.x+hipHalf,y:pelvisCenterRaw.y};

  const leftElbowRaw=endpoint(leftShoulderRaw,upperArmLength,angles.leftShoulder);
  const rightElbowRaw=endpoint(rightShoulderRaw,upperArmLength,angles.rightShoulder);
  const leftHandRaw=endpoint(leftElbowRaw,forearmLength,angles.leftShoulder+(Math.PI-angles.leftElbow));
  const rightHandRaw=endpoint(rightElbowRaw,forearmLength,angles.rightShoulder-(Math.PI-angles.rightElbow));
  const leftKneeRaw=endpoint(leftHipRaw,thighLength,angles.leftHip);
  const rightKneeRaw=endpoint(rightHipRaw,thighLength,angles.rightHip);
  const leftAnkleRaw=endpoint(leftKneeRaw,lowerLegLength,angles.leftHip-angles.leftKnee);
  const rightAnkleRaw=endpoint(rightKneeRaw,lowerLegLength,angles.rightHip-angles.rightKnee);
  const leftFootRaw=footPoints(leftAnkleRaw,footLength,angles.leftFoot);
  const rightFootRaw=footPoints(rightAnkleRaw,footLength,angles.rightFoot);

  const supportFoot=angles.supportSide==='left'?leftFootRaw:rightFootRaw;
  const verticalShift=GROUND_Y-Math.max(supportFoot.heel.y,supportFoot.toe.y);
  const move=point=>shifted(point,verticalShift);
  const pelvisCenter=move(pelvisCenterRaw),torsoTop=move(torsoTopRaw),shoulderCenter=move(shoulderCenterRaw),headCenter=move(headCenterRaw);
  const leftShoulder=move(leftShoulderRaw),rightShoulder=move(rightShoulderRaw),leftHip=move(leftHipRaw),rightHip=move(rightHipRaw);
  const leftElbow=move(leftElbowRaw),rightElbow=move(rightElbowRaw),leftHand=move(leftHandRaw),rightHand=move(rightHandRaw);
  const leftKnee=move(leftKneeRaw),rightKnee=move(rightKneeRaw),leftAnkle=move(leftAnkleRaw),rightAnkle=move(rightAnkleRaw);
  const leftHeel=move(leftFootRaw.heel),leftToe=move(leftFootRaw.toe),rightHeel=move(rightFootRaw.heel),rightToe=move(rightFootRaw.toe);

  drawLine(group,'right-upper-arm',rightShoulder,rightElbow,'body-segment back-segment');
  drawLine(group,'right-forearm',rightElbow,rightHand,'body-segment back-segment');
  drawLine(group,'right-thigh',rightHip,rightKnee,'body-segment back-segment');
  drawLine(group,'right-lower-leg',rightKnee,rightAnkle,'body-segment back-segment');
  drawLine(group,'right-foot',rightHeel,rightToe,'body-segment back-segment');
  drawLine(group,'torso',pelvisCenter,torsoTop,'body-segment torso-segment');
  drawLine(group,'shoulder-line',leftShoulder,rightShoulder,'structural-line');
  drawLine(group,'pelvis-line',leftHip,rightHip,'structural-line');
  drawLine(group,'left-upper-arm',leftShoulder,leftElbow);
  drawLine(group,'left-forearm',leftElbow,leftHand);
  drawLine(group,'left-thigh',leftHip,leftKnee);
  drawLine(group,'left-lower-leg',leftKnee,leftAnkle);
  drawLine(group,'left-foot',leftHeel,leftToe);
  drawCircle(group,'head-shape',headCenter,Math.max(15,Math.min(24,headLength*.23)),'head-shape');

  for(const[id,position]of [['left-shoulder-joint',leftShoulder],['right-shoulder-joint',rightShoulder],['left-elbow-joint',leftElbow],['right-elbow-joint',rightElbow],['left-hip-joint',leftHip],['right-hip-joint',rightHip],['left-knee-joint',leftKnee],['right-knee-joint',rightKnee],['left-ankle-joint',leftAnkle],['right-ankle-joint',rightAnkle]])drawCircle(group,id,position,5,'joint');

  const weightedSegments=[
    {massKg:segmentMass(model,'head'),com:headCenter},{massKg:segmentMass(model,'torso'),com:pointAlong(pelvisCenter,torsoTop,.5)},{massKg:segmentMass(model,'pelvis'),com:pelvisCenter},
    {massKg:segmentMass(model,'upperArm'),com:pointAlong(leftShoulder,leftElbow,.5)},{massKg:segmentMass(model,'upperArm'),com:pointAlong(rightShoulder,rightElbow,.5)},
    {massKg:segmentMass(model,'forearmHand'),com:pointAlong(leftElbow,leftHand,.5)},{massKg:segmentMass(model,'forearmHand'),com:pointAlong(rightElbow,rightHand,.5)},
    {massKg:segmentMass(model,'thigh'),com:pointAlong(leftHip,leftKnee,.5)},{massKg:segmentMass(model,'thigh'),com:pointAlong(rightHip,rightKnee,.5)},
    {massKg:segmentMass(model,'lowerLeg'),com:pointAlong(leftKnee,leftAnkle,.5)},{massKg:segmentMass(model,'lowerLeg'),com:pointAlong(rightKnee,rightAnkle,.5)},
    {massKg:segmentMass(model,'foot'),com:pointAlong(leftHeel,leftToe,.5)},{massKg:segmentMass(model,'foot'),com:pointAlong(rightHeel,rightToe,.5)}
  ];
  const center=wholeBodyCenterOfMass(weightedSegments);
  comMarker.setAttribute('cx',center.x);comMarker.setAttribute('cy',center.y);
  return{center,pelvisCenter,scale:SCALE,groundY:GROUND_Y,supportSide:angles.supportSide,phaseName:angles.phaseName};
}
