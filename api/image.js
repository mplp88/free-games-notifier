const ALLOWED_HOSTS = ['cdn1.epicgames.com', 'cdn2.unrealengine.com'];

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed');
  }

  const imageUrl = req.query.url;

  if (typeof imageUrl !== 'string') {
    return res.status(400).send('Missing image URL');
  }

  try {
    const url = new URL(imageUrl);

    if (url.protocol !== 'https:' || !ALLOWED_HOSTS.includes(url.hostname)) {
      return res.status(403).send('Image host not allowed');
    }

    const response = await fetch(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return res.status(response.status).send('Image unavailable');
    }

    const contentType = response.headers.get('content-type') || '';

    if (!/^image\/(png|jpeg|webp|gif)$/i.test(contentType)) {
      return res.status(415).send('Unsupported image type');
    }

    const image = Buffer.from(await response.arrayBuffer());

    if (image.length > 5 * 1024 * 1024) {
      return res.status(413).send('Image too large');
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'public, max-age=86400');

    return res.status(200).send(image);
  } catch (error) {
    console.error('Image proxy error:', error.message);
    return res.status(502).send('Unable to retrieve image');
  }
}
