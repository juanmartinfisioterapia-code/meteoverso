import { useState, useRef, useEffect } from "react";

const WMO = {
  0:{icon:"☀️",label:"Despejado",color:"#FCD34D"},
  1:{icon:"🌤️",label:"Casi despejado",color:"#FCD34D"},
  2:{icon:"⛅",label:"Parcialmente nublado",color:"#93C5FD"},
  3:{icon:"☁️",label:"Nublado",color:"#94A3B8"},
  45:{icon:"🌫️",label:"Niebla",color:"#94A3B8"},
  48:{icon:"🌫️",label:"Niebla helada",color:"#BAE6FD"},
  51:{icon:"🌦️",label:"Llovizna",color:"#60A5FA"},
  53:{icon:"🌧️",label:"Llovizna mod.",color:"#60A5FA"},
  61:{icon:"🌧️",label:"Lluvia ligera",color:"#38BDF8"},
  63:{icon:"🌧️",label:"Lluvia moderada",color:"#38BDF8"},
  65:{icon:"🌧️",label:"Lluvia fuerte",color:"#0EA5E9"},
  71:{icon:"🌨️",label:"Nieve ligera",color:"#E0F2FE"},
  73:{icon:"❄️",label:"Nieve",color:"#E0F2FE"},
  75:{icon:"❄️",label:"Nieve fuerte",color:"#BAE6FD"},
  80:{icon:"🌦️",label:"Chubascos",color:"#60A5FA"},
  81:{icon:"🌧️",label:"Chubascos mod.",color:"#38BDF8"},
  82:{icon:"⛈️",label:"Chubascos fuertes",color:"#0EA5E9"},
  95:{icon:"⛈️",label:"Tormenta",color:"#818CF8"},
  99:{icon:"⛈️",label:"Tormenta+granizo",color:"#6366F1"},
};
const isNight = (date) => {
  const h = (date || new Date()).getHours();
  return h >= 21 || h < 7;
};

const WMO_NIGHT = {
  0:{icon:"🌙",label:"Despejado"},
  1:{icon:"🌙",label:"Casi despejado"},
  2:{icon:"☁️",label:"Parc. nublado"},
  3:{icon:"☁️",label:"Nublado"},
};

const wmo = (c, date) => {
  const night = isNight(date);
  if (night && WMO_NIGHT[c]) return {...WMO_NIGHT[c], color: WMO[c]?.color ?? "#94A3B8"};
  if (night && WMO_NIGHT[Math.floor((c||0)/10)*10]) return {...WMO_NIGHT[Math.floor((c||0)/10)*10], color: "#94A3B8"};
  return WMO[c] ?? WMO[Math.floor((c||0)/10)*10] ?? {icon:"🌡️",label:"Variable",color:"#94A3B8"};
};
const windDir = d => ["N","NE","E","SE","S","SO","O","NO"][Math.round((d||0)/45)%8];
const DAYS_ES = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const MONTHS_ES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const fmtHour = d => `${String(d.getHours()).padStart(2,"0")}:00`;
const fmtTime = s => s ? s.slice(11,16) : "—";

const MODELS = [
  {id:"best",  name:"Meteoverso",   badge:"RECOMENDADO", color:"#60A5FA", bg:"rgba(96,165,250,.08)",  br:"rgba(96,165,250,.28)",  tag:"🇪🇸 Mejor para España", param:"best_match",   primary:true},
  {id:"aemet", name:"AEMET",        badge:"HARMONIE",     color:"#F97316", bg:"rgba(249,115,22,.07)",  br:"rgba(249,115,22,.3)",   tag:"🇪🇸 Météo-France · ES",  param:"aemet",         primary:false},
  {id:"ecmwf", name:"El Tiempo.es", badge:"ECMWF",       color:"#38BDF8", bg:"rgba(56,189,248,.07)",  br:"rgba(56,189,248,.3)",   tag:"🇪🇺 Modelo Europeo",   param:"ecmwf_ifs025", primary:false},
  {id:"icon",  name:"Windy.com",    badge:"ICON-EU",      color:"#93C5FD", bg:"rgba(147,197,253,.07)", br:"rgba(147,197,253,.3)",  tag:"🇩🇪 Modelo Alemán",    param:"icon_seamless", primary:false},
];

const SECONDARY = MODELS.filter(m => !m.primary);
const CITIES = ["Madrid","Barcelona","Sevilla","Valencia","Bilbao","Málaga","Zaragoza","Palma","Tenerife","A Coruña"];

async function fetchGeo(q) {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=es&format=json`);
  if (!r.ok) throw new Error("HTTP " + r.status);
  return (await r.json()).results ?? [];
}


async function fetchAEMET(lat, lon) {
  return await fetchWeatherDirect(lat, lon, "meteofrance_seamless");
}

async function fetchWeatherDirect(lat, lon, param) {

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,precipitation,surface_pressure,visibility,uv_index` +
    `&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,relative_humidity_2m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_direction_10m_dominant,uv_index_max,sunrise,sunset` +
    `&wind_speed_unit=kmh&timezone=auto&models=${param}&forecast_days=7`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("HTTP " + r.status);
  const d = await r.json();
  if (!d.current) throw new Error("Sin datos");
  const c = d.current;
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
          info: wmo(d.hourly.weather_code[i], new Date(d.hourly.time[i])),
        });
      }
    }
  }
  const daily = [];
  if (d.daily?.time) {
    for (let i = 0; i < d.daily.time.length; i++) {
      const maxT = d.daily.temperature_2m_max[i];
      const minT = d.daily.temperature_2m_min[i];
      // Skip days with no temperature data or invalid data (0/0 means no data)
      if (maxT == null || minT == null) continue;
      if (maxT === 0 && minT === 0) continue;
      if (maxT < -50 || maxT > 60) continue;
      daily.push({
        date: new Date(d.daily.time[i] + "T12:00:00"),
        tempMax: Math.round(maxT),
        tempMin: Math.round(minT),
        precip: +(d.daily.precipitation_sum[i]||0).toFixed(1),
        precipProb: d.daily.precipitation_probability_max[i] ?? 0,
        wind: Math.round(d.daily.wind_speed_10m_max[i] ?? 0),
        windD: d.daily.wind_direction_10m_dominant[i],
        uv: d.daily.uv_index_max?.[i],
        sunrise: d.daily.sunrise?.[i],
        sunset: d.daily.sunset?.[i],
        info: wmo(d.daily.weather_code[i]),
      });
    }
  }
  return {
    temp: Math.round(c.temperature_2m), feels: Math.round(c.apparent_temperature),
    humidity: Math.round(c.relative_humidity_2m), wind: Math.round(c.wind_speed_10m),
    windD: Math.round(c.wind_direction_10m ?? 0), precip: +c.precipitation.toFixed(1),
    pressure: Math.round(c.surface_pressure),
    vis: c.visibility != null ? +(c.visibility/1000).toFixed(1) : null,
    uv: c.uv_index, info: wmo(c.weather_code, new Date()), hourly, daily,
  };

}

