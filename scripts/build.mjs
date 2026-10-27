// Bundles the worker into dist/main.mjs, the file Orca loads. Orca installs
// plugins from Git without running npm, so dependencies are bundled and the
// output is committed. Licences of bundled packages are appended to the file.
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'

const BUNDLED = ['yaml']

const notices = await Promise.all(
  BUNDLED.map(async (name) => {
    const pkg = JSON.parse(await readFile(`node_modules/${name}/package.json`, 'utf8'))
    const license = await readFile(`node_modules/${name}/LICENSE`, 'utf8')
    return `${pkg.name}@${pkg.version} (${pkg.license})\n\n${license.trim()}`
  })
)

await build({
  entryPoints: ['src/main.mjs'],
  outfile: 'dist/main.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  legalComments: 'eof',
  // yaml resolves to its CommonJS build under Node; give the ESM bundle a require().
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);"
  },
  footer: {
    js: `/*! Bundled third-party code:\n\n${notices.join('\n\n---\n\n').replaceAll('*/', '* /')}\n*/`
  },
  logLevel: 'info'
})
