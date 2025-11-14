/* ===========================================================
   Paw Care Vet Clinic — Main App Script (Frontend)
   =========================================================== */

// Ensure Api is available - api.js should load first
(function ensureApi() {
  if (typeof window === 'undefined') return;
  
  if (!window.Api) {
    console.error('[App] Api is not defined! Make sure api.js loads before app.js');
    // Create a minimal Api object to prevent errors
    window.Api = {
      token: () => null,
      auth: { login: async () => { throw new Error('Api not loaded'); } },
      pets: {},
      appts: {},
      rx: {},
      users: {},
      reports: {}
    };
  } else {
    console.log('[App] Api is available');
  }
})();

// Notification system
window.showNotification = function(message, type = 'info') {
  // Remove existing notifications
  const existing = document.querySelectorAll('.pawcare-notification');
  existing.forEach(n => n.remove());
  
  const notification = document.createElement('div');
  notification.className = `pawcare-notification fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg max-w-md ${
    type === 'success' ? 'bg-green-500 text-white' :
    type === 'error' ? 'bg-red-500 text-white' :
    'bg-blue-500 text-white'
  }`;
  notification.textContent = message;
  notification.style.animation = 'slideIn 0.3s ease-out';
  
  document.body.appendChild(notification);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
  
  // Add click to dismiss
  notification.addEventListener('click', () => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  });
};

