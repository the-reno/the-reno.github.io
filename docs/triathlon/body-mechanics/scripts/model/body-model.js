const SIZE_FACTORS=Object.freeze({small:.94,average:1,large:1.06});

const BASE_LENGTH_RATIOS=Object.freeze({
  head:.135,
  torso:.288,
  pelvis:.11,
  upperArm:.186,
  forearmHand:.244,
  thigh:.245,
  lowerLeg:.246,
  foot:.152
});

export const BODY_GROUPS=Object.freeze([
  {id:'torso',label:'Torso + pelvis',defaultPercent:44},
  {id:'arms',label:'Both arms',defaultPercent:10},
  {id:'legs',label:'Both legs',defaultPercent:38}
]);

function sizeFactor(value){return SIZE_FACTORS[value]??SIZE_FACTORS.average;}
function lengthCm(heightCm,segment,groupSize){return heightCm*BASE_LENGTH_RATIOS[segment]*sizeFactor(groupSize);}

export function createBodyModel({totalHeightCm,totalMassKg,profile}){
  const torsoPercent=Number(profile.torsoPercent);
  const armsPercent=Number(profile.armsPercent);
  const legsPercent=Number(profile.legsPercent);
  const headPercent=100-torsoPercent-armsPercent-legsPercent;

  const torsoMass=torsoPercent*.72;
  const pelvisMass=torsoPercent*.28;
  const eachArm=armsPercent/2;
  const eachLeg=legsPercent/2;

  const segments=[
    {id:'head',label:'Head + neck',lengthCm:lengthCm(totalHeightCm,'head','average'),massPercent:headPercent,massKg:totalMassKg*headPercent/100},
    {id:'torso',label:'Torso',lengthCm:lengthCm(totalHeightCm,'torso',profile.torsoSize),massPercent:torsoMass,massKg:totalMassKg*torsoMass/100},
    {id:'pelvis',label:'Pelvis',lengthCm:lengthCm(totalHeightCm,'pelvis',profile.torsoSize),massPercent:pelvisMass,massKg:totalMassKg*pelvisMass/100},
    {id:'upperArm',label:'Upper arm · each',lengthCm:lengthCm(totalHeightCm,'upperArm',profile.armsSize),massPercent:eachArm*.55,massKg:totalMassKg*(eachArm*.55)/100,paired:true},
    {id:'forearmHand',label:'Forearm + hand · each',lengthCm:lengthCm(totalHeightCm,'forearmHand',profile.armsSize),massPercent:eachArm*.45,massKg:totalMassKg*(eachArm*.45)/100,paired:true},
    {id:'thigh',label:'Thigh · each',lengthCm:lengthCm(totalHeightCm,'thigh',profile.legsSize),massPercent:eachLeg*.58,massKg:totalMassKg*(eachLeg*.58)/100,paired:true},
    {id:'lowerLeg',label:'Lower leg · each',lengthCm:lengthCm(totalHeightCm,'lowerLeg',profile.legsSize),massPercent:eachLeg*.32,massKg:totalMassKg*(eachLeg*.32)/100,paired:true},
    {id:'foot',label:'Foot · each',lengthCm:lengthCm(totalHeightCm,'foot',profile.legsSize),massPercent:eachLeg*.10,massKg:totalMassKg*(eachLeg*.10)/100,paired:true}
  ];

  return{totalHeightM:totalHeightCm/100,totalMassKg,headPercent,profile,segments};
}

export function validateProfile(profile){
  const allocated=Number(profile.torsoPercent)+Number(profile.armsPercent)+Number(profile.legsPercent);
  const headPercent=100-allocated;
  return{allocated,headPercent,valid:Number.isFinite(allocated)&&headPercent>=4&&headPercent<=15};
}

export function modelSummary(model){
  const byId=Object.fromEntries(model.segments.map(segment=>[segment.id,segment]));
  return{
    headPercent:model.headPercent,
    torsoLengthCm:byId.torso.lengthCm,
    armLengthCm:byId.upperArm.lengthCm+byId.forearmHand.lengthCm,
    legLengthCm:byId.thigh.lengthCm+byId.lowerLeg.lengthCm,
    footLengthCm:byId.foot.lengthCm
  };
}
