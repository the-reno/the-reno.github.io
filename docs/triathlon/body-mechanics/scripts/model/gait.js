const DEG=Math.PI/180;
export function gaitAngles(phase){const wave=Math.sin(phase*Math.PI*2);return{torso:5*DEG,leftShoulder:(-25*wave)*DEG,rightShoulder:(25*wave)*DEG,leftElbow:90*DEG,rightElbow:90*DEG,leftHip:(22*wave)*DEG,rightHip:(-22*wave)*DEG,leftKnee:(35+25*Math.max(0,-wave))*DEG,rightKnee:(35+25*Math.max(0,wave))*DEG};}
export function phaseRateFromCadence(cadence){return cadence/120;}