// Add CSS for notifications
if (!document.getElementById('pawcare-notification-styles')) {
  const style = document.createElement('style');
  style.id = 'pawcare-notification-styles';
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

/* ===== Authentication Helpers ===== */
const DEMO_USERS = {
  admin:        { username: "admin",        password: "admin123", name: "Admin" },
  vet:          { username: "drcruz",       password: "vet12345", name: "Dr. Cruz" },
  receptionist: { username: "daisy",        password: "frontdesk123", name: "Daisy" },
  pharmacist:   { username: "paul",         password: "pharma123", name: "Paul" }
};

window.tryLogin = async function(username, password, selectedRole) {
  if (window.USE_API) {
    if (!username || !password) return { ok:false, msg:"Username and password required." };
    if (!window.Api || !window.Api.auth) {
      return { ok:false, msg:"API not initialized. Please refresh the page." };
    }
    try {
      console.log("Attempting login for:", username);
      const res = await window.Api.auth.login(username, password);
      console.log("Login response:", res);
      
      if (!res || !res.user) {
        throw new Error("Invalid response from server. Please check backend connection.");
      }
      
      const role = (res?.user?.role || "").toLowerCase();
      if (!role) {
        throw new Error("Role missing in server response.");
      }
      if (selectedRole && selectedRole.toLowerCase() !== role) {
        return { ok:false, msg:`This account is a ${role.toUpperCase()} account.` };
      }
      
      if (!res.token) {
        throw new Error("No authentication token received from server.");
      }
      
      localStorage.setItem("jwt", res.token);
      localStorage.setItem("role", role);
      localStorage.setItem("username", res.user.username);
      localStorage.setItem("userDisplayName", res.user.name || res.user.username);
      localStorage.setItem("userEmail", res.user.email || "");
      pushRecent?.(`Logged in as ${res.user.name || res.user.username}`);
      console.log("Login successful, redirecting...");
      return { ok:true, role, name: res.user.name };
    } catch (err) {
      console.error("Login error:", err);
      let errorMsg = err.message || "Login failed.";
      
      // Provide more helpful error messages
      if (err.message && err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
        errorMsg = "Cannot connect to backend server. Please ensure the backend is running on http://localhost:8080";
      } else if (err.message && err.message.includes("401")) {
        errorMsg = "Invalid username or password.";
      } else if (err.message && err.message.includes("CORS")) {
        errorMsg = "CORS error. Try using a local web server instead of opening the file directly.";
      }
      
      return { ok:false, msg: errorMsg };
    }
  }

  if (!selectedRole) return { ok: false, msg: "Please select a role first." };
  const acct = DEMO_USERS[selectedRole];
  if (!acct) return { ok: false, msg: "Unknown role. Pick one from the left." };
  if (username !== acct.username || password !== acct.password) {
    return { ok: false, msg: "Invalid username or password for the selected role." };
  }
  localStorage.setItem("role", selectedRole);
  localStorage.setItem("userDisplayName", acct.name);
  localStorage.setItem("username", acct.username);
  return { ok: true, role:selectedRole, name:acct.name };
};

/* ===== Log out ===== */
window.logout = function() {
  localStorage.removeItem("role");
  localStorage.removeItem("userDisplayName");
  localStorage.removeItem("username");
  localStorage.removeItem("userEmail");
  localStorage.removeItem("jwt");
  location.href = "index.html";
};

window.handleUnauthorized = function(){
  alert("Your session has expired. Please log back in.");
  window.logout();
};

/* ===== Role & Sidebar ===== */
const CONFIG = {
  admin:        ["dashboard","pet-records","appointments","prescriptions","reports","manage-users"],
  vet:          ["dashboard","pet-records","appointments","prescriptions"],
  receptionist: ["dashboard","pet-records","appointments"],
  pharmacist:   ["dashboard","prescriptions"]
};

const LABEL = {
  "dashboard":"Dashboard",
  "pet-records":"Pet Records",
  "appointments":"Appointments",
  "prescriptions":"Prescriptions",
  "reports":"Reports",
  "manage-users":"Manage Users"
};

const ROLE_COPY = {
  admin:{ welcome:"Full access. Manage users, pets, appointments, and prescriptions." },
  vet:{ welcome:"Review/approve appointments and issue prescriptions." },
  receptionist:{ welcome:"Create appointments and manage client check-ins." },
  pharmacist:{ welcome:"View/dispense prescriptions and print PDFs." }
};

window.getRole = function(){ return localStorage.getItem("role") || ""; };
window.getUserName = function(){ return localStorage.getItem("userDisplayName") || ""; };
window.getUsername = function(){ return localStorage.getItem("username") || ""; };

window.ensureLoggedIn = function(){
  const role = localStorage.getItem("role");
  
  // In API mode, require JWT token
  if(window.USE_API && !localStorage.getItem("jwt")){
    console.log('[Auth] No JWT token, redirecting to login');
    location.href="index.html";
    return;
  }
  
  // In demo mode, just require role
  if(!window.USE_API && !role){
    console.log('[Auth] No role, redirecting to login');
    location.href="index.html";
    return;
  }
  
  // If we have a role, we're good (either mode)
  if(role) {
    console.log('[Auth] Logged in as', role);
    return;
  }
  
  // Fallback: redirect to login
  location.href="index.html";
};

window.renderSidebar = function(container, role, activeFile){
  container.innerHTML="";
  (CONFIG[role]||[]).forEach(key=>{
    const btn=document.createElement("button");
    btn.className="px-4 py-3 text-left rounded-md font-medium text-gray-700 hover:bg-[var(--soft-teal)] hover:text-white transition";
    btn.textContent=LABEL[key];
    btn.onclick=()=>location.href=`${key}.html`;
    if(`${key}.html`===activeFile) btn.classList.add("bg-[var(--soft-teal)]","text-white");
    container.appendChild(btn);
  });
};

window.ROLE_COPY = ROLE_COPY;

/* ===== Dashboard Quick Actions ===== */
window.renderQuickActions = function(el,role){
  el.innerHTML="";
  const make = (title,href,icon)=> {
    const b=document.createElement("button");
    b.className="text-left w-full bg-[#f7fbfb] hover:bg-[#eef6f6] border border-gray-200 rounded-xl p-5 shadow-soft";
    b.innerHTML=`<div class='text-2xl mb-2'>${icon}</div><div class='font-semibold'>${title}</div>`;
    b.onclick=()=>location.href=href;
    return b;
  };
  const map={
    admin:[make("Add Pet Record","pet-records.html","➕"),make("Create Appointment","appointments.html","📅"),make("Manage Users","manage-users.html","👥"),make("Issue Prescription","prescriptions.html","💊"),make("View Reports","reports.html","📈")],
    vet:[make("Review Appointments","appointments.html","📅"),make("Issue Prescription","prescriptions.html","💊"),make("View Reports","reports.html","📈"),make("View Pet Records","pet-records.html","🐾")],
    receptionist:[make("Create Appointment","appointments.html","📅"),make("Add Pet Record","pet-records.html","➕"),make("View Pet Records","pet-records.html","🐾")],
    pharmacist:[make("View Prescriptions","prescriptions.html","💊"),make("Dispense & Print","prescriptions.html","🖨️"),make("View Pet Records","pet-records.html","🐾")]
  };
  (map[role]||[]).forEach(btn=>el.appendChild(btn));
};

/* ===== Global Error Handler (helps on desktop builds without DevTools) ===== */
if(!window.__pawcare_error_handler_installed){
  window.__pawcare_error_handler_installed = true;
  window.addEventListener('error', function(e){
    try{
      const msg = e?.message || 'Unknown script error';
      console && console.error && console.error('GlobalError:', e?.error||e);
      alert('Error: ' + msg);
    }catch(_){/* ignore */}
  });
  window.addEventListener('unhandledrejection', function(e){
    try{
      const reason = e && (e.reason?.message || e.reason || '').toString();
      console && console.error && console.error('UnhandledRejection:', e?.reason||e);
      alert('Error: ' + (reason || 'Unknown promise rejection'));
    }catch(_){/* ignore */}
  });
}

/* ===== Recent Activity (local only) ===== */
const DB_KEY="pawcare_recent";
function db(){const raw=localStorage.getItem(DB_KEY);return raw?JSON.parse(raw):{recent:[]};}
function save(d){localStorage.setItem(DB_KEY,JSON.stringify(d));}
function pushRecent(txt){
  const d=db();
  d.recent.unshift({text:txt,ts:Date.now()});
  d.recent=d.recent.slice(0,20);
  save(d);
}
function clearRecent(){save({recent:[]});}

window.renderRecent=function(el){
  const d=db().recent;
  const clearBtn=document.createElement("div");
  clearBtn.className="mb-2";
  clearBtn.innerHTML=`<button class='border px-3 py-1 rounded-md text-sm hover:bg-gray-50' onclick='window._clearRecent()'>Clear recent activity</button>`;
  el.innerHTML="";
  el.appendChild(clearBtn);
  const wrap=document.createElement("div");
  wrap.innerHTML=d.length
    ? d.map(i=>`<div class='text-sm'>${new Date(i.ts).toLocaleString()} — ${i.text}</div>`).join("")
    : `<div class='text-gray-500'>Nothing yet.</div>`;
  el.appendChild(wrap);
};

window._clearRecent=()=>{clearRecent();const el=document.getElementById("recentList");if(el)window.renderRecent(el);};

/* ===== Domain Constants & Validation ===== */
window.SPECIES_TO_BREEDS = {
  Canine: [
    "Aspin","Labrador","Golden Retriever","German Shepherd","Poodle","Shih Tzu","Pug","Beagle","Husky","Dachshund","Chihuahua","Rottweiler","French Bulldog","Corgi","Border Collie"
  ],
  Feline: [
    "Puspin","Persian","Siamese","Maine Coon","British Shorthair","American Shorthair","Ragdoll","Scottish Fold","Bengal","Sphynx","Russian Blue","Norwegian Forest","Burmese","Abyssinian","Manx"
  ]
};

window.validatePhone = function(phone){
  const cleaned = (phone||"").replace(/[^0-9+\-()\s]/g,"");
  return cleaned.length >= 7;
};

window.validateEmail = function(email){
  if(!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

/* ===== Procedure Catalog & Prices (PHP) ===== */
window.PROCEDURE_CATALOG = {
  'Consultation & Check-up': [
    { code:'CONSULT_STANDARD', name:'Consultation Fee', cost:350, medications:'', dosage:'', directions:'General wellness consultation.' },
    { code:'CONSULT_FOLLOWUP', name:'Follow-Up Consultation', cost:250, medications:'', dosage:'', directions:'Short follow-up visit.' },
    { code:'CONSULT_EMERGENCY', name:'Emergency Fee', cost:800, medications:'', dosage:'', directions:'Emergency case consultation surcharge.' },
    { code:'CONSULT_AFTERHOURS', name:'After 9:00 PM Consultation', cost:500, medications:'', dosage:'', directions:'Applies to late night consults.' }
  ],
  'Vaccine & Deworming': [
    { code:'VAC_FELINE_4IN1', name:'Feline 4-in-1 Vaccine', cost:1000, medications:'Feline 4-in-1 Vaccine', dosage:'As directed', directions:'Administer subcutaneously; observe for adverse reactions.' },
    { code:'VAC_CANINE_5IN1', name:'Canine 5-in-1 Vaccine', cost:1000, medications:'Canine 5-in-1 Vaccine', dosage:'As directed', directions:'Follow core vaccine schedule.' },
    { code:'VAC_CANINE_6IN1', name:'Canine 6-in-1 Vaccine', cost:1000, medications:'Canine 6-in-1 Vaccine', dosage:'As directed', directions:'Repeat per vaccination chart.' },
    { code:'VAC_CANINE_8IN1', name:'Canine 8-in-1 Vaccine', cost:1200, medications:'Canine 8-in-1 Vaccine', dosage:'As directed', directions:'Annual booster recommended.' },
    { code:'VAC_ANTIRABIES', name:'Anti-Rabies Vaccine', cost:350, medications:'Anti-Rabies Vaccine', dosage:'1 ml', directions:'Administer once yearly.' },
    { code:'DEWORM_CANINE', name:'Canine Deworming', cost:250, medications:'Anthelmintic', dosage:'5 mg/kg', directions:'Repeat every 3 months.' },
    { code:'DEWORM_FELINE', name:'Feline Deworming', cost:200, medications:'Anthelmintic', dosage:'5 mg/kg', directions:'Repeat every 3 months.' }
  ],
  'Laboratory Tests': [
    { code:'LAB_CBC', name:'Complete Blood Count (CBC)', cost:550, medications:'', dosage:'', directions:'Collect EDTA sample; process same day.' },
    { code:'LAB_BCHEM', name:'Comprehensive Blood Chemistry', cost:3550, medications:'', dosage:'', directions:'Fast patient 8h prior.' },
    { code:'LAB_CHEM10', name:'Chemistry 10 Panel', cost:2250, medications:'', dosage:'', directions:'Fast patient 8h prior.' },
    { code:'LAB_XRAY', name:'X-ray', cost:700, medications:'', dosage:'', directions:'Sedation as needed; provide positioning.' },
    { code:'LAB_ULTRASOUND', name:'Ultrasound', cost:800, medications:'', dosage:'', directions:'Shave area; fasting advised.' },
    { code:'LAB_ULTRASOUND_OB', name:'Ultrasound OB', cost:800, medications:'', dosage:'', directions:'Pregnancy monitoring.' },
    { code:'LAB_URINALYSIS', name:'Urinalysis', cost:400, medications:'', dosage:'', directions:'Collect mid-stream sample.' },
    { code:'LAB_FECALYSIS', name:'Fecalysis', cost:350, medications:'', dosage:'', directions:'Fresh stool sample.' }
  ],
  'Rapid Tests': [
    { code:'RAPID_PARVO', name:'Canine Parvo/Corona Rapid Test', cost:800, medications:'', dosage:'', directions:'Use stool sample; 10 minute read.' },
    { code:'RAPID_GIARDIA', name:'Giardia Drop Test', cost:800, medications:'', dosage:'', directions:'Fresh stool sample.' },
    { code:'RAPID_FIVFELV', name:'FIV/FeLV Test', cost:1100, medications:'', dosage:'', directions:'Whole blood sample.' }
  ],
  'Surgical Service': [
    { code:'SURG_GENERAL', name:'General Surgery', cost:5000, medications:'Ceftriaxone, Meloxicam', dosage:'Per protocol', directions:'Administer pre-op antibiotics and analgesics.' },
    { code:'SURG_DENTAL', name:'Dental Prophylaxis', cost:3500, medications:'Clindamycin, Chlorhexidine Rinse', dosage:'Per protocol', directions:'Post-op pain management for 3 days.' }
  ],
  'Spaying & Castration': [
    { code:'SPAY_FELINE', name:'Feline Spaying', cost:8000, medications:'Amoxicillin-Clavulanate, Carprofen', dosage:'Amoxiclav 12.5 mg/kg BID 7d; Carprofen 2 mg/kg SID 3d', directions:'Keep incision dry; monitor for swelling.' },
    { code:'NEUTER_FELINE', name:'Feline Castration', cost:6000, medications:'Amoxicillin-Clavulanate, Tramadol', dosage:'Amoxiclav 12.5 mg/kg BID 5d; Tramadol 3 mg/kg q8h 3d', directions:'Restrict activity 5 days.' },
    { code:'SPAY_CANINE', name:'Canine Spaying', cost:14000, medications:'Cephalexin, Carprofen', dosage:'Cephalexin 20 mg/kg BID 7d; Carprofen 4 mg/kg SID 5d', directions:'Use Elizabethan collar until suture removal.' },
    { code:'NEUTER_CANINE', name:'Canine Castration', cost:12000, medications:'Cephalexin, Tramadol', dosage:'Cephalexin 20 mg/kg BID 5d; Tramadol 4 mg/kg q8h 3d', directions:'Limit exercise for 7 days.' }
  ]
};

let PROCEDURE_CATALOG_PROMISE = null;
window.fetchProcedureCatalog = async function(force=false){
  if(force){ PROCEDURE_CATALOG_PROMISE = null; }
  if(!PROCEDURE_CATALOG_PROMISE){
    if(window.USE_API){
      PROCEDURE_CATALOG_PROMISE = window.Api.procedures.catalog()
        .then(data=>{ window.PROCEDURE_CATALOG = data; return data; })
        .catch(err=>{ console.warn('Failed to load procedure catalog from API, using fallback.', err); return window.PROCEDURE_CATALOG; });
    } else {
      PROCEDURE_CATALOG_PROMISE = Promise.resolve(window.PROCEDURE_CATALOG);
    }
  }
  return PROCEDURE_CATALOG_PROMISE;
};

window.lookupProcedureTemplate = async function(category, codeOrName){
  const catalog = await fetchProcedureCatalog();
  const list = catalog?.[category] || [];
  return list.find(item => item.code === codeOrName || item.name === codeOrName) || null;
};

/* ===== Guard ===== */
window.guard=function(pageKey){
  window.ensureLoggedIn();
  const role=window.getRole();
  const allowed=CONFIG[role]||[];
  if(!allowed.includes(pageKey)) location.href="dashboard.html";
};

/* ===== Helpers for Pet Names etc. ===== */
window.petName = async function(id) {
  const pet = await repoGetPet(id);
  return pet ? pet.name : "Unknown Pet";
};

window.ownerForPet = async function(id) {
  const pet = await repoGetPet(id);
  if(!pet) return "Unknown Owner";
  if (pet.owner) return pet.owner;
  if (pet.ownerId){ const o = await repoGetOwner(pet.ownerId); return o? o.fullName : "Unknown Owner"; }
  return "Unknown Owner";
};

/* ===== Local Storage Repository Functions ===== */
// These functions provide local storage functionality when USE_API is false

// Owner repository functions
window.repoListOwners = async function(){
  const data = localStorage.getItem('pawcare_owners');
  return data ? JSON.parse(data) : [];
};

window.repoSearchOwners = async function(term){
  const t = (term||'').toLowerCase();
  const list = await repoListOwners();
  return list.filter(o => [o.fullName,o.phone,o.email].filter(Boolean).join(' ').toLowerCase().includes(t));
};

window.repoGetOwner = async function(id){
  const list = await repoListOwners();
  return list.find(o=>o.id==id)||null;
};

window.repoAddOwner = async function(owner){
  const list = await repoListOwners();
  const newId = list.length>0 ? Math.max(...list.map(o=>o.id))+1 : 1;
  const toSave = { id:newId, fullName:owner.fullName, phone:owner.phone, email:owner.email||'', address:owner.address||'' };
  list.push(toSave);
  localStorage.setItem('pawcare_owners', JSON.stringify(list));
  pushRecent(`Added owner: ${toSave.fullName}`);
  return toSave;
};

window.repoUpdateOwner = async function(owner){
  const list = await repoListOwners();
  const idx = list.findIndex(o=>o.id==owner.id);
  if(idx!==-1){ list[idx]=owner; localStorage.setItem('pawcare_owners', JSON.stringify(list)); }
  return owner;
};

// Pet repository functions
window.repoListPets = async function() {
  if (window.USE_API) {
    return await window.Api.pets.list();
  }
  const data = localStorage.getItem('pawcare_pets');
  return data ? JSON.parse(data) : [];
};

window.repoGetPet = async function(id) {
  if (window.USE_API) {
    return await window.Api.pets.get(id);
  }
  const pets = await repoListPets();
  return pets.find(p => p.id == id) || null;
};

window.repoAddPet = async function(pet, photoFile) {
  try {
    if (window.USE_API) {
      const result = await window.Api.pets.create(pet);
      if (photoFile) {
        try {
          await window.Api.pets.uploadPhoto(result.id, photoFile);
        } catch (err) {
          console.warn('Photo upload failed:', err);
          // Continue even if photo upload fails
        }
      }
      showNotification('Pet record saved successfully!', 'success');
      return result;
    }
    const pets = await repoListPets();
    const newId = pets.length > 0 ? Math.max(...pets.map(p => p.id)) + 1 : 1;
    pet.id = newId;
    pets.push(pet);
    localStorage.setItem('pawcare_pets', JSON.stringify(pets));
    pushRecent(`Added pet: ${pet.name}`);
    showNotification('Pet record saved successfully!', 'success');
    return pet;
  } catch (err) {
    showNotification('Failed to save pet record: ' + (err.message || 'Unknown error'), 'error');
    throw err;
  }
};

window.repoUpdatePet = async function(pet) {
  try {
    if (window.USE_API) {
      const result = await window.Api.pets.update(pet);
      showNotification('Pet record updated successfully!', 'success');
      return result;
    }
    const pets = await repoListPets();
    const index = pets.findIndex(p => p.id == pet.id);
    if (index !== -1) {
      pets[index] = pet;
      localStorage.setItem('pawcare_pets', JSON.stringify(pets));
      pushRecent(`Updated pet: ${pet.name}`);
      showNotification('Pet record updated successfully!', 'success');
    }
    return pet;
  } catch (err) {
    showNotification('Failed to update pet record: ' + (err.message || 'Unknown error'), 'error');
    throw err;
  }
};

window.repoDeletePet = async function(id) {
  try {
    if (window.USE_API) {
      await window.Api.pets.remove(id);
      showNotification('Pet record deleted successfully!', 'success');
      return;
    }
    const pets = await repoListPets();
    const filtered = pets.filter(p => p.id != id);
    localStorage.setItem('pawcare_pets', JSON.stringify(filtered));
    pushRecent(`Deleted pet #${id}`);
    showNotification('Pet record deleted successfully!', 'success');
  } catch (err) {
    showNotification('Failed to delete pet record: ' + (err.message || 'Unknown error'), 'error');
    throw err;
  }
};

// Appointment repository functions
window.repoListAppts = async function() {
  if (window.USE_API) {
    return await window.Api.appts.list();
  }
  const data = localStorage.getItem('pawcare_appts');
  return data ? JSON.parse(data) : [];
};

window.repoGetAppt = async function(id) {
  if (window.USE_API) {
    return await window.Api.appts.get(id);
  }
  const appts = await repoListAppts();
  return appts.find(a => a.id == id) || null;
};

function generateAppointmentCode(dateStr, timeStr){
  const d = dateStr ? dateStr.replaceAll('-','') : new Date().toISOString().slice(0,10).replaceAll('-','');
  const t = (timeStr||'').replaceAll(':','').slice(0,4);
  const rand = Math.floor(Math.random()*900+100);
  return `APT-${d}${t?'-'+t:''}-${rand}`;
}

window.repoAddAppt = async function(appt) {
  try {
    if (window.USE_API) {
      const result = await window.Api.appts.create(appt);
      showNotification('Appointment created successfully!', 'success');
      return result;
    }
    const appts = await repoListAppts();
    const newId = appts.length > 0 ? Math.max(...appts.map(a => a.id)) + 1 : 1;
    appt.id = newId;
    appt.code = appt.code || generateAppointmentCode(appt.date, appt.time);
    appt.status = appt.status || 'Pending';
    appt.vet = appt.vet || '';
    appt.vetUsername = appt.vetUsername || '';
    appts.push(appt);
    localStorage.setItem('pawcare_appts', JSON.stringify(appts));
    pushRecent(`Created appointment for ${appt.owner}`);
    showNotification('Appointment created successfully!', 'success');
    return appt;
  } catch (err) {
    showNotification('Failed to create appointment: ' + (err.message || 'Unknown error'), 'error');
    throw err;
  }
};

window.repoUpdateAppt = async function(appt) {
  try {
    if (window.USE_API) {
      const result = await window.Api.appts.update(appt);
      showNotification('Appointment updated successfully!', 'success');
      return result;
    }
    const appts = await repoListAppts();
    const index = appts.findIndex(a => a.id == appt.id);
    if (index !== -1) {
      appts[index].vetUsername = appt.vetUsername || appts[index].vetUsername || '';
      appts[index] = appt;
      localStorage.setItem('pawcare_appts', JSON.stringify(appts));
      pushRecent(`Updated appointment #${appt.id}`);
      showNotification('Appointment updated successfully!', 'success');
    }
    return appt;
  } catch (err) {
    showNotification('Failed to update appointment: ' + (err.message || 'Unknown error'), 'error');
    throw err;
  }
};

window.repoDeleteAppt = async function(id) {
  try {
    if (window.USE_API) {
      await window.Api.appts.remove(id);
      showNotification('Appointment deleted successfully!', 'success');
      return;
    }
    const appts = await repoListAppts();
    const filtered = appts.filter(a => a.id != id);
    localStorage.setItem('pawcare_appts', JSON.stringify(filtered));
    pushRecent(`Deleted appointment #${id}`);
    showNotification('Appointment deleted successfully!', 'success');
  } catch (err) {
    showNotification('Failed to delete appointment: ' + (err.message || 'Unknown error'), 'error');
    throw err;
  }
};

window.repoApproveAppt = async function(id) {
  if (window.USE_API) {
    await window.Api.appts.approve(id);
    return;
  }
  const appts = await repoListAppts();
  const appt = appts.find(a => a.id == id);
  if (appt) {
    appt.status = 'Approved by Vet';
    localStorage.setItem('pawcare_appts', JSON.stringify(appts));
    pushRecent(`Approved appointment #${id}`);
  }
};

window.repoDoneAppt = async function(id) {
  if (window.USE_API) {
    await window.Api.appts.done(id);
    // Trigger reports refresh if reports page is open
    if (typeof window.run === 'function') {
      window.run();
    }
    return;
  }
  const appts = await repoListAppts();
  const appt = appts.find(a => a.id == id);
  if (appt) {
    appt.status = 'Done';
    appt.completedAt = new Date().toISOString().split('T')[0];
    localStorage.setItem('pawcare_appts', JSON.stringify(appts));
    pushRecent(`Completed appointment #${id}`);
    // Trigger reports refresh if reports page is open
    if (typeof window.run === 'function') {
      window.run();
    }
  }
};

window.repoCreateAppt = async function(appt) {
  return await repoAddAppt(appt);
};

// Prescription repository functions
window.repoListRx = async function() {
  if (window.USE_API) {
    return await window.Api.rx.list();
  }
  const data = localStorage.getItem('pawcare_rx');
  return data ? JSON.parse(data) : [];
};

window.repoGetRx = async function(id) {
  if (window.USE_API) {
    return await window.Api.rx.get(id);
  }
  const rx = await repoListRx();
  return rx.find(r => r.id == id) || null;
};

window.repoAddRx = async function(rx) {
  try {
    if (window.USE_API) {
      const result = await window.Api.rx.create(rx);
      showNotification('Prescription created successfully!', 'success');
      return result;
    }
    const prescriptions = await repoListRx();
    const newId = prescriptions.length > 0 ? Math.max(...prescriptions.map(r => r.id)) + 1 : 1;
    rx.id = newId;
    prescriptions.push(rx);
    localStorage.setItem('pawcare_rx', JSON.stringify(prescriptions));
    pushRecent(`Created prescription for ${rx.pet}`);
    showNotification('Prescription created successfully!', 'success');
    return rx;
  } catch (err) {
    showNotification('Failed to create prescription: ' + (err.message || 'Unknown error'), 'error');
    throw err;
  }
};

window.repoUpdateRx = async function(rx) {
  try {
    if (window.USE_API) {
      const result = await window.Api.rx.update(rx);
      showNotification('Prescription updated successfully!', 'success');
      return result;
    }
    const prescriptions = await repoListRx();
    const index = prescriptions.findIndex(r => r.id == rx.id);
    if (index !== -1) {
      prescriptions[index] = rx;
      localStorage.setItem('pawcare_rx', JSON.stringify(prescriptions));
      pushRecent(`Updated prescription #${rx.id}`);
      showNotification('Prescription updated successfully!', 'success');
    }
    return rx;
  } catch (err) {
    showNotification('Failed to update prescription: ' + (err.message || 'Unknown error'), 'error');
    throw err;
  }
};

window.repoDeleteRx = async function(id) {
  try {
    if (window.USE_API) {
      await window.Api.rx.remove(id);
      showNotification('Prescription deleted successfully!', 'success');
      return;
    }
    const prescriptions = await repoListRx();
    const filtered = prescriptions.filter(r => r.id != id);
    localStorage.setItem('pawcare_rx', JSON.stringify(prescriptions));
    pushRecent(`Deleted prescription #${id}`);
    showNotification('Prescription deleted successfully!', 'success');
  } catch (err) {
    showNotification('Failed to delete prescription: ' + (err.message || 'Unknown error'), 'error');
    throw err;
  }
};

window.repoDispenseRx = async function(id) {
  if (window.USE_API) {
    await window.Api.rx.dispense(id);
    // Trigger reports refresh if reports page is open
    if (typeof window.run === 'function') {
      window.run();
    }
    return;
  }
  const prescriptions = await repoListRx();
  const rx = prescriptions.find(r => r.id == id);
  if (rx) {
    rx.dispensed = true;
    rx.dispensedAt = new Date().toISOString().split('T')[0];
    // Auto-archive once dispensed
    rx.archived = true;
    localStorage.setItem('pawcare_rx', JSON.stringify(prescriptions));
    pushRecent(`Dispensed prescription #${id}`);
    // Trigger reports refresh if reports page is open
    if (typeof window.run === 'function') {
      window.run();
    }
  }
};

window.repoArchiveRx = async function(id, archived=true){
  const prescriptions = await repoListRx();
  const idx = prescriptions.findIndex(r=>r.id==id);
  if(idx===-1) return;
  prescriptions[idx].archived = archived;
  localStorage.setItem('pawcare_rx', JSON.stringify(prescriptions));
};

window.repoCreateRx = async function(rx) {
  return await repoAddRx(rx);
};

// User repository functions
window.repoListUsers = async function() {
  if (window.USE_API) {
    return await window.Api.users.list();
  }
  const data = localStorage.getItem('pawcare_users');
  return data ? JSON.parse(data) : [];
};

window.repoListVets = async function() {
  if (window.USE_API) {
    return await window.Api.users.vets();
  }
  const users = await repoListUsers();
  return users.filter(u => (u.role||'').toLowerCase() === 'vet');
};

window.repoGetUser = async function(id) {
  if (window.USE_API) {
    return await window.Api.users.get(id);
  }
  const users = await repoListUsers();
  return users.find(u => u.id == id) || null;
};

window.repoAddUser = async function(user) {
  try {
    if (window.USE_API) {
      const result = await window.Api.users.create(user);
      showNotification('User created successfully!', 'success');
      return result;
    }
    const users = await repoListUsers();
    const newId = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;
    user.id = newId;
     if (typeof user.active === 'undefined') user.active = true;
    users.push(user);
    localStorage.setItem('pawcare_users', JSON.stringify(users));
    pushRecent(`Added user: ${user.name}`);
    showNotification('User created successfully!', 'success');
    return user;
  } catch (err) {
    showNotification('Failed to create user: ' + (err.message || 'Unknown error'), 'error');
    throw err;
  }
};

window.repoUpdateUser = async function(user) {
  try {
    if (window.USE_API) {
      const result = await window.Api.users.update(user);
      showNotification('User updated successfully!', 'success');
      return result;
    }
    const users = await repoListUsers();
    const index = users.findIndex(u => u.id == user.id);
    if (index !== -1) {
      users[index] = { ...users[index], ...user };
      localStorage.setItem('pawcare_users', JSON.stringify(users));
      pushRecent(`Updated user: ${user.name}`);
      showNotification('User updated successfully!', 'success');
    }
    return user;
  } catch (err) {
    showNotification('Failed to update user: ' + (err.message || 'Unknown error'), 'error');
    throw err;
  }
};

window.repoDeleteUser = async function(id) {
  try {
    if (window.USE_API) {
      await window.Api.users.remove(id);
      showNotification('User deleted successfully!', 'success');
      return;
    }
    const users = await repoListUsers();
    const filtered = users.filter(u => u.id != id);
    localStorage.setItem('pawcare_users', JSON.stringify(filtered));
    pushRecent(`Deleted user #${id}`);
    showNotification('User deleted successfully!', 'success');
  } catch (err) {
    showNotification('Failed to delete user: ' + (err.message || 'Unknown error'), 'error');
    throw err;
  }
};

window.repoCreateUser = async function(user) {
  return await repoAddUser(user);
};

// Reports repository functions
window.repoSummary = async function(period, from, to) {
  if (window.USE_API) {
    return await window.Api.reports.summary(period, from, to);
  }
  
  // Local storage implementation
  const today = new Date();
  let start, end;
  
  switch (period) {
    case 'day':
      start = new Date(today);
      end = new Date(today);
      break;
    case 'week':
      start = new Date(today);
      start.setDate(today.getDate() - 6);
      end = new Date(today);
      break;
    case 'month':
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today);
      break;
    case 'custom':
      start = new Date(from);
      end = new Date(to);
      break;
    default:
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today);
  }
  
  const appointments = await repoListAppts();
  const prescriptions = await repoListRx();
  const pets = await repoListPets();
  const owners = await repoListOwners();
  
  // Count appointments done
  const appointmentsDone = appointments.filter(a => 
    a.status === 'Done' && 
    a.completedAt && 
    new Date(a.completedAt) >= start && 
    new Date(a.completedAt) <= end
  ).length;
  
  // Count prescriptions dispensed
  const prescriptionsDispensed = prescriptions.filter(r => 
    r.dispensed && 
    r.dispensedAt && 
    new Date(r.dispensedAt) >= start && 
    new Date(r.dispensedAt) <= end
  ).length;
  
  // Count pets added (approximate - count pets created in period)
  const petsAdded = pets.filter(p => {
    // For local storage, we'll estimate based on pet ID or creation order
    // This is a simplified approach - in a real app you'd track creation dates
    return p.id && p.id > 0; // All pets are considered "added" for simplicity
  }).length;
  
  // Get recent activity events
  const events = [];
  const recentData = db();
  if (recentData && recentData.recent) {
    events.push(...recentData.recent.map(r => ({
      ts: new Date(r.ts).toISOString(),
      type: 'ACTIVITY',
      message: r.text
    })));
  }

  // New Patients (from recent events within range)
  const newPatients = (recentData?.recent||[])
    .filter(r=>r.text.startsWith('Added pet:'))
    .filter(r=>{ const d=new Date(r.ts); return d>=start && d<=end; })
    .map(r=>{
      const name = r.text.replace('Added pet:','').trim();
      const pet = pets.find(p=>p.name===name) || null;
      const ownerName = pet?.owner || (pet?.ownerId ? (owners.find(o=>o.id==pet.ownerId)?.fullName||'') : '');
      return { petName:name, ownerName, addedAt:new Date(r.ts).toISOString() };
    });

  // Finished Appointments with cost (join procedures on the completed date)
  function proceduresForPetOnDate(petId, dateStr){
    const pet = pets.find(p=>p.id==petId);
    if(!pet||!Array.isArray(pet.procedures)) return { names:[], total:0 };
    const list = pet.procedures.filter(pr=> (pr.performedAt||'') === dateStr);
    const names = list.map(pr=>pr.name||pr.procedure||'');
    const total = list.reduce((s,pr)=> s + Number(pr.cost||0), 0);
    return { names, total };
  }

  const finished = (appointments||[])
    .filter(a=> a.status==='Done' && a.completedAt)
    .filter(a=>{ const d=new Date(a.completedAt); return d>=start && d<=end; })
    .map(a=>{
      const pr = proceduresForPetOnDate(a.petId, a.completedAt);
      return {
        code: a.code||'',
        date: a.completedAt,
        time: a.time||'',
        vet: a.vet||'',
        pet: a.pet||'',
        owner: a.owner||'',
        procedures: pr.names,
        cost: pr.total
      };
    });

  const totalProfit = finished.reduce((s,x)=> s + Number(x.cost||0), 0);
  
  return {
    period,
    from: start.toISOString().split('T')[0],
    to: end.toISOString().split('T')[0],
    appointmentsDone,
    prescriptionsDispensed,
    petsAdded,
    events,
    newPatients,
    finished,
    finishedAppointments: finished,
    totalProfit,
    totalRevenue: totalProfit
  };
};

// Procedure repository functions
window.repoAddProcedure = async function(petId, procedure) {
  if (window.USE_API) {
      await window.Api.pets.addProcedure(petId, procedure);
    return;
  }
  const pets = await repoListPets();
  const pet = pets.find(p => p.id == petId);
  if (pet) {
    if (!pet.procedures) {
      pet.procedures = [];
    }
    const pr = {
      name: procedure.name || procedure.procedure || '',
      code: procedure.procedureCode || procedure.code || '',
      procedureCode: procedure.procedureCode || procedure.code || '',
      notes: procedure.notes || '',
      medications: procedure.medications || '',
      dosage: procedure.dosage || '',
      directions: procedure.directions || '',
      cost: Number(procedure.cost||0),
      performedAt: procedure.performedAt || procedure.date || new Date().toISOString().slice(0, 10),
      category: procedure.category || '',
      labType: procedure.labType || ''
    };
    pet.procedures.push(pr);
    localStorage.setItem('pawcare_pets', JSON.stringify(pets));
    pushRecent(`Added procedure for ${pet.name}: ${pr.name}`);
  }
};

window.repoUpdateProcedure = async function(petId, index, updated){
  const pets = await repoListPets();
  const pet = pets.find(p=>p.id==petId);
  if(!pet || !pet.procedures) return;
  const pr = {
    name: updated.name||'',
    code: updated.procedureCode || updated.code || '',
    procedureCode: updated.procedureCode || updated.code || '',
    notes: updated.notes||'',
    medications: updated.medications||'',
    dosage: updated.dosage||'',
    directions: updated.directions||'',
    cost: Number(updated.cost||0),
    performedAt: updated.performedAt || new Date().toISOString().slice(0,10),
    category: updated.category || '',
    labType: updated.labType || ''
  };
  pet.procedures[index]=pr;
  localStorage.setItem('pawcare_pets', JSON.stringify(pets));
};

window.repoDeleteProcedure = async function(petId, index){
  const pets = await repoListPets();
  const pet = pets.find(p=>p.id==petId);
  if(!pet || !pet.procedures) return;
  pet.procedures.splice(index,1);
  localStorage.setItem('pawcare_pets', JSON.stringify(pets));
};

// Helper function for file to data URL conversion
window.fileToDataURL = function(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/* ===== End of File ===== */
