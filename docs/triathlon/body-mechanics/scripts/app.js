import{createBodyModel}from'./model/body-model.js';
import{gaitAngles,phaseRateFromCadence}from'./model/gait.js';
import{weightForce}from'./model/mechanics.js';
import{mountBodyForm,renderMassSummary}from'./ui/body-form.js';
import{renderRunner}from'./ui/runner-view.js';

const segmentInputs=document.getElementById('segment-inputs');
const massSummary=document.getElementById('mass-summary');
const totalHeight=document.getElementById('total-height');
const totalMass=document.getElementById('total-mass');
const cadence=document.getElementById('cadence');
const cadenceOutput=document.getElementById('cadence-output');
const playToggle=document.getElementById('play-toggle');
const runnerGroup=document.getElementById('runner-segments');
const comMarker=document.getElementById('whole-body-com');
const results=document.getElementById('results');

let segments=[];let model;let phase=0;let playing=false;let lastTime=performance.now();

function rebuild(){
  model=createBodyModel({totalHeightCm:Number(totalHeight.value),totalMassKg:Number(totalMass.value),segments});
  const valid=renderMassSummary(massSummary,segments,model.totalMassKg);
  playToggle.disabled=!valid;
  renderFrame();
}
function renderFrame(){
  if(!model)return;
  const center=renderRunner(runnerGroup,comMarker,model,gaitAngles(phase));
  results.innerHTML=`<dt>Body mass</dt><dd>${model.totalMassKg.toFixed(1)} kg</dd><dt>Weight force</dt><dd>${weightForce(model.totalMassKg).toFixed(1)} N</dd><dt>Center of mass X</dt><dd>${center.x.toFixed(1)} px</dd><dt>Center of mass Y</dt><dd>${center.y.toFixed(1)} px</dd><dt>Cadence</dt><dd>${cadence.value} spm</dd>`;
}
function animate(now){
  const dt=Math.min((now-lastTime)/1000,.05);lastTime=now;
  if(playing){phase=(phase+dt*phaseRateFromCadence(Number(cadence.value)))%1;renderFrame();}
  requestAnimationFrame(animate);
}
segments=mountBodyForm(segmentInputs,next=>{segments=next;rebuild();});
[totalHeight,totalMass].forEach(input=>input.addEventListener('input',rebuild));
cadence.addEventListener('input',()=>{cadenceOutput.value=cadence.value;renderFrame();});
playToggle.addEventListener('click',()=>{playing=!playing;playToggle.textContent=playing?'Pause':'Play';});
rebuild();requestAnimationFrame(animate);
