'use strict';
// Applied review: ceda933b197697db0710a5b9c40c2c1ddc6fd2d5 (21 September 2026).
// Blank proposed fields remain blank; minor grammar/spelling corrections are logged.
const SOURCE = {repo:'the-reno/the-reno.github.io', revision:'23df86d3f7c8ab99fc22c3c2072c16b6abc533e5', date:'21 September 2026', site:'https://ronu.one'};
const SECTIONS = {
 all:{name:'Explore',number:'00',headline:'Stay <em>curious.</em>',description:'Welcome to my lab.<br>Ideas to explore. Models to test. Things to build.',note:'Endurance / Science / Markets / Making',eyebrow:'A personal lab'},
 triathlon:{
  name:'Triathlon',number:'01',headline:'Triathlon<em>.</em>',
  description:'I see endurance as a way to measure adaptation.',
  preview:'I look beyond pace and distance to explore how the body moves and where its limits lie.',
  note:'Movement / Endurance / Adaptation',eyebrow:'A personal perspective',art:'motion',
  question:'What keeps us moving?',
  perspective:[
   'I tend to see endurance as a systems problem. Beyond pace and distance, I am interested in how movement, energy, stress and recovery work together.',
   'Training makes those questions personal. What changes with repetition? What can be adapted? How do I keep functioning when conditions become uncomfortable?',
   'Here I explore those questions through mechanics, models and lessons from endurance.'
  ]
 },
 science:{
  name:'Science',number:'02',headline:'Science<em>.</em>',
  description:'I start with an ordinary observation and follow the questions it raises.',
  preview:'A roll of the dice. A traffic jam. A forest fire. Patterns behind ordinary events.',
  note:'Questions / Patterns / Experiments',eyebrow:'A personal perspective',art:'network',
  question:'What is behind the result?',
  perspective:[
   'It often starts with something ordinary: a roll of the dice, traffic slowing down, a spark becoming a fire. I want to understand what sits behind the result.',
   'I use simple models to explore how small interactions become larger patterns, and where prediction stops being reliable.',
   'The aim is not to make every answer certain. It is to ask a better question, test an explanation and see what changes.'
  ]
 },
 markets:{
  name:'Markets',number:'03',headline:'Markets<em>.</em>',
  description:'I explore how to make decisions when the future is uncertain.',
  preview:'I use data and models to compare possibilities, understand trade-offs and make decisions without confusing confidence with certainty.',
  note:'Rates / Currencies / Decisions',eyebrow:'A personal perspective',art:'curves',
  question:'How do we decide without certainty?',
  perspective:[
   'I am interested in how decisions change when the future is uncertain. Rates, currencies and liquidity are connected, but the choice depends on the objective and the risks we are prepared to take.',
   'I use data and models to compare possibilities, not to turn a forecast into certainty.',
   'The aim is to make the best decision the available information supports.'
  ],
  empty:'No articles or experiments are listed in this section yet.'
 },
 maker:{
  name:'Maker',number:'04',headline:'Maker<em>.</em>',
  description:'',
  preview:'Loading…',
  note:'Sketch / Build / Refine',eyebrow:'A personal perspective',art:'cube',
  question:'What happens when an idea becomes real?',
  perspective:[],
  empty:'No articles or projects are listed in this section yet.'
 }
};
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
// Homepage slides represent sections only. No article IDs, titles or summaries.
const FEATURED_SECTIONS = ['triathlon','science','markets','maker'].map(section => ({
 section,
 title: SECTIONS[section].name,
 description: SECTIONS[section].preview,
 art: SECTIONS[section].art,
 cta: 'Explore ' + SECTIONS[section].name.toLowerCase()
}));
