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
      // AEMET no nos dio una URL de datos: algo falló en el primer paso
      return res.status(500).json({ error: 'AEMET no devolvió datos', respuestaAemet: predMeta });
    }

    const predData = await (await fetch(predMeta.datos)).json();

    res.status(200).json({ codMunicipio, data: predData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}