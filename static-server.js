import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const app = express();
const PORT = Number(process.env.PORT || 5173);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, 'dist');

app.use(
  express.static(distPath, {
    etag: true,
    maxAge: '7d',
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
        return;
      }
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }),
);

app.use((req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Frontend running on http://0.0.0.0:${PORT}`);
  console.log(`Frontend: http://localhost:${PORT}`);
  console.log(`Network frontend: http://${getLocalIp()}:${PORT}`);
}).on('error', (error) => {
  if (error?.code === 'EADDRINUSE') {
    console.error(`Frontend port ${PORT} is busy. Stop the other app or choose another port.`);
    process.exit(1);
  }
  console.error('Frontend failed to start:', error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
});

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const values of Object.values(interfaces)) {
    for (const value of values ?? []) {
      if (value.family === 'IPv4' && !value.internal) return value.address;
    }
  }
  return 'YOUR_LOCAL_IP';
}
