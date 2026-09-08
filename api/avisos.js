import zlib from 'zlib';
import tar from 'tar-stream';

function nivelDesdeSeveridad(sev) {
  const s = (sev || '').toLowerCase();
  if (s === 'extreme') return 'rojo';
  if (s === 'severe') return 'naranja';
  if (s === 'moderate') return 'amarillo';
  return 'verde';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { provincia } = req.query;
  const AEMET_KEY = process.env.AEMET_API_KEY;
  if (!AEMET_KEY) return res.status(500).json({ error: 'API key no configurada' });

  try {
    const metaRes = await fetch(`https://opendata.aemet.es/opendata/api/avisos_cap/ultimoelaborado/area/esp?api_key=${AEMET_KEY}`);
    const meta = await metaRes.json();
    if (!meta.datos) {
      return res.status(500).json({ error: 'AEMET no devolvio datos', respuestaAemet: meta });
    }

    const fileRes = await fetch(meta.datos);
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    const gunzipped = zlib.gunzipSync(buffer);

    const avisos = [];
    const extract = tar.extract();

    await new Promise((resolve, reject) => {
      extract.on('entry', (header, stream, next) => {
        let xml = '';
        stream.on('data', c => xml += c.toString('utf-8'));
        stream.on('end', () => {
          if (header.name.endsWith('.xml') && provincia && xml.includes(provincia)) {
            const severidad = (xml.match(/<severity>(.*?)<\/severity>/) || [])[1];
            const evento = (xml.match(/<cap:event>(.*?)<\/cap:event>/) || xml.match(/<event>(.*?)<\/event>/) || [])[1];
            const descripcion = (xml.match(/<description>([\s\S]*?)<\/description>/) || [])[1];
            const zona = (xml.match(/<areaDesc>(.*?)<\/areaDesc>/) || [])[1];
            const efectivo = (xml.match(/<effective>(.*?)<\/effective>/) || [])[1];
            const expira = (xml.match(/<expires>(.*?)<\/expires>/) || [])[1];
            if (severidad && severidad.toLowerCase() !== 'minor') {
              avisos.push({
                nivel: nivelDesdeSeveridad(severidad),
                evento: evento || 'Aviso meteorologico',
                zona: zona || provincia,
                descripcion: descripcion ? descripcion.trim() : '',
                efectivo,
                expira,
              });
            }
          }
          next();
        });
      });
      extract.on('finish', resolve);
      extract.on('error', reject);
      extract.end(gunzipped);
    });

    res.status(200).json({ provincia, avisos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
