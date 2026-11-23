// Validates the enrichment sources against their JSON Schemas and checks the
// cross-file invariants a schema cannot express.
//
// Usage (from this folder):  npm ci && npm run validate
//
// Checks:
//   - every registry file and criterion file validates against schema/*.schema.json
//   - no unexpected files (a registry without a schema, a criteria file that is
//     neither <code>.sidecar.json nor <code>.hints.json)
//   - each sidecar's criterion.code equals its file name stem; every hints file
//     has a matching sidecar
//   - component semantic ids are unique across ALL sidecars
//   - roles.json: role ids unique; exclusionGroundRules cover exactly the declared
//     categories with declared dispositions; exclusionCategoryMap values are
//     declared categories

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (...p) => JSON.parse(fs.readFileSync(path.join(root, ...p), 'utf8'));

const ajv = new Ajv({ allErrors: true, strict: true });
const schemaOf = (name) => ajv.compile(read('schema', `${name}.schema.json`));

const REGISTRY_SCHEMAS = {
  'value-types.json': 'value-types',
  'codelist-attributes.json': 'codelist-attributes',
  'encoding-profile.json': 'encoding-profile',
  'scheme-agency-profile.json': 'scheme-agency-profile',
  'roles.json': 'roles',
  'codelist-governance.json': 'codelist-governance',
  'ui-hints.json': 'ui-hints',
};

const errors = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);

function check(where, validate, data) {
  if (validate(data)) return true;
  for (const e of validate.errors) fail(where, `${e.instancePath || '/'} ${e.message}${e.params?.additionalProperty ? ` ("${e.params.additionalProperty}")` : ''}`);
  return false;
}

// --- registries -----------------------------------------------------------
const registriesDir = path.join(root, 'registries');
for (const file of fs.readdirSync(registriesDir).sort()) {
  const where = `registries/${file}`;
  const schemaName = REGISTRY_SCHEMAS[file];
  if (!schemaName) { fail(where, 'no schema registered for this registry file'); continue; }
  check(where, schemaOf(schemaName), read('registries', file));
}
for (const file of Object.keys(REGISTRY_SCHEMAS)) {
  if (!fs.existsSync(path.join(registriesDir, file))) fail(`registries/${file}`, 'expected registry file is missing');
}

// --- criteria -------------------------------------------------------------
const validateSidecar = schemaOf('sidecar');
const validateHints = schemaOf('hints');
const criteriaDir = path.join(root, 'criteria');
const files = fs.readdirSync(criteriaDir).sort();
const sidecarCodes = new Set();
const idOwner = new Map();

for (const file of files) {
  const where = `criteria/${file}`;
  const m = file.match(/^(.+)\.(sidecar|hints)\.json$/);
  if (!m) { fail(where, 'unexpected file (expected <code>.sidecar.json or <code>.hints.json)'); continue; }
  const [, code, kind] = m;
  const data = read('criteria', file);
  if (kind === 'sidecar') {
    sidecarCodes.add(code);
    if (!check(where, validateSidecar, data)) continue;
    // The file stem is the criterion's output identity (the key of every published
    // file). It is the EA code, except for the Part II/V 'other' criteria, which are
    // keyed 'ot-<id>' so that their identity stays stable although EA now gives them
    // their own codes (these criteria must also carry their EA tag, e.g. C65_OT).
    const c = data.criterion;
    if (code !== c.code) {
      if (code !== `ot-${c.id}`) fail(where, `file name "${code}" must be the criterion code "${c.code}" or "ot-${c.id}"`);
      else if (!c.tag) fail(where, `an "ot-<id>" criterion must carry criterion.tag (its EA tag, e.g. C65_OT)`);
    }
    for (const [requestpath, c] of Object.entries(data.components)) {
      const prev = idOwner.get(c.id);
      if (prev) fail(where, `semantic id "${c.id}" (${requestpath}) is already used by ${prev}`);
      else idOwner.set(c.id, `${file} ${requestpath}`);
    }
  } else {
    check(where, validateHints, data);
  }
}
for (const file of files) {
  const m = file.match(/^(.+)\.hints\.json$/);
  if (m && !sidecarCodes.has(m[1])) fail(`criteria/${file}`, `no matching ${m[1]}.sidecar.json`);
}

