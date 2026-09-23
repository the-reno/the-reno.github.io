'use strict';
// Article catalogue and pinned source. Landing copy lives in page-content.js.
const SOURCE = {repo:'the-reno/the-reno.github.io', revision:'23df86d3f7c8ab99fc22c3c2072c16b6abc533e5', date:'21 September 2026', site:'https://ronu.one'};
// Compatibility identities for the unchanged article reader; no duplicated copy.
const SECTIONS = Object.fromEntries(['all', ...SITE.sectionOrder].map((id, i) => [id, {
  name: MAIN_PAGES[id].name, number: String(i).padStart(2, '0')
}]));
const TOPICS = [
 {id:'endurance',section:'triathlon',type:'Article',title:'Endurance',description:'A systems view of fuel, movement and the ability to keep going.',art:'motion',path:'/triathlon/',file:'docs/triathlon/index.html',tags:'ATP fuel oxygen muscle phosphocreatine glycolysis aerobic metabolism'},
 {id:'body-mechanics',section:'triathlon',type:'Interactive',title:'Body Mechanics',description:"A mechanical model of a runner, built from the body's core rotational axes.",art:'pendulum',path:'/triathlon/body-mechanics/',tags:'runner hip knee ankle shoulder elbow balance mass'},
 {id:'arms',section:'triathlon',type:'Interactive',title:'Arm Mechanics',description:'Change arm proportions and movement. Compare angular momentum and residual rotation.',art:'rhythm',path:'/triathlon/body-mechanics/arms/',tags:'arms cadence elbow shoulder torque angular momentum balance'},
 {id:'chaos-motion',section:'triathlon',type:'Article',title:'From Chaos to Motion',description:'How molecules, electrical signals and continuous correction become endurance.',art:'waves',path:'/triathlon/energy.html',file:'docs/triathlon/energy.html',tags:'ATP calcium myosin muscle contraction feedback fatigue mitochondria'},
 {id:'prediction',section:'science',type:'Article',title:'The Complexity of Prediction',description:'From rolling dice to understanding the patterns behind uncertain outcomes.',art:'branches',path:'/Science/prediction.html',file:'docs/Science/prediction.html',tags:'dice probability Newton mathematics uncertainty quantum'},
 {id:'spark',section:'science',type:'Interactive',title:'The Spark',description:'Most sparks die. A few change everything. The difference is the system surrounding them.',art:'network',path:'/Science/forest-fire-model.html',tags:'forest fire connectivity growth lightning networks critical systems'},
 {id:'traffic',section:'science',type:'Interactive',title:'Phantom Traffic Jam',description:'Explore how a small disturbance grows into a traffic wave moving backward through a network.',art:'lanes',path:'/Science/traffic-jam.html',tags:'traffic demand driver reaction following distance truck weather instability'},
 {id:'dice-storm',section:'science',type:'Article',title:'The Dice and the Storm',description:'Some days look normal. Then one small thing changes the direction of the day.',art:'cube',path:'/Science/dice.html',file:'docs/Science/dice.html',status:'Introduction only',tags:'dice storm small things',inline:'<p>Some days look normal. Same routine. Same train. Same desk. Then one small thing changes the direction of the day.</p>'}
];
