# Changelog

## Unreleased

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
