import { useState, useEffect } from "react";

// ─── CONFIG ────────────────────────────────────────────────────────────────────
const SHEETS_URL   = "https://script.google.com/macros/s/AKfycbzxZEqtWxiYNlW0eaFwr1XAwcgGElaKov_EHWK7uaIkAY62B5QLLK4Z7nQaG1OVN5f4/exec";
const ADMIN_PASS   = "BYF2025admin";
const EDIT_WINDOW  = 10 * 60 * 1000; // 10 minutes in ms
const SIGNUP_DAY   = 24; // roster opens on 24th of previous month

// ─── SHEETS HELPERS ────────────────────────────────────────────────────────────
async function post(data) {
  try { const r = await fetch(SHEETS_URL,{method:"POST",body:JSON.stringify(data)}); return await r.json(); }
  catch(e){ return {error:e.toString()}; }
}
async function get(params) {
  try { const r = await fetch(SHEETS_URL+"?"+new URLSearchParams(params).toString()); return await r.json(); }
  catch(e){ return {error:e.toString()}; }
}

// ─── DEFAULTS ──────────────────────────────────────────────────────────────────
const DEFAULT_SERVICES = [
  { id:"kids1",   name:"Kids Class 1",       session:"Morning", icon:"🌱" },
  { id:"kids2",   name:"Kids Class 2",       session:"Morning", icon:"📖" },
  { id:"adult",   name:"Adult Class",        session:"Morning", icon:"🕊️" },
  { id:"manager", name:"Program Manager",    session:"Morning", icon:"📋" },
  { id:"setup",   name:"Setup",              session:"Evening", icon:"🏮" },
  { id:"aarati",  name:"Aarati",             session:"Evening", icon:"🪔" },
  { id:"bgclass", name:"Bhagavad Gita Class",session:"Evening", icon:"📿" },
  { id:"bhajan",  name:"Bhajan / Kirtan",    session:"Evening", icon:"🎵" },
  { id:"cooking", name:"Cooking",            session:"Evening", icon:"🍛" },
];
const DEFAULT_MEMBERS = ["Keshav Kandel","Senshil Chand","Komal Chand","Rahul Kumar","Roneel Narayan"];
const DEFAULT_VENUES  = ["Pendicup Community Centre, Warner","Bray Hall Community Centre, Petrie"];
const MORNING_VENUE   = "Pendicup Community Centre, Warner";

// ─── HELPERS ───────────────────────────────────────────────────────────────────
function getSundays(y,m){ const s=[],d=new Date(y,m,1); while(d.getDay()!==0)d.setDate(d.getDate()+1); while(d.getMonth()===m){s.push(new Date(d));d.setDate(d.getDate()+7);} return s; }
function fmtLong(d){ return d.toLocaleDateString("en-AU",{weekday:"long",day:"numeric",month:"long",year:"numeric"}); }
function fmtShort(d){ return d.toLocaleDateString("en-AU",{day:"numeric",month:"short"}); }
function fmtMonth(y,m){ return new Date(y,m,1).toLocaleString("en-AU",{month:"long",year:"numeric"}); }
function isOpen(y,m,openDay){
  const now=new Date(), pm=m===0?11:m-1, py=m===0?y-1:y;
  return now>=new Date(py,pm,openDay||SIGNUP_DAY)&&now<=new Date(y,m+1,0);
}
function canEdit(signedAt){ return signedAt && (Date.now()-signedAt < EDIT_WINDOW); }

