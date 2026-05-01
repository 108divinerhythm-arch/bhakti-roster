import { useState, useEffect } from "react";

// ─── GOOGLE SHEETS API ─────────────────────────────────────────────────────────
const SHEETS_URL = "https://script.google.com/macros/s/AKfycbzxZEqtWxiYNlW0eaFwr1XAwcgGElaKov_EHWK7uaIkAY62B5QLLK4Z7nQaG1OVN5f4/exec";

async function sheetsPost(payload) {
  try {
    const res = await fetch(SHEETS_URL, { method:"POST", body:JSON.stringify(payload) });
    return await res.json();
  } catch(e) { return { error: e.toString() }; }
}
async function sheetsGet(params) {
  try {
    const res = await fetch(SHEETS_URL + "?" + new URLSearchParams(params).toString());
    return await res.json();
  } catch(e) { return { error: e.toString() }; }
}

// ─── SERVICES / ROLES ──────────────────────────────────────────────────────────
const ALL_SERVICES = [
  { id:"kids1",   label:"Kids Class 1",      session:"morning", icon:"🌱" },
  { id:"kids2",   label:"Kids Class 2",      session:"morning", icon:"📖" },
  { id:"adult",   label:"Adult Class",       session:"morning", icon:"🕊️" },
  { id:"manager", label:"Program Manager",   session:"morning", icon:"📋" },
  { id:"setup",   label:"Setup",             session:"evening", icon:"🏮" },
  { id:"aarati",  label:"Aarati",            session:"evening", icon:"🪔" },
  { id:"bgclass", label:"Bhagavad Gita Class",session:"evening",icon:"📿" },
  { id:"bhajan",  label:"Bhajan Singing",    session:"evening", icon:"🎵" },
];

const MORNING_ROLES = [
  { id:"kids1",   label:"Kids Class 1",      desc:"Ages up to 8 · Vedic culture & values", time:"9:30–11:00 AM", icon:"🌱" },
  { id:"kids2",   label:"Kids Class 2",      desc:"Ages 9–16 · Deeper exploration",         time:"9:30–11:00 AM", icon:"📖" },
  { id:"adult",   label:"Adult Class",       desc:"Bhagavad Gita discourse for parents",    time:"9:30–11:00 AM", icon:"🕊️" },
  { id:"manager", label:"Program Manager",   desc:"Coordinates the morning session",        time:"9:00–11:30 AM", icon:"📋" },
];
const EVENING_ROLES = [
  { id:"setup",   label:"Setup",               desc:"Venue setup & decoration",    time:"4:00–5:00 PM", icon:"🏮" },
  { id:"aarati",  label:"Aarati",              desc:"Sacred lamp ceremony",        time:"5:00–5:30 PM", icon:"🪔" },
  { id:"bgclass", label:"Bhagavad Gita Class", desc:"Evening discourse",           time:"5:30–6:30 PM", icon:"📿" },
  { id:"bhajan",  label:"Bhajan Singing",      desc:"Devotional kirtan & singing", time:"5:00–7:00 PM", icon:"🎵" },
];
const EVENING_VENUES = ["Pendicup Community Centre, Warner","Bray Hall Community Centre, Petrie"];
const MORNING_VENUE  = "Pendicup Community Centre, Samsonvale Road, Warner QLD 4500";
const DEFAULT_COOKING = [
  { id:"g1", name:"South Indian Devotees",  color:"#c0622a" },
  { id:"g2", name:"North Indian Devotees",  color:"#2d7d9a" },
  { id:"g3", name:"Fijian Devotees",        color:"#3a8a5c" },
  { id:"g4", name:"International Devotees", color:"#7a4fa0" },
];
const SEED_USERS = [
  { id:"admin", name:"Keshav Kandel",  email:"108divinerhythm@gmail.com", password:"BYF2025admin", role:"admin",   services:[] },
  { id:"u1",    name:"Senshil Chand",  email:"senshilk@gmail.com",        password:"bhakti123",    role:"devotee", services:["kids1","adult","bhajan"] },
  { id:"u2",    name:"Komal Chand",    email:"komal@gmail.com",           password:"bhakti123",    role:"devotee", services:["kids2","manager","setup"] },
  { id:"u3",    name:"Rahul Kumar",    email:"rahul@gmail.com",           password:"bhakti123",    role:"devotee", services:["adult","bgclass","aarati"] },
  { id:"u4",    name:"Roneel Narayan", email:"roneel@gmail.com",          password:"bhakti123",    role:"devotee", services:["bhajan","setup","manager"] },
];

// ─── HELPERS ───────────────────────────────────────────────────────────────────
function getSundays(y,m){ const s=[],d=new Date(y,m,1); while(d.getDay()!==0)d.setDate(d.getDate()+1); while(d.getMonth()===m){s.push(new Date(d));d.setDate(d.getDate()+7);} return s; }
function fmtLong(d) { return d.toLocaleDateString("en-AU",{weekday:"long",day:"numeric",month:"long",year:"numeric"}); }
function fmtShort(d){ return d.toLocaleDateString("en-AU",{day:"numeric",month:"short"}); }
function fmtMonth(y,m){ return new Date(y,m,1).toLocaleString("en-AU",{month:"long",year:"numeric"}); }
function buildRoster(sundays){ const r={}; sundays.forEach((_,i)=>{ r[i]={morning:{},evening:{}}; MORNING_ROLES.forEach(x=>{r[i].morning[x.id]=null;}); EVENING_ROLES.forEach(x=>{r[i].evening[x.id]=null;}); }); return r; }

