export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { cityName, type, context, conf, weatherData } = req.body;
  if (!cityName || !type) return res.status(400).json({ error: 'Missing parameters' });

  const key = process.env.ANTHROPIC_KEY;
  if (!key) return res.status(500).json({ error: 'No Anthropic key' });

  // Build precise weather context
  const { temp, feels, humidity, wind, precip, precipProb, condition, maxTemp, minTemp, rainHours } = weatherData || {};

  let systemPrompt = '';
  let userPrompt = '';

  if (type === 'now') {
    systemPrompt = `Eres el asistente meteorológico de Meteoverso. Genera UN veredicto en 2 frases máximo en español.
PRIORIDADES (en orden):
1. TORMENTAS/FENÓMENOS ESPECIALES: Si la condición incluye tormenta, granizo, nieve intensa o viento>70km/h — ALERTA SIEMPRE, es lo primero
2. LLUVIA: Solo menciona paraguas si probabilidad_lluvia>40% O precipitacion>0.5mm
3. VIENTO: Si viento>40km/h menciona el efecto en la sensación térmica
4. TEMPERATURA: Si >28°C habla de calor, si <8°C habla de frío y abrigo
5. SENSACIÓN: Si sensacion es 3+ grados menor que temperatura, menciona que se siente más frío de lo que marca
6. DÍA AGRADABLE: Si todo normal, di que es buen día y qué actividades van bien
REGLAS:
- Coherencia absoluta con los datos
- Nunca menciones lluvia si precipitacion=0 Y probabilidad<20%
- Tono cercano y práctico, sin tecnicismos
- 2 frases máximo`;

    userPrompt = `Ciudad: ${cityName}
Temperatura: ${temp}°C | Sensación térmica: ${feels}°C
Condición: ${condition}
Probabilidad lluvia: ${precipProb}% | Precipitación: ${precip}mm
Viento: ${wind}km/h | Humedad: ${humidity}%
Fiabilidad modelos: ${conf}%

Genera el veredicto para AHORA MISMO.`;

  } else if (type === '24h') {
    systemPrompt = `Eres el asistente meteorológico de Meteoverso. Genera UN veredicto en 2 frases sobre las próximas horas.
REGLAS ESTRICTAS:
- Solo menciona paraguas si hay horas con lluvia probable (>40%)
- Menciona la temperatura máxima y mínima del día
- Si hay cambios bruscos de temperatura, avisa
- Si hay horas de viento fuerte, menciónalas
- Sé directo y práctico. Sin tecnicismos.`;

    userPrompt = `Ciudad: ${cityName}
Temperatura máxima: ${maxTemp}°C | Mínima: ${minTemp}°C
Horas con lluvia probable (>40%): ${rainHours}
Fiabilidad: ${conf}%
Contexto adicional: ${context}

Genera el veredicto para las PRÓXIMAS 24 HORAS.`;

  } else {
    systemPrompt = `Eres el asistente meteorológico de Meteoverso. Genera UN veredicto en 2 frases sobre la semana.
REGLAS ESTRICTAS:
- Resume la tendencia general de la semana
- Menciona los días más destacados (más calor, lluvia, frío)
- Sé directo y práctico. Sin tecnicismos.`;

    userPrompt = `Ciudad: ${cityName}
Resumen semanal: ${context}
Fiabilidad: ${conf}%

Genera el veredicto para ESTA SEMANA.`;
  }

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
        max_tokens: 120,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    const d = await r.json();
    const veredicto = d.content?.find(b => b.type === 'text')?.text?.trim();
    if (!veredicto) throw new Error('No veredicto');
    return res.status(200).json({ veredicto });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
