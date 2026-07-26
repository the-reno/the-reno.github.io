export const SIZE_MULTIPLIERS=Object.freeze({small:.94,average:1,large:1.06});
export const FOREARM_FRACTIONS=Object.freeze({small:.54,average:.57,large:.60});

const BASE_TOTAL_ARM_RATIO=.44;
const UPPER_ARM_MASS_FRACTION=.55;

export function createArmModel({heightCm,massKg,armsMassPercent,armLengthProfile='average',forearmProfile='average'}){
  const heightM=Number(heightCm)/100;
  const bodyMassKg=Number(massKg);
  const totalArmsMassKg=bodyMassKg*Number(armsMassPercent)/100;
  const oneArmMassKg=totalArmsMassKg/2;
  const totalArmLengthM=heightM*BASE_TOTAL_ARM_RATIO*SIZE_MULTIPLIERS[armLengthProfile];
  const forearmFraction=FOREARM_FRACTIONS[forearmProfile];
  const forearmHandLengthM=totalArmLengthM*forearmFraction;
  const upperArmLengthM=totalArmLengthM-forearmHandLengthM;
  const upperArmMassKg=oneArmMassKg*UPPER_ARM_MASS_FRACTION;
  const forearmHandMassKg=oneArmMassKg-upperArmMassKg;
  return{
    heightM,bodyMassKg,armsMassPercent:Number(armsMassPercent),totalArmsMassKg,oneArmMassKg,
    totalArmLengthM,upperArmLengthM,forearmHandLengthM,upperArmMassKg,forearmHandMassKg,
    armLengthProfile,forearmProfile
  };
}

export function validateArmInputs({heightCm,massKg,armsMassPercent}){
  const errors=[];
  if(!Number.isFinite(Number(heightCm))||heightCm<120||heightCm>230)errors.push('Height must be between 120 and 230 cm.');
  if(!Number.isFinite(Number(massKg))||massKg<30||massKg>250)errors.push('Weight must be between 30 and 250 kg.');
  if(!Number.isFinite(Number(armsMassPercent))||armsMassPercent<4||armsMassPercent>16)errors.push('Both arms must represent between 4% and 16% of body weight.');
  return errors;
}
