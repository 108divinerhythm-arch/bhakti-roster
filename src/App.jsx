import { useState, useEffect } from "react";

// ─── CONSTANTS ─────────────────────────────────────────────────────────────────
const COOKING_GROUPS = [
  { id: "g1", name: "South Indian Devotees",   color: "#c0622a" },
  { id: "g2", name: "North Indian Devotees",   color: "#2d7d9a" },
  { id: "g3", name: "Fijian Devotees",         color: "#3a8a5c" },
  { id: "g4", name: "International Devotees",  color: "#7a4fa0" },
];

const MORNING_ROLES = [
  { id:"kids1",   label:"Kids Class 1",     desc:"Ages up to 8 · Vedic culture & values",  time:"9:30–11:00 AM", icon:"🌱" },
  { id:"kids2",   label:"Kids Class 2",     desc:"Ages 9–16 · Deeper exploration",          time:"9:30–11:00 AM", icon:"📖" },
  { id:"adult",   label:"Adult Class",      desc:"Bhagavad Gita discourse for parents",     time:"9:30–11:00 AM", icon:"🕊️" },
  { id:"manager", label:"Program Manager",  desc:"Coordinates the morning session",         time:"9:00–11:30 AM", icon:"📋" },
];

const EVENING_ROLES = [
  { id:"setup",   label:"Setup",              desc:"Venue setup & decoration",     time:"4:00–5:00 PM", icon:"🏮" },
  { id:"aarati",  label:"Aarati",             desc:"Sacred lamp ceremony",         time:"5:00–5:30 PM", icon:"🪔" },
  { id:"bgclass", label:"Bhagavad Gita Class",desc:"Evening discourse",            time:"5:30–6:30 PM", icon:"📿" },
  { id:"bhajan",  label:"Bhajan Singing",     desc:"Devotional kirtan & singing",  time:"5:00–7:00 PM", icon:"🎵" },
];

const SIGNUP_OPENS_DAY = 24;

// ─── SEED USERS ────────────────────────────────────────────────────────────────
const SEED_USERS = [
  { id:"admin", name:"Keshav Kandel",  email:"keshkandel@gmail.com", password:"BYF2025admin", role:"admin"   },
  { id:"u1",    name:"Senshil Chand",  email:"senshilk@gmail.com",   password:"bhakti123",   role:"devotee" },
  { id:"u2",    name:"Komal Chand",    email:"komal@gmail.com",      password:"bhakti123",   role:"devotee" },
  { id:"u3",    name:"Rahul Kumar",    email:"rahul@gmail.com",      password:"bhakti123",   role:"devotee" },
  { id:"u4",    name:"Roneel Narayan", email:"roneel@gmail.com",     password:"bhakti123",   role:"devotee" },
];

// ─── IN-MEMORY STORE ───────────────────────────────────────────────────────────
const store = { users: [...SEED_USERS], rosters: {}, cooking: {} };

function getSundays(year, month) {
  const sundays = [];
  const d = new Date(year, month, 1);
  while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
  while (d.getMonth() === month) { sundays.push(new Date(d)); d.setDate(d.getDate() + 7); }
  return sundays;
}
function fmtLong(d)  { return d.toLocaleDateString("en-AU",{weekday:"long",day:"numeric",month:"long",year:"numeric"}); }
function fmtShort(d) { return d.toLocaleDateString("en-AU",{day:"numeric",month:"short"}); }
function fmtMonth(y,m){ return new Date(y,m,1).toLocaleString("en-AU",{month:"long",year:"numeric"}); }

function isSignupOpen(year, month) {
  const now   = new Date();
  const pm    = month===0?11:month-1;
  const py    = month===0?year-1:year;
  const opens = new Date(py, pm, SIGNUP_OPENS_DAY);
  const close = new Date(year, month+1, 0);
  return now>=opens && now<=close;
}

function ensureRoster(year, month) {
  const key = `${year}-${month}`;
  if (!store.rosters[key]) {
    const s = getSundays(year, month);
    const r = {}; const c = {};
    s.forEach((_,i)=>{
      r[i]={morning:{},evening:{}};
      MORNING_ROLES.forEach(x=>{r[i].morning[x.id]=null;});
      EVENING_ROLES.forEach(x=>{r[i].evening[x.id]=null;});
      c[i]=COOKING_GROUPS[i%COOKING_GROUPS.length];
    });
    store.rosters[key]=r; store.cooking[key]=c;
  }
}
function getRoster(year,month){ ensureRoster(year,month); return {roster:store.rosters[`${year}-${month}`], cooking:store.cooking[`${year}-${month}`]}; }
function setSlot(year,month,wi,session,roleId,person){ ensureRoster(year,month); store.rosters[`${year}-${month}`][wi][session][roleId]=person; }
function setCook(year,month,wi,group){ ensureRoster(year,month); store.cooking[`${year}-${month}`][wi]=group; }