// ─── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const now = new Date();
  const [loading,  setLoading]  = useState(true);
  const [user,     setUser]     = useState(null);
  const [page,     setPage]     = useState("login");
  const [vy, setVy] = useState(now.getFullYear());
  const [vm, setVm] = useState(now.getMonth());
  const [sundays,  setSundays]  = useState([]);
  const [roster,   setRoster]   = useState({});
  const [cooking,  setCooking]  = useState({});
  const [venues,   setVenues]   = useState({});
  const [selWeek,  setSelWeek]  = useState(0);
  const [users,    setUsers]    = useState([]);
  const [settings, setSettings] = useState({ signupOpensDay:24, cookingGroups:DEFAULT_COOKING });
  const [localSettings, setLocalSettings] = useState(null);
  const [loginEmail,setLE]=useState(""); const [loginPass,setLP]=useState(""); const [loginErr,setLErr]=useState("");
  const [signing,  setSigning]  = useState(false);
  const [notif,    setNotif]    = useState(null);
  const [adminTab, setAdminTab] = useState("roster");
  const [newU,     setNewU]     = useState({name:"",email:"",password:"",services:[]});
  const [creating, setCreating] = useState(false);
  const [createMsg,setCreateMsg]= useState("");
  const [savingSettings,setSavingSettings]=useState(false);
  const [settingsMsg,setSettingsMsg]=useState("");
  const [_,forceUpdate]=useState(0);

  const notify=(msg,type="success")=>{ setNotif({msg,type}); setTimeout(()=>setNotif(null),5000); };
  const prevMonth=()=>{ if(vm===0){setVm(11);setVy(y=>y-1);}else setVm(m=>m-1); };
  const nextMonth=()=>{ if(vm===11){setVm(0);setVy(y=>y+1);}else setVm(m=>m+1); };
  const isOpen=(y,m)=>{ const d=settings.signupOpensDay||24; const pm=m===0?11:m-1,py=m===0?y-1:y; return now>=new Date(py,pm,d)&&now<=new Date(y,m+1,0); };

  // ── LOAD ──────────────────────────────────────────────────────────────────────
  const loadUsers = async () => {
    const res = await sheetsGet({ action:"getUsers" });
    if (res.users?.length > 0) {
      // Ensure services field exists
      const withServices = res.users.map(u => ({ ...u, services: u.services ? (typeof u.services === "string" ? JSON.parse(u.services) : u.services) : [] }));
      setUsers(withServices); return withServices;
    }
    for (const u of SEED_USERS) await sheetsPost({ action:"saveUser", user:{ ...u, services: JSON.stringify(u.services) } });
    setUsers(SEED_USERS); return SEED_USERS;
  };

  const loadSettings = async () => {
    const res = await sheetsGet({ action:"getSettings" });
    if (res.settings && Object.keys(res.settings).length > 0) {
      const s = { signupOpensDay: res.settings.signupOpensDay || 24, cookingGroups: res.settings.cookingGroups || DEFAULT_COOKING };
      setSettings(s); setLocalSettings(JSON.parse(JSON.stringify(s))); return s;
    }
    const def = { signupOpensDay:24, cookingGroups:DEFAULT_COOKING };
    setSettings(def); setLocalSettings(JSON.parse(JSON.stringify(def))); return def;
  };

  const loadRoster = async (y, m, curSettings) => {
    const s = getSundays(y,m); setSundays(s);
    const r = buildRoster(s);
    const groups = curSettings?.cookingGroups || settings.cookingGroups || DEFAULT_COOKING;
    const c = {}; s.forEach((_,i)=>{ c[i]=groups[i%groups.length]; });

    const [rosterRes, settingsRes] = await Promise.all([
      sheetsGet({ action:"getRoster", year:y, month:m }),
      sheetsGet({ action:"getSettings" }),
    ]);

    if (rosterRes.slots) {
      rosterRes.slots.forEach(slot => {
        const wi = parseInt(slot.weekIdx);
        if (slot.session==="morning" && r[wi]) r[wi].morning[slot.roleId] = slot.person;
        if (slot.session==="evening" && r[wi]) r[wi].evening[slot.roleId] = slot.person;
      });
    }

    const v = {};
    if (settingsRes.settings) {
      Object.keys(settingsRes.settings).forEach(k => {
        if (k.startsWith("venue_")) v[k.replace("venue_","")] = settingsRes.settings[k];
        if (k.startsWith(`cook_${y}_${m}_`)) {
          const wi = parseInt(k.split("_").pop());
          try { c[wi] = JSON.parse(settingsRes.settings[k]); } catch {}
        }
      });
    }
    setRoster({...r}); setCooking({...c}); setVenues(v); setSelWeek(0);
  };

  useEffect(()=>{
    (async()=>{ setLoading(true); const s=await loadSettings(); await loadUsers(); await loadRoster(vy,vm,s); setLoading(false); })();
  },[]);
  useEffect(()=>{ if(!loading) loadRoster(vy,vm,settings); },[vy,vm]);

  const handleLogin=()=>{ const u=users.find(x=>x.email.toLowerCase()===loginEmail.toLowerCase()&&x.password===loginPass); if(!u){setLErr("Incorrect email or password.");return;} setUser(u);setLErr("");setPage(u.role==="admin"?"admin":"dashboard"); };
  const handleLogout=()=>{ setUser(null);setPage("login");setLE("");setLP(""); };

  const handleSignup=async(wi,session,roleId)=>{
    if(!isOpen(vy,vm)){notify("Sign-ups open on the "+settings.signupOpensDay+"th of the previous month.","error");return;}
    setSigning(true);
    await sheetsPost({ action:"saveRosterSlot", year:vy, month:vm, weekIdx:wi, session, roleId, person:{id:user.id,name:user.name,email:user.email} });
    await loadRoster(vy,vm,settings); setSigning(false);
    notify("✓ Signed up for "+((session==="morning"?MORNING_ROLES:EVENING_ROLES).find(r=>r.id===roleId)?.label));
  };

  const handleClearSlot=async(wi,session,roleId)=>{
    await sheetsPost({ action:"saveRosterSlot", year:vy, month:vm, weekIdx:wi, session, roleId, person:null });
    await loadRoster(vy,vm,settings); notify("Slot cleared.");
  };

  const handleAssign=async(wi,session,roleId,uid)=>{
    const u=users.find(x=>x.id===uid); if(!u)return;
    await sheetsPost({ action:"saveRosterSlot", year:vy, month:vm, weekIdx:wi, session, roleId, person:{id:u.id,name:u.name,email:u.email} });
    await loadRoster(vy,vm,settings);
    notify(`Assigned ${u.name}`);
  };

  const handleSetCooking=async(wi,group)=>{ setCooking(p=>({...p,[wi]:group})); await sheetsPost({ action:"saveSettings", settings:{ [`cook_${vy}_${vm}_${wi}`]:JSON.stringify(group) } }); notify("Cooking group updated!"); };
  const handleSetVenue=async(wi,venue)=>{ const k=`${vy}-${vm}-${wi}`; setVenues(p=>({...p,[k]:venue})); await sheetsPost({ action:"saveSettings", settings:{ [`venue_${k}`]:venue } }); notify("Venue updated!"); };
  const getVenue=(wi)=>venues[`${vy}-${vm}-${wi}`]||EVENING_VENUES[0];

  const handleCreateUser=async()=>{
    if(!newU.name||!newU.email||!newU.password){setCreateMsg("Please fill in all fields.");return;}
    if(users.find(x=>x.email.toLowerCase()===newU.email.toLowerCase())){setCreateMsg("Email already exists.");return;}
    setCreating(true);
    const u={id:"u"+Date.now(),name:newU.name,email:newU.email,password:newU.password,role:"devotee",services:newU.services};
    await sheetsPost({ action:"saveUser", user:{...u,services:JSON.stringify(u.services)} });
    await loadUsers(); setCreating(false);
    setCreateMsg(`✓ Account created for ${newU.name}.`);
    setNewU({name:"",email:"",password:"",services:[]});
    setTimeout(()=>setCreateMsg(""),5000);
  };

  const handleDeleteUser=async(id)=>{
    await sheetsPost({ action:"deleteUser", userId:id });
    await loadUsers(); notify("Devotee removed.");
  };

  const handleChangePassword=async(id,newPw)=>{
    const u=users.find(x=>x.id===id); if(!u)return;
    const updated={...u,services:JSON.stringify(u.services||[]),password:newPw};
    await sheetsPost({ action:"saveUser", user:updated });
    await loadUsers(); notify("Password updated for "+u.name);
  };

  const handleUpdateServices=async(id,services)=>{
    const u=users.find(x=>x.id===id); if(!u)return;
    await sheetsPost({ action:"saveUser", user:{...u,services:JSON.stringify(services)} });
    await loadUsers(); notify("Services updated.");
  };

  const handleSaveSettings=async()=>{
    setSavingSettings(true);
    await sheetsPost({ action:"saveSettings", settings:localSettings });
    setSettings({...localSettings}); setSavingSettings(false);
    setSettingsMsg("✓ Settings saved!"); setTimeout(()=>setSettingsMsg(""),4000);
    notify("Settings saved to Google Sheets!");
    await loadRoster(vy,vm,localSettings);
  };

  // Devotees who can do a specific role
  const devoteesByRole=(roleId)=> users.filter(u=>u.role!=="admin"&&(u.services||[]).includes(roleId));

  const myServices=()=>{
    if(!user||!sundays.length)return[];
    const out=[];
    sundays.forEach((sunday,wi)=>{
      if(!roster[wi])return;
      MORNING_ROLES.forEach(r=>{if(roster[wi].morning[r.id]?.id===user.id)out.push({wi,sunday,session:"Morning",role:r.label,time:r.time});});
      EVENING_ROLES.forEach(r=>{if(roster[wi].evening[r.id]?.id===user.id)out.push({wi,sunday,session:"Evening",role:r.label,time:r.time});});
    });
    return out;
  };

  const open=isOpen(vy,vm);
  const devotees=users.filter(x=>x.role!=="admin");

  if(loading) return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"linear-gradient(150deg,#fdf3e3,#fde9cc,#e8f2f7)"}}>
      <div style={{fontSize:56,marginBottom:20}}>🪷</div>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:"#c8922a",marginBottom:12}}>Bhakti Yoga Foundation</div>
      <div style={{fontFamily:"Lato,sans-serif",fontSize:14,color:"#7a5c3a"}}>Loading from Google Sheets…</div>
    </div>
  );

  return (
    <div style={S.root}>
      <style>{css}</style>
      <div style={S.bg1}/><div style={S.bg2}/>
      {notif&&<div className="ai" style={{...S.notif,background:notif.type==="error"?"#7a1515":"#1a4230"}}>{notif.msg}</div>}

      {user&&(
        <header style={S.hdr}>
          <div style={S.hdrIn}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:26}}>🪷</span>
              <div><div style={S.bName}>BHAKTI YOGA FOUNDATION</div><div style={S.bSub}>Simple Living · High Thinking</div></div>
            </div>
            <nav style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              {user.role!=="admin"&&<><NB active={page==="dashboard"} onClick={()=>setPage("dashboard")}>My Services</NB><NB active={page==="roster"} onClick={()=>setPage("roster")}>Roster</NB></>}
              {user.role==="admin"&&<NB active onClick={()=>setPage("admin")}>Admin Panel</NB>}
              <div style={S.chip}><Av name={user.name}/><span style={{color:"#c8922a",fontFamily:"Lato,sans-serif",fontSize:13}}>{user.name.split(" ")[0]}</span><button style={S.logoutBtn} onClick={handleLogout}>Sign out</button></div>
            </nav>
          </div>
        </header>
      )}

      <main style={{...S.main,paddingTop:user?90:0}}>

        {/* LOGIN */}
        {page==="login"&&(
          <div className="ai" style={S.lWrap}>
            <div style={S.lCard}>
              <div style={{fontSize:56,marginBottom:16}}>🪷</div>
              <div style={S.lTitle}>Bhakti Yoga Foundation</div>
              <div style={{fontFamily:"Lato,sans-serif",fontSize:13,color:"#7a5c3a",marginBottom:4}}>Volunteer Roster System</div>
              <div style={{fontFamily:"Lato,sans-serif",fontSize:11,color:"#c8922a",letterSpacing:2.5,marginBottom:32}}>SIMPLE LIVING · HIGH THINKING</div>
              <input style={S.inp} type="email" placeholder="Email address" value={loginEmail} onChange={e=>setLE(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()}/>
              <input style={{...S.inp,marginTop:10}} type="password" placeholder="Password" value={loginPass} onChange={e=>setLP(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()}/>
              {loginErr&&<div style={{color:"#8b1a1a",fontFamily:"Lato,sans-serif",fontSize:13,marginTop:8,textAlign:"left"}}>{loginErr}</div>}
              <button style={{...S.primBtn,marginTop:18}} onClick={handleLogin}>Sign In 🙏</button>
              <div style={{marginTop:18,fontFamily:"Lato,sans-serif",fontSize:12,color:"#bbb"}}>Contact your admin to receive login details</div>
            </div>
          </div>
        )}

        {/* DASHBOARD */}
        {page==="dashboard"&&user&&(
          <div className="ai" style={S.pw}>
            <h1 style={S.pH}>Hare Krishna, {user.name.split(" ")[0]}! 🙏</h1>
            <p style={S.pS}>Your upcoming services</p>
            <MN y={vy} m={vm} onP={prevMonth} onN={nextMonth}/>
            {open
              ?<div style={S.openBan}><span style={{fontSize:22}}>🔓</span><div><div style={{fontWeight:"bold",fontSize:15}}>Roster open for {fmtMonth(vy,vm)}</div><div style={{fontSize:13,opacity:0.85,marginTop:2,fontFamily:"Lato,sans-serif"}}>Go to Roster to sign up</div></div><button style={S.goBtn} onClick={()=>setPage("roster")}>Go to Roster →</button></div>
              :<div style={S.closeBan}><span style={{fontSize:20}}>🔒</span><div style={{fontFamily:"Lato,sans-serif",fontSize:14}}><strong>Sign-ups open on the {settings.signupOpensDay}th</strong> of the previous month.</div></div>
            }
            {myServices().length===0
              ?<div style={S.empty}><div style={{fontSize:40,marginBottom:12}}>📋</div><div style={{fontSize:15,color:"#7a5c3a",fontFamily:"Lato,sans-serif"}}>No services for {fmtMonth(vy,vm)} yet.</div>{open&&<button style={{...S.primBtn,marginTop:16,width:"auto",padding:"10px 28px"}} onClick={()=>setPage("roster")}>Go to Roster</button>}</div>
              :<div style={S.sGrid}>{myServices().map((s,i)=>(
                <div key={i} className="si" style={{...S.sCard,animationDelay:`${i*0.07}s`}}>
                  <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:10}}><span style={{fontSize:24}}>{s.session==="Morning"?"🌅":"🌙"}</span><div><div style={{fontWeight:"bold",fontSize:15}}>{s.role}</div><div style={{fontFamily:"Lato,sans-serif",fontSize:12,color:"#7a5c3a",marginTop:2}}>{s.session} · {s.time}</div></div></div>
                  <div style={{fontFamily:"Lato,sans-serif",fontSize:13,color:"#3d2b10",marginBottom:6}}>{fmtLong(s.sunday)}</div>
                  <div style={{fontFamily:"Lato,sans-serif",fontSize:11,color:"#bbb",fontStyle:"italic"}}>To make changes, speak to admin</div>
                </div>
              ))}</div>
            }
          </div>
        )}

        {/* ROSTER */}
        {page==="roster"&&user&&(
          <div className="ai" style={S.pw}>
            <h1 style={S.pH}>Monthly Roster</h1>
            <p style={S.pS}>{fmtMonth(vy,vm)} · Sign up for your services</p>
            <MN y={vy} m={vm} onP={prevMonth} onN={nextMonth}/>
            <div style={open?S.openBan:S.closeBan}>
              <span style={{fontSize:20}}>{open?"🔓":"🔒"}</span>
              <div style={{fontFamily:"Lato,sans-serif",fontSize:14}}>{open?<><strong>Roster is open</strong> — click any role to sign up</>:<><strong>Not open yet.</strong> Opens on the {settings.signupOpensDay}th of the previous month.</>}</div>
            </div>
            <WT sundays={sundays} sel={selWeek} onSel={setSelWeek}/>
            {sundays[selWeek]&&<>
              <div style={S.dayLbl}>☀️ {fmtLong(sundays[selWeek])}</div>
              <Sec icon="🍛" title="Evening Cooking" sub="Assigned by monthly rotation">
                {cooking[selWeek]&&<div style={{...S.cookB,background:cooking[selWeek].color+"18",borderColor:cooking[selWeek].color}}>
                  <span style={{width:12,height:12,borderRadius:"50%",background:cooking[selWeek].color,display:"inline-block",flexShrink:0}}/>
                  <span style={{fontWeight:"bold",fontSize:15}}>{cooking[selWeek].name}</span>
                  <span style={{fontFamily:"Lato,sans-serif",fontSize:13,color:"#7a5c3a"}}>is cooking this Sunday</span>
                </div>}
              </Sec>
              <Sec icon="🌅" title="Morning Program" sub={`9:30–11:00 AM · ${MORNING_VENUE.split(",")[0]}`}>
                <div style={S.rGrid}>{MORNING_ROLES.map(role=>{const t=roster[selWeek]?.morning[role.id];const im=t?.id===user.id;return<RC key={role.id} role={role} taken={t} isMe={im} open={open} signing={signing} onSignup={()=>handleSignup(selWeek,"morning",role.id)}/>;})}</div>
              </Sec>
              <Sec icon="🌙" title="Evening Festival" sub={`5:00–7:00 PM · ${getVenue(selWeek)}`}>
                <div style={S.rGrid}>{EVENING_ROLES.map(role=>{const t=roster[selWeek]?.evening[role.id];const im=t?.id===user.id;return<RC key={role.id} role={role} taken={t} isMe={im} open={open} signing={signing} onSignup={()=>handleSignup(selWeek,"evening",role.id)}/>;})}</div>
              </Sec>
            </>}
          </div>
        )}

        {/* ADMIN */}
        {page==="admin"&&user?.role==="admin"&&(
          <div className="ai" style={S.pw}>
            <h1 style={S.pH}>Admin Panel</h1>
            <p style={S.pS}>All data saved to Google Sheets ✓</p>
            <div style={{display:"flex",gap:8,marginBottom:24,flexWrap:"wrap"}}>
              {["roster","devotees","settings"].map(t=>(
                <button key={t} onClick={()=>setAdminTab(t)} style={{...S.atab,...(adminTab===t?S.atabOn:{})}}>{t==="roster"?"📋 Roster":t==="devotees"?"👥 Devotees":"⚙️ Settings"}</button>
              ))}
            </div>

            {/* ROSTER TAB */}
            {adminTab==="roster"&&<>
              <MN y={vy} m={vm} onP={prevMonth} onN={nextMonth}/>
              <WT sundays={sundays} sel={selWeek} onSel={setSelWeek}/>
              {sundays[selWeek]&&<>
                <div style={S.dayLbl}>☀️ {fmtLong(sundays[selWeek])}</div>
                <div style={S.aC}><div style={S.aCT}>🏛️ Evening Venue — {fmtShort(sundays[selWeek])}</div>
                  <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                    {EVENING_VENUES.map(v=>{const a=getVenue(selWeek)===v;return<button key={v} onClick={()=>handleSetVenue(selWeek,v)} style={{background:a?"#2d7d9a":"#2d7d9a18",color:a?"#fff":"#2d7d9a",border:"2px solid #2d7d9a",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontFamily:"Lato,sans-serif",fontSize:13,fontWeight:"bold"}}>{v}</button>;})}</div></div>
                <div style={S.aC}><div style={S.aCT}>🍛 Cooking Group — {fmtShort(sundays[selWeek])}</div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {settings.cookingGroups.map(g=>{const on=cooking[selWeek]?.id===g.id;return<button key={g.id} style={{background:on?g.color:g.color+"22",color:on?"#fff":g.color,border:`2px solid ${g.color}`,borderRadius:8,padding:"8px 14px",cursor:"pointer",fontFamily:"Lato,sans-serif",fontSize:13,fontWeight:"bold"}} onClick={()=>handleSetCooking(selWeek,g)}>{g.name}</button>;})}</div></div>
                <div style={S.aC}><div style={S.aCT}>🌅 Morning Program</div>
                  <div style={S.aGrid}>{MORNING_ROLES.map(role=>{const p=roster[selWeek]?.morning[role.id];const eligible=devoteesByRole(role.id);return<AS key={role.id} role={role} person={p} eligible={eligible} allDevotees={devotees} onClear={()=>handleClearSlot(selWeek,"morning",role.id)} onAssign={uid=>handleAssign(selWeek,"morning",role.id,uid)}/>;})}</div></div>
                <div style={S.aC}><div style={S.aCT}>🌙 Evening Festival · {getVenue(selWeek)}</div>
                  <div style={S.aGrid}>{EVENING_ROLES.map(role=>{const p=roster[selWeek]?.evening[role.id];const eligible=devoteesByRole(role.id);return<AS key={role.id} role={role} person={p} eligible={eligible} allDevotees={devotees} onClear={()=>handleClearSlot(selWeek,"evening",role.id)} onAssign={uid=>handleAssign(selWeek,"evening",role.id,uid)}/>;})}</div></div>
              </>}
            </>}

            {/* DEVOTEES TAB */}
            {adminTab==="devotees"&&<>
              <div style={S.aC}>
                <div style={S.aCT}>➕ Add New Devotee</div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  <input style={S.inp} placeholder="Full name" value={newU.name} onChange={e=>setNewU(u=>({...u,name:e.target.value}))}/>
                  <input style={S.inp} type="email" placeholder="Email address" value={newU.email} onChange={e=>setNewU(u=>({...u,email:e.target.value}))}/>
                  <input style={S.inp} placeholder="Set password" value={newU.password} onChange={e=>setNewU(u=>({...u,password:e.target.value}))}/>
                </div>
                <div style={{marginTop:16,marginBottom:8,fontFamily:"Lato,sans-serif",fontSize:13,fontWeight:"bold",color:"#3d2b10"}}>Services this devotee can perform:</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8,marginBottom:16}}>
                  {ALL_SERVICES.map(svc=>{
                    const checked=newU.services.includes(svc.id);
                    return <label key={svc.id} style={{display:"flex",alignItems:"center",gap:8,background:checked?"#e07b3918":"#f8f4ee",border:`1.5px solid ${checked?"#e07b39":"#f5e6c8"}`,borderRadius:8,padding:"8px 12px",cursor:"pointer",fontFamily:"Lato,sans-serif",fontSize:13}}>
                      <input type="checkbox" checked={checked} onChange={()=>{const s=checked?newU.services.filter(x=>x!==svc.id):[...newU.services,svc.id];setNewU(u=>({...u,services:s}));}} style={{width:16,height:16,accentColor:"#e07b39"}}/>
                      <span>{svc.icon} {svc.label}</span>
                      <span style={{fontSize:10,color:"#aaa",marginLeft:"auto"}}>{svc.session==="morning"?"AM":"PM"}</span>
                    </label>;
                  })}
                </div>
                <button style={{...S.primBtn,width:"auto",padding:"11px 24px",opacity:creating?0.7:1}} onClick={handleCreateUser} disabled={creating}>{creating?"Creating…":"Create Account"}</button>
                {createMsg&&<div style={{marginTop:12,fontSize:13,fontFamily:"Lato,sans-serif",color:createMsg.startsWith("✓")?"#2d6a4f":"#8b1a1a"}}>{createMsg}</div>}
              </div>

              <div style={S.aC}>
                <div style={S.aCT}>👥 All Devotees ({devotees.length})</div>
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  {users.map(u=><DR key={u.id} u={u} onDelete={()=>handleDeleteUser(u.id)} onChangePw={pw=>handleChangePassword(u.id,pw)} onUpdateServices={svcs=>handleUpdateServices(u.id,svcs)}/>)}
                </div>
              </div>
            </>}

            {/* SETTINGS TAB */}
            {adminTab==="settings"&&localSettings&&<>
              <div style={S.aC}>
                <div style={S.aCT}>📅 Roster Sign-up Window</div>
                <div style={{fontFamily:"Lato,sans-serif",fontSize:13,color:"#7a5c3a",marginBottom:14}}>Devotees can sign up for next month starting from this day of the current month.</div>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <label style={{fontFamily:"Lato,sans-serif",fontSize:14,color:"#3d2b10",fontWeight:"bold"}}>Sign-ups open on day:</label>
                  <input type="number" min="1" max="28" style={{...S.inp,width:80,textAlign:"center"}} value={localSettings.signupOpensDay} onChange={e=>setLocalSettings(s=>({...s,signupOpensDay:parseInt(e.target.value)||24}))}/>
                  <span style={{fontFamily:"Lato,sans-serif",fontSize:13,color:"#7a5c3a"}}>of each month</span>
                </div>
              </div>
              <div style={S.aC}>
                <div style={S.aCT}>🍛 Cooking Groups</div>
                <div style={{fontFamily:"Lato,sans-serif",fontSize:13,color:"#7a5c3a",marginBottom:14}}>Edit names and colours. They rotate automatically each Sunday.</div>
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  {localSettings.cookingGroups.map((g,i)=>(
                    <div key={g.id} style={{display:"flex",alignItems:"center",gap:12}}>
                      <div style={{width:16,height:16,borderRadius:"50%",background:g.color,flexShrink:0}}/>
                      <input style={{...S.inp,flex:1}} value={g.name} onChange={e=>{const cg=[...localSettings.cookingGroups];cg[i]={...cg[i],name:e.target.value};setLocalSettings(s=>({...s,cookingGroups:cg}));}}/>
                      <div style={{display:"flex",gap:6}}>
                        {["#c0622a","#2d7d9a","#3a8a5c","#7a4fa0","#b5860d","#8b2252"].map(col=>(
                          <button key={col} onClick={()=>{const cg=[...localSettings.cookingGroups];cg[i]={...cg[i],color:col};setLocalSettings(s=>({...s,cookingGroups:cg}));}} style={{width:20,height:20,borderRadius:"50%",background:col,border:g.color===col?"3px solid #1a1209":"2px solid transparent",cursor:"pointer"}}/>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={S.aC}>
                <div style={S.aCT}>🌅 Morning Venue (Fixed)</div>
                <div style={{fontFamily:"Lato,sans-serif",fontSize:14,color:"#3d2b10",background:"#f8f4ee",padding:"12px 16px",borderRadius:8,border:"1px solid #f5e6c8"}}>📍 {MORNING_VENUE}</div>
                <div style={{fontFamily:"Lato,sans-serif",fontSize:12,color:"#bbb",marginTop:8,fontStyle:"italic"}}>Evening venue is set per-Sunday in the Roster tab.</div>
              </div>
              <div style={S.aC}>
                <div style={S.aCT}>🔐 Change Admin Password</div>
                <APW onSave={pw=>handleChangePassword(user.id,pw)}/>
              </div>
              <button style={{...S.primBtn,width:"auto",padding:"13px 32px",opacity:savingSettings?0.7:1}} onClick={handleSaveSettings} disabled={savingSettings}>{savingSettings?"Saving…":"💾 Save All Settings"}</button>
              {settingsMsg&&<div style={{marginTop:12,fontFamily:"Lato,sans-serif",fontSize:13,color:"#2d6a4f",fontWeight:"bold"}}>{settingsMsg}</div>}
            </>}
          </div>
        )}
      </main>
      <footer style={S.footer}>Bhakti Yoga Foundation · ABN 88 219 281 244 · ACNC Registered Charity · Queensland, Australia</footer>
    </div>
  );
}

// ─── SUB-COMPONENTS ────────────────────────────────────────────────────────────
function Av({name}){ return <div style={{width:30,height:30,borderRadius:"50%",background:"#c8922a",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:"bold",fontFamily:"Lato,sans-serif",flexShrink:0}}>{name[0]}</div>; }
function NB({active,onClick,children}){ return <button onClick={onClick} style={{background:"transparent",border:`1px solid ${active?"#c8922a":"#a0856a55"}`,color:active?"#c8922a":"#a0856a",padding:"7px 16px",borderRadius:5,cursor:"pointer",fontFamily:"Lato,sans-serif",fontSize:13,fontWeight:active?"700":"400"}}>{children}</button>; }
function MN({y,m,onP,onN}){ return <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:20,marginBottom:20}}><button onClick={onP} style={{background:"none",border:"2px solid #c8922a",color:"#c8922a",width:36,height:36,borderRadius:"50%",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button><div style={{fontSize:22,fontFamily:"'Playfair Display',serif",fontWeight:"bold",color:"#1a1209",minWidth:200,textAlign:"center"}}>{fmtMonth(y,m)}</div><button onClick={onN} style={{background:"none",border:"2px solid #c8922a",color:"#c8922a",width:36,height:36,borderRadius:"50%",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>›</button></div>; }
function WT({sundays,sel,onSel}){ return <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>{sundays.map((s,i)=><button key={i} onClick={()=>onSel(i)} style={{background:sel===i?"#e07b39":"rgba(255,255,255,0.8)",border:`1.5px solid ${sel===i?"#e07b39":"#f5e6c8"}`,color:sel===i?"#fff":"#3d2b10",borderRadius:10,padding:"10px 20px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,minWidth:110}}><span style={{fontSize:11,opacity:0.8,textTransform:"uppercase",letterSpacing:1,fontFamily:"Lato,sans-serif"}}>Week {i+1}</span><span style={{fontSize:17,fontWeight:"bold",fontFamily:"'Playfair Display',serif"}}>{fmtShort(s)}</span></button>)}</div>; }
function Sec({icon,title,sub,children}){ return <div style={{background:"rgba(255,255,255,0.85)",borderRadius:16,padding:"22px 26px",marginBottom:20,boxShadow:"0 4px 20px rgba(0,0,0,0.06)",border:"1px solid #f5e6c8"}}><div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:16}}><span style={{fontSize:26}}>{icon}</span><div><div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:"bold",color:"#1a1209"}}>{title}</div><div style={{fontFamily:"Lato,sans-serif",fontSize:12,color:"#7a5c3a",marginTop:2}}>{sub}</div></div></div>{children}</div>; }

function RC({role,taken,isMe,open,signing,onSignup}){
  return <div style={{background:taken?(isMe?"#e6f4ed":"#f8f4ee"):"#fff",border:`1.5px solid ${taken?(isMe?"#3a8a5c55":"#e0d4b0"):"#f5e6c8"}`,borderRadius:12,padding:"16px",display:"flex",flexDirection:"column",gap:8}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:"bold",color:"#1a1209",lineHeight:1.3}}>{role.icon} {role.label}</div><div style={{fontFamily:"Lato,sans-serif",fontSize:11,color:"#7a5c3a",whiteSpace:"nowrap",marginLeft:6}}>{role.time}</div></div>
    <div style={{fontFamily:"Lato,sans-serif",fontSize:12,color:"#7a5c3a",flex:1}}>{role.desc}</div>
    {taken?<div style={{background:isMe?"#3a8a5c":"#2d7d9a",color:"#fff",padding:"6px 12px",borderRadius:6,fontSize:12,fontFamily:"Lato,sans-serif",fontWeight:"bold"}}>{isMe?"✓ You":`✓ ${taken.name}`}</div>
    :open?<button onClick={onSignup} disabled={signing} style={{background:"linear-gradient(135deg,#e07b39,#c8922a)",color:"#fff",border:"none",borderRadius:8,padding:"8px",cursor:"pointer",fontFamily:"Lato,sans-serif",fontSize:13,fontWeight:"bold",opacity:signing?0.7:1}}>{signing?"Saving…":"Sign Up"}</button>
    :<div style={{fontFamily:"Lato,sans-serif",fontSize:11,color:"#ccc",fontStyle:"italic"}}>Not open yet</div>}
  </div>;
}

function AS({role,person,eligible,allDevotees,onClear,onAssign}){
  const [show,setShow]=useState(false);
  const hasEligible=eligible.length>0;
  return <div style={{background:"#f8f4ee",borderRadius:10,padding:"12px 14px"}}>
    <div style={{fontFamily:"Lato,sans-serif",fontSize:12,color:"#7a5c3a",fontWeight:"bold",marginBottom:6}}>{role.icon} {role.label}</div>
    {!hasEligible&&!person&&<div style={{fontFamily:"Lato,sans-serif",fontSize:11,color:"#e07b39",fontStyle:"italic",marginBottom:6}}>⚠️ No devotees assigned to this service</div>}
    {person?<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:6}}><span style={{fontFamily:"Lato,sans-serif",fontSize:13,fontWeight:"bold",color:"#1a1209"}}>{person.name}</span><button onClick={onClear} style={{background:"#8b1a1a",color:"#fff",border:"none",borderRadius:4,padding:"3px 8px",cursor:"pointer",fontSize:11,fontFamily:"Lato,sans-serif"}}>Clear</button></div>
    :show?<div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
        <select onChange={e=>{if(e.target.value){onAssign(e.target.value);setShow(false);}}} style={{flex:1,padding:"5px 8px",borderRadius:6,border:"1px solid #f5e6c8",fontFamily:"Lato,sans-serif",fontSize:12,background:"#fff"}}>
          <option value="">Select devotee…</option>
          {eligible.length>0&&<optgroup label="✓ Assigned to this service">{eligible.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</optgroup>}
          {allDevotees.filter(u=>!eligible.find(e=>e.id===u.id)).length>0&&<optgroup label="— Other devotees">{allDevotees.filter(u=>!eligible.find(e=>e.id===u.id)).map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</optgroup>}
        </select>
        <button onClick={()=>setShow(false)} style={{background:"none",border:"none",cursor:"pointer",color:"#7a5c3a",fontSize:16}}>×</button>
      </div>
    :<button onClick={()=>setShow(true)} style={{background:"#2d7d9a22",color:"#2d7d9a",border:"1px dashed #2d7d9a",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontFamily:"Lato,sans-serif",fontSize:12,width:"100%"}}>+ Assign {hasEligible?`(${eligible.length} available)`:""}</button>}
  </div>;
}

function DR({u,onDelete,onChangePw,onUpdateServices}){
  const [showPw,setShowPw]=useState(false);
  const [showSvc,setShowSvc]=useState(false);
  const [newPw,setNewPw]=useState("");
  const services=u.services||[];
  return <div style={{background:"#f8f4ee",borderRadius:10,padding:"12px 16px"}}>
    <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
      <Av name={u.name}/>
      <div style={{flex:1,minWidth:120}}>
        <div style={{fontWeight:"bold",fontSize:14}}>{u.name}</div>
        <div style={{fontFamily:"Lato,sans-serif",fontSize:12,color:"#7a5c3a"}}>{u.email}</div>
        {services.length>0&&<div style={{fontFamily:"Lato,sans-serif",fontSize:11,color:"#c8922a",marginTop:2}}>{services.map(s=>ALL_SERVICES.find(x=>x.id===s)?.label).filter(Boolean).join(", ")}</div>}
      </div>
      <div style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontFamily:"Lato,sans-serif",fontWeight:"bold",background:u.role==="admin"?"#c8922a22":"#2d7d9a22",color:u.role==="admin"?"#c8922a":"#2d7d9a"}}>{u.role}</div>
      <button onClick={()=>setShowSvc(!showSvc)} style={{background:"#2d7d9a22",color:"#2d7d9a",border:"1px solid #2d7d9a44",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontFamily:"Lato,sans-serif",fontSize:12}}>🛠 Services</button>
      <button onClick={()=>setShowPw(!showPw)} style={{background:"#e07b3922",color:"#e07b39",border:"1px solid #e07b3944",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontFamily:"Lato,sans-serif",fontSize:12}}>🔑 Change PW</button>
      {u.role!=="admin"&&<button onClick={onDelete} style={{background:"#8b1a1a22",color:"#8b1a1a",border:"1px solid #8b1a1a44",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontFamily:"Lato,sans-serif",fontSize:12}}>Remove</button>}
    </div>
    {showSvc&&<div style={{marginTop:12,borderTop:"1px solid #f5e6c8",paddingTop:12}}>
      <div style={{fontFamily:"Lato,sans-serif",fontSize:12,fontWeight:"bold",color:"#7a5c3a",marginBottom:8}}>Services for {u.name}:</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:6}}>
        {ALL_SERVICES.map(svc=>{
          const checked=services.includes(svc.id);
          return <label key={svc.id} style={{display:"flex",alignItems:"center",gap:6,background:checked?"#e07b3918":"#fff",border:`1px solid ${checked?"#e07b39":"#f5e6c8"}`,borderRadius:6,padding:"6px 10px",cursor:"pointer",fontFamily:"Lato,sans-serif",fontSize:12}}>
            <input type="checkbox" checked={checked} onChange={()=>{ const ns=checked?services.filter(x=>x!==svc.id):[...services,svc.id]; onUpdateServices(ns); }} style={{accentColor:"#e07b39"}}/>
            {svc.icon} {svc.label}
          </label>;
        })}
      </div>
      <button onClick={()=>setShowSvc(false)} style={{marginTop:8,background:"none",border:"none",cursor:"pointer",color:"#7a5c3a",fontFamily:"Lato,sans-serif",fontSize:12}}>Done ✓</button>
    </div>}
    {showPw&&<div style={{display:"flex",gap:8,marginTop:10,alignItems:"center"}}>
      <input style={{...S.inp,flex:1,padding:"8px 12px"}} placeholder="New password" value={newPw} onChange={e=>setNewPw(e.target.value)}/>
      <button onClick={()=>{if(newPw){onChangePw(newPw);setNewPw("");setShowPw(false);}}} style={{background:"#c8922a",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontFamily:"Lato,sans-serif",fontSize:13,fontWeight:"bold"}}>Save</button>
      <button onClick={()=>setShowPw(false)} style={{background:"none",border:"none",cursor:"pointer",color:"#7a5c3a",fontSize:18}}>×</button>
    </div>}
  </div>;
}

