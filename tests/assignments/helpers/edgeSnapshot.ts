import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import ts from 'typescript';

// Avoid Vite's browser asset transform of new URL(literal, import.meta.url):
// this is a filesystem walk even when the caller uses the jsdom environment.
const sourceDirectory = '../../../supabase/functions/';
const root = new URL(sourceDirectory, import.meta.url);

/** Walk actual local imports, including re-exports, so new helpers cannot evade parity. */
export function edgeSnapshot(entries: string[]) {
  const sources = new Map<string, string>();
  function visit(url: URL) {
    if (!url.href.startsWith(root.href)) throw new Error(`Edge import escapes the function source tree: ${url.href} outside ${root.href}`);
    const file = decodeURIComponent(url.href.slice(root.href.length));
    if (sources.has(file)) return;
    const source = readFileSync(url, 'utf8');
    sources.set(file, source);
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    function walk(node: ts.Node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        if (node.moduleSpecifier.text.startsWith('.')) visit(new URL(node.moduleSpecifier.text, url));
      }
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const path = node.arguments[0];
        if (!path || !ts.isStringLiteral(path)) throw new Error(`Unresolved dynamic Edge import in ${file}`);
        if (path.text.startsWith('.')) visit(new URL(path.text, url));
      }
      ts.forEachChild(node, walk);
    }
    walk(ast);
  }
  entries.forEach(file => visit(new URL(file, root)));
  return sources;
}
