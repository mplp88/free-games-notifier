function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function createPage({ title, description, deepLink, webUrl }) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeDeepLink = escapeHtml(deepLink);
  const safeWebUrl = escapeHtml(webUrl);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">

  <title>${safeTitle} - Free Games Notifier</title>

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: #0f172a;
      color: #f8fafc;
      font-family: Arial, sans-serif;
      text-align: center;
    }

    .container {
      width: 100%;
      max-width: 420px;
      padding: 36px 28px;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 16px;
    }

    h1 {
      margin: 0 0 12px;
      font-size: 24px;
    }

    p {
      color: #cbd5e1;
      line-height: 1.6;
      font-size: 14px;
    }

    .button {
      display: block;
      width: 100%;
      margin-top: 24px;
      padding: 15px 20px;
      border-radius: 8px;
      background: #2563eb;
      color: white;
      text-decoration: none;
      font-weight: bold;
      transition: background 0.2s;
    }

    .button:hover {
      background: #1d4ed8;
    }

    .secondary {
      display: inline-block;
      margin-top: 20px;
      color: #93c5fd;
      font-size: 13px;
      text-decoration: none;
    }

    .brand {
      margin-top: 28px;
      color: #64748b;
      font-size: 12px;
    }
  </style>
</head>

<body>
  <main class="container">
    <h1>${safeTitle}</h1>

    <p>${safeDescription}</p>

    <a class="button" href="${safeDeepLink}">
      🚀 Abrir en la aplicación
    </a>

    <a class="secondary" href="${safeWebUrl}">
      Abrir en el navegador
    </a>

    <div class="brand">
      Free Games Notifier
    </div>
  </main>

  <script>
    // Intentamos abrir la aplicación automáticamente.
    // El botón permanece disponible si el navegador bloquea el intento.
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.location.href = ${JSON.stringify(deepLink)};
      }, 300);
    });
  </script>
</body>
</html>`;
}

module.exports = (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
  );
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Method not allowed');
  }

  const { store, id } = req.query;

  if (typeof store !== 'string' || typeof id !== 'string') {
    return res.status(400).send('Invalid request');
  }

  let config;

  switch (store.toLowerCase()) {
    case 'steam':
      // Los App IDs de Steam son numéricos.
      if (!/^\d+$/.test(id)) {
        return res.status(400).send('Invalid Steam App ID');
      }

      config = {
        title: 'Abrir en Steam',
        description:
          'Estamos intentando abrir Steam para mostrarte la página de este juego.',
        deepLink: `steam://store/${id}`,
        webUrl: `https://store.steampowered.com/app/${id}/`,
      };
      break;

    case 'epic':
      // El slug debe contener solamente caracteres seguros.
      if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
        return res.status(400).send('Invalid Epic product slug');
      }

      config = {
        title: 'Abrir en Epic Games',
        description:
          'Estamos intentando abrir Epic Games Launcher para mostrarte la página de este juego.',
        deepLink: `com.epicgames.launcher://store/product/${id}`,
        webUrl: `https://store.epicgames.com/p/${id}`,
      };
      break;

    default:
      return res.status(404).send('Store not supported');
  }

  return res
    .status(200)
    .setHeader('Content-Type', 'text/html; charset=utf-8')
    .send(createPage(config));
};
