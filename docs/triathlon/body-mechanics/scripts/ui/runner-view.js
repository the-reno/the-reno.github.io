import{endpoint,pointAlong,wholeBodyCenterOfMass}from'../model/mechanics.js';

const SCALE=410;
function svgElement(name,attributes={}){const element=document.createElementNS('http://www.w3.org/2000/svg',name);for(const[key,value]of Object.entries(attributes))element.setAttribute(key,value);return element;}
function drawSegment(group,id,start,end){let line=group.querySelector(`#${id}`);if(!line){line=svgElement('line',{id,class:'body-segment'});group.appendChild(line);}line.setAttribute('x1',start.x);line.setAttribute('y1',start.y);line.setAttribute('x2',end.x);line.setAttribute('y2',end.y);}
function length(model,id){return(model.segments.find(segment=>segment.id===id)?.lengthCm||1)/100*SCALE;}
function mass(model,id){return model.segments.find(segment=>segment.id===id)?.massKg||0;}

export function renderRunner(group,comMarker,model,angles){
  const pelvis={x:300,y:315};const torsoTop=endpoint(pelvis,length(model,'torso'),Math.PI+angles.torso);const headTop=endpoint(torsoTop,length(model,'head'),Math.PI+angles.torso);
  const shoulder=pointAlong(torsoTop,pelvis,.18);const hip=pelvis;
  const leftElbow=endpoint(shoulder,length(model,'upperArm'),angles.leftShoulder);const rightElbow=endpoint(shoulder,length(model,'upperArm'),angles.rightShoulder);
  const leftHand=endpoint(leftElbow,length(model,'forearmHand'),angles.leftShoulder+angles.leftElbow-Math.PI/2);const rightHand=endpoint(rightElbow,length(model,'forearmHand'),angles.rightShoulder-angles.rightElbow+Math.PI/2);
  const leftKnee=endpoint(hip,length(model,'thigh'),angles.leftHip);const rightKnee=endpoint(hip,length(model,'thigh'),angles.rightHip);
  const leftAnkle=endpoint(leftKnee,length(model,'lowerLeg'),angles.leftHip-angles.leftKnee+Math.PI);const rightAnkle=endpoint(rightKnee,length(model,'lowerLeg'),angles.rightHip-angles.rightKnee+Math.PI);
  const leftToe={x:leftAnkle.x+length(model,'foot'),y:leftAnkle.y};const rightToe={x:rightAnkle.x+length(model,'foot'),y:rightAnkle.y};
  const geometry=[
    ['head',torsoTop,headTop,mass(model,'head')],['torso',pelvis,torsoTop,mass(model,'torso')],['pelvis',{x:pelvis.x-22,y:pelvis.y},{x:pelvis.x+22,y:pelvis.y},mass(model,'pelvis')],
    ['left-upper-arm',shoulder,leftElbow,mass(model,'upperArm')],['right-upper-arm',shoulder,rightElbow,mass(model,'upperArm')],['left-forearm',leftElbow,leftHand,mass(model,'forearmHand')],['right-forearm',rightElbow,rightHand,mass(model,'forearmHand')],
    ['left-thigh',hip,leftKnee,mass(model,'thigh')],['right-thigh',hip,rightKnee,mass(model,'thigh')],['left-lower-leg',leftKnee,leftAnkle,mass(model,'lowerLeg')],['right-lower-leg',rightKnee,rightAnkle,mass(model,'lowerLeg')],['left-foot',leftAnkle,leftToe,mass(model,'foot')],['right-foot',rightAnkle,rightToe,mass(model,'foot')]
  ];
  for(const[id,start,end]of geometry)drawSegment(group,id,start,end);
  const center=wholeBodyCenterOfMass(geometry.map(([,start,end,massKg])=>({massKg,com:pointAlong(start,end,.5)})));
  comMarker.setAttribute('cx',center.x);comMarker.setAttribute('cy',center.y);
  return center;
}
