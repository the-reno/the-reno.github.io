export const GRAVITY=9.80665;

export function endpoint(origin,lengthM,angleRad){return{x:origin.x+lengthM*Math.sin(angleRad),y:origin.y+lengthM*Math.cos(angleRad)};}
export function pointAlong(start,end,ratio=.5){return{x:start.x+ratio*(end.x-start.x),y:start.y+ratio*(end.y-start.y)};}
export function rodInertiaAboutCenter(massKg,lengthM){return massKg*lengthM**2/12;}
export function rodInertiaAboutJoint(massKg,lengthM){return massKg*lengthM**2/3;}
export function velocity(previous,current,deltaTime){if(!previous||!current||deltaTime<=0)return{x:0,y:0};return{x:(current.x-previous.x)/deltaTime,y:(current.y-previous.y)/deltaTime};}
export function momentum(massKg,vector){return{x:massKg*vector.x,y:massKg*vector.y};}
export function angularMomentum(inertia,angularVelocity){return inertia*angularVelocity;}
export function weightForce(massKg){return massKg*GRAVITY;}
export function wholeBodyCenterOfMass(segments){let x=0,y=0,mass=0;for(const segment of segments){x+=segment.com.x*segment.massKg;y+=segment.com.y*segment.massKg;mass+=segment.massKg;}return mass>0?{x:x/mass,y:y/mass}:{x:0,y:0};}
