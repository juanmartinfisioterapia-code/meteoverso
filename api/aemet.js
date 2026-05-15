export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { endpoint } = req.query;
  if (!endpoint) {
    return res.status(400).json({ error: 'Missing endpoint parameter' });
  }

  const key = process.env.VITE_AEMET_KEY;
  if (!key) {
    return res.status(500).json({ error: 'AEMET key not configured' });
  }

  try {
    // Build AEMET URL
    const aemetUrl = decodeURIComponent(endpoint) + `?api_key=${key}`;
    
    const response = await fetch(aemetUrl, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `AEMET error: ${response.status}` });
    }

    const data = await response.json();

    // If AEMET returns a datos URL, fetch that too
    if (data.datos) {
      const dataResponse = await fetch(data.datos);
      if (dataResponse.ok) {
        const finalData = await dataResponse.json();
        return res.status(200).json({ success: true, data: finalData, meta: data });
      }
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