function APW({onSave}){
  const [pw,setPw]=useState("");
  return <div style={{display:"flex",gap:8,alignItems:"center"}}>
    <input style={{...S.inp,flex:1}} type="password" placeholder="New admin password" value={pw} onChange={e=>setPw(e.target.value)}/>
    <button onClick={()=>{if(pw){onSave(pw);setPw("");}}} style={{background:"#c8922a",color:"#fff",border:"none",borderRadius:8,padding:"12px 20px",cursor:"pointer",fontFamily:"Lato,sans-serif",fontSize:13,fontWeight:"bold",flexShrink:0}}>Update</button>
  </div>;
}

const S={
  root:{minHeight:"100vh",fontFamily:"'Playfair Display',Georgia,serif",color:"#1a1209",position:"relative",overflowX:"hidden"},
  bg1:{position:"fixed",inset:0,background:"linear-gradient(150deg,#fdf3e3 0%,#fde9cc 45%,#e8f2f7 100%)",zIndex:0},
  bg2:{position:"fixed",inset:0,backgroundImage:"radial-gradient(circle at 15% 20%,rgba(224,123,57,0.1) 0%,transparent 45%),radial-gradient(circle at 85% 75%,rgba(45,125,154,0.1) 0%,transparent 45%)",zIndex:0},
  notif:{position:"fixed",top:16,right:16,padding:"12px 22px",borderRadius:8,color:"#fff",fontFamily:"Lato,sans-serif",fontSize:14,zIndex:1000,boxShadow:"0 4px 20px rgba(0,0,0,0.25)",maxWidth:360},
  hdr:{position:"fixed",top:0,left:0,right:0,zIndex:100,background:"rgba(26,18,9,0.96)",backdropFilter:"blur(8px)",borderBottom:"2px solid #c8922a33"},
  hdrIn:{maxWidth:1000,margin:"0 auto",padding:"12px 24px",display:"flex",alignItems:"center",justifyContent:"space-between"},
  bName:{color:"#c8922a",fontSize:12,fontFamily:"Lato,sans-serif",fontWeight:"700",letterSpacing:2.5},
  bSub:{color:"#7a5c3a",fontSize:10,fontFamily:"Lato,sans-serif",letterSpacing:2,marginTop:1},
  chip:{display:"flex",alignItems:"center",gap:8,marginLeft:8,paddingLeft:12,borderLeft:"1px solid #c8922a33"},
  logoutBtn:{background:"transparent",border:"1px solid #7a5c3a55",color:"#7a5c3a",padding:"4px 10px",borderRadius:4,cursor:"pointer",fontFamily:"Lato,sans-serif",fontSize:11},
  main:{position:"relative",zIndex:1,maxWidth:1000,margin:"0 auto",padding:"0 20px 80px"},
  lWrap:{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24},
  lCard:{background:"rgba(255,255,255,0.93)",borderRadius:24,padding:"44px 40px",maxWidth:400,width:"100%",textAlign:"center",boxShadow:"0 20px 60px rgba(0,0,0,0.12)",border:"1px solid #f5e6c8"},
  lTitle:{fontSize:24,fontWeight:"bold",color:"#1a1209",marginBottom:4},
  inp:{padding:"12px 16px",borderRadius:8,border:"1.5px solid #f5e6c8",fontSize:14,fontFamily:"Lato,sans-serif",outline:"none",background:"#fff",color:"#1a1209",width:"100%",display:"block"},
  primBtn:{background:"linear-gradient(135deg,#e07b39,#c8922a)",color:"#fff",border:"none",borderRadius:10,padding:"13px",cursor:"pointer",fontFamily:"Lato,sans-serif",fontSize:14,fontWeight:"700",width:"100%",letterSpacing:0.5},
  pw:{paddingTop:32},
  pH:{fontFamily:"'Playfair Display',serif",fontSize:28,fontWeight:"bold",color:"#1a1209",marginBottom:4},
  pS:{fontFamily:"Lato,sans-serif",fontSize:14,color:"#7a5c3a",marginBottom:24},
  openBan:{display:"flex",alignItems:"center",gap:14,background:"rgba(45,125,154,0.1)",border:"1.5px solid #2d7d9a44",borderRadius:12,padding:"14px 18px",marginBottom:20,flexWrap:"wrap"},
  closeBan:{display:"flex",alignItems:"center",gap:14,background:"rgba(200,146,42,0.08)",border:"1.5px solid #c8922a44",borderRadius:12,padding:"14px 18px",marginBottom:20},
  goBtn:{marginLeft:"auto",background:"#2d7d9a",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontFamily:"Lato,sans-serif",fontSize:13,fontWeight:"bold",flexShrink:0},
  empty:{background:"rgba(255,255,255,0.7)",borderRadius:16,padding:"44px",textAlign:"center",border:"1px solid #f5e6c8"},
  sGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:16},
  sCard:{background:"rgba(255,255,255,0.9)",border:"1px solid #f5e6c8",borderRadius:14,padding:"20px",boxShadow:"0 4px 16px rgba(0,0,0,0.05)"},
  dayLbl:{fontFamily:"Lato,sans-serif",fontSize:14,color:"#7a5c3a",fontStyle:"italic",marginBottom:20,background:"rgba(255,255,255,0.6)",borderRadius:8,padding:"10px 16px",border:"1px solid #f5e6c8"},
  cookB:{display:"flex",alignItems:"center",gap:12,padding:"14px 18px",borderRadius:10,border:"2px solid"},
  rGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12},
  atab:{background:"rgba(255,255,255,0.7)",border:"1.5px solid #f5e6c8",borderRadius:8,padding:"10px 20px",cursor:"pointer",fontFamily:"Lato,sans-serif",fontSize:14,color:"#7a5c3a"},
  atabOn:{background:"#1a1209",color:"#c8922a",border:"1.5px solid #c8922a"},
  aC:{background:"rgba(255,255,255,0.88)",borderRadius:14,padding:"22px 24px",marginBottom:18,border:"1px solid #f5e6c8",boxShadow:"0 4px 16px rgba(0,0,0,0.05)"},
  aCT:{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:"bold",color:"#1a1209",marginBottom:14},
  aGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10},
  footer:{position:"relative",zIndex:1,background:"#1a1209",color:"#7a5c3a",textAlign:"center",padding:"18px 24px",fontSize:11,fontFamily:"Lato,sans-serif",letterSpacing:0.8},
};

const css=`
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Lato:wght@300;400;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  button:hover{filter:brightness(1.08);}
  input:focus,select:focus{outline:2px solid #c8922a;outline-offset:1px;}
  ::-webkit-scrollbar{width:6px;} ::-webkit-scrollbar-thumb{background:#c8922a44;border-radius:3px;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}
  @keyframes slideIn{from{opacity:0;transform:translateX(-8px);}to{opacity:1;transform:translateX(0);}}
  .ai{animation:fadeUp 0.4s ease forwards;}
  .si{animation:slideIn 0.35s ease forwards;opacity:0;}
`;