// --- roles cross-checks ---------------------------------------------------
if (fs.existsSync(path.join(registriesDir, 'roles.json'))) {
  const roles = read('registries', 'roles.json');
  const cats = new Set(roles.exclusionCategories ?? []);
  const disp = new Set(roles.exclusionDispositions ?? []);
  const seen = new Set();
  for (const r of [...(roles.buyerTypes ?? []), ...(roles.eoRoles ?? [])]) {
    if (seen.has(r.id)) fail('registries/roles.json', `duplicate role id "${r.id}"`);
    seen.add(r.id);
    const ruleCats = Object.keys(r.exclusionGroundRules ?? {});
    for (const c of cats) if (!ruleCats.includes(c)) fail('registries/roles.json', `role "${r.id}" is missing exclusion category "${c}"`);
    for (const [c, d] of Object.entries(r.exclusionGroundRules ?? {})) {
      if (!cats.has(c)) fail('registries/roles.json', `role "${r.id}" has unknown exclusion category "${c}"`);
      if (!disp.has(d)) fail('registries/roles.json', `role "${r.id}" category "${c}" has undeclared disposition "${d}"`);
    }
  }
  for (const [prefix, c] of Object.entries(roles.exclusionCategoryMap ?? {})) {
    if (!prefix.startsWith('$') && !cats.has(c)) fail('registries/roles.json', `exclusionCategoryMap["${prefix}"] -> unknown category "${c}"`);
  }
}

// --- codelist-governance cross-checks --------------------------------------
// (Checks against the real code lists, the CVA and the compiler's behaviour need those inputs and
// live in espd-tools/model-compiler/codelist-governance.test.mjs.)
if (fs.existsSync(path.join(registriesDir, 'codelist-governance.json'))) {
  const where = 'registries/codelist-governance.json';
  const { codelists } = read('registries', 'codelist-governance.json');
  const names = new Map(); // lower-case name or alias -> owner
  for (const [name, e] of Object.entries(codelists)) {
    if (e.gc && e.externalSource) fail(where, `${name}: has both a gc file and an externalSource (a shipped list needs no external source)`);
    if (!e.gc && !e.externalSource) fail(where, `${name}: not shipped (no gc), so it must record where it comes from (externalSource)`);
    if (!e.gc && e.excludedCodes) fail(where, `${name}: excludedCodes needs a shipped list (gc)`);
    for (const n of [name, ...(e.aliases ?? [])]) {
      const k = n.toLowerCase();
      if (names.has(k) && names.get(k) !== name) fail(where, `"${n}" names both ${names.get(k)} and ${name}`);
      names.set(k, name);
    }
  }
}

// --- administrative parts (I, II, VI) ----------------------------------------
// Hand-authored for now, to be derived from the EA model later. Per part: index.json (the
// manifest) and, per section listed in it, section<L>.{schema,example,mapping,form}.json.
// (Round-trip, Schematron and enum-sync tests need the mapping engine and the code lists,
// so they stay with the consumers; see espd-tools/model-compiler and espd-demo.)
const partsDir = path.join(root, 'parts');
const validateManifest = schemaOf('parts-manifest');
const validateForm = schemaOf('parts-form');
const validateMapping = schemaOf('parts-mapping');
// Section instance schemas use keywords of their own ($codelist, ...), so they compile in
// non-strict mode; the structure above them is checked strictly by the schemas just loaded.
const looseAjv = new Ajv({ allErrors: true, strict: false });
const SECTION_KINDS = ['schema', 'example', 'mapping', 'form'];
let partSections = 0;

