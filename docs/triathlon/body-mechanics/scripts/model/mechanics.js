export function endpoint(origin,lengthM,angleRad){return{x:origin.x+lengthM*Math.sin(angleRad),y:origin.y+lengthM*Math.cos(angleRad)};}
export function pointAlong(start,end,ratio=.5){return{x:start.x+ratio*(end.x-start.x),y:start.y+ratio*(end.y-start.y)};}
export function wholeBodyCenterOfMass(segments){let x=0,y=0,mass=0;for(const segment of segments){x+=segment.com.x*segment.massKg;y+=segment.com.y*segment.massKg;mass+=segment.massKg;}return mass>0?{x:x/mass,y:y/mass}:{x:0,y:0};}
