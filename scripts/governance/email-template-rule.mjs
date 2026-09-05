// Conservative local-flow proof: raw data is never trusted merely because its
// variable is named "safe". Composed HTML is allowed only if every leaf is escaped.
export default {
  meta: { type: "problem", schema: [], messages: { raw: "Escape this HTML interpolation with escapeHtml; composed markup must contain only escaped values." } },
  create(context) {
    const source = context.sourceCode;
    const unwrap = node => node?.type === "TSAsExpression" || node?.type === "TSNonNullExpression" ? unwrap(node.expression) : node;
    function variable(node) {
      let scope = source.getScope(node);
      while (scope) { const found = scope.set.get(node.name); if (found) return found; scope = scope.upper; }
    }
    function safe(input, seen = new Set()) {
      const node = unwrap(input);
      if (!node || seen.has(node)) return false;
      const next = new Set(seen).add(node);
      const check = child => safe(child, next);
      switch (node.type) {
        case "Literal": return true;
        case "Identifier": {
          const binding = variable(node);
          return binding?.defs.length === 1 && binding.defs[0].type === "Variable"
            && !binding.references.some(ref => ref.isWrite() && !ref.init)
            && check(binding.defs[0].node.init);
        }
        case "TemplateLiteral": return node.expressions.every(check);
        case "ConditionalExpression": return check(node.consequent) && check(node.alternate);
        case "LogicalExpression": return node.operator === "&&" ? check(node.right) : check(node.left) && check(node.right);
        case "BinaryExpression": return node.operator === "+" && check(node.left) && check(node.right);
        case "CallExpression": {
          if (node.callee.type === "Identifier" && node.callee.name === "escapeHtml") {
            return variable(node.callee)?.defs.some(def => def.type === "ImportBinding"
              && def.parent.source.value.endsWith("/corporateEmailTemplate.ts")
              && def.node.imported?.name === "escapeHtml") ?? false;
          }
          const callee = node.callee;
          if (callee.type !== "MemberExpression" || callee.computed) return false;
          if (callee.property.name === "replace") return check(callee.object) && check(node.arguments[1]);
          if (callee.property.name === "join" && node.arguments.every(check)) {
            const map = callee.object;
            if (map.type !== "CallExpression" || map.callee.type !== "MemberExpression" || map.callee.property.name !== "map") return false;
            const callback = map.arguments[0];
            return callback?.type === "ArrowFunctionExpression" && check(callback.body);
          }
          return false;
        }
        default: return false;
      }
    }
    return {
      TemplateLiteral(node) {
        if (!/<\/?[a-z][^>]*>/i.test(node.quasis.map(part => part.value.raw).join(""))) return;
        for (const expression of node.expressions) if (!safe(expression)) context.report({ node: expression, messageId: "raw" });
      },
    };
  },
};
