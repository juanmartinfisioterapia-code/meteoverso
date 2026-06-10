export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { cityName, type, context, conf } = req.body;
  if (!cityName || !type) return res.status(400).json({ error: 'Missing parameters' });

  const key = process.env.ANTHROPIC_KEY;
  if (!key) return res.status(500).json({ error: 'No Anthropic key' });

  const labels = { now: 'ahora mismo', '24h': 'próximas horas', '7d': 'esta semana' };

  // Accurate moon phase calculation
  function getMoonPhase() {
    const now = new Date();
    // Known new moon reference: 16 May 2026
    const newMoonRef = new Date('2026-05-16T03:00:00Z');
    const daysSince = (now - newMoonRef) / (1000 * 60 * 60 * 24);
    const phase = ((daysSince % 29.53) + 29.53) % 29.53;
    const illum = Math.round((1 - Math.cos(2 * Math.PI * phase / 29.53)) / 2 * 100);

    if (phase < 1.5) return { name: "Luna nueva 🌑", illum, visible: false };
    if (phase < 7.4) return { name: "Luna creciente 🌒", illum, visible: illum > 15 };
    if (phase < 8.9) return { name: "Cuarto creciente 🌓", illum, visible: true };
    if (phase < 14.8) return { name: "Luna gibosa creciente 🌔", illum, visible: true };
    if (phase < 16.3) return { name: "Luna llena 🌕", illum, visible: true };
    if (phase < 22.1) return { name: "Luna gibosa menguante 🌖", illum, visible: true };
    if (phase < 23.6) return { name: "Cuarto menguante 🌗", illum, visible: true };
    return { name: "Luna menguante 🌘", illum, visible: illum > 15 };
  }

  // Time of day — Spain/Portugal
  const now = new Date();
  const utcHour = now.getUTCHours();
  const month = now.getUTCMonth() + 1;
  const offset = (month >= 4 && month <= 10) ? 2 : 1;
  const h = (utcHour + offset) % 24;

  const isNight = h >= 21 || h < 7;
  const timeLabel = h >= 6 && h < 12 ? "mañana"
    : h >= 12 && h < 18 ? "tarde"
    : h >= 18 && h < 21 ? "noche"
    : "madrugada";

  const moon = getMoonPhase();
  const moonText = isNight && moon.visible
    ? `Fase lunar esta noche: ${moon.name} (${moon.illum}% iluminada).`
    : isNight && !moon.visible
    ? `Luna casi invisible esta noche (${moon.illum}% iluminación).`
    : "";

  const systemPrompt = `Eres el asistente meteorológico de Meteoverso. Genera UN veredicto en 2 frases en español.

HORA: Son las ${h}h, es de ${timeLabel}.
${isNight ? "ES DE NOCHE: NO sugieras actividades diurnas como pasear, hacer deporte o salir al exterior de forma activa. Adapta el consejo a la noche." : ""}
${moonText ? `LUNA: ${moonText} Si el cielo está despejado, menciona la luna como dato especial y curioso.` : ""}

PRIORIDADES:
1. Tormenta/granizo/nieve → avisa primero
2. Lluvia >40% → recomienda paraguas
3. Viento >40km/h → menciona el viento
4. Temperatura >28°C → calor
5. Temperatura <8°C de día O <19°C de noche → recomienda chaqueta (más si hay viento)
6. Sensación 3°C menor → se siente más frío de lo que marca
7. Noche despejada con luna visible → menciónala
8. Normal → consejo coherente con la hora

REGLAS:
- NUNCA paraguas si precipitación 0mm y probabilidad <20%
- De noche: consejos nocturnos
- De día: consejos diurnos
- Tono cercano, práctico, sin tecnicismos
- Máximo 2 frases`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 130,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Ciudad: ${cityName}. ${context} Fiabilidad: ${conf}%. Veredicto para ${labels[type]}:` }],
      }),
    });

    const d = await r.json();
    let veredicto = d.content?.find(b => b.type === 'text')?.text?.trim();
    if (veredicto) veredicto = veredicto.replace(/\*\*/g, '').replace(/^#+\s*/gm, '').trim();
    if (!veredicto) throw new Error('No veredicto');
    return res.status(200).json({ veredicto });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
// updated martes, 26 de mayo de 2026, 11:56:34 CEST
