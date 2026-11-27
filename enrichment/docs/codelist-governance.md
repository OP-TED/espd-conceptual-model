# Codelist governance: sources of truth and how the model treats each list

This page records, per codelist, **where its authority lives** and **how the model and the
implementations that use it are expected to treat it**. The ESPD-EDM documentation, the shipped `.gc`
files, the Schematron/CVA and the model all have to agree, and this is where that agreement is written
down.

The machine-readable form is [`../registries/codelist-governance.json`](../registries/codelist-governance.json),
published with the model in `ESPD-EDM/model/registries`. This page explains the axes and records the
decisions behind its values.

> **Status: team assessment.** The decisions for the five lists in "Per-codelist decisions" reflect the
> current assessment of the ESPD team. The lists beyond those five are recorded from what the repositories
> show (shipped files, the CVA) and are pending review; the registry flags each with a note.

## Sources

Four sources touch codelists, with different authority:

| Source | What it is | Authority |
|---|---|---|
| **ESPD-EDM documentation** | [code-lists page](https://docs.acceptance.ted.europa.eu/ESPD-EDM/latest/technical/code-lists.html): the human-readable catalogue of which lists ESPD ships | states intent: which lists exist and their role |
| **`ESPD-EDM/codelists/*.gc`** | the shipped Genericode files (codes and 24-language labels) | the **values** a shipped list provides |
| **Schematron and CVA** | `espd-validation-schematron`: XML-layer validation | the **enforced** value set, when a list is validated |
| **The model** | the published instance-data schemas and mappings (`ESPD-EDM/model`) | how a list is **used**: enum or reference by name |

## The axes

Every codelist is characterised by independent yes/no properties, each owned by a different concern. Do
**not** infer one from another:

1. **Shipped in ESPD-EDM**: is there a `.gc` under `ESPD-EDM/codelists/`? A property of ESPD-EDM. In the
   registry it is not stored: a list is shipped when its entry names its `.gc`.
2. **Validated in Schematron** (`schematronValidated`): does the CVA/Schematron enforce the value set at
   the XML interchange layer? A property of the standard, set by ESPD governance; the registry only reads
   it, and a test compares it with the CVA.
3. **Inlined as an enum** (`inlineEnum`): does the instance-data schema carry the values as an `enum`, or
   only reference the list by name? A decision of the model.
4. **Offered in a user interface.** A decision of each application, so it is **not** in this registry.
   (The reference implementation `espd-demo` records it in its own `ui-codelists.json`.)

### The axes are independent: all combinations are legitimate

An earlier draft of this page claimed that inlining and validation were inversely coupled ("inline if and
only if not validated"). That was wrong: it over-generalised from a sample of five lists.
`docrefcontent-type` and `eoid-type` are **both validated and inlined**. The two axes answer different
questions:

- **Validated** = "does the *standard* enforce this set at the XML layer?", a governance property read
  from the CVA.
- **Inlined** = "does the *schema* carry the values, for authoring and UI convenience?", driven mainly by
  size and stability: small, stable lists are convenient to inline, large lists are referenced by name.

All four combinations occur (sizes as of writing):

| | inlined = yes | inlined = no |
|---|---|---|
| **validated = yes** | `docrefcontent-type` (10), `eoid-type` (5): small closed lists, inlined for authoring feedback *and* enforced at the XML layer | `country` (341), `occupation` (4046): validated but too large to inline, referenced by name |
| **validated = no** | `financial-ratio-type` (40), `boolean-gui-control-type` (6): a suggested set, inlined as an implementer choice | a large *suggested* list would land here: referenced by name, no XML enforcement |

**The one real coupling** is narrow and about *labelling*, not about *whether* to inline: an inlined enum
is an **implementer choice** (`$codelistEnumIsImplementerChoice`) if and only if the list is *not*
validated. When a list is both validated and inlined, the inlined values are the standard's enforced set,
so the marker is false.

> **"Shipped but not Schematron-validated"** carries a distinct meaning the team stated explicitly: *we
> suggest these values, but implementers may use others.* That is a property of validation, independent of
> whether the model also inlines the list.

## Per-codelist decisions (team assessment)

| Codelist | Shipped | Schematron-validated | Use for UI | Inline as enum | Source |
|---|:---:|:---:|:---:|:---:|---|
| `country` | yes | **yes** | yes | **no** | [doc](https://docs.acceptance.ted.europa.eu/ESPD-EDM/latest/technical/code-lists.html#country-table) |
| `occupation` | yes | **yes** | yes | **no** | [doc](https://docs.acceptance.ted.europa.eu/ESPD-EDM/latest/technical/code-lists.html#occupation-table) |
| `financial-ratio-type` | yes | **no** | yes | **yes** | [doc](https://docs.acceptance.ted.europa.eu/ESPD-EDM/latest/technical/code-lists.html#financial-ratio-type-table) |
| `boolean-gui-control-type` | yes | **no** | yes | **yes** | [doc](https://docs.acceptance.ted.europa.eu/ESPD-EDM/latest/technical/code-lists.html#boolean-gui-control-type-table) |
| `procurement-procedure-type` | **no** | no | yes | **yes** | [OP dataset](https://op.europa.eu/en/web/eu-vocabularies/dataset/-/resource?uri=http://publications.europa.eu/resource/dataset/procurement-procedure-type), [issue #308](https://github.com/OP-TED/ESPD-EDM/issues/308) |

"Use for UI" is the team's view of whether a pick list makes sense; it is applied by each application.

Verified against the repositories at the time of writing: `country` and `occupation` have CVA contexts;
`financial-ratio-type` and `boolean-gui-control-type` do not; `procurement-procedure-type` has no `.gc`
shipped.

The remaining shipped lists are recorded in the registry from what the repositories show (pending team
review). Two of them are **both validated and inlined**, the counterexamples to the discarded coupling:

| Codelist | Shipped | Validated | Use for UI | Inlined | Note |
|---|:---:|:---:|:---:|:---:|---|
| `docrefcontent-type` | yes | **yes** | yes | **yes** | Part I section A; small closed list, inlined for authoring and enforced at XML |
| `eoid-type` | yes | **yes** | yes | **yes** | Part I section B; same validated and inlined case |
| `currency` | yes | yes | yes | no | about 290 codes, reference by name |
| `eo-role-type` | yes | yes | yes | yes | 5 codes, inlined in Part II section A |
| `economic-operator-size` | yes | yes | yes | yes | 5 codes, inlined in Part II section A |
| `access-right`, `language` | yes | yes | yes | no | validated; not used by a modelled field yet |
| `criterion-element-type`, `property-group-type`, `response-data-type`, `profile-execution-id`, `selection-criterion`, `exclusion-ground` | yes | yes | **no** | no | internal and structural codes, not user pickers |

The registry is the authoritative record for all of these; this table can lag behind it.

### Notes and open points

- **`procurement-procedure-type` is the special case.** It is not shipped (tracked upstream as
  [ESPD-EDM issue #308](https://github.com/OP-TED/ESPD-EDM/issues/308)), yet it is needed for the user
  interface and the registry records the intent to inline it. Until a `.gc` ships, the enum cannot be
  derived from a shipped source: the field in the Part I section C schema carries the list by name, and the
  values come from the [OP dataset](https://op.europa.eu/en/web/eu-vocabularies/dataset/-/resource?uri=http://publications.europa.eu/resource/dataset/procurement-procedure-type)
  (`externalSource` in the registry). The enum check for the parts accepts this case, and only this case.
- **"Shipped but not validated" is a deliberate category**, not an oversight, for `financial-ratio-type` and
  `boolean-gui-control-type`. They are intentionally unvalidated because the values are suggestions.
  Adding them to the Schematron would turn a *suggested* list into an *enforced* one, contradicting the
  team's "implementers may use others" statement. Keep them unvalidated unless the team deliberately makes
  them authoritative.
- **Whether `boolean-gui-control-type` belongs in the exchanged data at all** is a separate modelling
  question, orthogonal to how it is validated or inlined.
- **The lists beyond the team's five are ground truth from the repositories, pending review.** Their
  `inlineEnum` values are the current best assessment, not a team decision yet.

## How the model uses the registry

The registry is **data**, hand-authored because the decisions are governance and not derivable. What is
checked, and where:

- **Schema and internal consistency**: `enrichment/validate.mjs` (every list has a `gc` or an
  `externalSource`, `excludedCodes` need a shipped list, no two entries claim the same name or alias).
- **Against the shipped files and the Schematron**: `espd-tools/model-compiler/codelist-governance.test.mjs`
  (every `gc` exists, every shipped `.gc` has an entry, `excludedCodes` are real codes,
  `schematronValidated` matches the CVA, every list a value type or criterion leaf uses has an entry, and
  `inlineEnum` matches what the compiler publishes).
- **The administrative parts**: `espd-tools/model-compiler/parts-codelists.test.mjs`. Every part field that
  names a list agrees with the registry: an inlined enum equals the `.gc` codes minus `excludedCodes`, the
  list is shipped and inlined, and `$codelistEnumIsImplementerChoice` follows the coupling above.

Two things about the compiler are still open (see the TODOs in the enrichment README):

- The compiler decides inlining by a **size gate** (a shipped list with at most 60 codes,
  `MAX_INLINE_ENUM` in `generate-instance-schema.mjs`), not by reading the registry. The registry records
  that outcome and the test above checks it. Making `inlineEnum` the input of the decision, so that a
  deliberate choice for a borderline list can be recorded, would change nothing for today's lists.
- The compiler marks **every** inlined enum `$codelistEnumIsImplementerChoice`, whereas the rule above says
  only an unvalidated one should carry it. Changing that alters published instance-data schemas, so it is a
  decision for the ESPD-EDM owners. The administrative parts already follow the rule.
