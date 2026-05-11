import { useState, useRef, useEffect } from "react";

const WMO = {
  0:{icon:"☀️",label:"Despejado"},1:{icon:"🌤️",label:"Casi despejado"},
  2:{icon:"⛅",label:"Parc. nublado"},3:{icon:"☁️",label:"Nublado"},
  45:{icon:"🌫️",label:"Niebla"},48:{icon:"🌫️",label:"Niebla helada"},
  51:{icon:"🌦️",label:"Llovizna"},53:{icon:"🌧️",label:"Llovizna mod."},
  55:{icon:"🌧️",label:"Llovizna densa"},61:{icon:"🌧️",label:"Lluvia ligera"},
  63:{icon:"🌧️",label:"Lluvia mod."},65:{icon:"🌧️",label:"Lluvia fuerte"},
  71:{icon:"🌨️",label:"Nieve ligera"},73:{icon:"❄️",label:"Nieve"},
  75:{icon:"❄️",label:"Nieve fuerte"},80:{icon:"🌦️",label:"Chubascos"},
  81:{icon:"🌧️",label:"Chubascos mod."},82:{icon:"⛈️",label:"Chubascos fuertes"},
  95:{icon:"⛈️",label:"Tormenta"},99:{icon:"⛈️",label:"Tormenta+granizo"},
};
const wmo = c => WMO[c] ?? WMO[Math.floor((c||0)/10)*10] ?? {icon:"🌡️",label:"Variable"};
const windDir = d => ["N","NE","E","SE","S","SO","O","NO"][Math.round((d||0)/45)%8];

const MODELS = [
  {id:"best",  name:"Mejor Modelo", badge:"RECOMENDADO", badgeC:"#60A5FA", color:"#60A5FA", bg:"rgba(96,165,250,.08)",  br:"rgba(96,165,250,.28)",  tag:"🇪🇸 Estaciones ES", res:"Auto", param:"best_match"},
  {id:"ecmwf", name:"ECMWF",        badge:"EL TIEMPO.ES",badgeC:"#38BDF8", color:"#38BDF8", bg:"rgba(56,189,248,.07)",  br:"rgba(56,189,248,.25)",  tag:"🇪🇺 Europa 9km",   res:"9 km",  param:"ecmwf_ifs025"},
  {id:"icon",  name:"ICON-EU",      badge:"ALTA RES.",   badgeC:"#93C5FD", color:"#93C5FD", bg:"rgba(147,197,253,.07)", br:"rgba(147,197,253,.22)", tag:"🇩🇪 Alemania 2km", res:"2 km",  param:"icon_seamless"},
];

const CITIES = ["Madrid","Barcelona","Sevilla","Valencia","Bilbao","Málaga","Zaragoza","Palma","Tenerife","A Coruña"];

