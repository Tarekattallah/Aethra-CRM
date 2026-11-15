import { writeFile } from 'node:fs/promises';

// Run before importing/deploying the frontend: node scripts/configure-vercel.mjs https://YOUR-API.onrender.com
const input = process.argv[2];
if (!input) throw new Error('Pass the actual Render API origin as the only argument');
const origin = new URL(input);
if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
  throw new Error('Use an HTTPS origin without credentials, paths or query parameters');
}
const config = {
  $schema: 'https://openapi.vercel.sh/vercel.json',
  framework: 'vite',
  buildCommand: 'npm run build',
  installCommand: 'npm ci',
  outputDirectory: 'dist',
  headers: [{ source: '/api/:path*', headers: [{key:'Cache-Control', value:'private, no-store'}] }],
  rewrites: [
    { source: '/api/:path*', destination: `${origin.origin}/api/:path*` },
    { source: '/((?!api(?:/|$)).*)', destination: '/index.html' }
  ]
};
await writeFile(new URL('../client/vercel.json', import.meta.url), JSON.stringify(config, null, 2)+'\n');
console.log(`Configured Vercel API proxy for ${origin.origin}; set the Vercel project root to client.`);
