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

// --- report ---------------------------------------------------------------
if (errors.length) {
  console.error(`Enrichment validation FAILED (${errors.length} problem${errors.length === 1 ? '' : 's'}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`Enrichment OK: ${Object.keys(REGISTRY_SCHEMAS).length} registries, ${sidecarCodes.size} sidecars, ${files.length - sidecarCodes.size} hints files, ${idOwner.size} unique semantic ids.`);
