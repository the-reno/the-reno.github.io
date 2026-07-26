import{createArmModel,validateArmInputs}from'./model/arm-model.js';
import{strideDurationSeconds,stridePhaseName}from'./model/arm-gait.js';
import{analyzeProfile,findSuggestedProfile,frameState}from'./model/arm-mechanics.js';
import{renderSideView,renderTopView,renderTrace}from'./ui/arm-view.js';

const $=id=>document.getElementById(id);
const controls={height:$('height'),weight:$('weight'),armsMass:$('arms-mass'),armLength:$('arm-length'),forearm:$('forearm'),elbow:$('elbow-profile'),amplitude:$('amplitude'),timing:$('timing'),cadence:$('cadence')};
const sideView=$('side-view'),topView=$('top-view'),trace=$('momentum-trace'),results=$('results'),suggestion=$('suggestion'),validation=$('validation'),play=$('play-toggle'),cadenceOutput=$('cadence-output');
let phase=0,playing=false,lastTime=performance.now(),model,analysis,suggested;

function profile(){return{elbowProfile:controls.elbow.value,amplitudeProfile:controls.amplitude.value,timing:controls.timing.value};}
function inputValues(){return{heightCm:Number(controls.height.value),massKg:Number(controls.weight.value),armsMassPercent:Number(controls.armsMass.value),armLengthProfile:controls.armLength.value,forearmProfile:controls.forearm.value};}
function formatProfile(value){return`${value.elbowProfile} elbow · ${value.amplitudeProfile} swing · ${value.timing}`;}

function rebuild(){
  const values=inputValues();const errors=validateArmInputs(values);
  validation.textContent=errors.join(' ');validation.className=`validation ${errors.length?'invalid':'valid'}`;play.disabled=errors.length>0;
  if(errors.length)return;
  model=createArmModel(values);analysis=analyzeProfile(model,profile(),Number(controls.cadence.value));suggested=findSuggestedProfile(model,Number(controls.cadence.value));render();
}

function render(){
  if(!model)return;const current=frameState(model,phase,profile(),Number(controls.cadence.value));
  renderSideView(sideView,current,model);renderTopView(topView,current);renderTrace(trace,analysis.traces,phase);
  results.innerHTML=`
    <dt>Arm length</dt><dd>${(model.totalArmLengthM*100).toFixed(1)} cm</dd>
    <dt>Upper arm</dt><dd>${(model.upperArmLengthM*100).toFixed(1)} cm</dd>
    <dt>Forearm + hand</dt><dd>${(model.forearmHandLengthM*100).toFixed(1)} cm</dd>
    <dt>Both arms mass</dt><dd>${model.totalArmsMassKg.toFixed(2)} kg</dd>
    <dt>Stride phase</dt><dd>${stridePhaseName(phase)}</dd>
    <dt>Arm momentum RMS</dt><dd>${analysis.armMomentumRms.toFixed(3)} kg·m²/s</dd>
    <dt>Reference leg momentum</dt><dd>${analysis.legMomentumRms.toFixed(3)} kg·m²/s</dd>
    <dt>Residual momentum</dt><dd>${analysis.residualMomentumRms.toFixed(3)} kg·m²/s</dd>
    <dt>Momentum balanced</dt><dd>${analysis.balancePercent.toFixed(1)}%</dd>
    <dt>Peak shoulder torque</dt><dd>${analysis.peakShoulderTorque.toFixed(1)} N·m</dd>
    <dt>Shoulder torque RMS</dt><dd>${analysis.shoulderTorqueRms.toFixed(1)} N·m</dd>
    <dt>Positive work proxy</dt><dd>${analysis.positiveWork.toFixed(1)} J/stride</dd>
    <dt>Left/right symmetry</dt><dd>${analysis.symmetry.toFixed(1)}%</dd>`;
  const currentText=formatProfile(profile()),bestText=formatProfile(suggested.profile);
  const same=currentText===bestText;
  suggestion.innerHTML=`<strong>${same?'Current selection is the mechanical suggestion.':'Suggested mechanical balance'}</strong><br>${bestText}<br><span>Residual ${suggested.residualMomentumRms.toFixed(3)} kg·m²/s · peak torque ${suggested.peakShoulderTorque.toFixed(1)} N·m · work ${suggested.positiveWork.toFixed(1)} J/stride</span>`;
}

for(const input of Object.values(controls))input.addEventListener('input',()=>{cadenceOutput.value=controls.cadence.value;rebuild();});
play.addEventListener('click',()=>{playing=!playing;play.textContent=playing?'Pause':'Play';});
function animate(now){const dt=Math.min((now-lastTime)/1000,.05);lastTime=now;if(playing&&model){phase=(phase+dt/strideDurationSeconds(Number(controls.cadence.value)))%1;render();}requestAnimationFrame(animate);}
rebuild();requestAnimationFrame(animate);
