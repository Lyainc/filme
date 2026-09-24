import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const index = '/docs/mockups/filme-mobile-v1/index.html';
const server = Bun.serve({
  hostname: '127.0.0.1', port: Number(process.env.FILME_MOCKUP_PORT || 3791),
  async fetch(request) {
    let path;
    try { path = decodeURIComponent(new URL(request.url).pathname); } catch { return new Response('Bad path', { status: 400 }); }
    if (path === '/') return Response.redirect(new URL(index, request.url));
    const allowed = path.startsWith('/docs/mockups/filme-mobile-v1/') || path.startsWith('/public/assets/landing/') || path === '/public/fonts/PretendardVariable.woff2' || path.startsWith('/docs/verification/mobile-ui-2026-09-20/');
    const full = resolve(root, '.' + path);
    if (!allowed || !full.startsWith(root + '/') || !['.html', '.js', '.css', '.png', '.jpg', '.webp', '.woff2'].includes(extname(full))) return new Response('Not found', { status: 404 });
    const file = Bun.file(full);
    if (!await file.exists()) return new Response('Not found', { status: 404 });
    return new Response(file, { headers: { 'Cache-Control': 'no-store' } });
  },
});
console.log(`FILME mockup: http://127.0.0.1:${server.port}${index}`);
