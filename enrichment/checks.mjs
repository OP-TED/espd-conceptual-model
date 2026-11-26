// Checks used by validate.mjs that a JSON Schema cannot express, kept apart so they can be tested.

/**
 * Keys that appear twice in the same JSON object. JSON.parse keeps only the last of them, so a
 * copy-paste duplicate would otherwise go unnoticed. Returns one message per repeated key, with the
 * path of the object that holds it. Throws on text that is not valid JSON.
 */
export function findDuplicateKeys(text) {
  let i = 0;
  const found = [];
  const skipSpace = () => { while (i < text.length && /\s/.test(text[i])) i++; };
  const readString = () => {
    const start = i;
    i++;
    while (i < text.length && text[i] !== '"') { if (text[i] === '\\') i++; i++; }
    if (i >= text.length) throw new SyntaxError('unterminated string');
    i++;
    return JSON.parse(text.slice(start, i));
  };
  const readValue = (where) => {
    skipSpace();
    const c = text[i];
    if (c === '{') {
      i++;
      skipSpace();
      if (text[i] === '}') { i++; return; }
      const seen = new Set();
      for (;;) {
        skipSpace();
        if (text[i] !== '"') throw new SyntaxError(`expected a key at position ${i}`);
        const key = readString();
        skipSpace();
        if (text[i] !== ':') throw new SyntaxError(`expected ":" at position ${i}`);
        i++;
        if (seen.has(key)) found.push(`duplicate key "${key}" in ${where || '/'}`);
        seen.add(key);
        readValue(`${where}/${key}`);
        skipSpace();
        if (text[i] === ',') { i++; continue; }
        if (text[i] === '}') { i++; return; }
        throw new SyntaxError(`expected "," or "}" at position ${i}`);
      }
    } else if (c === '[') {
      i++;
      skipSpace();
      if (text[i] === ']') { i++; return; }
      for (let n = 0; ; n++) {
        readValue(`${where}/${n}`);
        skipSpace();
        if (text[i] === ',') { i++; continue; }
        if (text[i] === ']') { i++; return; }
        throw new SyntaxError(`expected "," or "]" at position ${i}`);
      }
    } else if (c === '"') {
      readString();
    } else {
      const start = i;
      while (i < text.length && !/[,\]}\s]/.test(text[i])) i++;
      if (i === start) throw new SyntaxError(`unexpected character at position ${i}`);
    }
  };
  readValue('');
  skipSpace();
  if (i < text.length) throw new SyntaxError(`unexpected content at position ${i}`);
  return found;
}

/**
 * Does `dataPath` (for example partI.contractingAuthority.country, with [] allowed for arrays) lead to a
 * property of an instance-data schema? Follows local $ref, array items, and the composition keywords
 * (allOf, anyOf, oneOf, if, then, else), so a property that is declared in only one branch of a
 * composition still counts: the check is "can this path exist", not "is it always present".
 */
export function schemaHasPath(schema, dataPath) {
  const refTarget = (ref) => {
    if (ref === '#') return schema;
    const m = /^#\/(\$defs|definitions)\/(.+)$/.exec(ref);
    return m ? schema[m[1]]?.[m[2]] : undefined;
  };
  // Every schema node whose properties apply at `node`: the node itself, what it $refs, its array items
  // and everything reachable through the composition keywords.
  const expand = (node, seen = new Set()) => {
    if (!node || typeof node !== 'object' || seen.has(node)) return [];
    seen.add(node);
    const out = [node];
    if (typeof node.$ref === 'string') out.push(...expand(refTarget(node.$ref), seen));
    if (node.items && typeof node.items === 'object' && !Array.isArray(node.items)) out.push(...expand(node.items, seen));
    for (const key of ['allOf', 'anyOf', 'oneOf']) {
      if (Array.isArray(node[key])) for (const sub of node[key]) out.push(...expand(sub, seen));
    }
    for (const key of ['if', 'then', 'else']) out.push(...expand(node[key], seen));
    return out;
  };
  let nodes = [schema];
  for (const key of dataPath.replace(/\[\]/g, '').split('.')) {
    const next = [];
    for (const node of nodes.flatMap((n) => expand(n))) {
      const child = node.properties?.[key];
      if (child) next.push(child);
    }
    if (!next.length) return false;
    nodes = next;
  }
  return true;
}
