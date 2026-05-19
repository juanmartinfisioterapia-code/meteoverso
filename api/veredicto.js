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

  const systemPrompt = `Eres el asistente meteorológico de Meteoverso. Genera UN veredicto en 2 frases en español.

PRIORIDADES EN ORDEN:
1. Si hay tormenta, granizo o nieve intensa → avisa siempre primero
2. Si probabilidad de lluvia > 40% → recomienda paraguas
3. Si viento > 40km/h → menciona el viento
4. Si temperatura > 28°C → menciona calor
5. Si temperatura < 8°C → menciona frío y abrigo
6. Si sensación térmica es 3°C menor que temperatura → menciona que se siente más frío
7. Si todo normal → di que es buen día y qué se puede hacer

REGLAS:
- NUNCA menciones paraguas si la precipitación es 0mm y probabilidad < 20%
- Sé coherente con los datos exactos
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
        messages: [{ role: 'user', content: `Ciudad: ${cityName}. ${context} Fiabilidad modelos: ${conf}%. Veredicto para ${labels[type]}:` }],
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
