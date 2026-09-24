import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import config from './tailwind.config.cjs';

const dir = dirname(fileURLToPath(import.meta.url));
const result = await Bun.build({
  entrypoints: [resolve(dir, 'src/app.jsx')],
  target: 'browser', format: 'iife', minify: true,
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
});
if (!result.success) throw new Error(result.logs.join('\n'));
await Bun.write(resolve(dir, 'app.js'), result.outputs[0]);
const input = await Bun.file(resolve(dir, 'src/styles.css')).text();
const css = await postcss([tailwind(config)]).process(input, { from: resolve(dir, 'src/styles.css'), map: false });
await Bun.write(resolve(dir, 'styles.css'), css.css);
console.log('Built standalone app.js + styles.css');
