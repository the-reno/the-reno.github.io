const NS='http://www.w3.org/2000/svg';
function get(svg,id,name){let element=svg.querySelector(`#${id}`);if(!element){element=document.createElementNS(NS,name);element.id=id;svg.appendChild(element);}return element;}
function line(svg,id,a,b,className){const element=get(svg,id,'line');element.setAttribute('class',className);element.setAttribute('x1',a.x);element.setAttribute('y1',a.y);element.setAttribute('x2',b.x);element.setAttribute('y2',b.y);return element;}
function circle(svg,id,p,r,className){const element=get(svg,id,'circle');element.setAttribute('class',className);element.setAttribute('cx',p.x);element.setAttribute('cy',p.y);element.setAttribute('r',r);return element;}
function toScreen(origin,point,scale){return{x:origin.x+point.x*scale,y:origin.y+point.y*scale};}

export function renderSideView(svg,state,model){
  const scale=310;const leftOrigin={x:165,y:95};const rightOrigin={x:435,y:95};
  line(svg,'shoulder-bar',{x:135,y:95},{x:465,y:95},'structure');
  line(svg,'torso-axis',{x:300,y:70},{x:300,y:295},'torso-axis');
  for(const[side,origin,arm]of[['left',leftOrigin,state.left],['right',rightOrigin,state.right]]){
    const elbow=toScreen(origin,arm.elbow,scale);const hand=toScreen(origin,arm.hand,scale);
    line(svg,`${side}-upper`,origin,elbow,`arm-segment ${side}`);line(svg,`${side}-forearm`,elbow,hand,`arm-segment ${side}`);
    circle(svg,`${side}-shoulder`,origin,6,'joint');circle(svg,`${side}-elbow`,elbow,5,'joint');circle(svg,`${side}-hand`,hand,6,'hand');
  }
}

export function renderTopView(svg,state){
  const center={x:300,y:145};
  const torso=get(svg,'torso-top','ellipse');torso.setAttribute('class','torso-top');torso.setAttribute('cx',center.x);torso.setAttribute('cy',center.y);torso.setAttribute('rx',42);torso.setAttribute('ry',82);
  const leftShoulder={x:246,y:125},rightShoulder={x:354,y:125};line(svg,'top-shoulders',leftShoulder,rightShoulder,'structure');
  const depthScale=145;const lateralScale=65;
  for(const[side,origin,arm,sign]of[['left',leftShoulder,state.left,-1],['right',rightShoulder,state.right,1]]){
    const elbow={x:origin.x+sign*18+arm.elbow.x*lateralScale,y:origin.y+arm.elbow.x*depthScale};
    const hand={x:origin.x+sign*28+arm.hand.x*lateralScale,y:origin.y+arm.hand.x*depthScale};
    line(svg,`top-${side}-upper`,origin,elbow,`arm-segment ${side}`);line(svg,`top-${side}-forearm`,elbow,hand,`arm-segment ${side}`);
    circle(svg,`top-${side}-hand`,hand,5,'hand');
  }
  const yaw=Math.max(-18,Math.min(18,state.residualH*8));
  const arrow=line(svg,'yaw-arrow',{x:center.x-45,y:245},{x:center.x+45+yaw,y:245},'yaw-arrow');arrow.setAttribute('marker-end','url(#arrowhead)');
}

export function renderTrace(svg,traces,phase){
  const width=540,height=120,pad=12;const all=[...traces.armH,...traces.legH,...traces.residualH];const max=Math.max(...all.map(Math.abs),.01);
  const path=values=>values.map((value,index)=>`${index?'L':'M'} ${pad+index/(values.length-1)*(width-2*pad)} ${height/2-value/max*(height/2-pad)}`).join(' ');
  for(const[id,values,className]of[['trace-legs',traces.legH,'trace legs'],['trace-arms',traces.armH,'trace arms'],['trace-residual',traces.residualH,'trace residual']]){const element=get(svg,id,'path');element.setAttribute('class',className);element.setAttribute('d',path(values));}
  line(svg,'trace-zero',{x:pad,y:height/2},{x:width-pad,y:height/2},'trace-zero');
  const x=pad+phase*(width-2*pad);line(svg,'trace-cursor',{x,y:8},{x,y:height-8},'trace-cursor');
}
