export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const AEMET_KEY = process.env.AEMET_API_KEY;
  if (!AEMET_KEY) return res.status(500).json({ error: 'API key no configurada' });

  const codMunicipio = '19293'; // Uceda, fijo por ahora para probar

  try {
    const predRes = await fetch(
      `https://opendata.aemet.es/opendata/api/prediccion/especifica/municipio/diaria/${codMunicipio}?api_key=${AEMET_KEY}`
    );
    const predMeta = await predRes.json();

    if (!predMeta.datos) {
      return res.status(500).json({ error: 'AEMET no devolvió datos', respuestaAemet: predMeta });
    }

    const predRes2 = await fetch(predMeta.datos);
    const buffer = await predRes2.arrayBuffer();
    const decoder = new TextDecoder('iso-8859-15');
    const text = decoder.decode(buffer);
    const predData = JSON.parse(text);

    res.status(200).json({ codMunicipio, data: predData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
