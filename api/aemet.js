export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat y lon requeridos' });

  const AEMET_KEY = process.env.AEMET_API_KEY;
  if (!AEMET_KEY) return res.status(500).json({ error: 'API key no configurada' });

  try {
    const munRes = await fetch(`https://opendata.aemet.es/opendata/api/maestro/municipios?api_key=${AEMET_KEY}`);
    const munData = await munRes.json();
    const listRes = await fetch(munData.datos);
    const municipios = await listRes.json();

    let closest = null;
    let minDist = Infinity;
    for (const m of municipios) {
      const mLat = parseFloat(m.latitud_dec);
      const mLon = parseFloat(m.longitud_dec);
      const dist = Math.sqrt(Math.pow(mLat - lat, 2) + Math.pow(mLon - lon, 2));
      if (dist < minDist) { minDist = dist; closest = m; }
    }

    if (!closest) return res.status(404).json({ error: 'Municipio no encontrado' });

    const codMunicipio = closest.id.replace('id', '');
    const predRes = await fetch(`https://opendata.aemet.es/opendata/api/prediccion/especifica/municipio/diaria/${codMunicipio}?api_key=${AEMET_KEY}`);
    const predMeta = await predRes.json();
    const predData = await (await fetch(predMeta.datos)).json();

    res.status(200).json({ municipio: closest.nombre, codMunicipio, data: predData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
