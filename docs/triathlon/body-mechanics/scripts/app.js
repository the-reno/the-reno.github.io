import{createBodyModel,modelSummary,validateProfile}from'./model/body-model.js';
import{gaitAngles,phaseRateFromCadence}from'./model/gait.js';
import{weightForce}from'./model/mechanics.js';
import{mountBodyForm,renderProfileSummary}from'./ui/body-form.js';
import{renderRunner}from'./ui/runner-view.js';

const profileInputs=document.getElementById('segment-inputs');
const massSummary=document.getElementById('mass-summary');
const totalHeight=document.getElementById('total-height');
const totalMass=document.getElementById('total-mass');
const cadence=document.getElementById('cadence');
const cadenceOutput=document.getElementById('cadence-output');
const playToggle=document.getElementById('play-toggle');
const runnerGroup=document.getElementById('runner-segments');
const comMarker=document.getElementById('whole-body-com');
const results=document.getElementById('results');

let profile;
let model;
let phase=0;
let playing=false;
let lastTime=performance.now();

function rebuild(){
  model=createBodyModel({totalHeightCm:Number(totalHeight.value),totalMassKg:Number(totalMass.value),profile});
  const valid=renderProfileSummary(massSummary,profile,model)&&Number(totalHeight.value)>0&&Number(totalMass.value)>0;
  playToggle.disabled=!valid;
  if(!valid&&playing){playing=false;playToggle.textContent='Play';}
  renderFrame();
}

function renderFrame(){
  if(!model||!validateProfile(profile).valid)return;
  const frame=renderRunner(runnerGroup,comMarker,model,gaitAngles(phase));
  const dimensions=modelSummary(model);
  const comHeightCm=(frame.groundY-frame.center.y)/frame.scale*100;
  const comOffsetCm=(frame.center.x-frame.pelvisCenter.x)/frame.scale*100;
  results.innerHTML=`
    <dt>Body mass</dt><dd>${model.totalMassKg.toFixed(1)} kg</dd>
    <dt>Weight force</dt><dd>${weightForce(model.totalMassKg).toFixed(1)} N</dd>
    <dt>Torso length</dt><dd>${dimensions.torsoLengthCm.toFixed(1)} cm</dd>
    <dt>Arm length</dt><dd>${dimensions.armLengthCm.toFixed(1)} cm</dd>
    <dt>Leg length</dt><dd>${dimensions.legLengthCm.toFixed(1)} cm</dd>
    <dt>COM height</dt><dd>${comHeightCm.toFixed(1)} cm</dd>
    <dt>COM from pelvis</dt><dd>${comOffsetCm>=0?'+':''}${comOffsetCm.toFixed(1)} cm</dd>
    <dt>Stride phase</dt><dd>${frame.phaseName}</dd>
    <dt>Support side</dt><dd>${frame.supportSide}</dd>
    <dt>Cadence</dt><dd>${cadence.value} spm</dd>`;
}

function animate(now){
  const deltaTime=Math.min((now-lastTime)/1000,.05);
  lastTime=now;
  if(playing){phase=(phase+deltaTime*phaseRateFromCadence(Number(cadence.value)))%1;renderFrame();}
  requestAnimationFrame(animate);
}

profile=mountBodyForm(profileInputs,next=>{profile=next;rebuild();});
[totalHeight,totalMass].forEach(input=>input.addEventListener('input',rebuild));
cadence.addEventListener('input',()=>{cadenceOutput.value=cadence.value;renderFrame();});
playToggle.addEventListener('click',()=>{playing=!playing;playToggle.textContent=playing?'Pause':'Play';});
rebuild();
requestAnimationFrame(animate);
