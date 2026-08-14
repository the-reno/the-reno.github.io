const LENGTH_RATIOS=Object.freeze({head:.135,neck:.057,torso:.288,pelvis:.11,upperArm:.186,forearmHand:.244,thigh:.245,lowerLeg:.246,foot:.152});
const MASS_PERCENT=Object.freeze({head:7,neck:1,torso:31.68,pelvis:12.32,upperArm:2.75,forearmHand:2.25,thigh:11.02,lowerLeg:6.08,foot:1.9});
const REFERENCE_HEIGHT_CM=193;
const REFERENCE_MASS_KG=87;

export function createBodyModel(){
  const segments=Object.keys(LENGTH_RATIOS).map(id=>({
    id,
    lengthCm:REFERENCE_HEIGHT_CM*LENGTH_RATIOS[id],
    massKg:REFERENCE_MASS_KG*MASS_PERCENT[id]/100
  }));
  return{totalHeightCm:REFERENCE_HEIGHT_CM,segments};
}