async function fetchWeather(lat, lon, param) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,precipitation,surface_pressure,visibility,uv_index` +
    `&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,relative_humidity_2m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_direction_10m_dominant,uv_index_max,sunrise,sunset` +
    `&wind_speed_unit=kmh&timezone=auto&models=${param}&forecast_days=7`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("HTTP " + r.status);
  const d = await r.json();
  if (!d.current) throw new Error("Sin datos");
  const c = d.current;
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
          info: wmo(d.hourly.weather_code[i], new Date(d.hourly.time[i])),
        });
      }
    }
  }
  const daily = [];
  if (d.daily?.time) {
    for (let i = 0; i < d.daily.time.length; i++) {
      daily.push({
        date: new Date(d.daily.time[i] + "T12:00:00"),
        tempMax: Math.round(d.daily.temperature_2m_max[i]),
        tempMin: Math.round(d.daily.temperature_2m_min[i]),
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
    temp: Math.round(c.temperature_2m), feels: Math.round(c.apparent_temperature),
    humidity: Math.round(c.relative_humidity_2m), wind: Math.round(c.wind_speed_10m),
    windD: Math.round(c.wind_direction_10m ?? 0), precip: +c.precipitation.toFixed(1),
    pressure: Math.round(c.surface_pressure),
    vis: c.visibility != null ? +(c.visibility/1000).toFixed(1) : null,
    uv: c.uv_index, info: wmo(c.weather_code, new Date()), hourly, daily,
  };
}



function hourConcordance(data, i) {
  const temps = MODELS.map(m => data[m.id]?.hourly?.[i]?.temp).filter(v => v != null);
  if (temps.length < 2) return {color:"#475569", pct:0};
  const spread = Math.max(...temps) - Math.min(...temps);
  const pct = spread===0?100:spread===1?85:spread===2?65:spread<=4?45:20;
  return { pct, color: pct>=80?"#86EFAC":pct>=50?"#FCD34D":"#F87171" };
}

async function generateVeredicto(results, cityName, type) {
  const primary = results["best"];
  if (!primary || primary.error) return null;
  const temps = MODELS.map(m => results[m.id]?.temp).filter(v => v != null);
  const spread = temps.length > 1 ? Math.max(...temps) - Math.min(...temps) : 0;
  const conf = spread===0?100:spread===1?85:spread===2?65:spread<=4?45:20;

  // Build precise weather data
  const maxTemp = primary.hourly ? Math.max(...primary.hourly.map(h=>h.temp)) : primary.temp;
  const minTemp = primary.hourly ? Math.min(...primary.hourly.map(h=>h.temp)) : primary.temp;
  const rainHours = primary.hourly?.filter(h=>h.precipProb>40).length ?? 0;
  const week = primary.daily?.slice(0,7).map((d,i)=>`${i===0?"Hoy":i===1?"Mañana":DAYS_ES[d.date.getDay()]}: ${d.tempMax}°/${d.tempMin}° lluvia ${d.precipProb}%`).join(", ");

  const weatherData = {
    temp: primary.temp,
    feels: primary.feels,
    humidity: primary.humidity,
    wind: primary.wind,
    precip: primary.precip,
    precipProb: primary.daily?.[0]?.precipProb ?? 0,
    condition: primary.info.label,
    maxTemp,
    minTemp,
    rainHours,
  };

  const context = type==="now" ? `Temp: ${primary.temp}C sensacion ${primary.feels}C ${primary.info.label} viento ${primary.wind}kmh humedad ${primary.humidity}% precip ${primary.precip}mm` : type==="24h" ? `Max ${primary.hourly ? Math.max(...primary.hourly.map(h=>h.temp)) : primary.temp}C Min ${primary.hourly ? Math.min(...primary.hourly.map(h=>h.temp)) : primary.temp}C` : `Semana: ${week}`;

  try {
    const r = await fetch("/api/veredicto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cityName, type, context, conf, weatherData, hour: new Date().getHours() }),
    });
    if (!r.ok) throw new Error("error");
    const d = await r.json();
    return d.veredicto ?? null;
  } catch {
    // Local fallback con prioridades
    const cond = weatherData.condition.toLowerCase();
    if (cond.includes("tormenta") || cond.includes("granizo")) return `⚠️ Alerta de tormenta en ${cityName}. Evita actividades al aire libre.`;
    if (cond.includes("nieve") && weatherData.temp < 3) return `⚠️ Nevada en ${cityName}. Precaución en carreteras y exteriores.`;
    if (weatherData.wind > 70) return `⚠️ Viento muy fuerte en ${cityName} (${weatherData.wind}km/h). Peligro en exteriores.`;
    if (weatherData.precipProb > 60) return `Lluvia probable en ${cityName} hoy. Lleva paraguas.`;
    if (weatherData.temp > 30) return `Calor intenso en ${cityName} con ${weatherData.temp}°C. Protégete del sol.`;
    if (weatherData.wind > 40) return `Viento fuerte en ${cityName} (${weatherData.wind}km/h). Ten precaución.`;
    if (weatherData.temp < 8) return `Frío en ${cityName} con ${weatherData.temp}°C. Abrígate bien.`;
    if (weatherData.feels <= weatherData.temp - 3) return `${weatherData.temp}°C en ${cityName} pero se sienten ${weatherData.feels}°C. Lleva chaqueta.`;
    return `Tiempo ${weatherData.condition.toLowerCase()} en ${cityName} con ${weatherData.temp}°C. ${conf>=80?"Pronóstico fiable hoy.":"Consulta los modelos para más detalle."}`;
  }
}

// ─── Map Component ───────────────────────────────────────────────────────────
function WorldMap({ onCitySelect }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Load Leaflet CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    // Load Leaflet JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      if (!containerRef.current || mapRef.current) return;
      const L = window.L;

      const map = L.map(containerRef.current, {
        center: [20, 10],
        zoom: 1,
        zoomControl: true,
        attributionControl: false,
      });

      // Base map - dark style
      // CartoDB Dark Matter base
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
      }).addTo(map);

      // Labels layer on top (city names)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
      }).addTo(map);

      // Neon style
      const style = document.createElement('style');
      style.textContent = `
        .leaflet-tile-pane { filter: brightness(1.1) saturate(1.2); }
        .leaflet-container { background: #000810 !important; }
        .leaflet-control-zoom a { background: #0d1f35 !important; color: #38BDF8 !important; border-color: #38BDF8 !important; }
      `;
      document.head.appendChild(style);

      // Draw neon grid lines
      const gridStyle = { color: '#38BDF8', weight: 0.3, opacity: 0.15, fillOpacity: 0 };
      for (let lat = -80; lat <= 80; lat += 20) {
        L.polyline([[lat, -180],[lat, 180]], gridStyle).addTo(map);
      }
      for (let lng = -180; lng <= 180; lng += 20) {
        L.polyline([[-90, lng],[90, lng]], gridStyle).addTo(map);
      }

      // Rain radar from RainViewer API - get latest frame
      fetch('https://api.rainviewer.com/public/weather-maps.json')
        .then(r => r.json())
        .then(data => {
          const latest = data.radar?.past?.slice(-1)[0]?.path;
          if (latest) {
            L.tileLayer(`https://tilecache.rainviewer.com${latest}/256/{z}/{x}/{y}/2/1_1.png`, {
              opacity: 0.5,
              maxZoom: 13,
            }).addTo(map);
          }
        })
        .catch(() => {});

      // Double click to select city
      map.on('dblclick', async (e) => {
        const { lat, lng } = e.latlng;
        map.setView([lat, lng], Math.max(map.getZoom(), 10), { animate: true });
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=es`,
            { headers: { 'User-Agent': 'Meteoverso/1.0' } }
          );
          const d = await r.json();
          const addr = d.address || {};
          const cityName = addr.city || addr.town || addr.village || addr.municipality || addr.county || d.name || 'Este punto';
          const country = addr.country || '';
          const state = addr.state || '';
          const label = [cityName, state, country].filter(Boolean).join(', ');

          // Add marker
          L.marker([lat, lng], {
            icon: L.divIcon({
              html: '<div style="background:#38BDF8;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 0 8px rgba(56,189,248,.8)"></div>',
              iconSize: [12, 12],
              iconAnchor: [6, 6],
              className: ''
            })
          }).addTo(map).bindPopup(`<b>${cityName}</b>`).openPopup();

          const r2 = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=es&format=json`);
          const d2 = await r2.json();
          const city = d2.results?.[0];
          if (city) onCitySelect(city.latitude, city.longitude, cityName, label);
          else onCitySelect(lat, lng, cityName, label);
        } catch {
          onCitySelect(lat, lng, 'Este punto', `${lat.toFixed(2)}°N ${lng.toFixed(2)}°E`);
        }
      });

      mapRef.current = map;
      setLoaded(true);
    };
    document.head.appendChild(script);

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  return (
    <div style={{marginTop:28,animation:"fadeUp .6s ease .2s both"}}>
      <div style={{textAlign:"center",marginBottom:12}}>
        <span style={{color:"#38BDF8",fontSize:11,fontFamily:"'DM Mono',monospace",textTransform:"uppercase",letterSpacing:".1em"}}>🗺️ Mapa meteorológico</span>
        <div style={{color:"#1e3a5f",fontSize:11,marginTop:3}}>Doble toque en cualquier punto para ver su tiempo</div>
      </div>
      <div style={{position:"relative",borderRadius:16,overflow:"hidden",border:"1px solid rgba(56,189,248,.2)",boxShadow:"0 0 30px rgba(56,189,248,.08)"}}>
        <div ref={containerRef} style={{width:"100%",height:200,background:"#0a1628"}}/>
        {!loaded && (
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"#0a1628"}}>
            <div style={{textAlign:"center"}}>
              <div style={{width:28,height:28,border:"3px solid rgba(56,189,248,.3)",borderTopColor:"#38BDF8",borderRadius:"50%",animation:"spin .8s linear infinite",margin:"0 auto 10px"}}/>
              <div style={{color:"#1e4060",fontSize:12,fontFamily:"'DM Mono',monospace"}}>Cargando mapa...</div>
            </div>
          </div>
        )}
        {loaded && (
          <div style={{position:"absolute",bottom:12,left:"50%",transform:"translateX(-50%)",background:"rgba(6,16,30,.85)",border:"1px solid rgba(56,189,248,.2)",borderRadius:20,padding:"5px 14px",whiteSpace:"nowrap",pointerEvents:"none"}}>
            <span style={{color:"#38BDF8",fontSize:11}}>👆 Doble toque para ver el tiempo</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Components ───────────────────────────────────────────────────────────────

function VeredictoBox({ text, loading, type }) {
  const icons = { now:"⚡", "24h":"🕐", "7d":"📅" };
  const labels = { now:"ahora mismo", "24h":"próximas 24 horas", "7d":"esta semana" };
  return (
    <div style={{background:"linear-gradient(135deg,rgba(56,189,248,.08),rgba(96,165,250,.06))",border:"1px solid rgba(56,189,248,.25)",borderRadius:18,padding:"20px 22px",marginBottom:10,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,#38BDF8,#60A5FA)"}}/>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
        <span style={{fontSize:16}}>{icons[type]}</span>
        <span style={{color:"#38BDF8",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",fontFamily:"'DM Mono',monospace"}}>Veredicto · {labels[type]}</span>
      </div>
      {loading ? (
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:12,height:12,border:"2px solid rgba(56,189,248,.3)",borderTopColor:"#38BDF8",borderRadius:"50%",animation:"spin .7s linear infinite",flexShrink:0}}/>
          <span style={{color:"#1e4060",fontSize:13,fontFamily:"'DM Mono',monospace"}}>Analizando...</span>
        </div>
      ) : (
        <p style={{color:"#e0f2fe",fontSize:16,lineHeight:1.65,fontWeight:500,margin:0}}>{text}</p>
      )}
    </div>
  );
}

function CompareButton({ model, expanded, onClick }) {
  return (
    <button onClick={onClick}
      style={{display:"inline-flex",alignItems:"center",gap:6,background:expanded?`${model.color}22`:"rgba(255,255,255,.06)",border:`1.5px solid ${expanded?model.color:"rgba(255,255,255,.25)"}`,borderRadius:20,padding:"7px 16px",cursor:"pointer",transition:"all .2s",fontFamily:"'DM Sans',sans-serif"}}>
      <span style={{color:expanded?model.color:"#e0f2fe",fontSize:13,fontWeight:600}}>{model.name}</span>
      <span style={{color:expanded?model.color:"#94a3b8",fontSize:10}}>{expanded?"▲":"▼"}</span>
    </button>
  );
}

function PrimaryCurrentCard({ data, loading }) {
  if (loading) return (
    <div style={{background:"rgba(96,165,250,.06)",border:"1px solid rgba(96,165,250,.2)",borderRadius:18,padding:"24px",marginBottom:10}}>
      {[60,40,80,50].map((w,i)=><div key={i} style={{height:i===0?50:11,width:`${w}%`,background:"rgba(255,255,255,.05)",borderRadius:6,marginBottom:12,animation:"shimmer 1.4s ease infinite"}}/>)}
    </div>
  );
  if (!data || data.error) return null;
  return (
    <div style={{background:"rgba(96,165,250,.06)",border:"1px solid rgba(96,165,250,.2)",borderRadius:18,padding:"22px 24px",marginBottom:10}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:14}}>
        <span style={{background:"rgba(96,165,250,.15)",border:"1px solid rgba(96,165,250,.3)",borderRadius:8,padding:"3px 10px",color:"#60A5FA",fontSize:11,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>Meteoverso</span>
        <span style={{color:"#1e3a5f",fontSize:10}}>🇪🇸 Mejor para España</span>
      </div>
      <div style={{display:"flex",alignItems:"flex-end",gap:12,marginBottom:6}}>
        <span style={{fontSize:64}}>{data.info.icon}</span>
        <div>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:64,fontWeight:900,color:"#f0f9ff",lineHeight:1}}>{data.temp}°C</div>
          <div style={{color:"#60A5FA",fontSize:14,fontWeight:600,marginTop:2}}>{data.info.label}</div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"10px 8px",marginTop:14}}>
        {[
          {e:"🌡️",l:"Sensación",v:`${data.feels}°C`},
          {e:"💧",l:"Humedad",v:`${data.humidity}%`},
          {e:"💨",l:"Viento",v:`${data.wind}km/h ${windDir(data.windD)}`},
          {e:"🌧️",l:"Precipit.",v:`${data.precip}mm`},
          {e:"📊",l:"Presión",v:`${data.pressure}hPa`},
          {e:"👁️",l:"Visib.",v:data.vis!=null?`${data.vis}km`:"—"},
        ].map(({e,l,v})=>(
          <div key={l} style={{background:"rgba(255,255,255,.03)",borderRadius:10,padding:"8px 10px"}}>
            <div style={{color:"#93c5fd",fontSize:11,textTransform:"uppercase",letterSpacing:".06em",marginBottom:3,fontWeight:600}}>{e} {l}</div>
            <div style={{color:"#ffffff",fontSize:15,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SecondaryCurrentCard({ model, data }) {
  if (!data || data.error) return <div style={{color:"#FCA5A5",fontSize:12,padding:"8px"}}>⚠️ Sin datos</div>;
  return (
    <div style={{background:model.bg,border:`1px solid ${model.br}`,borderRadius:14,padding:"16px",animation:"fadeUp .3s ease both"}}>
      <div style={{display:"flex",alignItems:"flex-end",gap:8,marginBottom:6}}>
        <span style={{fontSize:36}}>{data.info.icon}</span>
        <span style={{fontFamily:"'Syne',sans-serif",fontSize:40,fontWeight:900,color:"#f0f9ff",lineHeight:1}}>{data.temp}°</span>
        <span style={{color:model.color,fontSize:12,fontWeight:600,marginBottom:4}}>{data.info.label}</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"5px 8px"}}>
        {[{l:"Sensación",v:`${data.feels}°`},{l:"Humedad",v:`${data.humidity}%`},{l:"Viento",v:`${data.wind}km/h`},{l:"Precip.",v:`${data.precip}mm`}].map(({l,v})=>(
          <div key={l}>
            <div style={{color:"#0f2035",fontSize:9,textTransform:"uppercase",letterSpacing:".04em"}}>{l}</div>
            <div style={{color:"#ffffff",fontSize:14,fontWeight:600,fontFamily:"'DM Mono',monospace"}}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [input,      setInput]      = useState("");
  const [drops,      setDrops]      = useState([]);
  const [showDrop,   setShowDrop]   = useState(false);
  const [loc,        setLoc]        = useState(null);
  const [data,       setData]       = useState({});
  const [status,     setStatus]     = useState("idle");
  const [errMsg,     setErrMsg]     = useState("");
  const [geoLoading,    setGeoLoading]    = useState(false);

  const [recentCities, setRecentCities] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mv_recent') || '[]'); } catch { return []; }
  });
  const [vNow,       setVNow]       = useState("");
  const [v24h,       setV24h]       = useState("");
  const [v7d,        setV7d]        = useState("");
  const [vLoad,      setVLoad]      = useState({now:false,"24h":false,"7d":false});
  const [expanded,   setExpanded]   = useState({}); // {ecmwf_now: true, icon_24h: false, ...}
  const [showInstall,setShowInstall]= useState(false);
  const [deferredPrompt,setDeferredPrompt] = useState(null);
  const deb = useRef(null);

  useEffect(() => {
    const handler = e => { e.preventDefault(); setDeferredPrompt(e); setShowInstall(true); };
    window.addEventListener('beforeinstallprompt', handler);
    const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    if (isIOS && !window.navigator.standalone) setTimeout(() => setShowInstall(true), 4000);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const skipDrop = useRef(false);
const autoGeoRan = useRef(false);

  useEffect(() => {
    if (autoGeoRan.current) return;
    autoGeoRan.current = true;
    const hasUsedGeo = localStorage.getItem('mv_geo_used');
    if (hasUsedGeo && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async pos => {
          const {latitude:lat, longitude:lon} = pos.coords;
          try {
            const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=es`, {headers:{'User-Agent':'Meteoverso/1.0'}});
            const d = await r.json();
            const addr = d.address || {};
            const name = addr.city || addr.town || addr.village || addr.municipality || addr.suburb || addr.county || d.name || 'Tu ubicacion';
            skipDrop.current = true;
            setInput(name);
            runModels(lat, lon, name);
          } catch { runModels(lat, lon, 'Tu ubicacion'); }
        },
        () => {}
      );
    }
  }, []);




  useEffect(() => {
    if (skipDrop.current) { skipDrop.current = false; return; }
    if (input.length < 2) { setDrops([]); setShowDrop(false); return; }
    clearTimeout(deb.current);
    deb.current = setTimeout(async () => {
      try { const r = await fetchGeo(input); setDrops(r); setShowDrop(r.length > 0); } catch {}
    }, 300);
    return () => clearTimeout(deb.current);
  }, [input]);

  const saveRecent = (lat, lon, name, label) => {
    const city = { lat, lon, name, label };
    setRecentCities(prev => {
      const filtered = prev.filter(c => c.name !== name);
      const updated = [city, ...filtered].slice(0, 6);
      try { localStorage.setItem('mv_recent', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const runModels = async (lat, lon, name) => {
    setShowDrop(false); setLoc({lat,lon,name}); setData({});
    setStatus("loading"); setErrMsg("");
    setVNow(""); setV24h(""); setV7d("");
    setVLoad({now:true,"24h":true,"7d":true});
    setExpanded({});
    // Save to recent cities
    setRecentCities(prev => {
      const filtered = prev.filter(c => c.name !== name);
      const updated = [{ name, lat, lon }, ...filtered].slice(0, 6);
      try { localStorage.setItem('mv_recent', JSON.stringify(updated)); } catch {}
      return updated;
    });
    const results = {};

    // Load all models in parallel - all fast now
    await Promise.all(MODELS.map(async m => {
      try {
        if (m.id === "aemet") {
          results[m.id] = await fetchAEMET(lat, lon);
        } else {
          results[m.id] = await fetchWeather(lat, lon, m.param);
        }
      } catch(e) { results[m.id] = { error: e.message }; }
    }));
    setData(results);
    setStatus(Object.values(results).some(d=>d?.temp!=null) ? "done" : "error");
    saveRecent(lat, lon, name, [name].join(', '));
    // Generate 3 veredictos in parallel
    const [vn, v2, v7] = await Promise.all([
      generateVeredicto(results, name, "now"),
      generateVeredicto(results, name, "24h"),
      generateVeredicto(results, name, "7d"),
    ]);
    setVNow(vn ?? "Pronóstico cargado correctamente.");
    setV24h(v2 ?? "Revisa las horas para planificar tu día.");
    setV7d(v7 ?? "Semana con variaciones. Consulta los días.");
    setVLoad({now:false,"24h":false,"7d":false});
  };

  const doSearch = async () => {
    const q = input.trim(); if (!q) return;
    setStatus("searching");
    try {
      const cities = await fetchGeo(q);
      if (!cities.length) { setStatus("error"); setErrMsg(`No encontré "${q}"`); return; }
      const c = cities[0];
      setInput([c.name,c.admin1,c.country].filter(Boolean).join(", "));
      runModels(c.latitude, c.longitude, c.name);
    } catch(e) { setStatus("error"); setErrMsg("Error: "+e.message); }
  };

  const pick = c => {
    setInput([c.name,c.admin1,c.country].filter(Boolean).join(", "));
    setShowDrop(false);
    runModels(c.latitude, c.longitude, c.name);
  };

  const quickCity = async city => {
    skipDrop.current=true; setInput(city); setShowDrop(false); setDrops([]); setStatus("searching");
    try {
      const r = await fetchGeo(city);
      if (r[0]) { const c=r[0]; setInput([c.name,c.admin1,c.country].filter(Boolean).join(", ")); runModels(c.latitude,c.longitude,c.name); }
    } catch(e) { setStatus("error"); setErrMsg("Error: "+e.message); }
  };

  const useGeo = () => {
    if (!navigator.geolocation) { setErrMsg("Geolocalización no disponible"); return; }
    setGeoLoading(true); setErrMsg("");
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const {latitude:lat, longitude:lon} = pos.coords;
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=es`, {headers:{'User-Agent':'Meteoverso/1.0'}});
          const d = await r.json();
          const addr = d.address || {}; const name = addr.city || addr.town || addr.village || addr.municipality || addr.suburb || addr.county || addr.state_district || d.name || "Tu ubicación";
localStorage.setItem('mv_geo_used', '1'); skipDrop.current=true; setInput(name); setGeoLoading(false); runModels(lat, lon, name);
        } catch { setInput("Tu ubicación"); setGeoLoading(false); runModels(lat, lon, "Tu ubicación"); }
      },
      err => { setGeoLoading(false); setErrMsg(err.code===1?"Permiso denegado.":"No se pudo obtener ubicación."); },
      {timeout:10000}
    );
  };

  const toggleExpand = (modelId, section) => {
    const key = `${modelId}_${section}`;
    setExpanded(prev => ({...prev, [key]: !prev[key]}));
  };

  const isLoading = status === "loading" || status === "searching";
  const primary = data["best"];

  // Build consensus for fiabilidad bar
  const buildCon = () => {
    const valid = MODELS.map(m => data[m.id]).filter(d => d?.temp != null);
    if (valid.length < 2) return null;
    const temps = valid.map(d=>d.temp);
    const spread = Math.max(...temps) - Math.min(...temps);
    const conf = spread===0?100:spread===1?85:spread===2?65:spread<=4?45:20;
    const cColor = conf>=80?"#86EFAC":conf>=50?"#FCD34D":"#F87171";
    const cLabel = conf>=80?"Alta concordancia":conf>=50?"Concordancia media":"Modelos discrepan";
    return { conf, spread, cColor, cLabel };
  };
  const con = buildCon();

  return (
    <div style={{minHeight:"100vh",background:"#06101e",color:"#e2e8f0",fontFamily:"'DM Sans',system-ui,sans-serif",overflowX:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@800;900&family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::placeholder{color:#1e3a5f} :focus{outline:none}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes shimmer{0%,100%{opacity:.1}50%{opacity:.3}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
        @keyframes twinkle{0%,100%{opacity:.12}50%{opacity:.6}}
        .city-pill:hover{background:rgba(56,189,248,.12)!important;color:#38BDF8!important;border-color:rgba(56,189,248,.3)!important}
        .drop-row:hover{background:#f0f9ff!important}
        .geo-btn:hover{background:linear-gradient(135deg,rgba(56,189,248,.2),rgba(96,165,250,.2))!important;border-color:rgba(56,189,248,.6)!important}
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

      <div style={{position:"relative",zIndex:1,maxWidth:640,margin:"0 auto",padding:"28px 16px 80px"}}>

        {/* HEADER */}
        <div style={{textAlign:"center",marginBottom:24,animation:"fadeUp .5s ease both"}}>
          <div style={{fontSize:48,marginBottom:6,display:"inline-block",animation:"float 5s ease-in-out infinite",filter:"drop-shadow(0 0 16px rgba(56,189,248,.4))"}}>🌤️</div>
          <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:"clamp(32px,8vw,54px)",fontWeight:900,letterSpacing:"-.03em",lineHeight:1,marginBottom:5,background:"linear-gradient(135deg,#bae6fd 0%,#38BDF8 50%,#60A5FA 100%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
            Meteoverso
          </h1>
          <div style={{color:"#94d4e8",fontSize:9,letterSpacing:".14em",textTransform:"uppercase",fontFamily:"'DM Mono',monospace",marginBottom:6}}>comparador meteorológico científico</div>
          <p style={{color:"#e0f2fe",fontSize:12,lineHeight:1.5}}>Tres modelos · Un consenso · Sin registro</p>
        </div>

        {/* INSTALL BANNER */}
        {showInstall && (
          <div style={{background:"linear-gradient(135deg,rgba(56,189,248,.1),rgba(96,165,250,.08))",border:"1px solid rgba(56,189,248,.25)",borderRadius:12,padding:"11px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:10,animation:"fadeUp .4s ease both"}}>
            <span style={{fontSize:20,flexShrink:0}}>📲</span>
            <div style={{flex:1}}>
              <div style={{color:"#e0f2fe",fontSize:12,fontWeight:600,marginBottom:1}}>Instala Meteoverso</div>
              <div style={{color:"#4b7b9e",fontSize:10}}>{deferredPrompt?"Añádela a tu pantalla de inicio":'Compartir → "Añadir a inicio"'}</div>
            </div>
            {deferredPrompt && <button onClick={async()=>{deferredPrompt.prompt();setDeferredPrompt(null);setShowInstall(false);}} style={{background:"#38BDF8",color:"#06101e",border:"none",borderRadius:8,padding:"6px 12px",fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0}}>Instalar</button>}
            <button onClick={()=>setShowInstall(false)} style={{background:"none",border:"none",color:"#4b7b9e",cursor:"pointer",fontSize:16,flexShrink:0,padding:0}}>✕</button>
          </div>
        )}

        {/* SEARCH */}
        <div style={{position:"relative",marginBottom:20,animation:"fadeUp .5s ease .08s both"}}>
          <button onClick={useGeo} disabled={isLoading||geoLoading} className="geo-btn"
            style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:"linear-gradient(135deg,rgba(56,189,248,.1),rgba(96,165,250,.08))",border:"1px solid rgba(56,189,248,.25)",borderRadius:12,padding:"11px",marginBottom:8,cursor:isLoading||geoLoading?"not-allowed":"pointer",transition:"all .2s",opacity:isLoading||geoLoading?.6:1}}>
            {geoLoading?<div style={{width:14,height:14,border:"2px solid rgba(56,189,248,.3)",borderTopColor:"#38BDF8",borderRadius:"50%",animation:"spin .7s linear infinite"}}/>:<span style={{fontSize:16}}>📍</span>}
            <span style={{color:"#38BDF8",fontSize:13,fontWeight:600}}>{geoLoading?"Detectando...":"Usar mi ubicación"}</span>
          </button>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <div style={{flex:1,height:1,background:"rgba(255,255,255,.06)"}}/>
            <span style={{color:"#1e3a5f",fontSize:11,fontFamily:"'DM Mono',monospace"}}>o busca</span>
            <div style={{flex:1,height:1,background:"rgba(255,255,255,.06)"}}/>
          </div>
          <div style={{display:"flex",gap:8,background:"rgba(255,255,255,.04)",border:"1px solid rgba(56,189,248,.22)",borderRadius:14,padding:"7px 7px 7px 15px",alignItems:"center"}}
            onFocusCapture={e=>{e.currentTarget.style.borderColor="rgba(56,189,248,.6)";e.currentTarget.style.boxShadow="0 0 0 3px rgba(56,189,248,.1)";}}
            onBlurCapture={e=>{e.currentTarget.style.borderColor="rgba(56,189,248,.22)";e.currentTarget.style.boxShadow="none";}}
          >
            <span style={{fontSize:14,flexShrink:0}}>🔍</span>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")doSearch();}}
              placeholder="Tu ciudad... (Uceda, Cuenca, Vigo...)"
              style={{flex:1,background:"transparent",border:"none",color:"#e2e8f0",fontSize:14,fontFamily:"'DM Sans',sans-serif",minWidth:0}}/>
            {isLoading&&<div style={{width:14,height:14,border:"2px solid rgba(56,189,248,.3)",borderTopColor:"#38BDF8",borderRadius:"50%",animation:"spin .7s linear infinite",flexShrink:0}}/>}
            <button onClick={doSearch} disabled={isLoading}
              style={{background:isLoading?"#0c2a42":"linear-gradient(135deg,#0ea5e9,#3b82f6)",color:isLoading?"#1e4060":"#fff",border:"none",borderRadius:9,padding:"8px 18px",fontSize:13,fontWeight:700,cursor:isLoading?"not-allowed":"pointer",flexShrink:0,opacity:isLoading?.5:1,whiteSpace:"nowrap",transition:"all .15s"}}>
              {isLoading?(status==="searching"?"Buscando...":"Cargando..."):"Comparar"}
            </button>
          </div>
          {showDrop&&drops.length>0&&!isLoading&&(
            <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:"#ffffff",border:"none",borderRadius:12,overflow:"hidden",zIndex:9999,boxShadow:"0 8px 32px rgba(0,0,0,.5)"}}>
              {drops.slice(0,5).map((c,i)=>(
                <button key={i} onClick={()=>pick(c)} className="drop-row"
                  style={{width:"100%",textAlign:"left",background:"#fff",border:"none",borderBottom:i<4?"1px solid #e5e7eb":"none",padding:"12px 16px",cursor:"pointer",color:"#0f172a",fontSize:14,fontFamily:"'DM Sans',sans-serif",display:"flex",gap:8,alignItems:"center",transition:"background .12s"}}>
                  <span style={{opacity:.5}}>📍</span>
                  <span style={{fontWeight:600}}>{c.name}</span>
                  {c.admin1&&<span style={{color:"#64748b",fontSize:12}}>{c.admin1}</span>}
                  <span style={{color:"#94a3b8",marginLeft:"auto",fontSize:11,fontFamily:"'DM Mono',monospace",flexShrink:0}}>{c.country}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {status==="error"&&errMsg&&(
          <div style={{background:"rgba(252,165,165,.07)",border:"1px solid rgba(252,165,165,.25)",borderRadius:10,padding:"11px 16px",color:"#FCA5A5",fontSize:13,marginBottom:14,animation:"fadeUp .3s ease both"}}>⚠️ {errMsg}</div>
        )}

        {/* QUICK CITIES */}
        {status==="idle"&&!showDrop&&(
          <div style={{animation:"fadeUp .5s ease .12s both"}}>
            {recentCities.length > 0 ? (
              <div style={{marginBottom:20}}>
                <div style={{color:"#1e3a5f",fontSize:10,textTransform:"uppercase",letterSpacing:".1em",fontFamily:"'DM Mono',monospace",marginBottom:10,textAlign:"center"}}>🕐 Búsquedas recientes</div>
                <div style={{display:"flex",gap:6,justifyContent:"center",flexWrap:"wrap"}}>
                  {recentCities.map((city,i)=>(
                    <div key={i} style={{position:"relative",display:"inline-flex",alignItems:"center"}}>
                      <button onClick={()=>{ skipDrop.current=true; setShowDrop(false); setDrops([]); setInput(city.name); runModels(city.lat,city.lon,city.name); }} className="city-pill"
                        style={{background:"rgba(56,189,248,.08)",border:"1px solid rgba(56,189,248,.25)",borderRadius:30,padding:"6px 15px 6px 12px",color:"#e0f2fe",fontSize:13,fontFamily:"'DM Sans',sans-serif",cursor:"pointer",transition:"all .15s",fontWeight:500,display:"flex",alignItems:"center",gap:5}}>
                        <span style={{fontSize:10,opacity:.6}}>📍</span>{city.name}
                      </button>
                      <button onClick={()=>{
                        setRecentCities(prev=>{ const u=prev.filter((_,j)=>j!==i); try{localStorage.setItem('mv_recent',JSON.stringify(u));}catch{} return u; });
                      }} style={{position:"absolute",top:-4,right:-4,background:"#0f2035",border:"1px solid rgba(56,189,248,.2)",borderRadius:"50%",width:16,height:16,cursor:"pointer",color:"#475569",fontSize:9,display:"flex",alignItems:"center",justifyContent:"center",padding:0,lineHeight:1}}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{marginBottom:20}}>
                <div style={{color:"#1e3a5f",fontSize:10,textTransform:"uppercase",letterSpacing:".1em",fontFamily:"'DM Mono',monospace",marginBottom:10,textAlign:"center"}}>Ciudades populares</div>
                <div style={{display:"flex",gap:6,justifyContent:"center",flexWrap:"wrap"}}>
                  {CITIES.map(city=>(
                    <button key={city} onClick={()=>quickCity(city)} className="city-pill"
                      style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.3)",borderRadius:30,padding:"6px 15px",color:"#e0f2fe",fontSize:13,fontFamily:"'DM Sans',sans-serif",cursor:"pointer",transition:"all .15s",fontWeight:500}}>
                      {city}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div style={{textAlign:"center"}}><p style={{color:"#94a3b8",fontSize:12,lineHeight:1.9}}>Sin registro · Sin API key · Datos científicos reales</p></div>
            <WorldMap onCitySelect={(lat, lon, name, label) => {
              setInput(label);
              runModels(lat, lon, name);
            }}/>
          </div>
        )}

        {/* RESULTS */}
        {(isLoading||status==="done")&&(
          <div style={{animation:"fadeUp .4s ease both"}}>

            {/* Location */}
            {loc&&(
              <div style={{textAlign:"center",marginBottom:20}}>
                <div style={{color:"#0f2a42",fontSize:10,textTransform:"uppercase",letterSpacing:".14em",fontFamily:"'DM Mono',monospace",marginBottom:3}}>comparando para</div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:26,fontWeight:900,color:"#f0f9ff"}}>{loc.name}</div>
              </div>
            )}

            {/* ── AHORA ── */}
            <div style={{marginBottom:28}}>
              <VeredictoBox text={vNow} loading={vLoad.now} type="now"/>
              <PrimaryCurrentCard data={primary} loading={isLoading}/>
              {/* Compare buttons */}
              {status==="done"&&primary&&!primary.error&&(
                <div style={{marginTop:8}}>
                  {/* Barra fiabilidad ahora mismo */}
                  {con&&(
                    <div style={{marginBottom:12}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                        <span style={{color:"#94a3b8",fontSize:11,fontWeight:600}}>🎯 Fiabilidad del pronóstico</span>
                        <span style={{color:con.cColor,fontSize:12,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{con.conf}% · {con.cLabel}</span>
                      </div>
                      <div style={{background:"rgba(255,255,255,.06)",borderRadius:6,height:7,overflow:"hidden"}}>
                        <div style={{width:`${con.conf}%`,height:"100%",background:con.cColor,borderRadius:6,transition:"width 1.2s ease"}}/>
                      </div>
                      <div style={{color:"#1e3a5f",fontSize:10,marginTop:3}}>{con.spread}°C de dispersión entre modelos</div>
                    </div>
                  )}
                  <div style={{color:"#1e3a5f",fontSize:10,textTransform:"uppercase",letterSpacing:".1em",fontFamily:"'DM Mono',monospace",marginBottom:8}}>Comparar con</div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {SECONDARY.map(m=>(
                      <div key={m.id}>
                        <CompareButton model={m} expanded={!!expanded[`${m.id}_now`]} onClick={()=>toggleExpand(m.id,"now")}/>
                        {expanded[`${m.id}_now`]&&(
                          <div style={{marginTop:8}}>
                            <SecondaryCurrentCard model={m} data={data[m.id]}/>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── 24 HORAS ── */}
            <div style={{borderTop:"1px solid rgba(255,255,255,.06)",paddingTop:24,marginBottom:28}}>
              <VeredictoBox text={v24h} loading={vLoad["24h"]} type="24h"/>
              {/* Primary hourly strip */}
              {primary?.hourly?.length>0&&(
                <div style={{overflowX:"auto",paddingBottom:6,marginBottom:8}}>
                  <div style={{display:"flex",gap:6,minWidth:"max-content"}}>
                    {primary.hourly.map((h,i)=>{
                      const cc = hourConcordance(data, i);
                      return(
                        <div key={i} style={{flexShrink:0,width:72,background:"rgba(96,165,250,.07)",border:"1px solid rgba(96,165,250,.2)",borderRadius:10,padding:"10px 6px",textAlign:"center"}}>
                          <div style={{color:"#1e4060",fontSize:9,fontFamily:"'DM Mono',monospace",marginBottom:5}}>{fmtHour(h.time)}</div>
                          <div style={{fontSize:22,marginBottom:3}}>{h.info.icon}</div>
                          <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900,color:"#f0f9ff",marginBottom:6}}>{h.temp}°</div>
                          <div style={{display:"flex",flexDirection:"column",gap:3,marginBottom:6}}>
                            {[{e:"💧",v:`${h.precipProb}%`},{e:"🌧️",v:`${h.precip}mm`},{e:"💨",v:`${h.wind}km`}].map(({e,v})=>(
                              <div key={e} style={{display:"flex",justifyContent:"space-between"}}>
                                <span style={{fontSize:9}}>{e}</span>
                                <span style={{color:"#bae6fd",fontSize:9,fontFamily:"'DM Mono',monospace"}}>{v}</span>
                              </div>
                            ))}
                          </div>
                          <div style={{background:"rgba(255,255,255,.06)",borderRadius:4,height:3,overflow:"hidden"}}>
                            <div style={{width:`${cc.pct}%`,height:"100%",background:cc.color,borderRadius:4}}/>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* Compare buttons 24h */}
              {status==="done"&&primary&&!primary.error&&(
                <div>
                  <div style={{color:"#1e3a5f",fontSize:10,textTransform:"uppercase",letterSpacing:".1em",fontFamily:"'DM Mono',monospace",marginBottom:8}}>Comparar con</div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {SECONDARY.map(m=>(
                      <div key={m.id} style={{width:"100%"}}>
                        <CompareButton model={m} expanded={!!expanded[`${m.id}_24h`]} onClick={()=>toggleExpand(m.id,"24h")}/>
                        {expanded[`${m.id}_24h`]&&data[m.id]?.hourly?.length>0&&(
                          <div style={{overflowX:"auto",paddingBottom:6,marginTop:8,animation:"fadeUp .3s ease both"}}>
                            <div style={{display:"flex",gap:6,minWidth:"max-content"}}>
                              {data[m.id].hourly.map((h,i)=>(
                                <div key={i} style={{flexShrink:0,width:68,background:m.bg,border:`1px solid ${m.br}`,borderRadius:10,padding:"10px 6px",textAlign:"center"}}>
                                  <div style={{color:"#1e4060",fontSize:9,fontFamily:"'DM Mono',monospace",marginBottom:4}}>{fmtHour(h.time)}</div>
                                  <div style={{fontSize:20,marginBottom:2}}>{h.info.icon}</div>
                                  <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,color:"#f0f9ff",marginBottom:4}}>{h.temp}°</div>
                                  <div style={{display:"flex",flexDirection:"column",gap:2}}>
                                    {[{e:"💧",v:`${h.precipProb}%`},{e:"💨",v:`${h.wind}km`}].map(({e,v})=>(
                                      <div key={e} style={{display:"flex",justifyContent:"space-between"}}>
                                        <span style={{fontSize:9}}>{e}</span>
                                        <span style={{color:m.color,fontSize:9,fontFamily:"'DM Mono',monospace"}}>{v}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── 7 DÍAS ── */}
            <div style={{borderTop:"1px solid rgba(255,255,255,.06)",paddingTop:24}}>
              <VeredictoBox text={v7d} loading={vLoad["7d"]} type="7d"/>
              {/* Primary daily */}
              {primary?.daily?.length>0&&(
                <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:8}}>
                  {primary.daily.map((d,i)=>(
                    <div key={i} style={{background:"rgba(96,165,250,.05)",border:"1px solid rgba(96,165,250,.15)",borderRadius:12,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                      <div style={{minWidth:64}}>
                        <div style={{fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:900,color:i===0?"#38BDF8":i===1?"#60A5FA":"#2e6b8a"}}>
                          {i===0?"Hoy":i===1?"Mañana":DAYS_ES[d.date.getDay()]}
                        </div>
                        <div style={{color:"#0f2035",fontSize:10,fontFamily:"'DM Mono',monospace"}}>{d.date.getDate()} {MONTHS_ES[d.date.getMonth()]}</div>
                      </div>
                      <span style={{fontSize:28}}>{d.info.icon}</span>
                      <div style={{display:"flex",alignItems:"baseline",gap:4}}>
                        <span style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:900,color:"#f0f9ff"}}>{d.tempMax}°</span>
                        <span style={{color:"#1e4060",fontSize:13}}>/</span>
                        <span style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:700,color:"#2e6b8a"}}>{d.tempMin}°</span>
                      </div>
                      <div style={{marginLeft:"auto",display:"flex",gap:12}}>
                        {[{e:"💧",v:`${d.precipProb}%`},{e:"🌧️",v:`${d.precip}mm`},{e:"💨",v:`${d.wind}km/h`}].map(({e,v})=>(
                          <div key={e} style={{textAlign:"center"}}>
                            <div style={{fontSize:10}}>{e}</div>
                            <div style={{color:"#bae6fd",fontSize:10,fontWeight:600,fontFamily:"'DM Mono',monospace"}}>{v}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Compare buttons 7d */}
              {status==="done"&&primary&&!primary.error&&(
                <div>
                  <div style={{color:"#1e3a5f",fontSize:10,textTransform:"uppercase",letterSpacing:".1em",fontFamily:"'DM Mono',monospace",marginBottom:8}}>Comparar con</div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {SECONDARY.map(m=>(
                      <div key={m.id} style={{width:"100%"}}>
                        <CompareButton model={m} expanded={!!expanded[`${m.id}_7d`]} onClick={()=>toggleExpand(m.id,"7d")}/>
                        {expanded[`${m.id}_7d`]&&data[m.id]?.daily?.length>0&&(
                          <div style={{display:"flex",flexDirection:"column",gap:4,marginTop:8,animation:"fadeUp .3s ease both"}}>
                            {data[m.id].daily.map((d,i)=>(
                              <div key={i} style={{background:m.bg,border:`1px solid ${m.br}`,borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                                <div style={{minWidth:56}}>
                                  <div style={{color:m.color,fontSize:11,fontWeight:700}}>{i===0?"Hoy":i===1?"Mañana":DAYS_ES[d.date.getDay()]}</div>
                                </div>
                                <span style={{fontSize:22}}>{d.info.icon}</span>
                                <div style={{display:"flex",alignItems:"baseline",gap:3}}>
                                  <span style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,color:"#f0f9ff"}}>{d.tempMax}°</span>
                                  <span style={{color:"#1e4060",fontSize:11}}>/</span>
                                  <span style={{fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:700,color:"#2e6b8a"}}>{d.tempMin}°</span>
                                </div>
                                <div style={{marginLeft:"auto",display:"flex",gap:10}}>
                                  {[{e:"💧",v:`${d.precipProb}%`},{e:"🌧️",v:`${d.precip}mm`}].map(({e,v})=>(
                                    <div key={e} style={{textAlign:"center"}}>
                                      <div style={{fontSize:9}}>{e}</div>
                                      <div style={{color:m.color,fontSize:9,fontWeight:600,fontFamily:"'DM Mono',monospace"}}>{v}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        <div style={{textAlign:"center",marginTop:48,color:"#091628",fontSize:10,fontFamily:"'DM Mono',monospace",lineHeight:2}}>
          Meteoverso · Open-Meteo · ECMWF · ICON-EU<br/>Sin publicidad · Sin tracking · Datos científicos
        </div>
      </div>
    </div>
  );
}
