// Backend API configuration - defaults to API mode for data persistence
// Ensure API_BASE is set before any API calls
if (typeof window !== 'undefined') {
  window.API_BASE = window.API_BASE ?? "http://localhost:8080/api";
  window.USE_API = window.USE_API ?? true;  // Default to API mode
}

// Check if backend is available on page load
(async function() {
  // Wait for window to be ready
  if (typeof window === 'undefined') return;
  
  // Only check if USE_API is not explicitly set
  if (window.USE_API === undefined || window.USE_API === null) {
    try {
      // Try to connect to backend
      const response = await fetch(window.API_BASE + '/auth/login', {
        method: 'OPTIONS',
        signal: AbortSignal.timeout(3000)
      });
      window.USE_API = true;
      console.log('[API] ✓ Backend detected at', window.API_BASE, '- using API mode (data will persist)');
    } catch (err) {
      // Backend not available - show warning but still try API mode
      console.warn('[API] ⚠ Backend not immediately available, but will use API mode');
      console.warn('[API] Make sure backend is running on', window.API_BASE);
      // Still set to true so it tries to use API (user needs data persistence)
      window.USE_API = true;
    }
  } else {
    console.log('[API] USE_API explicitly set to', window.USE_API);
  }
})();

window.ApiHttp = async function http(path, { method="GET", headers={}, body, timeoutMs=12000, token } = {}){
  // Ensure API_BASE is set
  if (!window.API_BASE) {
    window.API_BASE = "http://localhost:8080/api";
    console.warn('[API] API_BASE was not set, using default:', window.API_BASE);
  }
  
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), timeoutMs);
  
  const url = window.API_BASE + path;
  
  // Get token - use provided token, or get from Api.token(), or get from localStorage directly
  let authToken = token;
  if (!authToken && window.Api && typeof window.Api.token === 'function') {
    authToken = window.Api.token();
  }
  if (!authToken) {
    authToken = localStorage.getItem("jwt");
  }
  
  const authHeader = authToken ? {"Authorization":`Bearer ${authToken}`} : {};
  
  console.log(`[API] ${method} ${url}`, { hasToken: !!authToken, tokenLength: authToken ? authToken.length : 0 });
  
  try {
    const res = await fetch(url, {
    method,
    headers: {
      "Accept":"application/json",
      ...(body instanceof FormData ? {} : {"Content-Type":"application/json"}),
      ...authHeader,
      ...headers
    },
    body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
      signal: ctrl.signal,
      mode: 'cors',
      credentials: 'include'  // Changed from 'omit' to 'include' for CORS with credentials
    });
  clearTimeout(t);
    
    console.log(`[API] Response: ${res.status} ${res.statusText}`);
    
  if(!res.ok){
    const msg = await res.text().catch(()=>res.statusText);
    
    // Handle 401 Unauthorized - token expired or invalid
    if(res.status === 401){
      console.error(`[API] 401 Unauthorized - Token may be expired or invalid`);
      localStorage.removeItem("jwt");
      localStorage.removeItem("user");
      if(typeof window.handleUnauthorized === 'function'){
        window.handleUnauthorized();
      } else {
        // Redirect to login if handler not defined
        if (window.location && !window.location.pathname.includes('index.html')) {
          window.location.href = 'index.html';
        }
      }
      throw new Error("Authentication failed. Please log in again.");
    }
    
    // Handle 403 Forbidden - token missing or insufficient permissions
    if(res.status === 403){
      console.error(`[API] 403 Forbidden - Token missing or insufficient permissions`);
      const currentToken = localStorage.getItem("jwt");
      if (!currentToken) {
        // No token - redirect to login
        localStorage.removeItem("user");
        localStorage.removeItem("role");
        if (window.location && !window.location.pathname.includes('index.html')) {
          window.location.href = 'index.html';
        }
        throw new Error("Not authenticated. Please log in.");
      } else {
        // Token exists but insufficient permissions - this should rarely happen now
        // Backend should filter data instead of returning 403
        const role = localStorage.getItem("role") || "unknown";
        const errorMsg = msg && msg.length > 0 ? msg : `Action not allowed for your role (${role}).`;
        throw new Error(errorMsg);
      }
    }
    
    const error = new Error(`${res.status} ${res.statusText} — ${msg}`);
    console.error(`[API] Error:`, error);
    throw error;
  }
  const text = await res.text();
    console.log(`[API] Response body:`, text.substring(0, 200));
    try { 
      const parsed = text ? JSON.parse(text) : null;
      console.log(`[API] Parsed:`, parsed);
      return parsed;
    } catch (e) { 
      console.warn(`[API] Failed to parse JSON:`, e, text);
      return text; 
    }
  } catch (err) {
    clearTimeout(t);
    console.error(`[API] Fetch error:`, err);
    if (err.name === "AbortError") {
      throw new Error("Request timeout");
    }
    // Provide more helpful error messages
    if (err.message && err.message.includes("Failed to fetch")) {
      throw new Error("Cannot connect to backend at " + window.API_BASE + ". Please ensure:\n1. Backend is running\n2. Run: cd pawcare-backend && mvn spring-boot:run -Dspring-boot.run.profiles=h2");
    }
    throw err;
  }
};

