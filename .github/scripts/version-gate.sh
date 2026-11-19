#!/usr/bin/env bash
#
# Version gates for the ESPD-EDM export.
#
# All of the checks the export workflow runs live here rather than inline in
# the YAML, so they can be read in one place, reviewed as code, and run by hand
# before dispatching a release export.
#
# Usage:
#   version-gate.sh resolve         Work out which version this run is building
#   version-gate.sh self-test       Run the exporter's own gate tests
#   version-gate.sh check-model     Check the versions declared in the EA model
#   version-gate.sh verify-output   Check the freshly exported code lists
#   version-gate.sh verify-edm      Check the ESPD-EDM tree before committing
#   version-gate.sh copy-validation    Copy the validation files into ESPD-EDM
#   version-gate.sh verify-validation  Check the published validation files
#   version-gate.sh all-local       resolve + self-test + check-model (no export)
#
# Paths default to the layout the workflow checks out at the workspace root:
#
#   conceptual-model/   this repository
#   espd-tools/         the exporter
#   espd-edm/           the publication target
#
# Override them with environment variables to run against a local clone layout:
#
#   MODEL_FILE=../espd-conceptual-model/conceptual-model/ESPD_CM.eapx \
#   EXPORTER_DIR=../espd-tools/EAtoJSON \
#   EXPECTED_VERSION=5.0.0 \
#     bash version-gate.sh check-model
#
# Exit codes: 0 pass, 1 fail. Any failure is meant to stop the workflow before
# anything reaches ESPD-EDM.

set -euo pipefail

# major.minor.patch with an optional pre-release tail. Kept in step with the
# pattern the exporter enforces, so a version the model accepts is a version
# this gate accepts.
readonly SEMVER_PATTERN='^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$'

EXPORTER_DIR="${EXPORTER_DIR:-espd-tools/EAtoJSON}"
MODEL_FILE="${MODEL_FILE:-conceptual-model/conceptual-model/ESPD_CM.eapx}"
OUTPUT_DIR="${OUTPUT_DIR:-espd-tools/EAtoJSON/outputs/code-lists}"
EDM_DIR="${EDM_DIR:-espd-edm}"
SCHEMATRON_DIR="${SCHEMATRON_DIR:-espd-validation-schematron}"

# The validation artefacts ESPD-EDM publishes, as "folder:file pattern". This is
# exactly the layout ESPD-EDM/validation/README.md documents, and the single
# place it is defined: the publication workflow copies these and nothing else,
# and verify-validation checks these and nothing else.
#
# The same folder name is used on both sides, so espd-validation-schematron's
# ESPDRequest/xsl lands in ESPD-EDM's validation/ESPDRequest/xsl. Libraries,
# sample XML, XSD and the generic common/xsl tooling stay in the schematron
# repository. Each folder is filtered by its pattern, which keeps the
# ESPD-criterion.xml and criterionList.xml pipeline inputs out of the xsl
# folders.
readonly VALIDATION_SETS=(
  'common/cva:*.cva'
  'common/sch:*.sch'
  'ESPDRequest/sch:*.sch'
  'ESPDRequest/xsl:*.xsl'
  'ESPDResponse/sch:*.sch'
  'ESPDResponse/xsl:*.xsl'
)

# Set by "resolve", consumed by the checks. Empty means "no release version to
# enforce", which is the normal case on a feature branch.
EXPECTED_VERSION="${EXPECTED_VERSION:-}"

# ---------------------------------------------------------------------------
# Output helpers. The ::error:: / ::notice:: prefixes are GitHub Actions
# annotations; they are harmless noise when the script is run by hand.
# ---------------------------------------------------------------------------

info () { printf '%s\n' "$*"; }
notice () { printf '::notice::%s\n' "$*"; }
fail () { printf '::error::%s\n' "$*" >&2; exit 1; }

require_file () {
  [[ -f "$1" ]] || fail "$2 was not found at \"$1\". Set ${3} to point at it."
}

require_dir () {
  [[ -d "$1" ]] || fail "$2 was not found at \"$1\". Set ${3} to point at it."
}

# Absolute paths, so the checks can cd into the exporter without losing track of
# the model and the output folders. Only ever called on a path that has already
# been checked to exist, so a missing path is reported as the value the caller
# supplied rather than as a bare "cd: no such file or directory".
absolute () {
  local path="$1"
  if [[ -d "${path}" ]]; then
    (cd "${path}" && pwd)
  else
    printf '%s/%s\n' "$(cd "$(dirname "${path}")" && pwd)" "$(basename "${path}")"
  fi
}

validate_version () {
  local version="$1" origin="$2"
  [[ "${version}" =~ ${SEMVER_PATTERN} ]] ||
    fail "Expected version \"${version}\" (from ${origin}) is not a major.minor.patch version."
}

# Builds the --expect-version argument list, empty when there is nothing to
# enforce. Returned as an array so no value is ever word-split by the shell.
expect_args () {
  if [[ -n "${EXPECTED_VERSION}" ]]; then
    validate_version "${EXPECTED_VERSION}" 'EXPECTED_VERSION'
    EXPECT_ARGS=(--expect-version "${EXPECTED_VERSION}")
  else
    EXPECT_ARGS=()
  fi
}