function getUserServices(uid,year,month){
  ensureRoster(year,month);
  const key=`${year}-${month}`; const sundays=getSundays(year,month); const out=[];
  sundays.forEach((sunday,wi)=>{
    const w=store.rosters[key][wi];
    MORNING_ROLES.forEach(r=>{ if(w.morning[r.id]?.id===uid) out.push({wi,sunday,session:"Morning",role:r.label,time:r.time,roleId:r.id}); });
    EVENING_ROLES.forEach(r=>{ if(w.evening[r.id]?.id===uid) out.push({wi,sunday,session:"Evening",role:r.label,time:r.time,roleId:r.id}); });
  });
  return out;
}

// ─── CLAUDE EMAIL ──────────────────────────────────────────────────────────────
async function callClaude(prompt) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:700,messages:[{role:"user",content:prompt}]})});
    const d = await res.json();
    return d.content?.[0]?.text||"";
  } catch { return ""; }
}

async function genWelcomeEmail(name,email,password){
  return callClaude(`Write a short warm welcome email for ${name} joining Bhakti Yoga Foundation volunteer roster system. Their login: email=${email}, password=${password}. Org: Bhakti Yoga Foundation (Simple Living·High Thinking), Queensland AU. Reply-to: bhaktiyoga.org@gmail.com. Only the email body, warm spiritual tone, 3 short paragraphs, include credentials clearly, end "In loving service, Bhakti Yoga Foundation". Plain text.`);
}
async function genRosterEmail(name,assignments){
  const list=assignments.map(a=>`- ${a.role} on ${fmtLong(a.sunday)} (${a.time}, ${a.session} Program)`).join("\n");
  return callClaude(`Write a warm confirmation email for Bhakti Yoga Foundation devotee ${name} who signed up for:\n${list}\nRemind them to speak to admin for any changes. Reply-to: bhaktiyoga.org@gmail.com. Only email body, spiritual warm tone, end "In loving service, Bhakti Yoga Foundation". Plain text.`);
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const now = new Date();
  const [user,   setUser]   = useState(null);
  const [page,   setPage]   = useState("login");
  const [vy, setVy] = useState(now.getFullYear());
  const [vm, setVm] = useState(now.getMonth());
  const [sundays, setSundays] = useState([]);
  const [roster,  setRoster]  = useState({});
  const [cooking, setCooking] = useState({});
  const [selWeek, setSelWeek] = useState(0);
  const [loginEmail, setLE] = useState("");
  const [loginPass,  setLP] = useState("");
  const [loginErr,   setLErr] = useState("");
  const [signing,    setSigning]  = useState(false);
  const [notif,      setNotif]    = useState(null);
  const [emailPrev,  setEmailPrev]= useState("");
  const [showEmail,  setShowEmail]= useState(false);
  const [adminTab,   setAdminTab] = useState("roster");
  const [newU,       setNewU]     = useState({name:"",email:"",password:""});
  const [creating,   setCreating] = useState(false);
  const [createMsg,  setCreateMsg]= useState("");
  const [_, forceUpdate] = useState(0);

  const refresh = () => { const {roster:r,cooking:c}=getRoster(vy,vm); setRoster({...r}); setCooking({...c}); };

  useEffect(()=>{
    const s=getSundays(vy,vm); setSundays(s); refresh(); setSelWeek(0);
  },[vy,vm]);

  const notify=(msg,type="success")=>{ setNotif({msg,type}); setTimeout(()=>setNotif(null),5000); };

  const handleLogin=()=>{
    const u=store.users.find(x=>x.email.toLowerCase()===loginEmail.toLowerCase()&&x.password===loginPass);
    if(!u){setLErr("Incorrect email or password.");return;}
    setUser(u); setLErr(""); setPage(u.role==="admin"?"admin":"dashboard");
  };
  const handleLogout=()=>{ setUser(null); setPage("login"); setLE(""); setLP(""); };
  const prevMonth=()=>{ if(vm===0){setVm(11);setVy(y=>y-1);}else setVm(m=>m-1); };
  const nextMonth=()=>{ if(vm===11){setVm(0);setVy(y=>y+1);}else setVm(m=>m+1); };

  const handleSignup=async(wi,session,roleId)=>{
    if(!isSignupOpen(vy,vm)){notify("Sign-ups open on the 24th of the previous month.","error");return;}
    setSigning(true);
    setSlot(vy,vm,wi,session,roleId,{id:user.id,name:user.name,email:user.email});
    refresh();
    const services=getUserServices(user.id,vy,vm);
    const email=await genRosterEmail(user.name,services.map(s=>({role:s.role,sunday:s.sunday,time:s.time,session:s.session})));
    setEmailPrev(email); setShowEmail(true); setSigning(false);
    notify(`✓ Signed up successfully!`);
  };

  const handleClearSlot=(wi,session,roleId)=>{ setSlot(vy,vm,wi,session,roleId,null); refresh(); notify("Slot cleared."); };

  const handleCreateUser=async()=>{
    if(!newU.name||!newU.email||!newU.password){setCreateMsg("Please fill in all fields.");return;}
    if(store.users.find(x=>x.email.toLowerCase()===newU.email.toLowerCase())){setCreateMsg("Email already exists.");return;}
    setCreating(true);
    const u={id:"u"+Date.now(),name:newU.name,email:newU.email,password:newU.password,role:"devotee"};
    store.users.push(u);
    await genWelcomeEmail(newU.name,newU.email,newU.password);
    setCreating(false); setCreateMsg(`✓ Account created for ${newU.name}. Welcome email sent to ${newU.email}.`);
    setNewU({name:"",email:"",password:""}); forceUpdate(x=>x+1);
    setTimeout(()=>setCreateMsg(""),5000);
  };

  const handleDeleteUser=(id)=>{ const i=store.users.findIndex(x=>x.id===id); if(i!==-1)store.users.splice(i,1); notify("Devotee removed."); forceUpdate(x=>x+1); };

  const myServices = user ? getUserServices(user.id,vy,vm) : [];
  const open = isSignupOpen(vy,vm);

  return (
    <div style={R.root}>
      <style>{css}</style>
      <div style={R.bg1}/><div style={R.bg2}/>

      {notif&&<div className="anim-in" style={{...R.notif,background:notif.type==="error"?"#7a1515":"#1a4230"}}>{notif.msg}</div>}

      {user&&(
        <header style={R.hdr}>
          <div style={R.hdrIn}>
            <div style={R.brand}>
              <span style={{fontSize:26}}>🪷</span>
              <div>
                <div style={R.brandName}>BHAKTI YOGA FOUNDATION</div>
                <div style={R.brandSub}>Simple Living · High Thinking</div>
              </div>
            </div>
            <nav style={R.nav}>
              {user.role!=="admin"&&<>
                <NBtn active={page==="dashboard"} onClick={()=>setPage("dashboard")}>My Services</NBtn>
                <NBtn active={page==="roster"} onClick={()=>setPage("roster")}>Roster</NBtn>
              </>}
              {user.role==="admin"&&<NBtn active onClick={()=>setPage("admin")}>Admin Panel</NBtn>}
              <div style={R.chip}>
                <Av name={user.name}/>
                <span style={{color:"#c8922a",fontFamily:"Lato,sans-serif",fontSize:13}}>{user.name.split(" ")[0]}</span>
                <button style={R.logoutBtn} onClick={handleLogout}>Sign out</button>
              </div>
            </nav>
          </div>
        </header>
      )}

      <main style={{...R.main,paddingTop:user?90:0}}>

        {/* LOGIN */}
        {page==="login"&&(
          <div className="anim-in" style={R.loginWrap}>
            <div style={R.loginCard}>
              <div style={{fontSize:56,marginBottom:16}}>🪷</div>
              <div style={R.loginTitle}>Bhakti Yoga Foundation</div>
              <div style={{fontFamily:"Lato,sans-serif",fontSize:13,color:"#7a5c3a",marginBottom:4}}>Volunteer Roster System</div>
              <div style={{fontFamily:"Lato,sans-serif",fontSize:11,color:"#c8922a",letterSpacing:2.5,marginBottom:32}}>SIMPLE LIVING · HIGH THINKING</div>
              <input style={R.inp} type="email" placeholder="Email address" value={loginEmail} onChange={e=>setLE(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()}/>
              <input style={{...R.inp,marginTop:10}} type="password" placeholder="Password" value={loginPass} onChange={e=>setLP(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()}/>
              {loginErr&&<div style={{color:"#8b1a1a",fontFamily:"Lato,sans-serif",fontSize:13,marginTop:8,textAlign:"left"}}>{loginErr}</div>}
              <button style={{...R.primBtn,marginTop:18}} onClick={handleLogin}>Sign In 🙏</button>
              <div style={{marginTop:18,fontFamily:"Lato,sans-serif",fontSize:12,color:"#bbb"}}>Contact your admin to receive login details</div>
            </div>
          </div>
        )}

        {/* DASHBOARD */}
        {page==="dashboard"&&user&&(
          <div className="anim-in" style={R.pw}>
            <h1 style={R.pageH}>Hare Krishna, {user.name.split(" ")[0]}! 🙏</h1>
            <p style={R.pageSub}>Your upcoming services</p>
            <MNav y={vy} m={vm} onP={prevMonth} onN={nextMonth}/>

            {open
              ? <div style={R.openBan}><span style={{fontSize:22}}>🔓</span><div><div style={{fontWeight:"bold",fontSize:15}}>Roster open for {fmtMonth(vy,vm)}</div><div style={{fontSize:13,opacity:0.85,marginTop:2,fontFamily:"Lato,sans-serif"}}>Go to the Roster tab to sign up</div></div><button style={R.goBtn} onClick={()=>setPage("roster")}>Go to Roster →</button></div>
              : <div style={R.closeBan}><span style={{fontSize:20}}>🔒</span><div style={{fontFamily:"Lato,sans-serif",fontSize:14}}><strong>Sign-ups for {fmtMonth(vy,vm)}</strong> open on the 24th of the previous month.<br/><span style={{fontSize:12,opacity:0.8}}>To change your service, contact admin</span></div></div>
            }

            {myServices.length===0
              ? <div style={R.empty}><div style={{fontSize:40,marginBottom:12}}>📋</div><div style={{fontSize:15,color:"#7a5c3a",fontFamily:"Lato,sans-serif"}}>No services signed up for {fmtMonth(vy,vm)} yet.</div>{open&&<button style={{...R.primBtn,marginTop:16,width:"auto",padding:"10px 28px"}} onClick={()=>setPage("roster")}>Go to Roster</button>}</div>
              : <div style={R.svcGrid}>{myServices.map((s,i)=>(
                  <div key={i} className="slide-in" style={{...R.svcCard,animationDelay:`${i*0.07}s`}}>
                    <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:10}}>
                      <span style={{fontSize:24}}>{s.session==="Morning"?"🌅":"🌙"}</span>
                      <div><div style={{fontWeight:"bold",fontSize:15}}>{s.role}</div><div style={{fontFamily:"Lato,sans-serif",fontSize:12,color:"#7a5c3a",marginTop:2}}>{s.session} · {s.time}</div></div>
                    </div>
                    <div style={{fontFamily:"Lato,sans-serif",fontSize:13,color:"#3d2b10",marginBottom:6}}>{fmtLong(s.sunday)}</div>
                    <div style={{fontFamily:"Lato,sans-serif",fontSize:11,color:"#bbb",fontStyle:"italic"}}>To make changes, speak to admin</div>
                  </div>
                ))}</div>
            }

            {showEmail&&emailPrev&&(
              <div style={R.emailBox}>
                <div style={{fontFamily:"Lato,sans-serif",fontSize:12,fontWeight:"bold",color:"#7a5c3a",marginBottom:10}}>📧 Confirmation email sent to {user.email}</div>
                <div style={{fontFamily:"Lato,sans-serif",fontSize:13,color:"#3d2b10",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{emailPrev}</div>
                <button style={{...R.primBtn,marginTop:14,width:"auto",padding:"8px 20px",fontSize:13}} onClick={()=>setShowEmail(false)}>Dismiss</button>
              </div>
            )}
          </div>
        )}

        {/* ROSTER */}
        {page==="roster"&&user&&(
          <div className="anim-in" style={R.pw}>
            <h1 style={R.pageH}>Monthly Roster</h1>
            <p style={R.pageSub}>{fmtMonth(vy,vm)} · Sign up for your services</p>
            <MNav y={vy} m={vm} onP={prevMonth} onN={nextMonth}/>

            <div style={open?R.openBan:R.closeBan}>
              <span style={{fontSize:20}}>{open?"🔓":"🔒"}</span>
              <div style={{fontFamily:"Lato,sans-serif",fontSize:14,color:open?"#1a3a2a":"#5a3a10"}}>
                {open?<><strong>Roster is open</strong> — click any role to sign up for {fmtMonth(vy,vm)}</>:<><strong>Roster not yet open.</strong> Sign-ups open on the 24th of the previous month.</>}
              </div>
            </div>

            <WeekTabs sundays={sundays} sel={selWeek} onSel={setSelWeek}/>

            {sundays[selWeek]&&<>
              <div style={R.sundayLbl}>☀️ {fmtLong(sundays[selWeek])}</div>

              <Sec icon="🍛" title="Evening Cooking" sub="Assigned by monthly rotation">
                {cooking[selWeek]&&<div style={{...R.cookBadge,background:cooking[selWeek].color+"18",borderColor:cooking[selWeek].color}}>
                  <span style={{width:12,height:12,borderRadius:"50%",background:cooking[selWeek].color,display:"inline-block",flexShrink:0}}/>
                  <span style={{fontWeight:"bold",fontSize:15}}>{cooking[selWeek].name}</span>
                  <span style={{fontFamily:"Lato,sans-serif",fontSize:13,color:"#7a5c3a"}}>is cooking this Sunday</span>
                </div>}
              </Sec>

              <Sec icon="🌅" title="Morning Program" sub="9:30–11:00 AM · Pendicup Community Centre, Warner">
                <div style={R.roleGrid}>
                  {MORNING_ROLES.map(role=>{
                    const taken=roster[selWeek]?.morning[role.id];
                    const isMe=taken?.id===user.id;
                    return <RCard key={role.id} role={role} taken={taken} isMe={isMe} open={open} signing={signing} onSignup={()=>handleSignup(selWeek,"morning",role.id)}/>;
                  })}
                </div>
              </Sec>

              <Sec icon="🌙" title="Evening Festival" sub="5:00–7:00 PM · Warner or Petrie">
                <div style={R.roleGrid}>
                  {EVENING_ROLES.map(role=>{
                    const taken=roster[selWeek]?.evening[role.id];
                    const isMe=taken?.id===user.id;
                    return <RCard key={role.id} role={role} taken={taken} isMe={isMe} open={open} signing={signing} onSignup={()=>handleSignup(selWeek,"evening",role.id)}/>;
                  })}
                </div>
              </Sec>
            </>}

            {showEmail&&emailPrev&&(
              <div style={R.emailBox}>
                <div style={{fontFamily:"Lato,sans-serif",fontSize:12,fontWeight:"bold",color:"#7a5c3a",marginBottom:10}}>📧 Confirmation sent to {user.email}</div>
                <div style={{fontFamily:"Lato,sans-serif",fontSize:13,color:"#3d2b10",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{emailPrev}</div>
                <button style={{...R.primBtn,marginTop:14,width:"auto",padding:"8px 20px",fontSize:13}} onClick={()=>setShowEmail(false)}>Dismiss</button>
              </div>
            )}
          </div>
        )}

        {/* ADMIN */}
        {page==="admin"&&user?.role==="admin"&&(
          <div className="anim-in" style={R.pw}>
            <h1 style={R.pageH}>Admin Panel</h1>
            <p style={R.pageSub}>Manage devotees, roster, and assignments</p>

            <div style={{display:"flex",gap:8,marginBottom:24}}>
              {["roster","users"].map(t=>(
                <button key={t} onClick={()=>setAdminTab(t)} style={{...R.atab,...(adminTab===t?R.atabOn:{})}}>
                  {t==="roster"?"📋 Roster":"👥 Devotees"}
                </button>
              ))}
            </div>

            {adminTab==="roster"&&<>
              <MNav y={vy} m={vm} onP={prevMonth} onN={nextMonth}/>
              <WeekTabs sundays={sundays} sel={selWeek} onSel={setSelWeek}/>

              {sundays[selWeek]&&<>
                <div style={R.sundayLbl}>☀️ {fmtLong(sundays[selWeek])}</div>

                <div style={R.aCard}>
                  <div style={R.aCardT}>🍛 Cooking Group</div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {COOKING_GROUPS.map(g=>{
                      const on=cooking[selWeek]?.id===g.id;
                      return <button key={g.id} style={{background:on?g.color:g.color+"22",color:on?"#fff":g.color,border:`2px solid ${g.color}`,borderRadius:8,padding:"8px 14px",cursor:"pointer",fontFamily:"Lato,sans-serif",fontSize:13,fontWeight:"bold"}}
                        onClick={()=>{setCook(vy,vm,selWeek,g);refresh();}}>{g.name}</button>;
                    })}
                  </div>
                </div>

                <div style={R.aCard}>
                  <div style={R.aCardT}>🌅 Morning Program</div>
                  <div style={R.aGrid}>
                    {MORNING_ROLES.map(role=>{
                      const p=roster[selWeek]?.morning[role.id];
                      return <ASlot key={role.id} role={role} person={p} users={store.users.filter(x=>x.role!=="admin")}
                        onClear={()=>handleClearSlot(selWeek,"morning",role.id)}
                        onAssign={uid=>{const u=store.users.find(x=>x.id===uid);setSlot(vy,vm,selWeek,"morning",role.id,{id:u.id,name:u.name,email:u.email});refresh();notify(`Assigned ${u.name} to ${role.label}`);}}/>;
                    })}
                  </div>
                </div>

                <div style={R.aCard}>
                  <div style={R.aCardT}>🌙 Evening Festival</div>
                  <div style={R.aGrid}>
                    {EVENING_ROLES.map(role=>{
                      const p=roster[selWeek]?.evening[role.id];
                      return <ASlot key={role.id} role={role} person={p} users={store.users.filter(x=>x.role!=="admin")}
                        onClear={()=>handleClearSlot(selWeek,"evening",role.id)}
                        onAssign={uid=>{const u=store.users.find(x=>x.id===uid);setSlot(vy,vm,selWeek,"evening",role.id,{id:u.id,name:u.name,email:u.email});refresh();notify(`Assigned ${u.name} to ${role.label}`);}}/>;
                    })}
                  </div>
                </div>
              </>}
            </>}

            {adminTab==="users"&&<>
              <div style={R.aCard}>
                <div style={R.aCardT}>➕ Add New Devotee</div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  <input style={R.inp} placeholder="Full name" value={newU.name} onChange={e=>setNewU(u=>({...u,name:e.target.value}))}/>
                  <input style={R.inp} type="email" placeholder="Email address" value={newU.email} onChange={e=>setNewU(u=>({...u,email:e.target.value}))}/>
                  <input style={R.inp} placeholder="Set password" value={newU.password} onChange={e=>setNewU(u=>({...u,password:e.target.value}))}/>
                  <button style={{...R.primBtn,width:"auto",padding:"11px 24px",opacity:creating?0.7:1}} onClick={handleCreateUser} disabled={creating}>
                    {creating?"Creating account...":"Create Account & Send Welcome Email"}
                  </button>
                </div>
                {createMsg&&<div style={{marginTop:12,fontSize:13,fontFamily:"Lato,sans-serif",color:createMsg.startsWith("✓")?"#2d6a4f":"#8b1a1a"}}>{createMsg}</div>}
              </div>

              <div style={R.aCard}>
                <div style={R.aCardT}>👥 All Devotees ({store.users.filter(x=>x.role!=="admin").length})</div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {store.users.map(u=>(
                    <div key={u.id} style={{display:"flex",alignItems:"center",gap:12,background:"#f8f4ee",borderRadius:10,padding:"12px 14px"}}>
                      <Av name={u.name}/>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:"bold",fontSize:14}}>{u.name}</div>
                        <div style={{fontFamily:"Lato,sans-serif",fontSize:12,color:"#7a5c3a"}}>{u.email}</div>
                      </div>
                      <div style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontFamily:"Lato,sans-serif",fontWeight:"bold",background:u.role==="admin"?"#c8922a22":"#2d7d9a22",color:u.role==="admin"?"#c8922a":"#2d7d9a"}}>{u.role}</div>
                      {u.role!=="admin"&&<button style={{background:"#8b1a1a22",color:"#8b1a1a",border:"1px solid #8b1a1a44",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontFamily:"Lato,sans-serif",fontSize:12}} onClick={()=>handleDeleteUser(u.id)}>Remove</button>}
                    </div>
                  ))}
                </div>
              </div>
            </>}
          </div>
        )}
      </main>

      <footer style={R.footer}>Bhakti Yoga Foundation · ABN 88 219 281 244 · ACNC Registered Charity · Queensland, Australia</footer>
    </div>
  );
}

