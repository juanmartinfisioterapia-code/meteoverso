export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { cityName, type, context, conf } = req.body;
  if (!cityName || !type || !context) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const key = process.env.ANTHROPIC_KEY;
  if (!key) return res.status(500).json({ error: 'No Anthropic key configured' });

  const labels = { now: 'ahora mismo', '24h': 'próximas horas de hoy', '7d': 'esta semana' };

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
        max_tokens: 100,
        system: `Eres el asistente de Meteoverso. Da UN VEREDICTO muy corto en 1-2 frases en español, tono cercano y práctico. Sin tecnicismos. Di exactamente qué esperar: si llevar paraguas, si hace calor, si es buen día. ${type === 'now' ? 'Habla del momento actual.' : type === '24h' ? 'Habla de las próximas horas de hoy.' : 'Habla del tiempo esta semana.'} Fiabilidad ${conf}%. Sin asteriscos ni markdown.`,
        messages: [{ role: 'user', content: `Ciudad: ${cityName}. ${context} Concordancia: ${conf}%. Veredicto para ${labels[type]}:` }],
      }),
    });

    const d = await r.json();
    const veredicto = d.content?.find(b => b.type === 'text')?.text?.trim();

    if (!veredicto) throw new Error('No veredicto from Claude');

    return res.status(200).json({ veredicto });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
