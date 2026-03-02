import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import serve from 'rollup-plugin-serve';

const dev = process.env.SERVE === 'true' || process.env.ROLLUP_WATCH === 'true';

export default {
  input: 'src/tidal-card.ts',
  output: {
    file: 'dist/tidal-card.js',
    format: 'es',
    sourcemap: dev,
  },
  plugins: [
    resolve(),
    commonjs(),
    typescript(),
    json(),
    !dev && terser({ format: { comments: false } }),
    dev &&
      serve({
        contentBase: ['dist'],
        port: 5000,
      }),
  ].filter(Boolean),
};