// Define Api object (ensure it exists before app.js uses it)
window.Api = window.Api || {
  token(){ return localStorage.getItem("jwt") || null; },
  auth: {
    login: async (username, password) => {
      return ApiHttp("/auth/login", { method:"POST", body:{ username, password }, token:null });
    },
    changePassword: (username, oldPassword, newPassword) => ApiHttp("/auth/change-password", { method:"POST", body:{ username, oldPassword, newPassword } })
  },
  pets: {
    list:   () => ApiHttp("/pets",                 { token: Api.token() }),
    get:    (id)=> ApiHttp(`/pets/${id}`,          { token: Api.token() }),
    create: (p)=>  ApiHttp("/pets",                { method:"POST", body:p, token: Api.token() }),
    update: (p)=>  ApiHttp(`/pets/${p.id}`,        { method:"PUT",  body:p, token: Api.token() }),
    remove: (id)=> ApiHttp(`/pets/${id}`,          { method:"DELETE", token: Api.token() }),
    uploadPhoto: (id, file)=>{ const fd=new FormData(); fd.append("file", file); return ApiHttp(`/pets/${id}/photo`, { method:"POST", body:fd, token: Api.token() }); },
    addProcedure: (id, proc)=>{
      const payload = window.USE_API ? {
        date: proc.performedAt || proc.date,
        procedure: proc.name || proc.procedure,
        notes: proc.notes,
        vet: (typeof getUserName==='function' ? getUserName() : undefined),
        category: proc.category,
        labType: proc.labType,
        medications: proc.medications,
        procedureCode: proc.procedureCode || proc.code,
        dosage: proc.dosage,
        directions: proc.directions,
        cost: proc.cost
      } : proc;
      return ApiHttp(`/pets/${id}/procedures`, { method:"POST", body:payload, token: Api.token() });
    }
  },
  appts: {
    list:    ()    => ApiHttp("/appointments", { token: Api.token() }),
    listForVet: (name) => ApiHttp(`/appointments?vet=${encodeURIComponent(name)}`, { token: Api.token() }),
    listUnassigned: () => ApiHttp(`/appointments?unassigned=true`, { token: Api.token() }),
    get:     (id)  => ApiHttp(`/appointments/${id}`, { token: Api.token() }),
    create:  (a)   => ApiHttp("/appointments", { method:"POST", body:a, token: Api.token() }),
    update:  (a)   => ApiHttp(`/appointments/${a.id}`, { method:"PUT", body:a, token: Api.token() }),
    approve: (id)  => ApiHttp(`/appointments/${id}/approve`, { method:"POST", token: Api.token() }),
    done:    (id)  => ApiHttp(`/appointments/${id}/done`,    { method:"POST", token: Api.token() }),
    remove:  (id)  => ApiHttp(`/appointments/${id}`, { method:"DELETE", token: Api.token() })
  },
  rx: {
    list:    ()   => ApiHttp("/prescriptions", { token: Api.token() }),
    get:     (id) => ApiHttp(`/prescriptions/${id}`, { token: Api.token() }),
    create:  (r)  => ApiHttp("/prescriptions", { method:"POST", body:r, token: Api.token() }),
    update:  (r)  => ApiHttp(`/prescriptions/${r.id}`, { method:"PUT", body:r, token: Api.token() }),
    dispense:(id) => ApiHttp(`/prescriptions/${id}/dispense`, { method:"POST", token: Api.token() }),
    remove:  (id) => ApiHttp(`/prescriptions/${id}`, { method:"DELETE", token: Api.token() })
  },
  procedures: {
    catalog: () => ApiHttp("/procedures/catalog", { token: Api.token() })
  },
  users: {
    list:   ()   => ApiHttp("/users", { token: Api.token() }),
    get:    (id) => ApiHttp(`/users/${id}`, { token: Api.token() }),
    create: (u)  => ApiHttp("/users", { method:"POST", body:u, token: Api.token() }),
    update: (u)  => ApiHttp(`/users/${u.id}`, { method:"PUT", body:u, token: Api.token() }),
    remove: (id) => ApiHttp(`/users/${id}`, { method:"DELETE", token: Api.token() }),
    vets:   ()   => ApiHttp("/users/vets", { token: Api.token() })
  },
  reports: {
    summary: (period, from, to) => {
      const q = new URLSearchParams({ period, ...(from?{from}:{}) , ...(to?{to}:{}) }).toString();
      return ApiHttp(`/reports/summary?${q}`, { token: Api.token() });
    },
    log: (from, to) => {
      const q = new URLSearchParams({ from, to }).toString();
      return ApiHttp(`/ops/log?${q}`, { token: Api.token() });
    }
  }
};
