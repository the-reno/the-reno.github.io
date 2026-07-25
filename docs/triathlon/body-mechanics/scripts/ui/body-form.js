import{BODY_GROUPS,validateProfile}from'../model/body-model.js';

const SIZE_OPTIONS=['small','average','large'];

export function mountBodyForm(container,onChange){
  container.innerHTML=`
    <div class="input-section">
      <p class="input-help">Enter broad weight distribution. Head and neck use the remaining percentage.</p>
      ${BODY_GROUPS.map(group=>`<label class="profile-row"><span>${group.label}</span><span><input data-profile="${group.id}Percent" type="number" min="0" max="90" step="0.5" value="${group.defaultPercent}"> %</span></label>`).join('')}
    </div>
    <div class="input-section">
      <p class="input-help">Choose segment size relative to an average person with the same height.</p>
      ${['torso','arms','legs'].map(group=>`<label class="profile-row"><span>${group[0].toUpperCase()+group.slice(1)} length</span><select data-profile="${group}Size" aria-label="${group} relative length">${SIZE_OPTIONS.map(option=>`<option value="${option}"${option==='average'?' selected':''}>${option[0].toUpperCase()+option.slice(1)}</option>`).join('')}</select></label>`).join('')}
    </div>`;
  const notify=()=>onChange(readProfile(container));
  container.addEventListener('input',notify);
  container.addEventListener('change',notify);
  return readProfile(container);
}

export function readProfile(container){
  const value=id=>container.querySelector(`[data-profile="${id}"]`)?.value;
  return{
    torsoPercent:Number(value('torsoPercent')),
    armsPercent:Number(value('armsPercent')),
    legsPercent:Number(value('legsPercent')),
    torsoSize:value('torsoSize')||'average',
    armsSize:value('armsSize')||'average',
    legsSize:value('legsSize')||'average'
  };
}

export function renderProfileSummary(element,profile,model){
  const validation=validateProfile(profile);
  element.className=`mass-summary ${validation.valid?'valid':'invalid'}`;
  element.innerHTML=validation.valid
    ?`Head + neck: <strong>${validation.headPercent.toFixed(1)}%</strong><br>Total allocation: 100.0%<br><span class="summary-note">Lengths are calculated from height and the selected relative size.</span>`
    :`Current remainder for head + neck: <strong>${validation.headPercent.toFixed(1)}%</strong><br>Keep the remainder between 4% and 15%.`;
  return validation.valid;
}
