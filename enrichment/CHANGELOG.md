# Changelog

## Unreleased

- Initial import of the implementer-neutral enrichment sources from `espd-demo/model/model-sources/`:
  - `registries/`: `value-types.json`, `codelist-attributes.json`, `encoding-profile.json`,
    `scheme-agency-profile.json`, `roles.json` (neutral part only; display text and per-role UI
    behaviour stay in the consuming application).
  - `criteria/`: 62 `*.sidecar.json` and 3 `*.hints.json`.
- Added JSON Schemas (`schema/`) and `validate.mjs` (schema validation plus cross-file checks).
- Relative `source` paths in `value-types.json` and `codelist-attributes.json` adjusted for the new
  location (three levels up to the workspace root instead of four).
