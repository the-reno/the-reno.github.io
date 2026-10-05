import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {measureWall,measureFloor} from '../docs/basement/model-metrics.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
const box=[];
for(const x of [-2,2])for(const z of [-.1,.1])for(const y of [0,2.4])
  box.push([x*Math.cos(.7)-z*Math.sin(.7)+3,y,x*Math.sin(.7)+z*Math.cos(.7)-5]);
const wall=measureWall(box);
near(wall.length,4);near(wall.thickness,.2);near(wall.height,2.4);
near(Math.hypot(wall.b[0]-wall.a[0],wall.b[1]-wall.a[1]),4);
const floor=measureFloor([{positions:[[0,0,0],[4,0,0],[4,0,3],[0,0,3],[0,-.2,0],[4,-.2,0],[4,-.2,3]],
  indices:[0,1,2,0,2,3,4,5,6,2,1,0]}]);
near(floor.squareMeters,12);near(floor.position[0],2);near(floor.position[2],1.5);
const gltf=JSON.parse(await readFile(new URL('../docs/basement/room.gltf',import.meta.url)));
const buffers=gltf.buffers.map(b=>Buffer.from(b.uri.split(',')[1],'base64'));
function accessor(id){
  const a=gltf.accessors[id],v=gltf.bufferViews[a.bufferView],buffer=buffers[v.buffer];
  const dims={VEC3:3,SCALAR:1}[a.type],bytes={5126:4,5123:2,5125:4}[a.componentType];
  const read={5126:'readFloatLE',5123:'readUInt16LE',5125:'readUInt32LE'}[a.componentType];
  return Array.from({length:a.count},(_,i)=>Array.from({length:dims},(_,j)=>
    buffer[read]((v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||dims*bytes)+j*bytes)));
}
const entries=gltf.nodes.filter(n=>'mesh' in n).map(n=>{
  const p=gltf.meshes[n.mesh].primitives[0];
  return {name:n.name,positions:accessor(p.attributes.POSITION),indices:accessor(p.indices).flat()};
});
const walls=entries.filter(e=>e.name.startsWith('wall_')).map(e=>measureWall(e.positions));
assert.equal(walls.length,22);
assert.ok(walls.every(w=>w.length>.1&&w.length<10&&w.height>2&&w.height<2.5));
const actual=measureFloor(entries.filter(e=>e.name.startsWith('floor_')));
near(actual.squareMeters,79.39815231028437);
assert.equal(actual.triangles.length,10);
console.log(`Model metric checks passed: rotated walls, length versus diagonal, floor-only faces, duplicate rejection; ${walls.length} walls and ${actual.squareMeters.toFixed(5)} m².`);