// ─── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
  const now = new Date();
  const [loading,  setLoading]  = useState(true);
  const [view,     setView]     = useState("roster"); // roster | admin
  const [adminAuth,setAdminAuth]= useState(false);
  const [adminPw,  setAdminPw]  = useState("");
  const [pwErr,    setPwErr]    = useState(false);
  const [vy, setVy] = useState(now.getFullYear());
  const [vm, setVm] = useState(now.getMonth());
  const [sundays,  setSundays]  = useState([]);
  const [selWeek,  setSelWeek]  = useState(0);
  const [slots,    setSlots]    = useState({}); // key: "wi-svcId" → {member, signedAt}
  const [members,  setMembers]  = useState(DEFAULT_MEMBERS);
  const [services, setServices] = useState(DEFAULT_SERVICES);
  const [venues,   setVenues]   = useState({});
  const [settings, setSettings] = useState({ openDay:SIGNUP_DAY });
  const [notif,    setNotif]    = useState(null);
  const [selMember,setSelMember]= useState("");
  const [ticker,   setTicker]   = useState(0); // force re-render for countdown

  // Admin state
  const [adminTab, setAdminTab] = useState("roster");
  const [newMember,setNewMember]= useState("");
  const [newSvcName,setNewSvcName]=useState("");
  const [newSvcSession,setNewSvcSession]=useState("Morning");
  const [newSvcIcon,setNewSvcIcon]=useState("✨");
  const [savingSettings,setSavingSettings]=useState(false);
  const [localOpenDay,setLocalOpenDay]=useState(SIGNUP_DAY);

  const notify=(msg,type="success")=>{ setNotif({msg,type}); setTimeout(()=>setNotif(null),4000); };

  // Countdown ticker
  useEffect(()=>{ const t=setInterval(()=>setTicker(x=>x+1),15000); return()=>clearInterval(t); },[]);

  // Load all data
  const loadAll = async (y,m) => {
    const [rRes,sRes] = await Promise.all([
      get({action:"getRoster",year:y,month:m}),
      get({action:"getSettings"}),
    ]);
    // Build slots
    const sl={};
    if(rRes.slots) rRes.slots.forEach(s=>{
      const k=`${s.weekIdx}-${s.roleId}`;
      sl[k]={ member:s.person?.name||"", signedAt:s.person?.signedAt?parseInt(s.person.signedAt):null };
    });
    setSlots(sl);
    // Settings
    if(sRes.settings){
      const cfg=sRes.settings;
      if(cfg.members) setMembers(typeof cfg.members==="string"?JSON.parse(cfg.members):cfg.members);
      if(cfg.services) setServices(typeof cfg.services==="string"?JSON.parse(cfg.services):cfg.services);
      if(cfg.openDay) setSettings({openDay:parseInt(cfg.openDay)||SIGNUP_DAY});
      if(cfg.openDay) setLocalOpenDay(parseInt(cfg.openDay)||SIGNUP_DAY);
      // venues
      const v={};
      Object.keys(cfg).forEach(k=>{ if(k.startsWith("venue_")) v[k.replace("venue_","")]=cfg[k]; });
      setVenues(v);
    }
  };

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      const s=getSundays(vy,vm); setSundays(s); setSelWeek(0);
      await loadAll(vy,vm);
      setLoading(false);
    })();
  },[vy,vm]);

  const prevMonth=()=>{ if(vm===0){setVm(11);setVy(y=>y-1);}else setVm(m=>m-1); };
  const nextMonth=()=>{ if(vm===11){setVm(0);setVy(y=>y+1);}else setVm(m=>m+1); };
  const getVenue=(wi)=>venues[`${vy}-${vm}-${wi}`]||DEFAULT_VENUES[0];

  // ── SIGN UP ──────────────────────────────────────────────────────────────────
  const handleSignup=async(wi,svcId)=>{
    if(!selMember){notify("Please select your name first!","error");return;}
    if(!isOpen(vy,vm,settings.openDay)){notify("Roster not open yet.","error");return;}
    const k=`${wi}-${svcId}`;
    const existing=slots[k];
    if(existing?.member && !canEdit(existing.signedAt) && !adminAuth){
      notify("This slot is taken and the 10-minute edit window has passed.","error"); return;
    }
    const signedAt=Date.now();
    setSlots(p=>({...p,[k]:{member:selMember,signedAt}}));
    await post({ action:"saveRosterSlot", year:vy, month:vm, weekIdx:wi, session:"", roleId:svcId,
      person:{id:svcId+wi, name:selMember, email:"", signedAt:String(signedAt)} });
    notify(`✓ ${selMember} signed up for ${services.find(s=>s.id===svcId)?.name}`);
  };

  // ── ADMIN CLEAR ───────────────────────────────────────────────────────────────
  const handleClear=async(wi,svcId)=>{
    const k=`${wi}-${svcId}`;
    setSlots(p=>({...p,[k]:{member:"",signedAt:null}}));
    await post({ action:"saveRosterSlot", year:vy, month:vm, weekIdx:wi, session:"", roleId:svcId, person:null });
    notify("Slot cleared.");
  };

  // ── ADMIN ASSIGN ──────────────────────────────────────────────────────────────
  const handleAdminAssign=async(wi,svcId,memberName)=>{
    const k=`${wi}-${svcId}`;
    const signedAt=Date.now();
    setSlots(p=>({...p,[k]:{member:memberName,signedAt}}));
    await post({ action:"saveRosterSlot", year:vy, month:vm, weekIdx:wi, session:"", roleId:svcId,
      person:{id:svcId+wi, name:memberName, email:"", signedAt:String(signedAt)} });
    notify(`Assigned ${memberName}.`);
  };

  // ── VENUE ─────────────────────────────────────────────────────────────────────
  const handleVenue=async(wi,v)=>{
    const k=`${vy}-${vm}-${wi}`; setVenues(p=>({...p,[k]:v}));
    await post({ action:"saveSettings", settings:{ [`venue_${k}`]:v } });
    notify("Venue updated!");
  };

  // ── MEMBERS ───────────────────────────────────────────────────────────────────
  const handleAddMember=async()=>{
    if(!newMember.trim()){return;}
    const updated=[...members,newMember.trim()]; setMembers(updated); setNewMember("");
    await post({ action:"saveSettings", settings:{ members:JSON.stringify(updated) } });
    notify(`${newMember.trim()} added!`);
  };
  const handleRemoveMember=async(name)=>{
    const updated=members.filter(m=>m!==name); setMembers(updated);
    await post({ action:"saveSettings", settings:{ members:JSON.stringify(updated) } });
    notify(`${name} removed.`);
  };

  // ── SERVICES ──────────────────────────────────────────────────────────────────
  const handleAddService=async()=>{
    if(!newSvcName.trim()){return;}
    const svc={ id:"svc"+Date.now(), name:newSvcName.trim(), session:newSvcSession, icon:newSvcIcon };
    const updated=[...services,svc]; setServices(updated);
    setNewSvcName(""); setNewSvcIcon("✨");
    await post({ action:"saveSettings", settings:{ services:JSON.stringify(updated) } });
    notify(`Service "${svc.name}" added!`);
  };
  const handleRemoveService=async(id)=>{
    const updated=services.filter(s=>s.id!==id); setServices(updated);
    await post({ action:"saveSettings", settings:{ services:JSON.stringify(updated) } });
    notify("Service removed.");
  };

  // ── SAVE SETTINGS ─────────────────────────────────────────────────────────────
  const handleSaveSettings=async()=>{
    setSavingSettings(true);
    await post({ action:"saveSettings", settings:{ openDay:localOpenDay, members:JSON.stringify(members), services:JSON.stringify(services) } });
    setSettings({openDay:localOpenDay}); setSavingSettings(false); notify("Settings saved!");
  };

  const open=isOpen(vy,vm,settings.openDay);
  const morningServices=services.filter(s=>s.session==="Morning");
  const eveningServices=services.filter(s=>s.session==="Evening");

  if(loading) return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"linear-gradient(150deg,#fdf3e3,#fde9cc,#e8f2f7)"}}>
      <div style={{fontSize:56,marginBottom:20}}>🪷</div>
      <div style={{fontFamily:"Georgia,serif",fontSize:22,color:"#c8922a",marginBottom:12}}>Bhakti Yoga Foundation</div>
      <div style={{fontFamily:"sans-serif",fontSize:14,color:"#7a5c3a"}}>Loading roster…</div>
    </div>
  );

  return (
    <div style={S.root}>
      <style>{css}</style>
      <div style={S.bg1}/><div style={S.bg2}/>
      {notif&&<div className="ai" style={{...S.notif,background:notif.type==="error"?"#7a1515":"#1a4230"}}>{notif.msg}</div>}

      {/* HEADER */}
      <header style={S.hdr}>
        <div style={S.hdrIn}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontSize:26}}>🪷</span>
            <div><div style={S.bName}>BHAKTI YOGA FOUNDATION</div><div style={S.bSub}>Simple Living · High Thinking</div></div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <NB active={view==="roster"} onClick={()=>setView("roster")}>📋 Roster</NB>
            <NB active={view==="admin"} onClick={()=>setView("admin")}>🔐 Admin</NB>
          </div>
        </div>
      </header>

      <main style={S.main}>

        {/* ══ ROSTER VIEW ══ */}
        {view==="roster"&&(
          <div className="ai" style={S.pw}>
            <h1 style={S.pH}>Volunteer Roster</h1>
            <p style={S.pS}>Select your name, then click a service to sign up</p>

            <MN y={vy} m={vm} onP={prevMonth} onN={nextMonth}/>

            {/* Status banner */}
            <div style={open?S.openBan:S.closeBan}>
              <span style={{fontSize:20}}>{open?"🔓":"🔒"}</span>
              <div style={{fontFamily:"sans-serif",fontSize:14}}>
                {open?<><strong>Roster is open for {fmtMonth(vy,vm)}</strong> — select your name below and sign up!</>:<><strong>Not open yet.</strong> Sign-ups open on the {settings.openDay}th of the previous month.</>}
              </div>
            </div>

            {/* Name selector */}
            {open&&(
              <div style={S.nameBox}>
                <div style={S.nameLabel}>👤 Who are you?</div>
                <select value={selMember} onChange={e=>setSelMember(e.target.value)} style={S.nameSelect}>
                  <option value="">— Select your name —</option>
                  {members.map(m=><option key={m} value={m}>{m}</option>)}
                </select>
                {selMember&&<div style={S.nameConfirm}>✓ Signing up as <strong>{selMember}</strong></div>}
              </div>
            )}

            {/* Week tabs */}
            <WT sundays={sundays} sel={selWeek} onSel={setSelWeek}/>

            {sundays[selWeek]&&<>
              <div style={S.dayLbl}>☀️ {fmtLong(sundays[selWeek])}</div>

              {/* Morning */}
              {morningServices.length>0&&(
                <Sec icon="🌅" title="Morning Program" sub={`9:30–11:00 AM · ${MORNING_VENUE}`}>
                  <div style={S.rGrid}>
                    {morningServices.map(svc=>{
                      const k=`${selWeek}-${svc.id}`;
                      const slot=slots[k];
                      const taken=slot?.member;
                      const editable=taken&&canEdit(slot?.signedAt);
                      const isMe=taken===selMember&&selMember;
                      return <SlotCard key={svc.id} svc={svc} taken={taken} isMe={isMe} editable={editable} open={open} selMember={selMember}
                        signedAt={slot?.signedAt} onSignup={()=>handleSignup(selWeek,svc.id)}/>;
                    })}
                  </div>
                </Sec>
              )}

              {/* Evening */}
              {eveningServices.length>0&&(
                <Sec icon="🌙" title="Evening Festival" sub={`5:00–7:00 PM · ${getVenue(selWeek)}`}>
                  <div style={S.rGrid}>
                    {eveningServices.map(svc=>{
                      const k=`${selWeek}-${svc.id}`;
                      const slot=slots[k];
                      const taken=slot?.member;
                      const editable=taken&&canEdit(slot?.signedAt);
                      const isMe=taken===selMember&&selMember;
                      return <SlotCard key={svc.id} svc={svc} taken={taken} isMe={isMe} editable={editable} open={open} selMember={selMember}
                        signedAt={slot?.signedAt} onSignup={()=>handleSignup(selWeek,svc.id)}/>;
                    })}
                  </div>
                </Sec>
              )}
            </>}
          </div>
        )}

        {/* ══ ADMIN VIEW ══ */}
        {view==="admin"&&(
          <div className="ai" style={S.pw}>
            {!adminAuth?(
              <div style={S.lWrap}>
                <div style={S.lCard}>
                  <div style={{fontSize:40,marginBottom:12}}>🔐</div>
                  <div style={S.lTitle}>Admin Access</div>
                  <div style={{fontFamily:"sans-serif",fontSize:13,color:"#7a5c3a",marginBottom:24}}>Enter the admin password to continue</div>
                  <input style={S.inp} type="password" placeholder="Password" value={adminPw} onChange={e=>setAdminPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(adminPw===ADMIN_PASS?(setAdminAuth(true),setPwErr(false)):setPwErr(true))}/>
                  {pwErr&&<div style={{color:"#8b1a1a",fontFamily:"sans-serif",fontSize:13,marginTop:8}}>Incorrect password</div>}
                  <button style={{...S.primBtn,marginTop:16}} onClick={()=>{ if(adminPw===ADMIN_PASS){setAdminAuth(true);setPwErr(false);}else setPwErr(true); }}>Login</button>
                </div>
              </div>
            ):(
              <>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:8}}>
                  <div><h1 style={S.pH}>Admin Panel</h1><p style={S.pS}>All changes save to Google Sheets automatically</p></div>
                  <button onClick={()=>{setAdminAuth(false);setView("roster");}} style={{background:"#8b1a1a22",color:"#8b1a1a",border:"1px solid #8b1a1a44",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontFamily:"sans-serif",fontSize:13}}>Sign Out</button>
                </div>

                <div style={{display:"flex",gap:8,marginBottom:24,flexWrap:"wrap"}}>
                  {["roster","members","services","settings"].map(t=>(
                    <button key={t} onClick={()=>setAdminTab(t)} style={{...S.atab,...(adminTab===t?S.atabOn:{})}}>
                      {t==="roster"?"📋 Roster":t==="members"?"👥 Members":t==="services"?"🛠 Services":"⚙️ Settings"}
                    </button>
                  ))}
                </div>

                {/* ── ADMIN ROSTER ── */}
                {adminTab==="roster"&&<>
                  <MN y={vy} m={vm} onP={prevMonth} onN={nextMonth}/>
                  <WT sundays={sundays} sel={selWeek} onSel={setSelWeek}/>
                  {sundays[selWeek]&&<>
                    <div style={S.dayLbl}>☀️ {fmtLong(sundays[selWeek])}</div>
                    <div style={S.aC}>
                      <div style={S.aCT}>🏛️ Evening Venue</div>
                      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                        {DEFAULT_VENUES.map(v=>{const a=getVenue(selWeek)===v;return<button key={v} onClick={()=>handleVenue(selWeek,v)} style={{background:a?"#2d7d9a":"#2d7d9a18",color:a?"#fff":"#2d7d9a",border:"2px solid #2d7d9a",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontFamily:"sans-serif",fontSize:13,fontWeight:"bold"}}>{v}</button>;})}
                      </div>
                    </div>
                    {["Morning","Evening"].map(sess=>{
                      const svcs=services.filter(s=>s.session===sess);
                      if(!svcs.length)return null;
                      return <div key={sess} style={S.aC}>
                        <div style={S.aCT}>{sess==="Morning"?"🌅":"🌙"} {sess} Services</div>
                        <div style={S.aGrid}>
                          {svcs.map(svc=>{
                            const k=`${selWeek}-${svc.id}`;
                            const taken=slots[k]?.member;
                            return <AdminSlot key={svc.id} svc={svc} taken={taken} members={members}
                              onClear={()=>handleClear(selWeek,svc.id)}
                              onAssign={name=>handleAdminAssign(selWeek,svc.id,name)}/>;
                          })}
                        </div>
                      </div>;
                    })}
                  </>}
                </>}

                {/* ── MEMBERS ── */}
                {adminTab==="members"&&<>
                  <div style={S.aC}>
                    <div style={S.aCT}>➕ Add Member</div>
                    <div style={{display:"flex",gap:10}}>
                      <input style={{...S.inp,flex:1}} placeholder="Full name" value={newMember} onChange={e=>setNewMember(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAddMember()}/>
                      <button style={{...S.primBtn,width:"auto",padding:"12px 24px"}} onClick={handleAddMember}>Add</button>
                    </div>
                  </div>
                  <div style={S.aC}>
                    <div style={S.aCT}>👥 All Members ({members.length})</div>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {members.map(m=>(
                        <div key={m} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#f8f4ee",borderRadius:8,padding:"10px 14px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <Av name={m}/><span style={{fontFamily:"sans-serif",fontSize:14,fontWeight:"bold"}}>{m}</span>
                          </div>
                          <button onClick={()=>handleRemoveMember(m)} style={{background:"#8b1a1a22",color:"#8b1a1a",border:"1px solid #8b1a1a44",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontFamily:"sans-serif",fontSize:12}}>Remove</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>}

                {/* ── SERVICES ── */}
                {adminTab==="services"&&<>
                  <div style={S.aC}>
                    <div style={S.aCT}>➕ Add New Service</div>
                    <div style={{display:"flex",flexDirection:"column",gap:10}}>
                      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                        <input style={{...S.inp,flex:1,minWidth:180}} placeholder="Service name (e.g. Mridanga)" value={newSvcName} onChange={e=>setNewSvcName(e.target.value)}/>
                        <input style={{...S.inp,width:70,textAlign:"center",fontSize:22}} placeholder="🎵" value={newSvcIcon} onChange={e=>setNewSvcIcon(e.target.value)}/>
                      </div>
                      <div style={{display:"flex",gap:8}}>
                        {["Morning","Evening"].map(s=><button key={s} onClick={()=>setNewSvcSession(s)} style={{background:newSvcSession===s?"#e07b39":"#f8f4ee",color:newSvcSession===s?"#fff":"#7a5c3a",border:`1.5px solid ${newSvcSession===s?"#e07b39":"#f5e6c8"}`,borderRadius:8,padding:"8px 18px",cursor:"pointer",fontFamily:"sans-serif",fontSize:13,fontWeight:"bold"}}>{s==="Morning"?"🌅 Morning":"🌙 Evening"}</button>)}
                      </div>
                      <button style={{...S.primBtn,width:"auto",padding:"11px 24px"}} onClick={handleAddService}>Add Service</button>
                    </div>
                  </div>
                  {["Morning","Evening"].map(sess=>{
                    const svcs=services.filter(s=>s.session===sess);
                    if(!svcs.length)return null;
                    return <div key={sess} style={S.aC}>
                      <div style={S.aCT}>{sess==="Morning"?"🌅":"🌙"} {sess} Services</div>
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {svcs.map(svc=>(
                          <div key={svc.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#f8f4ee",borderRadius:8,padding:"10px 14px"}}>
                            <span style={{fontFamily:"sans-serif",fontSize:14}}>{svc.icon} {svc.name}</span>
                            <button onClick={()=>handleRemoveService(svc.id)} style={{background:"#8b1a1a22",color:"#8b1a1a",border:"1px solid #8b1a1a44",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontFamily:"sans-serif",fontSize:12}}>Remove</button>
                          </div>
                        ))}
                      </div>
                    </div>;
                  })}
                </>}

                {/* ── SETTINGS ── */}
                {adminTab==="settings"&&<>
                  <div style={S.aC}>
                    <div style={S.aCT}>📅 Sign-up Window</div>
                    <div style={{fontFamily:"sans-serif",fontSize:13,color:"#7a5c3a",marginBottom:14}}>Roster opens for sign-ups on this day of the previous month.</div>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <label style={{fontFamily:"sans-serif",fontSize:14,fontWeight:"bold"}}>Opens on day:</label>
                      <input type="number" min="1" max="28" style={{...S.inp,width:80,textAlign:"center"}} value={localOpenDay} onChange={e=>setLocalOpenDay(parseInt(e.target.value)||24)}/>
                      <span style={{fontFamily:"sans-serif",fontSize:13,color:"#7a5c3a"}}>of each month</span>
                    </div>
                  </div>
                  <div style={S.aC}>
                    <div style={S.aCT}>ℹ️ About the 10-Minute Edit Window</div>
                    <div style={{fontFamily:"sans-serif",fontSize:13,color:"#7a5c3a",lineHeight:1.7}}>
                      When a member signs up for a service, they have <strong>10 minutes</strong> to change their selection. After that, only admin can make changes via this panel.
                    </div>
                  </div>
                  <button style={{...S.primBtn,width:"auto",padding:"13px 32px",opacity:savingSettings?0.7:1}} onClick={handleSaveSettings} disabled={savingSettings}>
                    {savingSettings?"Saving…":"💾 Save Settings"}
                  </button>
                </>}
              </>
            )}
          </div>
        )}
      </main>
      <footer style={S.footer}>Bhakti Yoga Foundation · ABN 88 219 281 244 · ACNC Registered Charity · Queensland, Australia</footer>
    </div>
  );
}

// ─── SLOT CARD (public) ────────────────────────────────────────────────────────
function SlotCard({svc,taken,isMe,editable,open,selMember,signedAt,onSignup}){
  const minsLeft = signedAt ? Math.max(0,Math.ceil((EDIT_WINDOW-(Date.now()-signedAt))/60000)) : 0;
  return <div style={{background:taken?(isMe?"#e6f4ed":"#f8f4ee"):"#fff",border:`1.5px solid ${taken?(isMe?"#3a8a5c":"#e0d4b0"):"#f5e6c8"}`,borderRadius:12,padding:"16px",display:"flex",flexDirection:"column",gap:8}}>
    <div style={{fontFamily:"Georgia,serif",fontSize:15,fontWeight:"bold",color:"#1a1209"}}>{svc.icon} {svc.name}</div>
    {taken?(
      <>
        <div style={{background:isMe?"#3a8a5c":"#2d7d9a",color:"#fff",padding:"6px 12px",borderRadius:6,fontSize:13,fontFamily:"sans-serif",fontWeight:"bold"}}>
          {isMe?"✓ You":"✓ "+taken}
        </div>
        {editable&&isMe&&<div style={{fontFamily:"sans-serif",fontSize:11,color:"#e07b39"}}>⏱ {minsLeft} min left to change</div>}
        {editable&&isMe&&<button onClick={onSignup} style={{background:"#e07b3922",color:"#e07b39",border:"1px solid #e07b3944",borderRadius:6,padding:"5px",cursor:"pointer",fontFamily:"sans-serif",fontSize:12}}>Change</button>}
      </>
    ):open?(
      selMember
        ?<button onClick={onSignup} style={{background:"linear-gradient(135deg,#e07b39,#c8922a)",color:"#fff",border:"none",borderRadius:8,padding:"8px",cursor:"pointer",fontFamily:"sans-serif",fontSize:13,fontWeight:"bold"}}>Sign Up</button>
        :<div style={{fontFamily:"sans-serif",fontSize:12,color:"#bbb",fontStyle:"italic"}}>Select your name above</div>
    ):<div style={{fontFamily:"sans-serif",fontSize:11,color:"#ccc",fontStyle:"italic"}}>Not open yet</div>}
  </div>;
}

// ─── ADMIN SLOT ────────────────────────────────────────────────────────────────
function AdminSlot({svc,taken,members,onClear,onAssign}){
  const [show,setShow]=useState(false);
  return <div style={{background:"#f8f4ee",borderRadius:10,padding:"12px 14px"}}>
    <div style={{fontFamily:"sans-serif",fontSize:12,color:"#7a5c3a",fontWeight:"bold",marginBottom:6}}>{svc.icon} {svc.name}</div>
    {taken?<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:6}}>
      <span style={{fontFamily:"sans-serif",fontSize:13,fontWeight:"bold",color:"#1a1209"}}>{taken}</span>
      <button onClick={onClear} style={{background:"#8b1a1a",color:"#fff",border:"none",borderRadius:4,padding:"3px 8px",cursor:"pointer",fontSize:11,fontFamily:"sans-serif"}}>Clear</button>
    </div>:show?<div style={{display:"flex",gap:6,alignItems:"center"}}>
      <select onChange={e=>{if(e.target.value){onAssign(e.target.value);setShow(false);}}} style={{flex:1,padding:"5px 8px",borderRadius:6,border:"1px solid #f5e6c8",fontFamily:"sans-serif",fontSize:12,background:"#fff"}}>
        <option value="">Select member…</option>{members.map(m=><option key={m} value={m}>{m}</option>)}
      </select>
      <button onClick={()=>setShow(false)} style={{background:"none",border:"none",cursor:"pointer",color:"#7a5c3a",fontSize:16}}>×</button>
    </div>:<button onClick={()=>setShow(true)} style={{background:"#2d7d9a22",color:"#2d7d9a",border:"1px dashed #2d7d9a",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontFamily:"sans-serif",fontSize:12,width:"100%"}}>+ Assign</button>}
  </div>;
}

