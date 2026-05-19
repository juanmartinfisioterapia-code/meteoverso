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

  // Calculate time of day server-side (Spain/Portugal timezone UTC+1/+2)
  const now = new Date();
  const h = (now.getUTCHours() + 1) % 24; // UTC+1 approximate
  const timeContext = h >= 6 && h < 12 ? "Es por la mañana."
    : h >= 12 && h < 18 ? "Es por la tarde."
    : h >= 18 && h < 23 ? "Es por la noche."
    : "Es de madrugada.";

  const systemPrompt = `Eres el asistente meteorológico de Meteoverso. Genera UN veredicto en 2 frases en español.

${type === 'now' ? `HORA ACTUAL: ${timeContext} El veredicto debe ser coherente con este momento — si es de noche o madrugada, no sugieras actividades al aire libre como pasear o hacer deporte. Si es de mañana o tarde, puedes sugerirlas si el tiempo lo permite.` : ''}

PRIORIDADES:
1. Tormenta/granizo/nieve intensa → avisa primero
2. Lluvia probable >40% → recomienda paraguas
3. Viento >40km/h → menciona el viento
4. Temperatura >28°C → menciona calor
5. Temperatura <8°C → menciona frío y abrigo
6. Sensación 3°C menor → menciona que se siente más frío
7. Tiempo normal → consejo práctico coherente con la hora

REGLAS:
- NUNCA menciones paraguas si precipitación 0mm y probabilidad <20%
- Coherente con los datos y con la hora del día
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
        max_tokens: 120,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Ciudad: ${cityName}. ${context} Fiabilidad: ${conf}%. Veredicto para ${labels[type]}:` }],
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
