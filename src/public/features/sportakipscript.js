(() => {
  // ---------- helpers ----------
  function byId(id){return document.getElementById(id);}
  function getLocalISODate(d=new Date()){const t=new Date(d);return new Date(t.getTime()-t.getTimezoneOffset()*6e4).toISOString().slice(0,10);}
  async function safeFetchJSON(url,init){
    const res=await fetch(url,{credentials:"include",...init});
    const txt=await res.text();
    const ct=res.headers.get("content-type")||"";
    if(!ct.includes("application/json"))throw new Error(`${res.status} ${res.statusText}: ${txt.slice(0,200)}`);
    const data=JSON.parse(txt);
    if(!res.ok)throw new Error(data?.error||`${res.status} ${res.statusText}`);
    return data;
  }

  // ---------- elements ----------
  const addBtn=byId("openAddDialogBtn")??document.querySelector(".mainfgupperholder .glow-on-hover");
  const rangeSelect=byId("rangeSelect");
  const resultsEl=byId("exerciseResults")??document.querySelector(".mainfglowerholder");

  const dlg=byId("addDialog");
  const form=byId("addForm");
  const cancelBtn=byId("cancelBtn");
  const addToListBtn=byId("addToListBtn");
  const clearCurrentBtn=byId("clearCurrentBtn");
  const entryList=byId("entryList");

  const sessionDate=byId("sessionDate");
  const exerciseInput=byId("exerciseInput");
  const exerciseDL=byId("exerciseListDL");
  const exerciseMeta=byId("exerciseMeta");
  const machineSelect=byId("machineSelect");

  const strengthFields=byId("strengthFields");
  const cardioFields=byId("cardioFields");

  const sets=byId("sets");
  const reps=byId("reps");
  const weight_kg=byId("weight_kg");
  const minutes=byId("minutes");
  const distance_km=byId("distance_km");
  const calories=byId("calories");
  const comment=byId("comment");

  // ---------- state ----------
  let exercises=[],machines=[],chosenExercise=null;
  let currentEntries=[]; // list of exercises added for this session

  // ---------- add to list ----------
  function onAddToList(){
    if(!chosenExercise){
      onExerciseChange();
      if(!chosenExercise){alert("Pick a valid exercise first.");return;}
    }
    
    // Add validation for numeric fields
    const validateNumber = (value, fieldName) => {
      if (value === null || value === "") return null;
      const num = Number(value);
      return isNaN(num) ? null : num;
    };

    const entry = {
      exercise_id: chosenExercise.id,
      exercise_name: chosenExercise.name,
      machine_id: machineSelect.value ? Number(machineSelect.value) : null,
      machine_name: machines.find(m => m.id === Number(machineSelect.value))?.name || null,
      sets: validateNumber(sets.value, 'sets'),
      reps: validateNumber(reps.value, 'reps'),
      weight_kg: validateNumber(weight_kg.value, 'weight'),
      minutes: validateNumber(minutes.value, 'minutes'),
      distance_km: validateNumber(distance_km.value, 'distance'),
      calories: validateNumber(calories.value, 'calories'),
      comment: (comment.value || "").trim() || null
    };
    
    // Validate at least some data is provided
    const hasData = entry.sets !== null || entry.reps !== null || entry.weight_kg !== null || 
                    entry.minutes !== null || entry.distance_km !== null || entry.calories !== null;
    
    if (!hasData) {
      alert("Please fill in at least one field (sets/reps/weight or minutes/distance/calories)");
      return;
    }
    
    currentEntries.push(entry);
    renderEntryList();
    form.reset();
    chosenExercise=null;
    strengthFields.style.display="none";
    cardioFields.style.display="none";
    exerciseMeta.textContent="";
  }

  // ---------- save session ----------
  async function onSaveSession(ev){
    ev.preventDefault();
    if(!currentEntries.length){alert("Add at least one exercise first.");return;}
    
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = "Saving...";
    submitBtn.disabled = true;

    try{
      const body={session_date:sessionDate.value||null,note:null,entries:currentEntries};
      const result = await safeFetchJSON("/api/workouts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      
      if (result.success) {
        currentEntries=[];
        renderEntryList();
        dlg.close();
        await refreshList();
      } else {
        throw new Error(result.error || "Failed to save workout");
      }
    }catch(e){console.error(e);alert(e.message||"Failed to save workout.");}
    finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  }

  // ---------- init ----------
  async function init(){
    sessionDate.value=getLocalISODate();
    await Promise.all([loadExercises(),loadMachines()]);
    wireEvents();
    await refreshList();
  }

  function wireEvents(){
    addBtn?.addEventListener("click",openDialog);
    cancelBtn?.addEventListener("click",()=>dlg.close());
    exerciseInput.addEventListener("input",onExerciseChange);
    addToListBtn.addEventListener("click",onAddToList);
    clearCurrentBtn.addEventListener("click",()=>form.reset());
    form.addEventListener("submit",onSaveSession);
    rangeSelect?.addEventListener("change",refreshList);
  }

  // ---------- data loaders ----------
  async function loadExercises(q=""){
    const data=await safeFetchJSON(`/api/exercises${q?`?query=${encodeURIComponent(q)}`:""}`);
    exercises=data;
    exerciseDL.innerHTML="";
    for(const ex of data){
      const opt=document.createElement("option");
      opt.value=ex.name;
      opt.label=ex.category?`${ex.name} (${ex.category})`:ex.name;
      exerciseDL.appendChild(opt);
    }
  }

  async function loadMachines(){
    machines=await safeFetchJSON("/api/machines");
    machineSelect.innerHTML='<option value="">— None —</option>';
    for(const m of machines){
      const opt=document.createElement("option");
      opt.value=m.id;
      opt.textContent=m.name+(m.body_part?` · ${m.body_part}`:"");
      machineSelect.appendChild(opt);
    }
  }

  // ---------- exercise selection ----------
  function onExerciseChange(){
    const name=(exerciseInput.value||"").trim();
    chosenExercise=exercises.find(e=>e.name.toLowerCase()===name.toLowerCase())||null;
    if(!chosenExercise){
      exerciseMeta.textContent="";
      strengthFields.style.display="none";
      cardioFields.style.display="none";
      return;
    }
    const cat=(chosenExercise.category||"").toLowerCase();
    exerciseMeta.textContent=`${chosenExercise.category||"—"} • ${chosenExercise.primary_muscle||"—"}${chosenExercise.is_bodyweight?" • Bodyweight":""}`;
    if(cat==="cardio"){strengthFields.style.display="none";cardioFields.style.display="block";}
    else{strengthFields.style.display="block";cardioFields.style.display="none";}
  }

  function renderEntryList(){
    if(!currentEntries.length){
      entryList.innerHTML='<p class="muted" style="margin:0;">No entries added yet.</p>';
      return;
    }
    entryList.innerHTML=currentEntries.map((e,i)=>`
      <div style="padding:.3rem 0;border-bottom:1px dashed #333;">
        <strong>${escapeHtml(e.exercise_name)}</strong>
        ${e.machine_name?` · <span class="muted">${escapeHtml(e.machine_name)}</span>`:""}
        <small class="muted">${formatDetails(e)}</small>
        <button type="button" data-idx="${i}" class="removeEntryBtn" style="float:right;">✖</button>
      </div>
    `).join("");
    entryList.querySelectorAll(".removeEntryBtn").forEach(btn=>{
      btn.addEventListener("click",()=>{
        const idx=Number(btn.dataset.idx);
        currentEntries.splice(idx,1);
        renderEntryList();
      });
    });
  }

  // ---------- utils ----------
  function valOrNull(el){const v=(el.value||"").trim();if(v==="")return null;const n=Number(v);return Number.isFinite(n)?n:null;}
  function openDialog(){form.reset();chosenExercise=null;currentEntries=[];renderEntryList();sessionDate.value=getLocalISODate();exerciseMeta.textContent="";strengthFields.style.display="none";cardioFields.style.display="none";dlg.showModal();}
  function num(v){return v==null?"–":String(v);}
  function formatDetails(e){
    const s=(e.sets||e.reps||e.weight_kg)?`${e.sets??"–"}×${e.reps??"–"} @ ${num(e.weight_kg)}kg`:"";
    const c=(e.minutes||e.distance_km||e.calories)?`${num(e.minutes)}min·${num(e.distance_km)}km·${num(e.calories)}kcal`:"";
    return [s,c,e.comment].filter(Boolean).join(" | ");
  }
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}

  // ---------- list rendering ----------
  async function refreshList(){
    const days=Number(rangeSelect?.value||30);
    const data=await safeFetchJSON(`/api/workouts?days=${days}`);
    const {sessions,items}=data;
    const map=new Map();for(const s of sessions)map.set(s.id,[]);
    for(const it of items){const arr=map.get(it.session_id);if(arr)arr.push(it);}
    resultsEl.innerHTML="";
    if(!sessions.length){resultsEl.innerHTML='<div class="routeoption"><p>No entries in range.</p></div>';return;}
    for(const s of sessions){
      const entries=map.get(s.id)||[];
      const card=document.createElement("div");
      card.className="routeoption";
      card.innerHTML=`<h1>${formatDate(s.session_date)}</h1>
      <div>${entries.map(renderEntry).join("")}</div>`;
      resultsEl.appendChild(card);
    }
  }
  function renderEntry(e){
    const name=e.exercise_name||"Exercise";
    const mach=e.machine_name?` · <span class="muted">${escapeHtml(e.machine_name)}</span>`:"";
    const str=(e.sets||e.reps||e.weight_kg)?`${e.sets??"–"}×${e.reps??"–"} @ ${num(e.weight_kg)}kg`:"";
    const car=(e.minutes||e.distance_km||e.calories)?`${num(e.minutes)}min · ${num(e.distance_km)}km · ${num(e.calories)}kcal`:"";
    const note=e.comment?` — <em>${escapeHtml(e.comment)}</em>`:"";
    const det=[str,car].filter(Boolean).join(" | ");
    return `<div style="padding:.35rem 0;border-bottom:1px dashed #333;"><strong>${escapeHtml(name)}</strong>${mach}${det?`<div class="muted">${det}${note}</div>`:(note?`<div class="muted">${note}</div>`:"")}</div>`;
  }
  function formatDate(iso){try{return new Date(iso).toLocaleDateString("en-GB",{year:"numeric",month:"short",day:"2-digit"});}catch{return iso;}}

  // ---------- start ----------
  init().catch(e=>{console.error("init failed",e);alert("Failed to init (maybe not logged in).");});
})();