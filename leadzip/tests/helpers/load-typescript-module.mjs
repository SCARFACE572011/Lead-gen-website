import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

async function typescriptModuleUrl(path, aliases = {}) {
  let source = await fs.readFile(path, 'utf8')
  for (const [specifier, dependencyPath] of Object.entries(aliases)) {
    const dependencyUrl = await typescriptModuleUrl(dependencyPath)
    source = source
      .split(`'${specifier}'`).join(`'${dependencyUrl}'`)
      .split(`"${specifier}"`).join(`"${dependencyUrl}"`)
  }
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: path,
  }).outputText
  return `data:text/javascript;base64,${Buffer.from(output).toString('base64')}`
}

/** Load a small TypeScript policy module without adding a test-runner dependency. */
export async function loadTypeScriptModule(path, aliases) {
  return import(await typescriptModuleUrl(path, aliases))
}

export function modulePath(relativePath) {
  return fileURLToPath(new URL(`../../${relativePath}`, import.meta.url))
}
