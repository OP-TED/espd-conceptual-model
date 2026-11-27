# Part II — Information concerning the economic operator

**Part II is a hybrid**, unlike Part I. It mixes two kinds of content that are
handled by two different tracks:

- **Administrative blocks** (`type: INFORMATION`) — the economic operator's
  identity and its representatives. These are UBL party aggregates, modelled
  **here** in `enrichment/parts/partII/`. **Status: both modelled.**
- **Criteria** (`type: CRITERION`, tags `C57_OT` to `C61_OT` and `C65_OT`) — six tendering
  criteria embedded in Part II. They are modelled like the exclusion and selection criteria: one
  sidecar each in `enrichment/criteria/`, compiled by `espd-tools/model-compiler`, **not** in
  this folder. **Status: modelled** — see "Criteria track" below.

## Administrative track (modelled here)

| Section | EA | What we model | UBL target | Doc |
|---|---|---|---|---|
| **A** economic operator | `I71 info-eo` → `EconomicOperatorParty/Party` | `role`, `name`, `size`, `country`, `identifier{value, schemeAgency}` | `cac:EconomicOperatorParty` (RESPONSE) | `sectionA.*` |
| **B** power of attorney | `I72 info-poa` → `PowerOfAttorney/AgentParty` | `powersOfAttorney[]{ description?, agent{name, identifier?, country?} }` | `cac:EconomicOperatorParty/cac:Party/cac:PowerOfAttorney` | `sectionB.*` |

### Section A — grounded in Schematron (BR-RESP-10, all error-level)
Every field is mandated: `role` (10-02/03), `identifier` (10-04), `name`
(10-05), `size` (10-06), `country` (10-07). Codelists: `eo-role-type` (5) and
`economic-operator-size` (5) are small+validated, so **inlined** as enums
(marker false — validated); `country` (341) is referenced by name. See
`registries/codelist-governance.json`.

### Section B — NOT grounded (caveat)
No Schematron rule and no `ESPD-Request/Response-BASE.xml` instance constrain or
exemplify `PowerOfAttorney`/`AgentParty`. The shape is derived from the EA `I72`
model and UBL 2.4 `PowerOfAttorneyType` (`Description` optional, `AgentParty`
mandatory). Fields are modelled as what UBL allows, all optional except an agent
`name`. **REVIEW against a real instance** when one is available — the same
situation Part I §A was in before a sample was supplied.

## Criteria track (modelled as sidecars, not here)

The criteria embedded in Part II are modelled as `enrichment/criteria/ot-<id>.sidecar.json` and
compiled by `espd-tools/model-compiler`. They are keyed `ot-<id>` so that their published identity
stays stable when EA renames a code (see the enrichment README). Their EA tags are `C<n>_OT`
(earlier `OT<n>`), and the EA codes in the table are the current ones:

| Section | Tag | EA code | Sidecar | Subject |
|---|---|---|---|---|
| A | `C57_OT` | `shelt-worksh` | `ot-sheltered-workshop` | the economic operator is a sheltered workshop |
| A | `C58_OT` | `registered` | `ot-registered-official-list` | registration in a pre-qualification system |
| A | `C59_OT` | `eo-group` | `ot-group-participation` | the economic operator takes part together with others |
| A | `C65_OT` | `sme` | `ot-eo-size` | micro, small or medium-sized enterprise |
| C | `C60_OT` | `relied` | `ot-relied-on-entities` | relied-on entities |
| D | `C61_OT` | `subco-ent` | `ot-subcontractors` | subcontracted entities |

Part V has one more criterion of this kind: `C63_OT` (`staff-red`, reduction of the number of
qualified candidates), sidecar `ot-reduction-of-candidates`. Part II section B is administrative and
has no criterion.

## Deferred (administrative, optional)

- Section A optional party fields the EA model carries but no Schematron rule
  requires: postal address (street/city/zone/building), contact
  (name/phone/email/fax), `WebsiteURI`, and the `QualifyingParty` /
  `IndustryClassificationCode` sub-party. (Same category as the optional buyer fields in Part I section B.)
- Section B optional agent address/contact fields.

## Upstream data-quality nits

- `I71 info-eo` description reads `"I70_info-eo"` (wrong section ref).
- `cbc:Electronicmail` (I71) and `cbc:ElectronicaMail` (I72) — two misspellings
  of `cbc:ElectronicMail`. No impact on us (we map the correct element).
