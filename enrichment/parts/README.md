# `parts/`: the administrative parts (I, II, VI)

The model compiler generates the model layers for **criteria** (Parts III/IV/V) from the EA structure
(`espd-edm.json`). The **administrative** parts, I (procedure and buyer), II (economic operator) and VI
(signature and declaration), are not criteria: they are UBL party and document aggregates, not the
`CRITERION/QUESTION/REQUIREMENT` tree the compiler consumes. They are modelled here, by hand, for now.
The goal is to derive them from the EA model as well; these files then become the reference for what that
derivation has to produce.

They are model artifacts, not presentation: every implementation has to fill in the same Part I, II and VI,
so the schema, the UBL mapping and the form (the fields, their input types, labels and code lists) are
published together, in `ESPD-EDM/model/parts/`.

## Layout

```
parts/
  README.md           this file
  partI/              procedure and contracting authority (sections A, B, C)
  partII/             economic operator (sections A, B); the Part II criteria are compiled, see partII/README.md
  partVI/             signature and declaration (section A)
```

Each part folder has `index.json` (the manifest: header keys and the order of the sections), a `README.md`
with the design notes (not published) and, per section, four files:

| File | Content |
| --- | --- |
| `section<L>.schema.json` | instance-data JSON Schema |
| `section<L>.example.json` | a valid example; `validate.mjs` checks it against the schema |
| `section<L>.mapping.json` | instance data to UBL mapping |
| `section<L>.form.json` | the form: fields, input types, labels (i18n key plus English text), code lists |

The vocabulary of the forms is closed: `uiType` is an enum in `../schema/parts-form.schema.json`, the
`uiHints` in `../registries/ui-hints.json`.

## Conventions (as established by Part I)

- **Scope to the Schematron-mandated minimum**, then add optional fields deliberately. A field is `required`
  in the schema and the form if and only if a Schematron rule makes it fatal; warning-level and unconstrained
  fields are optional. Document the scoping choice so it is not mistaken for an omission.
- **Code lists** follow [`../docs/codelist-governance.md`](../docs/codelist-governance.md) and `registries/codelist-governance.json`:
  a code field carries a `$codelist` / `codelist` marker; small lists are inlined as an enum (with
  `$codelistEnumIsImplementerChoice` if and only if not Schematron-validated), large lists are referenced by
  name. The enums are derived from the `.gc` files and must stay in sync with them.
- **Attribute sets** on code and identifier elements come from the codelist-attribute profile
  (`registries/codelist-attributes.json`) and expand through the shared expansion step.
- **Checks.** `validate.mjs` checks the files and their cross-references (see the enrichment README). The enum
  sync with the `.gc` files is checked for every code list field by `espd-tools/model-compiler/parts-codelists.test.mjs`,
  (it needs the shipped code lists, so it runs with the compiler's tests). The tests that need a mapping engine (map and unmap round trip, UBL
  structure against `ESPD-Request-BASE.xml`, Schematron attribute sets) live with the consumer, in
  `espd-demo/model/parts-tests/`, and run against the published copy; moving them needs the mapping engine to
  move to a shared place first.
