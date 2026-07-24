import{SEGMENT_DEFINITIONS,massPercentTotal}from'../model/body-model.js';

export function mountBodyForm(container,onChange){
  container.innerHTML=SEGMENT_DEFINITIONS.map(segment=>`<div class="segment-row"><span>${segment.label}</span><input data-field="lengthCm" data-id="${segment.id}" type="number" min="1" step="0.1" value="${segment.lengthCm}" aria-label="${segment.label} length in centimeters"><input data-field="massPercent" data-id="${segment.id}" type="number" min="0" max="100" step="0.1" value="${segment.massPercent}" aria-label="${segment.label} percentage of total weight"></div>`).join('');
  container.addEventListener('input',()=>onChange(readSegments(container)));
  return readSegments(container);
}

export function readSegments(container){
  return SEGMENT_DEFINITIONS.map(definition=>{
    const length=container.querySelector(`[data-id="${definition.id}"][data-field="lengthCm"]`);
    const mass=container.querySelector(`[data-id="${definition.id}"][data-field="massPercent"]`);
    return{id:definition.id,lengthCm:Number(length.value),massPercent:Number(mass.value)};
  });
}

export function renderMassSummary(element,segments,totalMassKg){
  const total=massPercentTotal(segments);const difference=total-100;const valid=Math.abs(difference)<=.1;
  element.className=`mass-summary ${valid?'valid':'invalid'}`;
  element.innerHTML=`Weight distribution: <strong>${total.toFixed(1)}%</strong><br>Allocated mass: ${(totalMassKg*total/100).toFixed(2)} kg${valid?'':'<br>Adjust the segment percentages to reach 100%.'}`;
  return valid;
}
