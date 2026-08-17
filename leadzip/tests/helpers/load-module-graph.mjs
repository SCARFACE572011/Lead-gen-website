import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

/**
 * Load a TypeScript module *and its whole import graph* without adding a test
 * runner or a bundler to the repo.
 *
 * tests/helpers/load-typescript-module.mjs rewrites import specifiers only in
 * the entry file, which is enough for a leaf policy module. The money-handling
 * code under test here is not a leaf: src/lib/emailCredits.ts pulls in
 * src/lib/stripe/subscriptionSync.ts, which itself imports 'stripe' and
 * '@supabase/supabase-js'. A bare specifier cannot be resolved from a data:
 * URL, so every level of the graph has to be rewritten, not just the first.
 *
 * Resolution rules:
 *   - anything listed in `overrides` is replaced by that stub file
 *   - '@/x' resolves to <repo>/src/x.ts (the tsconfig path alias)
 *   - './x' and '../x' resolve relative to the importing file, '.ts' appended
 *   - anything else is left untouched, so an unstubbed dependency fails loudly
 *     at import time instead of silently resolving to something unexpected
 */
const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url))

/** Matches `from 'x'` and bare `import 'x'`, but not `import('x')`. */
const SPECIFIER_RE = /(?:\bfrom\s*|\bimport\s*)(['"])([^'"\n]+)\1/g

function specifiersIn(source) {
  const found = new Set()
  for (const match of source.matchAll(SPECIFIER_RE)) found.add(match[2])
  return [...found]
}

function resolveSpecifier(specifier, fromFile, overrides) {
  if (Object.hasOwn(overrides, specifier)) return overrides[specifier]
  if (specifier.startsWith('@/')) {
    return path.join(REPO_ROOT, 'src', `${specifier.slice(2)}.ts`)
  }
  if (specifier.startsWith('.')) {
    return `${path.resolve(path.dirname(fromFile), specifier)}.ts`
  }
  return null
}

async function moduleUrl(filePath, overrides, cache, pending) {
  const cached = cache.get(filePath)
  if (cached) return cached
  if (pending.has(filePath)) {
    throw new Error(`Import cycle through ${filePath} is not supported by this loader.`)
  }
  pending.add(filePath)

  let source = await fs.readFile(filePath, 'utf8')
  for (const specifier of specifiersIn(source)) {
    const dependencyPath = resolveSpecifier(specifier, filePath, overrides)
    if (!dependencyPath) continue
    const dependencyUrl = await moduleUrl(dependencyPath, overrides, cache, pending)
    source = source
      .split(`'${specifier}'`)
      .join(`'${dependencyUrl}'`)
      .split(`"${specifier}"`)
      .join(`"${dependencyUrl}"`)
  }

  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filePath,
  }).outputText
  const url = `data:text/javascript;base64,${Buffer.from(output).toString('base64')}`

  pending.delete(filePath)
  cache.set(filePath, url)
  return url
}

/**
 * @param {string} entryPath absolute path to the .ts entry module
 * @param {Record<string, string>} overrides bare specifier -> absolute stub path
 */
export async function loadModuleGraph(entryPath, overrides = {}) {
  return import(await moduleUrl(entryPath, overrides, new Map(), new Set()))
}

export function repoPath(relativePath) {
  return path.join(REPO_ROOT, relativePath)
}