run_exporter () {
  local exporter
  require_dir "${EXPORTER_DIR}" 'The exporter (EAtoJSON)' 'EXPORTER_DIR'
  exporter="$(absolute "${EXPORTER_DIR}")"
  ( cd "${exporter}" && "$@" )
}

# ---------------------------------------------------------------------------
# resolve - decide which version this run is building
#
# Derived from a release/X.Y.Z branch name so a release export cannot disagree
# with the branch it was dispatched from, and overridable for runs from a
# feature branch. Validated before it is used anywhere: the input is
# user-supplied and ends up on a command line.
# ---------------------------------------------------------------------------

cmd_resolve () {
  local run_branch="${RUN_BRANCH:-}"
  local supplied="${INPUT_EXPECTED_VERSION:-}"
  local expected='' origin=''

  if [[ -n "${supplied}" ]]; then
    expected="${supplied}"
    origin='workflow input'
  elif [[ "${run_branch}" =~ ^release/(.+)$ ]]; then
    expected="${BASH_REMATCH[1]}"
    origin="branch name ${run_branch}"
  fi

  if [[ -n "${expected}" ]]; then
    validate_version "${expected}" "${origin}"
    info "Expecting ESPD version ${expected} (from ${origin})"
  else
    notice "No release version to enforce (branch \"${run_branch}\" is not release/X.Y.Z and no version was supplied); the model is still checked for internal consistency."
  fi

  # Hand the value to the later steps when running under Actions.
  if [[ -n "${GITHUB_ENV:-}" ]]; then
    printf 'EXPECTED_VERSION=%s\n' "${expected}" >> "${GITHUB_ENV}"
  fi
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    printf 'expected=%s\n' "${expected}" >> "${GITHUB_OUTPUT}"
  fi

  # So the value is visible when the script is run by hand.
  printf 'EXPECTED_VERSION=%s\n' "${expected}"
}

# ---------------------------------------------------------------------------
# self-test - the gates are only worth their exit codes if they work
# ---------------------------------------------------------------------------

cmd_self_test () {
  info '--- Exporter gate tests ---'
  run_exporter npm test
}

# ---------------------------------------------------------------------------
# check-model - the versions declared inside the EA model
#
# Runs before anything is written. This is the check that catches a
# codelists.json about to go out as 5.0.0-alpha.2 while every code list in the
# same model declares 5.0.0.
# ---------------------------------------------------------------------------

cmd_check_model () {
  local model
  require_file "${MODEL_FILE}" 'The EA model' 'MODEL_FILE'
  model="$(absolute "${MODEL_FILE}")"
  expect_args

  info '--- Model versions ---'
  run_exporter node export.js check-versions "${model}" "${EXPECT_ARGS[@]+${EXPECT_ARGS[@]}}"
}

# ---------------------------------------------------------------------------
# verify-output - the generated files, read as a consumer would read them
# ---------------------------------------------------------------------------

cmd_verify_output () {
  local output
  require_dir "${OUTPUT_DIR}" 'The export output folder' 'OUTPUT_DIR'
  output="$(absolute "${OUTPUT_DIR}")"
  expect_args

  info '--- Exported code lists ---'
  run_exporter node export.js verify-export "${output}" "${EXPECT_ARGS[@]+${EXPECT_ARGS[@]}}"
}

# ---------------------------------------------------------------------------
# verify-edm - the last gate before the push
#
# The files exactly as they will be committed, in their ESPD-EDM layout, with
# ublVersion cross-checked against the UBL schemas actually shipped. Catches a
# stale .gc left behind from an earlier release, which the copy step would not.
# ---------------------------------------------------------------------------

cmd_verify_edm () {
  local edm codelists schemas
  require_dir "${EDM_DIR}" 'The ESPD-EDM checkout' 'EDM_DIR'
  edm="$(absolute "${EDM_DIR}")"
  codelists="${edm}/codelists"
  schemas="${edm}/schemas/schemas.json"
  require_dir "${codelists}" 'The ESPD-EDM codelists folder' 'EDM_DIR'
  require_file "${schemas}" 'The ESPD-EDM schemas index' 'EDM_DIR'
  expect_args

  info '--- ESPD-EDM working tree ---'
  run_exporter node export.js verify-export "${codelists}" \
    --schemas "${schemas}" "${EXPECT_ARGS[@]+${EXPECT_ARGS[@]}}"
}

# ---------------------------------------------------------------------------
# Validation files - copy-validation and verify-validation
#
# Both read VALIDATION_SETS, so the list of published folders cannot drift
# between what is copied and what is checked. Deliberately free of Node and of
# the exporter, so the validation publication workflow needs neither.
# ---------------------------------------------------------------------------

# Names of the files in a folder matching a pattern, one per line, sorted.
list_matching () {
  local dir="$1" pattern="$2"
  find "${dir}" -maxdepth 1 -type f -name "${pattern}" -printf '%f\n' | LC_ALL=C sort
}

