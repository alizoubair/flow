#!/usr/bin/env bash
# Manage Flow orchestrator online evaluation.
# Usage: ./scripts/manage-online-eval.sh <command>
# Commands: create | status | pause | resume | delete | results | metrics
#
# Optional env:
#   AWS_PROFILE, AWS_REGION, ONLINE_EVAL_CONFIG_NAME,
#   ONLINE_EVAL_SAMPLING_PERCENTAGE, ONLINE_EVAL_CONFIG_ID, RESULTS_LOOKBACK_MINUTES, PYTHON

set -euo pipefail

# Git Bash: prevent MSYS path conversion for AWS ARNs / log group names
if [[ -n "${MSYSTEM:-}" ]]; then
  export MSYS2_ARG_CONV_EXCL='*'
  export MSYS_NO_PATHCONV=1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EVAL_DIR="${ROOT}/evaluations"
TF_DIR="${ROOT}/infrastructure/terraform/environments/dev"

COMMAND="${1:-}"
if [[ -z "${COMMAND}" ]]; then
  echo "Usage: $0 <command>"
  echo "Commands: create | status | pause | resume | delete | results | metrics"
  exit 1
fi

# Python resolution

is_windows_store_stub() {
  local exe_path
  exe_path="$(command -v "$1" 2>/dev/null || true)"
  [[ -n "${exe_path}" && "${exe_path}" == *WindowsApps* ]]
}

python_works() {
  "${@}" -c "import sys" >/dev/null 2>&1
}

resolve_python() {
  if [[ -n "${PYTHON:-}" ]]; then
    python_works "${PYTHON}" && echo "${PYTHON}" && return 0
    echo "PYTHON is set but not usable: ${PYTHON}" >&2; return 1
  fi
  for candidate in python3 python; do
    command -v "${candidate}" >/dev/null 2>&1 \
      && ! is_windows_store_stub "${candidate}" \
      && python_works "${candidate}" \
      && echo "${candidate}" && return 0
  done
  if command -v py >/dev/null 2>&1 && python_works py -3; then
    echo "py -3"; return 0
  fi
  return 1
}

PYTHON_CMD="$(resolve_python)" || {
  echo "No working Python 3.10+ found." >&2
  echo "Set PYTHON=/path/to/python or run the PowerShell script instead." >&2
  exit 1
}
read -r -a PYTHON_CMD_ARRAY <<< "${PYTHON_CMD}"

# Venv

cd "${EVAL_DIR}"

resolve_venv_python() {
  for candidate in ".venv/Scripts/python.exe" ".venv/Scripts/python" \
                   ".venv/bin/python3" ".venv/bin/python"; do
    [[ -f "${candidate}" ]] && echo "${candidate}" && return 0
  done
  return 1
}

if [[ -d ".venv" ]] && ! resolve_venv_python >/dev/null; then
  rm -rf ".venv"
fi

if [[ ! -d ".venv" ]]; then
  "${PYTHON_CMD_ARRAY[@]}" -m venv .venv
fi

VENV_PYTHON="$(resolve_venv_python)" || {
  echo "Could not find python in ${EVAL_DIR}/.venv" >&2; exit 1
}

"${VENV_PYTHON}" -m pip install -q -r requirements.txt

# Resolve Terraform outputs (only needed for create)

terraform_output() {
  (
    cd "${TF_DIR}"
    MSYS2_ARG_CONV_EXCL='*' MSYS_NO_PATHCONV=1 terraform output -raw "$1"
  )
}

export AWS_REGION="${AWS_REGION:-us-west-2}"

if [[ "${COMMAND}" == "create" ]]; then
  if [[ -z "${ONLINE_EVAL_SERVICE_ROLE_ARN:-}" ]]; then
    export ONLINE_EVAL_SERVICE_ROLE_ARN="$(terraform_output online_eval_service_role_arn)"
  fi
fi

# Run the command

echo "AWS_REGION=${AWS_REGION}"
echo "Command:   ${COMMAND}"
echo

exec "${VENV_PYTHON}" online_eval.py "${COMMAND}"
