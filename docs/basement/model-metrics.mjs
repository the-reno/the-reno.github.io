// Work in world-space metres. glTF wall meshes are extruded shell segments.
// Their oriented footprint gives length (not the diagonal of an AABB).
const cross = (o, a, b) => (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
function hull(points) {
  const unique = [...new Map(points.map(p => [p.map(v => v.toFixed(5)).join(','), p])).values()]
    .sort((a,b) => a[0]-b[0] || a[1]-b[1]);
  if (unique.length < 3) return unique;
  const half = (list) => {
    const out = [];
    for (const p of list) {
      while (out.length > 1 && cross(out.at(-2), out.at(-1), p) <= 1e-9) out.pop();
      out.push(p);
    }
    return out.slice(0,-1);
  };
  return [...half(unique), ...half([...unique].reverse())];
}

export function measureWall(positions) {
  if (!positions.length || positions.some(p => p.length !== 3 || p.some(v => !Number.isFinite(v))))
    throw new Error('Invalid wall geometry');
  const outline = hull(positions.map(p => [p[0],p[2]]));
  if (outline.length < 2) throw new Error('Empty wall footprint');
  let best;
  for (let i=0;i<outline.length;i++) {
    const a=outline[i], b=outline[(i+1)%outline.length];
    const len=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if (len < 1e-8) continue;
    const u=[(b[0]-a[0])/len,(b[1]-a[1])/len], v=[-u[1],u[0]];
    const us=outline.map(p=>p[0]*u[0]+p[1]*u[1]), vs=outline.map(p=>p[0]*v[0]+p[1]*v[1]);
    const loU=Math.min(...us),hiU=Math.max(...us),loV=Math.min(...vs),hiV=Math.max(...vs);
    const du=hiU-loU,dv=hiV-loV,area=du*dv;
    if (!best || area < best.area-1e-8) best={area,u,v,loU,hiU,loV,hiV,du,dv};
  }
  const {u,v,loU,hiU,loV,hiV,du,dv}=best;
  const at=(s,t)=>[s*u[0]+t*v[0],s*u[1]+t*v[1]];
  const a=du>=dv?at(loU,(loV+hiV)/2):at((loU+hiU)/2,loV);
  const b=du>=dv?at(hiU,(loV+hiV)/2):at((loU+hiU)/2,hiV);
  const ys=positions.map(p=>p[1]);
  return {length:Math.max(du,dv),thickness:Math.min(du,dv),height:Math.max(...ys)-Math.min(...ys),a,b};
}

export function measureFloor(floors) {
  let squareMeters=0, weighted=[0,0,0];
  const triangles=[], seen=new Set();
  for (const {positions,indices} of floors) {
    const top=Math.max(...positions.map(p=>p[1]));
    const order=indices || positions.map((_,i)=>i);
    for(let i=0;i<order.length;i+=3) {
      const tri=order.slice(i,i+3).map(k=>positions[k]);
      if(tri.length!==3 || tri.some(p=>Math.abs(p[1]-top)>1e-4)) continue;
      const key=tri.map(p=>p.map(v=>v.toFixed(5)).join(',')).sort().join(';');
      if(seen.has(key)) continue;
      seen.add(key);
      const [a,b,c]=tri;
      const area=Math.abs((b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]))/2;
      if(area<1e-8) continue;
      squareMeters+=area;
      weighted=weighted.map((n,k)=>n+area*(a[k]+b[k]+c[k])/3);
      triangles.push(tri);
    }
  }
  if(squareMeters<=0) throw new Error('Missing floor surface');
  return {squareMeters,position:weighted.map(v=>v/squareMeters),triangles};
}
