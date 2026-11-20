# ESPD model enrichment

Text companion to the Enterprise Architect model in `../conceptual-model/ESPD_CM.eapx`.

The EA model is the source of truth for the **structure** of the ESPD (parts, sections,
criteria, cardinality, conditions). It exports to `espd-edm.json` and the code lists
(see `espd-tools/EAtoJSON`). That structure is not enough to implement an ESPD service: it has
no stable business identity per node, no instance-data shape, no value types and no UBL value
bindings. This folder holds that missing layer as reviewable, mergeable JSON.

```
EA model (ESPD_CM.eapx)  --export-->  espd-edm.json  --+
                                                       +--> model compiler --> ESPD-EDM/model/
enrichment/ (this folder)  ----------------------------+
```

The model compiler (currently in `espd-demo/model/compiler`, moving to `espd-tools`) joins the
two inputs and gates on structural equivalence, so enrichment that drifts from a changed EA
structure fails the build instead of silently diverging.

## Why JSON next to a binary model

The `.eapx` is a binary file: it cannot be diffed or merged, and it changes rarely and for
legal or modelling reasons. The enrichment changes more often, is edited in an IDE, and wants
line-level review and blame. So it is kept as plain JSON files with their own JSON Schemas and
validation. The folder is self-contained (no references into the model folder) so that it can
be split out into its own repository later without changes.

## What belongs here, and what does not

Belongs here: facts that are true of the ESPD **regardless of who implements it**.

- stable semantic ids per structural node, and where each value lives in the instance data
- value types: JSON shape and UBL value binding per `ValueDataTypeCode`
- the XML encoding profile, codelist attribute sets, scheme-agency policy
- role facts: role ids, document type, exclusion-ground dispositions, UBL role mapping
- constraints on the instance-data schema that the EA model cannot express

Does **not** belong here: choices of one particular application.

- form layout, `uiType`, i18n keys and label text, group names, wizard order
- which Parts a given UI shows or lets a user edit per role
- UI affordances such as the TED notice lookup

Those stay in the consuming application (for the demo: `espd-demo/model/model-sources`
`form-profile.json`, `ui-hints.json`, `role-ui.json` and `*.presentation.json`).

## Layout

| Path | Content |
| --- | --- |
| `registries/value-types.json` | JSON shape and UBL value bindings per value type |
| `registries/encoding-profile.json` | kind to UBL element scaffold |
| `registries/codelist-attributes.json` | fixed attribute sets per codelist (mirrors the Schematron) |
| `registries/scheme-agency-profile.json` | `@schemeAgencyID` derivation policy |
| `registries/roles.json` | buyer types and EO roles, exclusion dispositions, UBL role mapping |
| `criteria/<code>.sidecar.json` | semantic ids and instance bindings for one criterion (a criterion is modelled when it has one) |
| `criteria/<code>.hints.json` | optional constraints on the generated instance-data schema |
| `schema/*.schema.json` | JSON Schema for each of the above |
| `validate.mjs` | schema validation plus cross-file checks |

Criterion files are named after the criterion's EA code, except the generic Part II/V `OT`
criteria, which are named `ot-<id>` and carry their EA `tag` (for example `OT65`).

## Validating

```
cd enrichment
npm ci
npm run validate
```

Besides the schemas, it checks: no unexpected files, file name matches the criterion, every
hints file has a sidecar, semantic ids are unique across all sidecars, and `roles.json` is
consistent with its declared categories and dispositions.

## Status of this folder

This is the canonical home going forward. During the transition the demo still reads its own
copies under `espd-demo/model/model-sources/` (its compiler has not moved yet), so changes to the
files listed above must currently be made in **both** places. The demo's copies are removed when
the compiler moves to `espd-tools` and the demo consumes the published model.

The `source` paths inside `registries/value-types.json` and `registries/codelist-attributes.json`
are relative to this folder and assume the sibling-checkout layout (`ESPD-EDM`,
`espd-validation-schematron` next to this repository). They are meant to become explicit inputs
of the compiler.

## Versioning

`CHANGELOG.md` tracks changes. Versions are meant to follow the ESPD-EDM release the
enrichment belongs to. The published `ESPD-EDM/model` envelope will record the structure
version and the enrichment version it was built from.

## Open TODOs

- **`codelist-attributes.json` duplicates the Schematron.** Its attribute sets are copied
  verbatim from `espd-validation-schematron/common/sch/01-ESPD-common-cl-attributes.sch`. Generate
  one from the other so they cannot drift.
- **Review `scheme-agency-profile.json`.** The agency choices, especially the default `OP` for
  identifiers without a scheme field, are a pragmatic policy that satisfies BR-OTH-02. Have the
  ESPD profile owners confirm them before they are treated as normative.
- **Review `roles.json` dispositions.** Every exclusion category is currently `mandatory` for both
  buyer types, although Art. 80(1) of Directive 2014/25/EU makes some of them conditional for
  contracting entities (utilities).
- **The instance-data shape becomes a published contract.** The `instanceBinding.path` values
  define the canonical instance JSON shape. Once the compiled model is published, that shape is
  shared by all implementers.
- **Codelist governance.** `espd-demo/model/codelists/governance.json` mixes facts that belong
  upstream (`excludedCodes`, `inlineEnum` for published schemas) with UI choices (`useForUI`) and
  values that can be derived (`shipped`, `schematronValidated`). To be classified and split.
