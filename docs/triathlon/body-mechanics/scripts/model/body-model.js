export const SEGMENT_DEFINITIONS=Object.freeze([
  {id:'head',label:'Head + neck',lengthCm:25,massPercent:8,parent:'torso'},
  {id:'torso',label:'Torso',lengthCm:52,massPercent:34,parent:'pelvis'},
  {id:'pelvis',label:'Pelvis',lengthCm:20,massPercent:12,parent:null},
  {id:'upperArm',label:'Upper arm · each',lengthCm:31,massPercent:3,parent:'torso',paired:true},
  {id:'forearmHand',label:'Forearm + hand · each',lengthCm:42,massPercent:2,parent:'upperArm',paired:true},
  {id:'thigh',label:'Thigh · each',lengthCm:47,massPercent:10,parent:'pelvis',paired:true},
  {id:'lowerLeg',label:'Lower leg · each',lengthCm:44,massPercent:5,parent:'thigh',paired:true},
  {id:'foot',label:'Foot · each',lengthCm:27,massPercent:1.5,parent:'lowerLeg',paired:true}
]);

export function createBodyModel({totalHeightCm,totalMassKg,segments}){
  const normalizedSegments=segments.map(segment=>{
    const definition=SEGMENT_DEFINITIONS.find(item=>item.id===segment.id);
    const multiplier=definition?.paired?2:1;
    return {...definition,...segment,multiplier,massKg:totalMassKg*(segment.massPercent/100)};
  });
  return {totalHeightM:totalHeightCm/100,totalMassKg,segments:normalizedSegments};
}

export function massPercentTotal(segments){
  return segments.reduce((sum,segment)=>{
    const definition=SEGMENT_DEFINITIONS.find(item=>item.id===segment.id);
    return sum+segment.massPercent*(definition?.paired?2:1);
  },0);
}

export function segmentMass(totalMassKg,massPercent){return totalMassKg*massPercent/100;}