/** Does `dataPath` (partI.a.b) lead to a property of the section instance schema? */
function schemaHasPath(schema, dataPath) {
  const deref = (s) => {
    let cur = s;
    for (let i = 0; cur?.$ref && i < 20; i++) {
      const m = cur.$ref.match(/^#\/(\$defs|definitions)\/(.+)$/);
      cur = m ? schema[m[1]]?.[m[2]] : undefined;
    }
    return cur;
  };
  let node = schema;
  for (const key of dataPath.replace(/\[\]/g, '').split('.')) {
    node = deref(node);
    if (node?.type === 'array' && node.items) node = deref(node.items);
    node = node?.properties?.[key];
    if (!node) return false;
  }
  return true;
}

if (fs.existsSync(partsDir)) {
  const hintsRegistry = fs.existsSync(path.join(registriesDir, 'ui-hints.json')) ? read('registries', 'ui-hints.json') : { lookups: {} };
  const governanceNames = new Set();
  if (fs.existsSync(path.join(registriesDir, 'codelist-governance.json'))) {
    for (const [name, e] of Object.entries(read('registries', 'codelist-governance.json').codelists ?? {})) {
      for (const n of [name, ...(e.aliases ?? [])]) governanceNames.add(n.toLowerCase());
    }
  }
  for (const dir of fs.readdirSync(partsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
    const where = `parts/${dir}`;
    const manifestFile = path.join(partsDir, dir, 'index.json');
    if (!fs.existsSync(manifestFile)) { fail(where, 'missing index.json'); continue; }
    const manifest = read('parts', dir, 'index.json');
    if (!check(`${where}/index.json`, validateManifest, manifest)) continue;
    if (dir !== `part${manifest.part}`) fail(`${where}/index.json`, `part "${manifest.part}" does not match the folder name`);

    const expected = new Set(['index.json', 'README.md']); // README.md: design notes, not published
    for (const id of manifest.sections) for (const kind of SECTION_KINDS) expected.add(`section${id}.${kind}.json`);
    for (const f of fs.readdirSync(path.join(partsDir, dir))) {
      if (!expected.has(f)) fail(`${where}/${f}`, 'unexpected file (not index.json and not a section file of a section listed in the manifest)');
    }

    for (const id of manifest.sections) {
      const at = `${where}/section${id}`;
      const files = {};
      let complete = true;
      for (const kind of SECTION_KINDS) {
        const p = path.join(partsDir, dir, `section${id}.${kind}.json`);
        if (!fs.existsSync(p)) { fail(`${at}.${kind}.json`, 'listed in the manifest but missing'); complete = false; } else files[kind] = read('parts', dir, `section${id}.${kind}.json`);
      }
      if (!complete) continue;
      partSections++;

      const formOk = check(`${at}.form.json`, validateForm, files.form);
      const mappingOk = check(`${at}.mapping.json`, validateMapping, files.mapping);
      let validateInstance;
      try { validateInstance = looseAjv.compile(files.schema); } catch (e) { fail(`${at}.schema.json`, `does not compile: ${e.message}`); }
      if (validateInstance) check(`${at}.example.json`, validateInstance, files.example);

      if (formOk) {
        if (files.form.part !== manifest.part) fail(`${at}.form.json`, `part is "${files.form.part}", expected "${manifest.part}"`);
        if (files.form.section !== id) fail(`${at}.form.json`, `section is "${files.form.section}", expected "${id}"`);
        if (files.form.filledBy !== manifest.filledBy) fail(`${at}.form.json`, `filledBy "${files.form.filledBy}" differs from the part's "${manifest.filledBy}"`);
        const seenPaths = new Set();
        for (const field of files.form.fields) {
          const f = `${at}.form.json field "${field.dataPath}"`;
          if (seenPaths.has(field.dataPath)) fail(f, 'dataPath appears twice');
          seenPaths.add(field.dataPath);
          if (!field.dataPath.startsWith(`part${manifest.part}.`)) fail(f, `dataPath must start with "part${manifest.part}."`);
          if (field.kind !== 'caption' && !schemaHasPath(files.schema, field.dataPath)) fail(f, `not a property of ${path.basename(at)}.schema.json`);
          if (field.uiType === 'code' && !field.codelist) fail(f, 'uiType "code" requires a codelist');
          if (field.codelist && !governanceNames.has(field.codelist.toLowerCase())) fail(f, `unknown codelist "${field.codelist}" (not in registries/codelist-governance.json)`);
          const lk = field.uiHints?.lookup;
          if (lk) {
            const def = hintsRegistry.lookups[lk.name];
            if (!def) fail(f, `unknown uiHints.lookup "${lk.name}" (not in registries/ui-hints.json)`);
            else if (lk.inputKind !== undefined && !def.reads.inputKinds.includes(lk.inputKind)) fail(f, `uiHints.lookup.inputKind "${lk.inputKind}" is not allowed for "${lk.name}" (allowed: ${def.reads.inputKinds.join(', ')})`);
          }
        }
      }
      if (mappingOk) {
        // The instance data a rule reads must exist in the section schema.
        const prefix = `part${manifest.part}.`;
        for (const r of files.mapping.rules) {
          const from = r.from ?? r.forEach;
          if (from.startsWith(prefix) && !schemaHasPath(files.schema, from)) fail(`${at}.mapping.json`, `"${from}" is not a property of ${path.basename(at)}.schema.json`);
        }
      }
    }
  }
}

// --- report ---------------------------------------------------------------
if (errors.length) {
  console.error(`Enrichment validation FAILED (${errors.length} problem${errors.length === 1 ? '' : 's'}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`Enrichment OK: ${Object.keys(REGISTRY_SCHEMAS).length} registries, ${sidecarCodes.size} sidecars, ${files.length - sidecarCodes.size} hints files, ${idOwner.size} unique semantic ids, ${partSections} administrative part sections.`);
