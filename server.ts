import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;
const FIREBASE_PROJECT_ID = 'ai-studio-bca6bfec-1ebe-467d-a6e6-da5c2cf57f15';

async function fetchPostMetaData(postId: string) {
  try {
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/posts/${postId}`;
    const res = await fetch(firestoreUrl);
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.fields) return null;

    const fields = data.fields;
    const authorUsername = fields.authorUsername?.stringValue || 'vybe_user';
    const authorDisplayName = fields.authorDisplayName?.stringValue || authorUsername;
    const content = fields.content?.stringValue || '';
    const mediaUrl = fields.mediaUrl?.stringValue || (fields.mediaUrls?.arrayValue?.values?.[0]?.stringValue || '');
    const isDeleted = fields.deleted?.booleanValue || false;

    if (isDeleted) return null;

    return {
      title: `Publicação de @${authorUsername} na VYBE`,
      description: content ? content.slice(0, 160) : `Confira a publicação de ${authorDisplayName} na VYBE!`,
      image: mediaUrl || 'https://app-vybe.vercel.app/logo.png',
      url: `https://app-vybe.vercel.app/p/${postId}`,
    };
  } catch (err) {
    console.error('Error fetching Firestore meta data for post:', err);
    return null;
  }
}

async function startServer() {
  const app = express();

  // API Health Check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Dynamic OpenGraph Meta Tags for public post links (/p/:postId)
  app.get('/p/:postId', async (req, res, next) => {
    const postId = req.params.postId;
    try {
      const meta = await fetchPostMetaData(postId);
      const indexPath = process.env.NODE_ENV === 'production'
        ? path.join(process.cwd(), 'dist', 'index.html')
        : path.join(process.cwd(), 'index.html');

      if (fs.existsSync(indexPath)) {
        let html = fs.readFileSync(indexPath, 'utf-8');

        if (meta) {
          // Replace title and Open Graph tags for link previews (WhatsApp, Twitter, Facebook)
          html = html.replace(/<title>.*?<\/title>/i, `<title>${meta.title}</title>`);
          html = html.replace(
            /<meta property="og:title" content=".*?" \/>/i,
            `<meta property="og:title" content="${meta.title}" />`
          );
          html = html.replace(
            /<meta property="og:description" content=".*?" \/>/i,
            `<meta property="og:description" content="${meta.description}" />`
          );
          html = html.replace(
            /<meta property="og:image" content=".*?" \/>/i,
            `<meta property="og:image" content="${meta.image}" />`
          );
          html = html.replace(
            /<meta property="og:url" content=".*?" \/>/i,
            `<meta property="og:url" content="${meta.url}" />`
          );

          // Add Twitter Card tags if not present
          if (!html.includes('twitter:card')) {
            const twitterTags = `
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${meta.title}" />
    <meta name="twitter:description" content="${meta.description}" />
    <meta name="twitter:image" content="${meta.image}" />
  `;
            html = html.replace('</head>', `${twitterTags}\n</head>`);
          }
        }

        return res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      }
    } catch (err) {
      console.error('Error handling SSR OpenGraph meta tags:', err);
    }
    next();
  });

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