// ─── TINY COMPONENTS ───────────────────────────────────────────────────────────
function Av({name}){ return <div style={{width:28,height:28,borderRadius:"50%",background:"#c8922a",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:"bold",fontFamily:"sans-serif",flexShrink:0}}>{name[0]}</div>; }
function NB({active,onClick,children}){ return <button onClick={onClick} style={{background:active?"#c8922a":"transparent",border:`1px solid ${active?"#c8922a":"#a0856a55"}`,color:active?"#1a1209":"#a0856a",padding:"7px 16px",borderRadius:5,cursor:"pointer",fontFamily:"sans-serif",fontSize:13,fontWeight:active?"700":"400"}}>{children}</button>; }
function MN({y,m,onP,onN}){ return <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:20,marginBottom:20}}><button onClick={onP} style={{background:"none",border:"2px solid #c8922a",color:"#c8922a",width:36,height:36,borderRadius:"50%",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button><div style={{fontSize:22,fontFamily:"Georgia,serif",fontWeight:"bold",color:"#1a1209",minWidth:200,textAlign:"center"}}>{fmtMonth(y,m)}</div><button onClick={onN} style={{background:"none",border:"2px solid #c8922a",color:"#c8922a",width:36,height:36,borderRadius:"50%",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>›</button></div>; }
function WT({sundays,sel,onSel}){ return <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>{sundays.map((s,i)=><button key={i} onClick={()=>onSel(i)} style={{background:sel===i?"#e07b39":"rgba(255,255,255,0.8)",border:`1.5px solid ${sel===i?"#e07b39":"#f5e6c8"}`,color:sel===i?"#fff":"#3d2b10",borderRadius:10,padding:"10px 20px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,minWidth:100}}><span style={{fontSize:10,opacity:0.8,textTransform:"uppercase",letterSpacing:1,fontFamily:"sans-serif"}}>Week {i+1}</span><span style={{fontSize:16,fontWeight:"bold",fontFamily:"Georgia,serif"}}>{fmtShort(s)}</span></button>)}</div>; }
function Sec({icon,title,sub,children}){ return <div style={{background:"rgba(255,255,255,0.85)",borderRadius:16,padding:"22px 26px",marginBottom:20,boxShadow:"0 4px 20px rgba(0,0,0,0.06)",border:"1px solid #f5e6c8"}}><div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:16}}><span style={{fontSize:26}}>{icon}</span><div><div style={{fontFamily:"Georgia,serif",fontSize:18,fontWeight:"bold",color:"#1a1209"}}>{title}</div><div style={{fontFamily:"sans-serif",fontSize:12,color:"#7a5c3a",marginTop:2}}>{sub}</div></div></div>{children}</div>; }

// ─── STYLES ────────────────────────────────────────────────────────────────────
const S={
  root:{minHeight:"100vh",fontFamily:"Georgia,serif",color:"#1a1209",position:"relative",overflowX:"hidden"},
  bg1:{position:"fixed",inset:0,background:"linear-gradient(150deg,#fdf3e3 0%,#fde9cc 45%,#e8f2f7 100%)",zIndex:0},
  bg2:{position:"fixed",inset:0,backgroundImage:"radial-gradient(circle at 15% 20%,rgba(224,123,57,0.1) 0%,transparent 45%),radial-gradient(circle at 85% 75%,rgba(45,125,154,0.1) 0%,transparent 45%)",zIndex:0},
  notif:{position:"fixed",top:16,right:16,padding:"12px 22px",borderRadius:8,color:"#fff",fontFamily:"sans-serif",fontSize:14,zIndex:1000,boxShadow:"0 4px 20px rgba(0,0,0,0.25)",maxWidth:360},
  hdr:{position:"fixed",top:0,left:0,right:0,zIndex:100,background:"rgba(26,18,9,0.96)",backdropFilter:"blur(8px)",borderBottom:"2px solid #c8922a33"},
  hdrIn:{maxWidth:1000,margin:"0 auto",padding:"12px 24px",display:"flex",alignItems:"center",justifyContent:"space-between"},
  bName:{color:"#c8922a",fontSize:12,fontFamily:"sans-serif",fontWeight:"700",letterSpacing:2.5},
  bSub:{color:"#7a5c3a",fontSize:10,fontFamily:"sans-serif",letterSpacing:2,marginTop:1},
  main:{position:"relative",zIndex:1,maxWidth:1000,margin:"0 auto",padding:"80px 20px 80px"},
  lWrap:{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"60vh"},
  lCard:{background:"rgba(255,255,255,0.93)",borderRadius:20,padding:"36px",maxWidth:360,width:"100%",textAlign:"center",boxShadow:"0 20px 60px rgba(0,0,0,0.12)",border:"1px solid #f5e6c8"},
  lTitle:{fontSize:20,fontWeight:"bold",color:"#1a1209",marginBottom:4},
  inp:{padding:"12px 16px",borderRadius:8,border:"1.5px solid #f5e6c8",fontSize:14,fontFamily:"sans-serif",outline:"none",background:"#fff",color:"#1a1209",width:"100%",display:"block"},
  primBtn:{background:"linear-gradient(135deg,#e07b39,#c8922a)",color:"#fff",border:"none",borderRadius:10,padding:"13px",cursor:"pointer",fontFamily:"sans-serif",fontSize:14,fontWeight:"700",width:"100%"},
  pw:{paddingTop:8},
  pH:{fontFamily:"Georgia,serif",fontSize:28,fontWeight:"bold",color:"#1a1209",marginBottom:4},
  pS:{fontFamily:"sans-serif",fontSize:14,color:"#7a5c3a",marginBottom:24},
  openBan:{display:"flex",alignItems:"center",gap:14,background:"rgba(45,125,154,0.1)",border:"1.5px solid #2d7d9a44",borderRadius:12,padding:"14px 18px",marginBottom:20,flexWrap:"wrap"},
  closeBan:{display:"flex",alignItems:"center",gap:14,background:"rgba(200,146,42,0.08)",border:"1.5px solid #c8922a44",borderRadius:12,padding:"14px 18px",marginBottom:20},
  nameBox:{background:"rgba(255,255,255,0.9)",border:"2px solid #c8922a44",borderRadius:14,padding:"20px 24px",marginBottom:24,boxShadow:"0 4px 16px rgba(0,0,0,0.06)"},
  nameLabel:{fontFamily:"sans-serif",fontSize:13,fontWeight:"bold",color:"#7a5c3a",marginBottom:10,letterSpacing:0.5},
  nameSelect:{width:"100%",padding:"12px 16px",borderRadius:8,border:"1.5px solid #c8922a44",fontSize:15,fontFamily:"sans-serif",background:"#fff",color:"#1a1209",cursor:"pointer",outline:"none"},
  nameConfirm:{fontFamily:"sans-serif",fontSize:13,color:"#3a8a5c",fontWeight:"bold",marginTop:8},
  dayLbl:{fontFamily:"sans-serif",fontSize:14,color:"#7a5c3a",fontStyle:"italic",marginBottom:20,background:"rgba(255,255,255,0.6)",borderRadius:8,padding:"10px 16px",border:"1px solid #f5e6c8"},
  rGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:12},
  atab:{background:"rgba(255,255,255,0.7)",border:"1.5px solid #f5e6c8",borderRadius:8,padding:"10px 20px",cursor:"pointer",fontFamily:"sans-serif",fontSize:14,color:"#7a5c3a"},
  atabOn:{background:"#1a1209",color:"#c8922a",border:"1.5px solid #c8922a"},
  aC:{background:"rgba(255,255,255,0.88)",borderRadius:14,padding:"22px 24px",marginBottom:18,border:"1px solid #f5e6c8",boxShadow:"0 4px 16px rgba(0,0,0,0.05)"},
  aCT:{fontFamily:"Georgia,serif",fontSize:16,fontWeight:"bold",color:"#1a1209",marginBottom:14},
  aGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10},
  footer:{position:"relative",zIndex:1,background:"#1a1209",color:"#7a5c3a",textAlign:"center",padding:"18px 24px",fontSize:11,fontFamily:"sans-serif",letterSpacing:0.8},
};

const css=`
  *{box-sizing:border-box;margin:0;padding:0;}
  button:hover{filter:brightness(1.08);}
  input:focus,select:focus{outline:2px solid #c8922a;outline-offset:1px;}
  ::-webkit-scrollbar{width:6px;} ::-webkit-scrollbar-thumb{background:#c8922a44;border-radius:3px;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}
  .ai{animation:fadeUp 0.4s ease forwards;}
`;
