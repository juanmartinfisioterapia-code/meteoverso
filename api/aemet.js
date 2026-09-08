import fs from 'fs';
import path from 'path';

let municipios = null;

function cargarMunicipios() {
  if (!municipios) {
    const filePath = path.join(process.cwd(), 'api', 'municipios.json');
    municipios = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
  return municipios;
}

function municipioMasCercano(lat, lon) {
  const lista = cargarMunicipios();
  let closest = null;
  let minDist = Infinity;
  for (const m of lista) {
    const dist = Math.sqrt(Math.pow(m.lat - lat, 2) + Math.pow(m.lon - lon, 2));
    if (dist < minDist) {
      minDist = dist;
      closest = m;
    }
  }
  return closest;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat y lon requeridos' });

  const AEMET_KEY = process.env.AEMET_API_KEY;
  if (!AEMET_KEY) return res.status(500).json({ error: 'API key no configurada' });

  const cercano = municipioMasCercano(parseFloat(lat), parseFloat(lon));
  if (!cercano) return res.status(404).json({ error: 'Municipio no encontrado' });

  try {
    const predRes = await fetch(
      `https://opendata.aemet.es/opendata/api/prediccion/especifica/municipio/diaria/${cercano.id}?api_key=${AEMET_KEY}`
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

    res.status(200).json({
      municipio: cercano.nombre,
      provincia: cercano.provincia,
      codMunicipio: cercano.id,
      data: predData,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
