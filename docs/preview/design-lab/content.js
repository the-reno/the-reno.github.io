'use strict';
/* Approved section sentences from the design discussion. A separate study, not a production rewrite. */
window.RONU_LAB = {
  revision: '20260921-lab1',
  layouts: [
    {id:'01',name:'Editorial',note:'Section first. Sentence underneath.',detail:'The section name leads. A serif sentence in the accent color creates a quieter, reading-led introduction.'},
    {id:'02',name:'Statement',note:'Let the sentence lead.',detail:'The sentence becomes the headline. A smaller section label keeps the subject clear without competing with the idea.'},
    {id:'03',name:'Split',note:'Words and a visual, side by side.',detail:'The section and sentence sit beside a restrained abstract graphic. On a phone, the graphic moves below the words.'},
    {id:'04',name:'Poster',note:'A bright field. Dark typography.',detail:'The sentence sits inside a solid accent-color panel. Dark text keeps the bright surface readable; the rest of the page stays dark.'}
  ],
  colors: [
    {id:'G1',name:'Acid lime',hex:'#B8FF3D',family:'Green'},
    {id:'G2',name:'Neon mint',hex:'#35F58B',family:'Green'},
    {id:'O1',name:'Signal orange',hex:'#FF7A1A',family:'Orange'},
    {id:'O2',name:'Solar orange',hex:'#FFAD32',family:'Orange'},
    {id:'B1',name:'Electric blue',hex:'#4D9AFF',family:'Blue'},
    {id:'B2',name:'Ice blue',hex:'#32D5FF',family:'Blue'}
  ],
  sections: [
    {id:'triathlon',name:'Triathlon',tagline:'Getting comfortable with discomfort.',start:'Getting comfortable ',end:'with discomfort.',themes:'Movement / Endurance / Adaptation',intro:'I see endurance as a way to measure adaptation.',question:'What keeps us moving?',body:'I tend to see endurance as a systems problem. Beyond pace and distance, I am interested in how movement, energy, stress and recovery work together.'},
    {id:'science',name:'Science',tagline:'Finding patterns within the chaos.',start:'Finding patterns ',end:'within the chaos.',themes:'Questions / Patterns / Experiments',intro:'I start with an ordinary observation and follow the questions it raises.',question:'What is behind the result?',body:'It often starts with something ordinary: a roll of the dice, traffic slowing down, a spark becoming a fire. I want to understand what sits behind the result.'},
    {id:'markets',name:'Markets',tagline:'Pricing the future before it happens.',start:'Pricing the future ',end:'before it happens.',themes:'Rates / Currencies / Decisions',intro:'I explore how to make decisions when the future is uncertain.',question:'How do we decide without certainty?',body:'I use data and models to compare possibilities, not to turn a forecast into certainty.'},
    {id:'maker',name:'Maker',tagline:'What happens when an idea becomes real?',start:'What happens when ',end:'an idea becomes real?',themes:'Sketch / Build / Refine',intro:'',question:'',body:''}
  ],
  topics: [
    {id:'endurance',section:'triathlon',type:'Article',title:'Endurance',description:'A systems view of fuel, movement and the ability to keep going.'},
    {id:'body-mechanics',section:'triathlon',type:'Interactive',title:'Body Mechanics',description:"A mechanical model of a runner, built from the body's core rotational axes."},
    {id:'arms',section:'triathlon',type:'Interactive',title:'Arm Mechanics',description:'Change arm proportions and movement. Compare angular momentum and residual rotation.'},
    {id:'chaos-motion',section:'triathlon',type:'Article',title:'From Chaos to Motion',description:'How molecules, electrical signals and continuous correction become endurance.'},
    {id:'prediction',section:'science',type:'Article',title:'The Complexity of Prediction',description:'From rolling dice to understanding the patterns behind uncertain outcomes.'},
    {id:'spark',section:'science',type:'Interactive',title:'The Spark',description:'Most sparks die. A few change everything. The difference is the system surrounding them.'},
    {id:'traffic',section:'science',type:'Interactive',title:'Phantom Traffic Jam',description:'Explore how a small disturbance grows into a traffic wave moving backward through a network.'},
    {id:'dice-storm',section:'science',type:'Introduction',title:'The Dice and the Storm',description:'Some days look normal. Then one small thing changes the direction of the day.'}
  ],
  images: [
    {title:'Football at night',src:'/assets/young-memory.svg',alt:'A night-time football scene viewed through a fence.'},
    {title:'Manhattan reflections',src:'/assets/present-reflection.webp',alt:'A reflective night-time view toward the Manhattan skyline.'},
    {title:'Night runner',src:'/assets/runner-card.jpg',alt:'A runner beside the waterfront at night.'}
  ]
};
