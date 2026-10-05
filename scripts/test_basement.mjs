import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateData, validatePolygon, polygonArea, polygonsOverlap, distance, formatLength, nextId} from '../docs/basement/data.mjs';
const raw = JSON.parse(await readFile(new URL('../docs/basement/execution.json', import.meta.url)));
const rect = (x, z, w, h) => [[x, 1, z], [x + w, 1, z], [x + w, 1, z + h], [x, 1, z + h]];
assert.equal(distance([0, 0, 0], [0, 2, 0]), 2);
assert.equal(formatLength(.3048), '1′ 0″');
assert.equal(formatLength(.3039), '1′ 0″'); // rounding carries across the foot boundary
assert.equal(polygonArea(rect(0, 0, 3, 2)), 6);
assert.equal(validatePolygon(rect(0, 0, 3, 2)), 6);
assert.equal(polygonsOverlap(rect(0, 0, 2, 2), rect(2, 0, 2, 2)), false);
assert.equal(polygonsOverlap(rect(0, 0, 2, 2), rect(0, 0, 2, 2)), true);
assert.equal(polygonsOverlap(rect(0, 0, 2, 2), rect(1, 0, 2, 2)), true);
assert.equal(polygonsOverlap(rect(0, 0, 4, 4), rect(1, 1, 1, 1)), true);
assert.throws(() => validatePolygon([[0,1,0], [2,1,2], [0,1,2], [2,1,0]]), /crosses/);
assert.throws(() => validatePolygon(rect(1, 0, 2, 2), [{points: rect(0, 0, 2, 2)}]), /overlaps/);
assert.throws(() => validatePolygon([[0,1,0], [1,1,0], [2,1,0]]), /small/);
const d = validateData(raw);
assert.equal(nextId(d, 'comment'), 'C01');
assert.equal(nextId(d, 'measurement'), 'M01');
assert.equal(nextId(d, 'area'), 'A1');
d.comments.push({id:'C01', position:[0,0,0], category:'MOVE', step:3, status:'OPEN', text:'Check PEX'});
d.measurements.push({id:'M01', a:[0,0,0], b:[0,2,0], status:'VERIFIED', name:'Height', step:1, verifiedMeters:2.1, verifiedAt:'2026-10-05'});
d.areas.push({id:'A1', name:'A1', points:rect(0,0,2,2), squareMeters:999, step:4});
const restored = validateData(JSON.parse(JSON.stringify(d)));
assert.equal(restored.areas[0].squareMeters, 4); // never trust imported area totals
assert.deepEqual(restored.measurements[0].position, [0,1,0]);
assert.equal(restored.measurements[0].verifiedMeters, 2.1);
assert.equal(nextId(restored, 'comment'), 'C02'); // deleted IDs cannot be reused
const invalid = structuredClone(d); invalid.model.id = 'another-room';
assert.throws(() => validateData(invalid), /model/);
const duplicate = structuredClone(d); duplicate.comments.push({...duplicate.comments[0]});
assert.throws(() => validateData(duplicate), /duplicate/);
const fakeVerified = structuredClone(d); delete fakeVerified.measurements[0].verifiedMeters;
assert.throws(() => validateData(fakeVerified), /confirmed/);
console.log('Basement data checks passed: units, polygons, overlap, provenance and import validation.');
