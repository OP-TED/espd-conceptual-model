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

- the administrative parts (I, II, VI): per section the instance-data schema, an example, the UBL
  mapping and the form (the fields, their input types, labels and code lists). They are not criteria,
  so the compiler cannot derive them from the EA structure. They are hand-authored for now, with the
  goal of deriving them from the EA model (see `parts/` below)
- the vocabulary of form affordances (`registries/ui-hints.json`, `uiType` in `schema/parts-form.schema.json`)

Does **not** belong here: choices of one particular application.

- form layout of the criteria, group names, wizard order, i18n keys and label text for criteria
- which Parts a given UI shows or lets a user edit per role

Those stay in the consuming application (for the demo: `espd-demo/model/model-sources`
`form-profile.json`, `role-ui.json` and `*.presentation.json`).

## Layout

| Path | Content |
| --- | --- |
| `registries/value-types.json` | JSON shape and UBL value bindings per value type |
| `registries/encoding-profile.json` | kind to UBL element scaffold |
| `registries/codelist-attributes.json` | fixed attribute sets per codelist (mirrors the Schematron) |
| `registries/scheme-agency-profile.json` | `@schemeAgencyID` derivation policy |
| `registries/roles.json` | buyer types and EO roles, exclusion dispositions, UBL role mapping |
| `registries/codelist-governance.json` | per codelist: its `.gc` file (present = shipped), aliases, whether the Schematron/CVA enforces it, whether the model inlines it as an enum, `excludedCodes`, `externalSource` |
| `registries/ui-hints.json` | the closed vocabulary of form affordances (for example the TED notice lookup) a part form field may use in `uiHints` |
| `parts/<part>/index.json` | manifest of an administrative part (I, II, VI): header keys and the order of its sections |
| `parts/README.md`, `parts/<part>/README.md` | conventions and design notes of the parts (not published) |
| `parts/<part>/section<L>.schema.json` | instance-data schema of the section |
| `parts/<part>/section<L>.example.json` | an example instance; validated against the schema |
| `parts/<part>/section<L>.mapping.json` | instance data to UBL mapping of the section |
| `parts/<part>/section<L>.form.json` | the form: fields, input types, labels (i18n key plus English text), code lists |
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
consistent with its declared categories and dispositions. For the parts it checks: the manifest and
every section file validate; the files on disk are exactly those the manifest lists; each example
validates against its section schema; every form `dataPath` and mapping `from` is a property of that
schema; every form code list is known to `codelist-governance.json`; and every `uiHints.lookup` is in
`ui-hints.json` with an allowed input kind. Round-trip, Schematron and enum-sync tests need the mapping
engine and the code lists, so they stay with the consumers.

The model compiler publishes the parts verbatim to `ESPD-EDM/model/parts` (and `ui-hints.json` to
`model/registries`), after checking that each part is complete, each section identifies itself and each
example validates against its schema. They are also covered by the enrichment hash in the envelope. The demo vendors the published
parts (`npm run model:sync`) and no longer keeps its own copy: change them here only.

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
