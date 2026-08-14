import{createBodyModel}from'./model/body-model.js';
import{gaitAngles,phaseRateFromCadence}from'./model/gait.js';
import{renderRunner}from'./ui/runner-view.js';

const runnerGroup=document.getElementById('runner-segments');
const comMarker=document.getElementById('whole-body-com');
const verticalAxis=document.getElementById('vertical-axis');

const model=createBodyModel();
const CADENCE_SPM=172;
let phase=0;
let lastTime=performance.now();

function renderFrame(){
  const frame=renderRunner(runnerGroup,comMarker,model,gaitAngles(phase));
  verticalAxis.setAttribute('x1',frame.center.x);
  verticalAxis.setAttribute('x2',frame.center.x);
  verticalAxis.setAttribute('y1',frame.groundY);
  verticalAxis.setAttribute('y2',frame.center.y-72);
}

function animate(now){
  const deltaTime=Math.min((now-lastTime)/1000,.05);
  lastTime=now;
  phase=(phase+deltaTime*phaseRateFromCadence(CADENCE_SPM))%1;
  renderFrame();
  requestAnimationFrame(animate);
}

renderFrame();
requestAnimationFrame(animate);