cmd_copy_validation () {
  local entry folder pattern source target count
  require_dir "${SCHEMATRON_DIR}" 'The espd-validation-schematron checkout' 'SCHEMATRON_DIR'
  require_dir "${EDM_DIR}" 'The ESPD-EDM checkout' 'EDM_DIR'

  info '--- Copying validation files ---'

  # Every source folder is checked before anything in ESPD-EDM is touched, so a
  # bad ref fails without leaving a half-cleared validation tree behind.
  for entry in "${VALIDATION_SETS[@]}"; do
    folder="${entry%%:*}"
    pattern="${entry#*:}"
    source="${SCHEMATRON_DIR}/${folder}"
    [[ -d "${source}" ]] || fail "${source} does not exist in the schematron checkout."
    [[ -n "$(list_matching "${source}" "${pattern}")" ]] ||
      fail "${source} holds no ${pattern} files."
  done

  for entry in "${VALIDATION_SETS[@]}"; do
    folder="${entry%%:*}"
    pattern="${entry#*:}"
    source="${SCHEMATRON_DIR}/${folder}"
    target="${EDM_DIR}/validation/${folder}"

    # Cleared first so a file removed upstream is removed here too. Scoped to
    # this one folder: validation/ has no index to cross-check against, so
    # mirroring is the only way a deletion propagates.
    rm -rf "${target}"
    mkdir -p "${target}"
    find "${source}" -maxdepth 1 -type f -name "${pattern}" -exec cp {} "${target}/" \;

    count="$(list_matching "${target}" "${pattern}" | wc -l | tr -d ' ')"
    info "  validation/${folder}: ${count} ${pattern} file(s)"
  done
}

# Checks every folder arrived, that nothing outside its pattern did, and - when
# the source checkout is present - that ESPD-EDM holds exactly the set the
# schematron repository produced, which is what catches a file removed
# upstream still lingering here.
cmd_verify_validation () {
  local problems=0 entry folder pattern target source published expected strays
  require_dir "${EDM_DIR}" 'The ESPD-EDM checkout' 'EDM_DIR'

  info '--- Published validation files ---'

  for entry in "${VALIDATION_SETS[@]}"; do
    folder="${entry%%:*}"
    pattern="${entry#*:}"
    target="${EDM_DIR}/validation/${folder}"

    if [[ ! -d "${target}" ]]; then
      printf '::error::%s is missing.\n' "${target}" >&2
      problems=$((problems + 1))
      continue
    fi

    strays="$(find "${target}" -mindepth 1 -maxdepth 1 ! \( -type f -name "${pattern}" \) -printf '%f\n' | LC_ALL=C sort)"
    if [[ -n "${strays}" ]]; then
      while IFS= read -r stray; do
        printf '::error::%s/%s does not belong here (only %s is published).\n' \
          "${target}" "${stray}" "${pattern}" >&2
        problems=$((problems + 1))
      done <<< "${strays}"
    fi

    published="$(list_matching "${target}" "${pattern}")"
    if [[ -z "${published}" ]]; then
      printf '::error::%s holds no %s files.\n' "${target}" "${pattern}" >&2
      problems=$((problems + 1))
      continue
    fi

    info "  validation/${folder}: $(printf '%s\n' "${published}" | wc -l | tr -d ' ') ${pattern} file(s)"

    source="${SCHEMATRON_DIR}/${folder}"
    if [[ -d "${source}" ]]; then
      expected="$(list_matching "${source}" "${pattern}")"
      if [[ "${published}" != "${expected}" ]]; then
        printf '::error::%s does not match %s:\n' "${target}" "${source}" >&2
        comm -3 <(printf '%s\n' "${expected}") <(printf '%s\n' "${published}") |
          while IFS= read -r line; do
            if [[ "${line}" == $'\t'* ]]; then
              printf '  only in ESPD-EDM: %s\n' "${line#?}" >&2
            else
              printf '  only in the schematron repo: %s\n' "${line}" >&2
            fi
          done
        problems=$((problems + 1))
      fi
    else
      notice "${source} is not checked out; skipping the source comparison."
    fi
  done

  (( problems == 0 )) || fail "${problems} problem(s) with the published validation files."
  info '✓ Published validation files are consistent'
}

# ---------------------------------------------------------------------------
# all-local - everything that needs no export run, for use before dispatching
# ---------------------------------------------------------------------------

cmd_all_local () {
  cmd_resolve
  cmd_self_test
  cmd_check_model
}

usage () {
  sed -n '3,30p' "$0" | sed 's/^# \{0,1\}//'
  exit 1
}

main () {
  case "${1:-}" in
    resolve)       cmd_resolve ;;
    self-test)     cmd_self_test ;;
    check-model)   cmd_check_model ;;
    verify-output) cmd_verify_output ;;
    verify-edm)    cmd_verify_edm ;;
    copy-validation)   cmd_copy_validation ;;
    verify-validation) cmd_verify_validation ;;
    all-local)     cmd_all_local ;;
    ''|-h|--help)  usage ;;
    *)             printf '::error::Unknown command "%s".\n' "$1" >&2; usage ;;
  esac
}

main "$@"