// ─── SUB-COMPONENTS ────────────────────────────────────────────────────────────
function Av({name}){ return <div style={{width:30,height:30,borderRadius:"50%",background:"#c8922a",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:"bold",fontFamily:"Lato,sans-serif",flexShrink:0}}>{name[0]}</div>; }
function NBtn({active,onClick,children}){ return <button onClick={onClick} style={{background:"transparent",border:`1px solid ${active?"#c8922a":"#a0856a55"}`,color:active?"#c8922a":"#a0856a",padding:"7px 16px",borderRadius:5,cursor:"pointer",fontFamily:"Lato,sans-serif",fontSize:13,fontWeight:active?"700":"400",letterSpacing:0.3}}>{children}</button>; }
function MNav({y,m,onP,onN}){ return <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:20,marginBottom:20}}><button onClick={onP} style={{background:"none",border:"2px solid #c8922a",color:"#c8922a",width:36,height:36,borderRadius:"50%",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button><div style={{fontSize:22,fontFamily:"'Playfair Display',serif",fontWeight:"bold",color:"#1a1209",minWidth:200,textAlign:"center"}}>{fmtMonth(y,m)}</div><button onClick={onN} style={{background:"none",border:"2px solid #c8922a",color:"#c8922a",width:36,height:36,borderRadius:"50%",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>›</button></div>; }
function WeekTabs({sundays,sel,onSel}){ return <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>{sundays.map((s,i)=><button key={i} onClick={()=>onSel(i)} style={{background:sel===i?"#e07b39":"rgba(255,255,255,0.8)",border:`1.5px solid ${sel===i?"#e07b39":"#f5e6c8"}`,color:sel===i?"#fff":"#3d2b10",borderRadius:10,padding:"10px 20px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,minWidth:110,fontFamily:sel===i?"Lato,sans-serif":"'Playfair Display',serif"}}><span style={{fontSize:11,opacity:0.8,textTransform:"uppercase",letterSpacing:1,fontFamily:"Lato,sans-serif"}}>Week {i+1}</span><span style={{fontSize:17,fontWeight:"bold"}}>{fmtShort(s)}</span></button>)}</div>; }
function Sec({icon,title,sub,children}){ return <div style={{background:"rgba(255,255,255,0.85)",borderRadius:16,padding:"22px 26px",marginBottom:20,boxShadow:"0 4px 20px rgba(0,0,0,0.06)",border:"1px solid #f5e6c8"}}><div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:16}}><span style={{fontSize:26}}>{icon}</span><div><div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:"bold",color:"#1a1209"}}>{title}</div><div style={{fontFamily:"Lato,sans-serif",fontSize:12,color:"#7a5c3a",marginTop:2}}>{sub}</div></div></div>{children}</div>; }

function RCard({role,taken,isMe,open,signing,onSignup}){
  return <div style={{background:taken?(isMe?"#e6f4ed":"#f8f4ee"):"#fff",border:`1.5px solid ${taken?(isMe?"#3a8a5c55":"#e0d4b0"):"#f5e6c8"}`,borderRadius:12,padding:"16px",display:"flex",flexDirection:"column",gap:8}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:"bold",color:"#1a1209",lineHeight:1.3}}>{role.icon} {role.label}</div>
      <div style={{fontFamily:"Lato,sans-serif",fontSize:11,color:"#7a5c3a",whiteSpace:"nowrap",marginLeft:6}}>{role.time}</div>
    </div>
    <div style={{fontFamily:"Lato,sans-serif",fontSize:12,color:"#7a5c3a",flex:1}}>{role.desc}</div>
    {taken
      ? <div style={{background:isMe?"#3a8a5c":"#2d7d9a",color:"#fff",padding:"6px 12px",borderRadius:6,fontSize:12,fontFamily:"Lato,sans-serif",fontWeight:"bold"}}>{isMe?"✓ You":`✓ ${taken.name}`}</div>
      : open
        ? <button onClick={onSignup} disabled={signing} style={{background:"linear-gradient(135deg,#e07b39,#c8922a)",color:"#fff",border:"none",borderRadius:8,padding:"8px",cursor:"pointer",fontFamily:"Lato,sans-serif",fontSize:13,fontWeight:"bold",opacity:signing?0.7:1}}>{signing?"Signing up…":"Sign Up"}</button>
        : <div style={{fontFamily:"Lato,sans-serif",fontSize:11,color:"#ccc",fontStyle:"italic"}}>Not open yet</div>
    }
  </div>;
}

function ASlot({role,person,users,onClear,onAssign}){
  const [show,setShow]=useState(false);
  return <div style={{background:"#f8f4ee",borderRadius:10,padding:"12px 14px"}}>
    <div style={{fontFamily:"Lato,sans-serif",fontSize:12,color:"#7a5c3a",fontWeight:"bold",marginBottom:6}}>{role.icon} {role.label}</div>
    {person
      ? <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:6}}><span style={{fontFamily:"Lato,sans-serif",fontSize:13,fontWeight:"bold",color:"#1a1209"}}>{person.name}</span><button onClick={onClear} style={{background:"#8b1a1a",color:"#fff",border:"none",borderRadius:4,padding:"3px 8px",cursor:"pointer",fontSize:11,fontFamily:"Lato,sans-serif"}}>Clear</button></div>
      : show
        ? <div style={{display:"flex",gap:6,alignItems:"center"}}><select onChange={e=>{if(e.target.value){onAssign(e.target.value);setShow(false);}}} style={{flex:1,padding:"5px 8px",borderRadius:6,border:"1px solid #f5e6c8",fontFamily:"Lato,sans-serif",fontSize:12,background:"#fff"}}><option value="">Select devotee…</option>{users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select><button onClick={()=>setShow(false)} style={{background:"none",border:"none",cursor:"pointer",color:"#7a5c3a",fontSize:16}}>×</button></div>
        : <button onClick={()=>setShow(true)} style={{background:"#2d7d9a22",color:"#2d7d9a",border:"1px dashed #2d7d9a",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontFamily:"Lato,sans-serif",fontSize:12,width:"100%"}}>+ Assign</button>
    }
  </div>;
}

// ─── STYLES ────────────────────────────────────────────────────────────────────
const R = {
  root:{minHeight:"100vh",fontFamily:"'Playfair Display',Georgia,serif",color:"#1a1209",position:"relative",overflowX:"hidden"},
  bg1:{position:"fixed",inset:0,background:"linear-gradient(150deg,#fdf3e3 0%,#fde9cc 45%,#e8f2f7 100%)",zIndex:0},
  bg2:{position:"fixed",inset:0,backgroundImage:"radial-gradient(circle at 15% 20%,rgba(224,123,57,0.1) 0%,transparent 45%),radial-gradient(circle at 85% 75%,rgba(45,125,154,0.1) 0%,transparent 45%)",zIndex:0},
  notif:{position:"fixed",top:16,right:16,padding:"12px 22px",borderRadius:8,color:"#fff",fontFamily:"Lato,sans-serif",fontSize:14,zIndex:1000,boxShadow:"0 4px 20px rgba(0,0,0,0.25)",maxWidth:320},
  hdr:{position:"fixed",top:0,left:0,right:0,zIndex:100,background:"rgba(26,18,9,0.96)",backdropFilter:"blur(8px)",borderBottom:"2px solid #c8922a33"},
  hdrIn:{maxWidth:1000,margin:"0 auto",padding:"12px 24px",display:"flex",alignItems:"center",justifyContent:"space-between"},
  brand:{display:"flex",alignItems:"center",gap:12},
  brandName:{color:"#c8922a",fontSize:12,fontFamily:"Lato,sans-serif",fontWeight:"700",letterSpacing:2.5},
  brandSub:{color:"#7a5c3a",fontSize:10,fontFamily:"Lato,sans-serif",letterSpacing:2,marginTop:1},
  nav:{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"},
  chip:{display:"flex",alignItems:"center",gap:8,marginLeft:8,paddingLeft:12,borderLeft:"1px solid #c8922a33"},
  logoutBtn:{background:"transparent",border:"1px solid #7a5c3a55",color:"#7a5c3a",padding:"4px 10px",borderRadius:4,cursor:"pointer",fontFamily:"Lato,sans-serif",fontSize:11},
  main:{position:"relative",zIndex:1,maxWidth:1000,margin:"0 auto",padding:"0 20px 80px"},
  loginWrap:{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24},
  loginCard:{background:"rgba(255,255,255,0.93)",borderRadius:24,padding:"44px 40px",maxWidth:400,width:"100%",textAlign:"center",boxShadow:"0 20px 60px rgba(0,0,0,0.12)",border:"1px solid #f5e6c8"},
  loginTitle:{fontSize:24,fontWeight:"bold",color:"#1a1209",marginBottom:4},
  inp:{padding:"12px 16px",borderRadius:8,border:"1.5px solid #f5e6c8",fontSize:14,fontFamily:"Lato,sans-serif",outline:"none",background:"#fff",color:"#1a1209",width:"100%",display:"block"},
  primBtn:{background:"linear-gradient(135deg,#e07b39,#c8922a)",color:"#fff",border:"none",borderRadius:10,padding:"13px",cursor:"pointer",fontFamily:"Lato,sans-serif",fontSize:14,fontWeight:"700",width:"100%",letterSpacing:0.5},
  pw:{paddingTop:32},
  pageH:{fontFamily:"'Playfair Display',serif",fontSize:28,fontWeight:"bold",color:"#1a1209",marginBottom:4},
  pageSub:{fontFamily:"Lato,sans-serif",fontSize:14,color:"#7a5c3a",marginBottom:24},
  openBan:{display:"flex",alignItems:"center",gap:14,background:"rgba(45,125,154,0.1)",border:"1.5px solid #2d7d9a44",borderRadius:12,padding:"14px 18px",marginBottom:20,flexWrap:"wrap"},
  closeBan:{display:"flex",alignItems:"center",gap:14,background:"rgba(200,146,42,0.08)",border:"1.5px solid #c8922a44",borderRadius:12,padding:"14px 18px",marginBottom:20},
  goBtn:{marginLeft:"auto",background:"#2d7d9a",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontFamily:"Lato,sans-serif",fontSize:13,fontWeight:"bold",flexShrink:0},
  empty:{background:"rgba(255,255,255,0.7)",borderRadius:16,padding:"44px",textAlign:"center",border:"1px solid #f5e6c8"},
  svcGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:16},
  svcCard:{background:"rgba(255,255,255,0.9)",border:"1px solid #f5e6c8",borderRadius:14,padding:"20px",boxShadow:"0 4px 16px rgba(0,0,0,0.05)"},
  emailBox:{background:"#f8f4ee",border:"1px solid #f5e6c8",borderRadius:12,padding:"20px 24px",marginTop:24},
  sundayLbl:{fontFamily:"Lato,sans-serif",fontSize:14,color:"#7a5c3a",fontStyle:"italic",marginBottom:20,background:"rgba(255,255,255,0.6)",borderRadius:8,padding:"10px 16px",border:"1px solid #f5e6c8"},
  cookBadge:{display:"flex",alignItems:"center",gap:12,padding:"14px 18px",borderRadius:10,border:"2px solid"},
  roleGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12},
  atab:{background:"rgba(255,255,255,0.7)",border:"1.5px solid #f5e6c8",borderRadius:8,padding:"10px 20px",cursor:"pointer",fontFamily:"Lato,sans-serif",fontSize:14,color:"#7a5c3a"},
  atabOn:{background:"#1a1209",color:"#c8922a",border:"1.5px solid #c8922a"},
  aCard:{background:"rgba(255,255,255,0.88)",borderRadius:14,padding:"22px 24px",marginBottom:18,border:"1px solid #f5e6c8",boxShadow:"0 4px 16px rgba(0,0,0,0.05)"},
  aCardT:{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:"bold",color:"#1a1209",marginBottom:14},
  aGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10},
  footer:{position:"relative",zIndex:1,background:"#1a1209",color:"#7a5c3a",textAlign:"center",padding:"18px 24px",fontSize:11,fontFamily:"Lato,sans-serif",letterSpacing:0.8},
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Lato:wght@300;400;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  button:hover{filter:brightness(1.08);}
  input:focus{outline:2px solid #c8922a;outline-offset:1px;}
  ::-webkit-scrollbar{width:6px;} ::-webkit-scrollbar-thumb{background:#c8922a44;border-radius:3px;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}
  @keyframes slideIn{from{opacity:0;transform:translateX(-8px);}to{opacity:1;transform:translateX(0);}}
  .anim-in{animation:fadeUp 0.4s ease forwards;}
  .slide-in{animation:slideIn 0.35s ease forwards;opacity:0;}
`;
