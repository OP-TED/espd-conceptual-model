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

The model compiler (`espd-tools/model-compiler`) joins the
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
| `registries/codelist-governance.json` | per codelist: its `.gc` file (present = shipped), aliases, whether the Schematron/CVA enforces it, whether the model inlines it as an enum, `excludedCodes`, `externalSource` |
| `criteria/<code>.sidecar.json` | semantic ids and instance bindings for one criterion (a criterion is modelled when it has one) |
| `criteria/<code>.hints.json` | optional constraints on the generated instance-data schema |
| `schema/*.schema.json` | JSON Schema for each of the above |
| `validate.mjs` | schema validation plus cross-file checks |

Criterion files are named after the criterion's EA code, except the Part II/V "other" criteria,
which are named `ot-<id>` (for example `ot-eo-size`) and must carry their EA `tag` (for example
`C65_OT`). The file name is the criterion's output identity, the key of every published file.
EA now gives these criteria their own codes (for example `sme`); the `ot-<id>` names are kept so
that the published identities stay stable when EA renames a code.

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

This is the only home of these sources. `espd-demo` used to keep its own copies; it now consumes the
published model (`ESPD-EDM/model`, compiled from this folder by `espd-tools/model-compiler`) and holds
only its own presentation inputs. When the model changes here, the demo picks it up by re-syncing
(`npm run model:sync`); its English i18n catalogues, whose keys derive from the EA codes and paths,
may need matching entries (a test in the demo lists any that are missing).

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
- **Codelist governance: split done, two follow-ups.** The neutral facts are `registries/codelist-governance.json`
  (`shipped` is derived from `gc`; `useForUI` stays in each application). TODO: derive `schematronValidated` from the CVA
  instead of keeping it by hand (a test in espd-tools checks it today). TODO: the compiler marks every inlined enum
  `$codelistEnumIsImplementerChoice`, but per the governance axes only an unvalidated one should carry it; decide whether the
  compiler should read this registry to set it (that changes published schemas).
- **TODO: ESPD-EDM's Checks workflow should verify the published model.** It runs on the commit the export workflow pushes
  but is not on the 5.0.0 branches. Add `node verify.mjs --model model --edm criterion/espd-edm.json` (espd-tools/model-compiler)
  there: it checks the envelope against its schema, that every listed file exists, that nothing stray or hand-edited lingers, and that
  the model was built from the structure file in the same commit.