async function fetchGeo(q) {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=es&format=json`);
  if (!r.ok) throw new Error("HTTP " + r.status);
  const d = await r.json();
  return d.results ?? [];
}

async function fetchWeather(lat, lon, param) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,precipitation,surface_pressure,visibility,uv_index` +
    `&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,relative_humidity_2m,uv_index,visibility` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_direction_10m_dominant,uv_index_max,sunrise,sunset` +
    `&wind_speed_unit=kmh&timezone=auto&models=${param}&forecast_days=7`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("HTTP " + r.status);
  const d = await r.json();
  if (!d.current) throw new Error("Sin datos");
  const c = d.current;

  // Parse hourly — next 24 hours from now
  const now = new Date();
  const hourly = [];
  if (d.hourly?.time) {
    for (let i = 0; i < d.hourly.time.length; i++) {
      const t = new Date(d.hourly.time[i]);
      if (t >= now && hourly.length < 24) {
        hourly.push({
          time: t,
          temp: Math.round(d.hourly.temperature_2m[i]),
          feels: Math.round(d.hourly.apparent_temperature[i]),
          precip: +(d.hourly.precipitation[i]||0).toFixed(1),
          precipProb: d.hourly.precipitation_probability[i] ?? 0,
          wind: Math.round(d.hourly.wind_speed_10m[i]),
          windD: d.hourly.wind_direction_10m[i],
          humidity: d.hourly.relative_humidity_2m[i],
          uv: d.hourly.uv_index?.[i],
          vis: d.hourly.visibility?.[i] != null ? +(d.hourly.visibility[i]/1000).toFixed(1) : null,
          info: wmo(d.hourly.weather_code[i]),
        });
      }
    }
  }

  // Parse daily — 7 days
  const daily = [];
  if (d.daily?.time) {
    for (let i = 0; i < d.daily.time.length; i++) {
      daily.push({
        date: new Date(d.daily.time[i] + "T12:00:00"),
        tempMax: Math.round(d.daily.temperature_2m_max[i]),
        tempMin: Math.round(d.daily.temperature_2m_min[i]),
        feelsMax: Math.round(d.daily.apparent_temperature_max[i]),
        feelsMin: Math.round(d.daily.apparent_temperature_min[i]),
        precip: +(d.daily.precipitation_sum[i]||0).toFixed(1),
        precipProb: d.daily.precipitation_probability_max[i] ?? 0,
        wind: Math.round(d.daily.wind_speed_10m_max[i]),
        windD: d.daily.wind_direction_10m_dominant[i],
        uv: d.daily.uv_index_max?.[i],
        sunrise: d.daily.sunrise?.[i],
        sunset: d.daily.sunset?.[i],
        info: wmo(d.daily.weather_code[i]),
      });
    }
  }

  return {
    temp: Math.round(c.temperature_2m),
    feels: Math.round(c.apparent_temperature),
    humidity: Math.round(c.relative_humidity_2m),
    wind: Math.round(c.wind_speed_10m),
    windD: Math.round(c.wind_direction_10m ?? 0),
    precip: +c.precipitation.toFixed(1),
    pressure: Math.round(c.surface_pressure),
    vis: c.visibility != null ? +(c.visibility/1000).toFixed(1) : null,
    uv: c.uv_index,
    info: wmo(c.weather_code),
    hourly,
    daily,
  };
}

function buildConsensus(data) {
  const valid = MODELS.map(m => data[m.id]).filter(d => d?.temp != null);
  if (!valid.length) return null;
  const avg = k => Math.round(valid.map(d=>d[k]).filter(v=>v!=null).reduce((a,b)=>a+b,0)/valid.length);
  const temps = valid.map(d=>d.temp);
  const spread = Math.max(...temps) - Math.min(...temps);
  const conf = spread===0?100:spread===1?85:spread===2?65:spread<=4?45:20;
  return {
    temp:avg("temp"), feels:avg("feels"), humidity:avg("humidity"),
    wind:avg("wind"), precip:avg("precip"), pressure:avg("pressure"),
    info:valid[0].info, spread, conf,
    cColor: conf>=80?"#86EFAC":conf>=50?"#FCD34D":"#FCA5A5",
    cLabel: conf>=80?"Alta concordancia":conf>=50?"Concordancia media":"Modelos discrepan",
  };
}

const DAYS_ES = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const MONTHS_ES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const fmtHour = d => `${String(d.getHours()).padStart(2,"0")}:00`;
const fmtDay = d => `${DAYS_ES[d.getDay()]} ${d.getDate()} ${MONTHS_ES[d.getMonth()]}`;
const fmtTime = s => s ? s.slice(11,16) : "—";

export default function App() {
  const [input,    setInput]    = useState("");
  const [drops,    setDrops]    = useState([]);
  const [showDrop, setShowDrop] = useState(false);
  const [loc,      setLoc]      = useState(null);
  const [data,     setData]     = useState({});
  const [status,   setStatus]   = useState("idle");
  const [errMsg,   setErrMsg]   = useState("");
  const [tab,      setTab]      = useState("ahora");    // ahora | horas | dias
  const [selModel, setSelModel] = useState("best");     // for hourly/daily view
  const deb = useRef(null);

  useEffect(() => {
    if (input.length < 2) { setDrops([]); setShowDrop(false); return; }
    clearTimeout(deb.current);
    deb.current = setTimeout(async () => {
      try { const r = await fetchGeo(input); setDrops(r); setShowDrop(r.length > 0); } catch {}
    }, 300);
    return () => clearTimeout(deb.current);
  }, [input]);

  const runModels = async (lat, lon, name) => {
    setShowDrop(false);
    setLoc({ lat, lon, name });
    setData({});
    setStatus("loading");
    setErrMsg("");
    setTab("ahora");
    const results = {};
    await Promise.all(MODELS.map(async m => {
      try   { results[m.id] = await fetchWeather(lat, lon, m.param); }
      catch(e) { results[m.id] = { error: e.message }; }
    }));
    const anyOk = Object.values(results).some(d => d?.temp != null);
    setData(results);
    setStatus(anyOk ? "done" : "error");
    if (!anyOk) setErrMsg("No se pudieron cargar los datos.");
  };

  const doSearch = async () => {
    const q = input.trim(); if (!q) return;
    setStatus("searching");
    try {
      const cities = await fetchGeo(q);
      if (!cities.length) { setStatus("error"); setErrMsg(`No encontré "${q}"`); return; }
      const c = cities[0];
      setInput([c.name, c.admin1, c.country].filter(Boolean).join(", "));
      runModels(c.latitude, c.longitude, c.name);
    } catch(e) { setStatus("error"); setErrMsg("Error: " + e.message); }
  };

  const pick = c => {
    setInput([c.name, c.admin1, c.country].filter(Boolean).join(", "));
    setShowDrop(false);
    runModels(c.latitude, c.longitude, c.name);
  };

  const quickCity = async city => {
    setInput(city); setStatus("searching");
    try {
      const r = await fetchGeo(city);
      if (r[0]) { const c=r[0]; setInput([c.name,c.admin1,c.country].filter(Boolean).join(", ")); runModels(c.latitude,c.longitude,c.name); }
    } catch(e) { setStatus("error"); setErrMsg("Error: " + e.message); }
  };

  const con = buildConsensus(data);
  const isLoading = status === "loading" || status === "searching";
  const curModel = MODELS.find(m => m.id === selModel);
  const curData = data[selModel];

  return (
    <div style={{minHeight:"100vh",background:"#06101e",color:"#e2e8f0",fontFamily:"'DM Sans',system-ui,sans-serif",overflowX:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@800;900&family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::placeholder{color:#1e3a5f} :focus{outline:none}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes shimmer{0%,100%{opacity:.1}50%{opacity:.3}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
        @keyframes twinkle{0%,100%{opacity:.12}50%{opacity:.6}}
        .city-pill:hover{background:rgba(56,189,248,.12)!important;color:#38BDF8!important;border-color:rgba(56,189,248,.3)!important}
        .drop-row:hover{background:rgba(56,189,248,.07)!important}
        .src-card{transition:transform .2s,box-shadow .2s}
        .src-card:hover{transform:translateY(-3px);box-shadow:0 12px 40px rgba(0,0,0,.4)}
        .tab-btn{transition:all .18s;cursor:pointer;border:none;font-family:'DM Sans',sans-serif}
        .model-btn{transition:all .15s;cursor:pointer;border:none;font-family:'DM Mono',monospace}
        .hour-card{transition:background .15s}
        .hour-card:hover{background:rgba(255,255,255,.05)!important}
      `}</style>

      {/* BG */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,#091628 0%,#06101e 100%)"}}/>
        <div style={{position:"absolute",top:"-20%",left:"15%",width:600,height:600,background:"radial-gradient(circle,rgba(56,189,248,.06) 0%,transparent 60%)"}}/>
        <div style={{position:"absolute",bottom:"-10%",right:"5%",width:500,height:500,background:"radial-gradient(circle,rgba(96,165,250,.05) 0%,transparent 60%)"}}/>
        {Array.from({length:40}).map((_,i)=>(
          <div key={i} style={{position:"absolute",left:`${(i*43+11)%100}%`,top:`${(i*67+5)%85}%`,width:i%8===0?2:1,height:i%8===0?2:1,borderRadius:"50%",background:"#93c5fd",animation:`twinkle ${1.5+i%3}s ease-in-out infinite`,animationDelay:`${(i*.2)%4}s`}}/>
        ))}
      </div>

      <div style={{position:"relative",zIndex:1,maxWidth:900,margin:"0 auto",padding:"28px 16px 80px"}}>

        {/* HEADER */}
        <div style={{textAlign:"center",marginBottom:28,animation:"fadeUp .5s ease both"}}>
          <div style={{fontSize:32,marginBottom:6,display:"inline-block",animation:"float 5s ease-in-out infinite"}}>🌤️</div>
          <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:"clamp(28px,7vw,48px)",fontWeight:900,letterSpacing:"-.03em",lineHeight:1,marginBottom:5,background:"linear-gradient(135deg,#bae6fd 0%,#38BDF8 50%,#60A5FA 100%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
            Meteoverso
          </h1>
          <div style={{color:"#164e63",fontSize:9,letterSpacing:".14em",textTransform:"uppercase",fontFamily:"'DM Mono',monospace",marginBottom:6}}>comparador meteorológico científico</div>
          <p style={{color:"#1e4060",fontSize:12,lineHeight:1.5}}>Tres modelos · Un consenso · Sin registro</p>
        </div>

        {/* SEARCH */}
        <div style={{position:"relative",maxWidth:560,margin:"0 auto 22px",animation:"fadeUp .5s ease .08s both"}}>
          <div style={{display:"flex",gap:8,background:"rgba(255,255,255,.04)",border:"1px solid rgba(56,189,248,.25)",borderRadius:16,padding:"7px 7px 7px 16px",alignItems:"center",transition:"border-color .2s,box-shadow .2s"}}
            onFocusCapture={e=>{e.currentTarget.style.borderColor="rgba(56,189,248,.6)";e.currentTarget.style.boxShadow="0 0 0 3px rgba(56,189,248,.1)";}}
            onBlurCapture={e=>{e.currentTarget.style.borderColor="rgba(56,189,248,.25)";e.currentTarget.style.boxShadow="none";}}
          >
            <span style={{fontSize:14,flexShrink:0}}>🔍</span>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")doSearch();}}
              placeholder="Tu ciudad... (Uceda, Cuenca, Vigo...)"
              style={{flex:1,background:"transparent",border:"none",color:"#e2e8f0",fontSize:14,fontFamily:"'DM Sans',sans-serif",minWidth:0}}/>
            {isLoading && <div style={{width:14,height:14,border:"2px solid rgba(56,189,248,.3)",borderTopColor:"#38BDF8",borderRadius:"50%",animation:"spin .7s linear infinite",flexShrink:0}}/>}
            <button onClick={doSearch} disabled={isLoading}
              style={{background:isLoading?"#0c2a42":"linear-gradient(135deg,#0ea5e9,#3b82f6)",color:isLoading?"#1e4060":"#fff",border:"none",borderRadius:10,padding:"8px 18px",fontSize:13,fontWeight:700,cursor:isLoading?"not-allowed":"pointer",fontFamily:"'DM Sans',sans-serif",flexShrink:0,opacity:isLoading?.5:1,whiteSpace:"nowrap",transition:"all .15s"}}>
              {isLoading?(status==="searching"?"Buscando...":"Cargando..."):"Comparar"}
            </button>
          </div>
          {showDrop && drops.length > 0 && !isLoading && (
            <div style={{position:"absolute",top:"calc(100% + 5px)",left:0,right:0,background:"#0a1628",border:"1px solid rgba(56,189,248,.2)",borderRadius:12,overflow:"hidden",zIndex:300,boxShadow:"0 20px 60px rgba(0,0,0,.9)"}}>
              {drops.slice(0,5).map((c,i)=>(
                <button key={i} onClick={()=>pick(c)} className="drop-row"
                  style={{width:"100%",textAlign:"left",background:"transparent",border:"none",borderBottom:i<4?"1px solid rgba(255,255,255,.04)":"none",padding:"11px 16px",cursor:"pointer",color:"#e2e8f0",fontSize:14,fontFamily:"'DM Sans',sans-serif",display:"flex",gap:8,alignItems:"center",transition:"background .12s"}}>
                  <span style={{opacity:.4}}>📍</span>
                  <span style={{fontWeight:600}}>{c.name}</span>
                  {c.admin1&&<span style={{color:"#4b7b9e",fontSize:12}}>{c.admin1}</span>}
                  <span style={{color:"#0f2035",marginLeft:"auto",fontSize:11,fontFamily:"'DM Mono',monospace",flexShrink:0}}>{c.country}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {status==="error" && errMsg && (
          <div style={{maxWidth:560,margin:"0 auto 18px",background:"rgba(252,165,165,.07)",border:"1px solid rgba(252,165,165,.25)",borderRadius:10,padding:"11px 16px",color:"#FCA5A5",fontSize:13,animation:"fadeUp .3s ease both"}}>⚠️ {errMsg}</div>
        )}

        {/* QUICK CITIES */}
        {status==="idle" && (
          <div style={{animation:"fadeUp .5s ease .12s both"}}>
            <div style={{display:"flex",gap:6,justifyContent:"center",flexWrap:"wrap",marginBottom:22}}>
              {CITIES.map(city=>(
                <button key={city} onClick={()=>quickCity(city)} className="city-pill"
                  style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:30,padding:"5px 14px",color:"#1e4060",fontSize:12,fontFamily:"'DM Sans',sans-serif",cursor:"pointer",transition:"all .15s"}}>
                  {city}
                </button>
              ))}
            </div>
            <div style={{textAlign:"center"}}><p style={{color:"#0f2035",fontSize:12,lineHeight:1.9}}>Sin registro · Sin API key · Datos científicos reales</p></div>
          </div>
        )}

        {/* RESULTS */}
        {(isLoading || status==="done") && (
          <div style={{animation:"fadeUp .4s ease both"}}>

            {/* Location */}
            {loc && (
              <div style={{textAlign:"center",marginBottom:18}}>
                <div style={{color:"#0f2a42",fontSize:10,textTransform:"uppercase",letterSpacing:".14em",fontFamily:"'DM Mono',monospace",marginBottom:3}}>comparando para</div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:24,fontWeight:900,color:"#f0f9ff"}}>{loc.name}</div>
              </div>
            )}

            {/* TABS */}
            <div style={{display:"flex",gap:4,background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:14,padding:4,marginBottom:18,maxWidth:340,margin:"0 auto 18px"}}>
              {[{id:"ahora",label:"⚡ Ahora"},{id:"horas",label:"🕐 24 horas"},{id:"dias",label:"📅 7 días"}].map(t=>(
                <button key={t.id} onClick={()=>setTab(t.id)} className="tab-btn"
                  style={{flex:1,padding:"8px 6px",borderRadius:10,fontSize:12,fontWeight:600,background:tab===t.id?"rgba(56,189,248,.15)":"transparent",color:tab===t.id?"#38BDF8":"#1e4060",border:tab===t.id?"1px solid rgba(56,189,248,.3)":"1px solid transparent"}}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── TAB: AHORA ── */}
            {tab==="ahora" && (
              <>
                {/* Consensus */}
                <div style={{background:"rgba(56,189,248,.04)",border:"1px solid rgba(56,189,248,.14)",borderRadius:18,padding:"20px",marginBottom:14}}>
                  {isLoading&&!con?(
                    <div style={{display:"flex",gap:20,flexWrap:"wrap",alignItems:"center"}}>
                      <div style={{height:65,width:170,background:"rgba(255,255,255,.04)",borderRadius:10,animation:"shimmer 1.4s ease infinite"}}/>
                      <div style={{flex:1}}>{[80,60,100,50].map((w,i)=><div key={i} style={{height:i===2?5:10,width:`${w}%`,background:"rgba(255,255,255,.04)",borderRadius:6,marginBottom:10,animation:"shimmer 1.4s ease infinite"}}/>)}</div>
                    </div>
                  ):con?(
                    <div style={{display:"flex",gap:20,flexWrap:"wrap",alignItems:"center"}}>
                      <div>
                        <div style={{color:"#0f2a42",fontSize:9,textTransform:"uppercase",letterSpacing:".12em",fontFamily:"'DM Mono',monospace",marginBottom:5}}>Consenso · 3 modelos</div>
                        <div style={{display:"flex",alignItems:"flex-end",gap:8,marginBottom:3}}>
                          <span style={{fontSize:48}}>{con.info.icon}</span>
                          <span style={{fontFamily:"'Syne',sans-serif",fontSize:54,fontWeight:900,color:"#f0f9ff",lineHeight:1}}>{con.temp}°C</span>
                        </div>
                        <div style={{color:"#2e6b8a",fontSize:12}}>{con.info.label}</div>
                      </div>
                      <div style={{flex:1,minWidth:170}}>
                        <div style={{marginBottom:10}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                            <span style={{color:"#1e4060",fontSize:11}}>Concordancia</span>
                            <span style={{color:con.cColor,fontSize:11,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{con.cLabel}</span>
                          </div>
                          <div style={{background:"rgba(255,255,255,.06)",borderRadius:6,height:5,overflow:"hidden"}}>
                            <div style={{width:`${con.conf}%`,height:"100%",background:con.cColor,borderRadius:6,transition:"width 1.2s ease"}}/>
                          </div>
                          <div style={{color:"#0f2035",fontSize:10,marginTop:3,fontFamily:"'DM Mono',monospace"}}>
                            ±{con.spread}°C dispersión
                            {con.spread===0&&<span style={{color:"#86EFAC",marginLeft:6}}>✓ Total acuerdo</span>}
                            {con.spread>=3&&<span style={{color:"#FCA5A5",marginLeft:6}}>⚠ Alta incertidumbre</span>}
                          </div>
                        </div>
                        <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                          {[{l:"Sensación",v:`${con.feels}°C`},{l:"Humedad",v:`${con.humidity}%`},{l:"Viento",v:`${con.wind}km/h`},{l:"Precip.",v:`${con.precip}mm`},{l:"Presión",v:`${con.pressure}hPa`}].map(({l,v})=>(
                            <div key={l}>
                              <div style={{color:"#0f2035",fontSize:9,textTransform:"uppercase",letterSpacing:".06em"}}>{l}</div>
                              <div style={{color:"#e0f2fe",fontSize:13,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{v}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ):null}
                </div>

                {/* Source cards */}
                <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:14}}>
                  {MODELS.map(m=>{
                    const d=data[m.id];
                    return(
                      <div key={m.id} className="src-card" style={{flex:"1 1 190px",minWidth:170,background:m.bg,border:`1px solid ${m.br}`,borderRadius:16,padding:"16px",position:"relative"}}>
                        <div style={{position:"absolute",top:10,right:10,background:`${m.badgeC}18`,border:`1px solid ${m.badgeC}35`,borderRadius:20,padding:"2px 7px",fontSize:8,color:m.badgeC,fontFamily:"'DM Mono',monospace",fontWeight:700}}>{m.badge}</div>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12}}>
                          <span style={{background:`${m.color}20`,border:`1px solid ${m.br}`,borderRadius:7,padding:"3px 9px",color:m.color,fontSize:11,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{m.name}</span>
                        </div>
                        {isLoading?[52,38,68,55,60].map((w,i)=><div key={i} style={{height:9,width:`${w}%`,background:"rgba(255,255,255,.05)",borderRadius:5,marginBottom:7,animation:"shimmer 1.4s ease infinite",animationDelay:`${i*.1}s`}}/>)
                        :!d?<div style={{color:"#1e3a5f",fontSize:12}}>Sin datos</div>
                        :d.error?<div style={{color:"#FCA5A5",fontSize:11}}>⚠️ {d.error}</div>
                        :(
                          <>
                            <div style={{display:"flex",alignItems:"flex-end",gap:6,marginBottom:3}}>
                              <span style={{fontSize:38,lineHeight:1}}>{d.info.icon}</span>
                              <span style={{fontFamily:"'Syne',sans-serif",fontSize:42,fontWeight:900,color:"#f0f9ff",lineHeight:1}}>{d.temp}°</span>
                            </div>
                            <div style={{color:m.color,fontSize:11,fontWeight:600,marginBottom:12}}>{d.info.label}</div>
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 8px"}}>
                              {[{l:"Sensación",v:`${d.feels}°`},{l:"Humedad",v:`${d.humidity}%`},{l:"Viento",v:`${d.wind}km/h ${windDir(d.windD)}`},{l:"Precip.",v:`${d.precip}mm`},{l:"Presión",v:`${d.pressure}hPa`},{l:"Visib.",v:d.vis!=null?`${d.vis}km`:"—"}].map(({l,v})=>(
                                <div key={l}>
                                  <div style={{color:"#0f2035",fontSize:9,textTransform:"uppercase",letterSpacing:".04em",marginBottom:1}}>{l}</div>
                                  <div style={{color:"#bae6fd",fontSize:11,fontWeight:600,fontFamily:"'DM Mono',monospace"}}>{v}</div>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                        <div style={{position:"absolute",bottom:9,right:11,color:"#0f2035",fontSize:9,fontFamily:"'DM Mono',monospace"}}>{m.res}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Comparison table */}
                {status==="done"&&con&&(
                  <div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(56,189,248,.1)",borderRadius:12,overflow:"hidden",marginBottom:14}}>
                    <div style={{padding:"10px 16px",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
                      <span style={{color:"#0f2a42",fontSize:10,textTransform:"uppercase",letterSpacing:".08em",fontFamily:"'DM Mono',monospace"}}>Comparativa · ↑ más alto · ↓ más bajo</span>
                    </div>
                    <div style={{overflowX:"auto"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",minWidth:340}}>
                        <thead>
                          <tr style={{background:"rgba(255,255,255,.01)"}}>
                            <td style={{padding:"7px 16px",color:"#0f2035",fontSize:9,textTransform:"uppercase",letterSpacing:".07em",fontFamily:"'DM Mono',monospace"}}>Parámetro</td>
                            {MODELS.map(m=>(
                              <td key={m.id} style={{padding:"7px 8px",textAlign:"center"}}>
                                <span style={{background:`${m.color}20`,color:m.color,fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:5,fontFamily:"'DM Mono',monospace",border:`1px solid ${m.br}`}}>{m.name}</span>
                              </td>
                            ))}
                            <td style={{padding:"7px 8px",textAlign:"center"}}>
                              <span style={{background:"rgba(255,255,255,.05)",color:"#2e6b8a",fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:5,fontFamily:"'DM Mono',monospace"}}>MEDIA</span>
                            </td>
                          </tr>
                        </thead>
                        <tbody>
                          {[{k:"temp",l:"Temp.",u:"°C"},{k:"feels",l:"Sensación",u:"°C"},{k:"humidity",l:"Humedad",u:"%"},{k:"wind",l:"Viento",u:"km/h"},{k:"precip",l:"Precip.",u:"mm"},{k:"pressure",l:"Presión",u:"hPa"},{k:"vis",l:"Visib.",u:"km"}].map(({k,l,u},ri)=>{
                            const vals=MODELS.map(m=>data[m.id]?.[k]).filter(v=>v!=null&&!isNaN(v));
                            const mn=vals.length?Math.min(...vals):null,mx=vals.length?Math.max(...vals):null;
                            const av=vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):null;
                            return(
                              <tr key={k} style={{background:ri%2?"rgba(255,255,255,.01)":"transparent",borderTop:"1px solid rgba(255,255,255,.03)"}}>
                                <td style={{padding:"8px 16px",color:"#2e6b8a",fontSize:12}}>{l}</td>
                                {MODELS.map(m=>{
                                  const v=data[m.id]?.[k];
                                  const hi=v!=null&&v===mx&&mn!==mx,lo=v!=null&&v===mn&&mn!==mx;
                                  return(
                                    <td key={m.id} style={{padding:"8px 8px",textAlign:"center"}}>
                                      {v!=null?<span style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:hi?"#FCD34D":lo?"#86EFAC":"#bae6fd",fontWeight:hi||lo?700:400}}>{v}{u}{hi?"↑":lo?"↓":""}</span>:<span style={{color:"#0f2035"}}>—</span>}
                                    </td>
                                  );
                                })}
                                <td style={{padding:"8px 8px",textAlign:"center"}}>
                                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:"#1e4060"}}>{av!=null?`${av}${u}`:"—"}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── TAB: HORAS ── */}
            {tab==="horas" && (
              <div>
                {/* Model selector */}
                <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
                  {MODELS.map(m=>(
                    <button key={m.id} onClick={()=>setSelModel(m.id)} className="model-btn"
                      style={{padding:"6px 14px",borderRadius:20,fontSize:11,fontWeight:700,background:selModel===m.id?`${m.color}22`:"rgba(255,255,255,.03)",color:selModel===m.id?m.color:"#1e4060",border:selModel===m.id?`1px solid ${m.br}`:"1px solid rgba(255,255,255,.07)"}}>
                      {m.name}
                    </button>
                  ))}
                </div>

                {isLoading?(
                  <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:8}}>
                    {Array.from({length:8}).map((_,i)=>(
                      <div key={i} style={{flexShrink:0,width:90,height:160,background:"rgba(255,255,255,.04)",borderRadius:12,animation:"shimmer 1.4s ease infinite",animationDelay:`${i*.08}s`}}/>
                    ))}
                  </div>
                ):curData?.hourly?.length>0?(
                  <div style={{overflowX:"auto",paddingBottom:8}}>
                    <div style={{display:"flex",gap:8,minWidth:"max-content"}}>
                      {curData.hourly.map((h,i)=>(
                        <div key={i} className="hour-card" style={{flexShrink:0,width:88,background:"rgba(255,255,255,.03)",border:`1px solid ${curModel.br}`,borderRadius:12,padding:"12px 8px",textAlign:"center",cursor:"default"}}>
                          <div style={{color:"#1e4060",fontSize:10,fontFamily:"'DM Mono',monospace",marginBottom:6}}>{fmtHour(h.time)}</div>
                          <div style={{fontSize:24,marginBottom:4}}>{h.info.icon}</div>
                          <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:900,color:"#f0f9ff",marginBottom:2}}>{h.temp}°</div>
                          <div style={{color:curModel.color,fontSize:9,marginBottom:8}}>{h.info.label}</div>
                          <div style={{display:"flex",flexDirection:"column",gap:4}}>
                            {[
                              {l:"💧",v:`${h.precipProb}%`},
                              {l:"🌧️",v:`${h.precip}mm`},
                              {l:"💨",v:`${h.wind}km/h`},
                              {l:"💦",v:`${h.humidity}%`},
                            ].map(({l,v})=>(
                              <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                                <span style={{fontSize:10}}>{l}</span>
                                <span style={{color:"#bae6fd",fontSize:10,fontFamily:"'DM Mono',monospace",fontWeight:600}}>{v}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ):(
                  <div style={{color:"#1e4060",fontSize:13,textAlign:"center",padding:"20px"}}>Sin datos horarios</div>
                )}
              </div>
            )}

            {/* ── TAB: DÍAS ── */}
            {tab==="dias" && (
              <div>
                {/* Model selector */}
                <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
                  {MODELS.map(m=>(
                    <button key={m.id} onClick={()=>setSelModel(m.id)} className="model-btn"
                      style={{padding:"6px 14px",borderRadius:20,fontSize:11,fontWeight:700,background:selModel===m.id?`${m.color}22`:"rgba(255,255,255,.03)",color:selModel===m.id?m.color:"#1e4060",border:selModel===m.id?`1px solid ${m.br}`:"1px solid rgba(255,255,255,.07)"}}>
                      {m.name}
                    </button>
                  ))}
                </div>

                {isLoading?(
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {Array.from({length:7}).map((_,i)=>(
                      <div key={i} style={{height:64,background:"rgba(255,255,255,.04)",borderRadius:12,animation:"shimmer 1.4s ease infinite",animationDelay:`${i*.08}s`}}/>
                    ))}
                  </div>
                ):curData?.daily?.length>0?(
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {curData.daily.map((d,i)=>(
                      <div key={i} style={{background:"rgba(255,255,255,.03)",border:`1px solid ${curModel.br}`,borderRadius:12,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                        {/* Day */}
                        <div style={{minWidth:80}}>
                          <div style={{color:i===0?"#38BDF8":"#1e4060",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".05em"}}>
                            {i===0?"Hoy":i===1?"Mañana":DAYS_ES[d.date.getDay()]}
                          </div>
                          <div style={{color:"#0f2035",fontSize:10}}>{d.date.getDate()} {MONTHS_ES[d.date.getMonth()]}</div>
                        </div>
                        {/* Icon + condition */}
                        <div style={{display:"flex",alignItems:"center",gap:8,minWidth:120}}>
                          <span style={{fontSize:28}}>{d.info.icon}</span>
                          <div>
                            <div style={{color:curModel.color,fontSize:11,fontWeight:600}}>{d.info.label}</div>
                            <div style={{color:"#0f2035",fontSize:10}}>☀️ {fmtTime(d.sunrise)} · 🌙 {fmtTime(d.sunset)}</div>
                          </div>
                        </div>
                        {/* Temps */}
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:900,color:"#f0f9ff"}}>{d.tempMax}°</span>
                          <span style={{color:"#1e4060",fontSize:14,fontFamily:"'DM Mono',monospace"}}>/</span>
                          <span style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:700,color:"#2e6b8a"}}>{d.tempMin}°</span>
                        </div>
                        {/* Details */}
                        <div style={{display:"flex",gap:12,flexWrap:"wrap",marginLeft:"auto"}}>
                          {[
                            {l:"💧",v:`${d.precipProb}%`},
                            {l:"🌧️",v:`${d.precip}mm`},
                            {l:"💨",v:`${d.wind}km/h ${windDir(d.windD)}`},
                            {l:"☀️UV",v:d.uv!=null?d.uv:"—"},
                          ].map(({l,v})=>(
                            <div key={l} style={{textAlign:"center"}}>
                              <div style={{color:"#0f2035",fontSize:9}}>{l}</div>
                              <div style={{color:"#bae6fd",fontSize:11,fontWeight:600,fontFamily:"'DM Mono',monospace"}}>{v}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ):(
                  <div style={{color:"#1e4060",fontSize:13,textAlign:"center",padding:"20px"}}>Sin datos diarios</div>
                )}
              </div>
            )}

          </div>
        )}

        <div style={{textAlign:"center",marginTop:48,color:"#091628",fontSize:10,fontFamily:"'DM Mono',monospace",lineHeight:2}}>
          Meteoverso · Open-Meteo · ECMWF · ICON-EU · Best Match<br/>Sin publicidad · Sin tracking · Datos científicos abiertos
        </div>
      </div>
    </div>
  );
}
