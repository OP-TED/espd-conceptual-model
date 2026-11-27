# Changelog

## Unreleased

- Added `docs/codelist-governance.md`, moved here from `espd-demo/docs` and made implementation-neutral: the registry it
  explains lives here and is published with the model. The outdated proposal and migration sections and the pointers to a
  private notes repository are gone. The enum sync of the administrative parts is now checked by
  `espd-tools/model-compiler/parts-codelists.test.mjs` (every `$codelist` field against its `.gc` and the registry).

- `validate.mjs`: reports a key that appears twice in one JSON object; the path check for part forms and mappings follows
  `allOf`, `anyOf`, `oneOf`, `if`, `then` and `else`, not only `$ref`. Both checks are in `checks.mjs` with tests (`npm test`).
- Workflows: the export records the resolved espd-tools commit in `sourceRef`; `edm_branch` takes a plain branch name
  (`refs/...` is rejected, so the concurrency group is exact); `validate-enrichment.yml` runs on push only for `main`,
  `develop` and `release/**` (a pull request already runs it per commit) and also runs `npm test`.

- Documentation cleanup, so the sources read correctly outside the original working setup: the Part II README now describes the `OT` criteria as modelled (sidecars with their current `C<n>_OT` tags); pointers to a private notes repository and to `espd-demo` paths that no longer exist were removed or reworded (part READMEs, registry and sidecar comments, part manifests);
  stale `OT<n>` tags in comments follow the current ones. Comments only: the published instance-data schemas, mappings and
  compiled criteria are unchanged.

- Registry status: `roles.json` and `scheme-agency-profile.json` carry `status` and `statusNote`. The role
  dispositions are `confirmed` (all exclusion categories mandatory for both buyer types, confirmed by the ESPD team);
  the scheme-agency policy is `provisional` until the ESPD profile owners confirm it. `validate.mjs` requires a note on
  a provisional registry. The README of the published model lists the provisional registries.

- Added the administrative parts (I, II, VI) under `parts/`, copied from `espd-demo/model/parts`: per section the
  instance-data schema, example, UBL mapping and form, plus a manifest per part. Added `registries/ui-hints.json`
  (from `espd-demo/model/model-sources/registries`), the form vocabulary (`uiType`) and schemas for all of them
  (`ui-hints`, `parts-manifest`, `parts-form`, `parts-mapping`). `validate.mjs` checks them and their cross-references.
  Published by the model compiler to `ESPD-EDM/model/parts` and `model/registries/ui-hints.json`; `espd-demo` vendors them
  and has dropped its own copy (it keeps only the tests). The design notes of each part moved here as `README.md`.
  The goal is to derive them from the EA model.

- Added `registries/codelist-governance.json` (with schema and validator rules): the implementer-neutral part of the
  codelist governance previously kept in `espd-demo/model/codelists/governance.json`. `shipped` is derived from `gc`;
  `useForUI` stays with the application. Published in `ESPD-EDM/model/registries`.

- Realigned with the current EA model (the export changed after the initial import):
  - The seven Part II/V "other" criteria now have their own EA codes and tags
    (`OT65`/`OT` is now `C65_OT`/`sme`, and likewise `shelt-worksh`, `registered`, `eo-group`,
    `relied`, `subco-ent`, `staff-red`). Their sidecars follow; the file names (`ot-<id>`), semantic
    ids and instance keys are unchanged, so the published instance-data schemas are unchanged.
  - `exg-mis-exg-mis-misconduct` is now `exg-mis-misconduct` in EA. The sidecar, its code and its
    semantic ids were renamed accordingly (this changes that criterion's instance key and ids).
  - `slc-suit-auth-mbrshp`: EA added a free-text question "Reasons why you are not registered" (shown
    when the economic operator is not registered). Bound as `slc-suit-auth-mbrshp.not-registered-reasons`
    (`notRegisteredReasons`).
  - `validate.mjs` now accepts a file name that is either the criterion code or `ot-<id>` (with a tag).

- Initial import of the implementer-neutral enrichment sources from `espd-demo/model/model-sources/`:
  - `registries/`: `value-types.json`, `codelist-attributes.json`, `encoding-profile.json`,
    `scheme-agency-profile.json`, `roles.json` (neutral part only; display text and per-role UI
    behaviour stay in the consuming application).
  - `criteria/`: 62 `*.sidecar.json` and 3 `*.hints.json`.
- Added JSON Schemas (`schema/`) and `validate.mjs` (schema validation plus cross-file checks).
- Relative `source` paths in `value-types.json` and `codelist-attributes.json` adjusted for the new
  location (three levels up to the workspace root instead of four).
