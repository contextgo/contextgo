#!/usr/bin/env bash

set -euo pipefail

declare -a CANDIDATE_ROOTS=()

append_candidate_root() {
  local root="${1:-}"

  if [[ -z "$root" ]]; then
    return 0
  fi

  if [[ "$root" == */sdk ]]; then
    root="$(cd "${root}/.." && pwd)"
  elif [[ -d "$root" ]]; then
    root="$(cd "$root" && pwd)"
  else
    return 0
  fi

  for existing_root in "${CANDIDATE_ROOTS[@]:-}"; do
    if [[ "$existing_root" == "$root" ]]; then
      return 0
    fi
  done

  CANDIDATE_ROOTS+=("$root")
}

append_discovered_roots() {
  local search_root="${1:-}"
  local max_depth="${2:-6}"

  if [[ -z "$search_root" || ! -d "$search_root" ]]; then
    return 0
  fi

  while IFS= read -r discovered_root; do
    if [[ -z "$discovered_root" ]]; then
      continue
    fi

    append_candidate_root "$discovered_root"
  done < <(
    find "$search_root" -maxdepth "$max_depth" -type d -name 'command-line-tools' 2>/dev/null || true
  )
}

resolve_tool_path() {
  local relative_path
  local root

  for root in "${CANDIDATE_ROOTS[@]:-}"; do
    for relative_path in "$@"; do
      if [[ -x "${root}/${relative_path}" ]]; then
        printf '%s\n' "${root}/${relative_path}"
        return 0
      fi
    done
  done

  return 1
}

resolve_sdk_home() {
  local root

  if [[ -n "${DEVECO_SDK_HOME:-}" && -d "${DEVECO_SDK_HOME}" ]]; then
    printf '%s\n' "$(cd "${DEVECO_SDK_HOME}" && pwd)"
    return 0
  fi

  for root in "${CANDIDATE_ROOTS[@]:-}"; do
    if [[ -d "${root}/sdk" ]]; then
      printf '%s\n' "${root}/sdk"
      return 0
    fi
  done

  return 1
}

choose_primary_root() {
  local sdk_home="$1"
  local hvigorw_path="$2"
  local ohpm_path="$3"

  if [[ "$sdk_home" == */sdk ]]; then
    dirname "$sdk_home"
    return 0
  fi

  if [[ -n "$hvigorw_path" ]]; then
    if [[ "$hvigorw_path" == */hvigor/bin/hvigorw ]]; then
      dirname "$(dirname "$hvigorw_path")"
      return 0
    fi

    dirname "$(dirname "$hvigorw_path")"
    return 0
  fi

  if [[ -n "$ohpm_path" ]]; then
    if [[ "$ohpm_path" == */ohpm/bin/ohpm ]]; then
      dirname "$(dirname "$ohpm_path")"
      return 0
    fi

    dirname "$(dirname "$ohpm_path")"
    return 0
  fi

  return 1
}

append_candidate_root "${CONTEXTGO_HARMONY_TOOLS_ROOT:-}"
append_candidate_root "${CONTEXTGO_HARMONY_BOOTSTRAP_ROOT:-}"
append_candidate_root "${DEVECO_SDK_HOME:-}"
append_candidate_root "${HOME:-}/Library/Huawei/command-line-tools"
append_candidate_root "${HOME:-}/Applications/DevEco-Studio.app/Contents/tools/command-line-tools"
append_candidate_root "/Applications/DevEco-Studio.app/Contents/tools/command-line-tools"
append_candidate_root "${HOME:-}/Applications/DevEco Studio.app/Contents/tools/command-line-tools"
append_candidate_root "/Applications/DevEco Studio.app/Contents/tools/command-line-tools"

append_discovered_roots "${HOME:-}/Library/Huawei"
append_discovered_roots "${HOME:-}/Library/DevEco-Studio"
append_discovered_roots "${HOME:-}/Library/DevEcoStudio"
append_discovered_roots "${HOME:-}/Applications"
append_discovered_roots "/Applications"

if [[ ${#CANDIDATE_ROOTS[@]} -eq 0 ]]; then
  append_discovered_roots "${HOME:-}" 8
fi

if [[ ${#CANDIDATE_ROOTS[@]} -eq 0 && "${CONTEXTGO_HARMONY_ENABLE_GLOBAL_SEARCH:-false}" == 'true' ]]; then
  append_discovered_roots "/Users" 6
  append_discovered_roots "/Applications" 8
fi

OHPM_PATH="$(resolve_tool_path 'bin/ohpm' 'ohpm/bin/ohpm' || true)"
HVIGORW_PATH="$(resolve_tool_path 'bin/hvigorw' 'hvigor/bin/hvigorw' || true)"
SDK_HOME="$(resolve_sdk_home || true)"

if [[ -z "$OHPM_PATH" || -z "$HVIGORW_PATH" || -z "$SDK_HOME" ]]; then
  {
    echo 'Unable to resolve HarmonyOS command-line tools.'
    echo "Resolved ohpm: ${OHPM_PATH:-<missing>}"
    echo "Resolved hvigorw: ${HVIGORW_PATH:-<missing>}"
    echo "Resolved DEVECO_SDK_HOME: ${SDK_HOME:-<missing>}"
    if [[ ${#CANDIDATE_ROOTS[@]} -gt 0 ]]; then
      echo 'Searched roots:'
      printf '  %s\n' "${CANDIDATE_ROOTS[@]}"
    else
      echo 'No Harmony tool roots were discovered.'
    fi
  } >&2
  exit 1
fi

PRIMARY_ROOT="$(choose_primary_root "$SDK_HOME" "$HVIGORW_PATH" "$OHPM_PATH")"

printf 'HARMONY_TOOLS_ROOT=%s\n' "$PRIMARY_ROOT"
printf 'DEVECO_SDK_HOME=%s\n' "$SDK_HOME"
printf 'CONTEXTGO_HARMONY_OHPM=%s\n' "$OHPM_PATH"
printf 'CONTEXTGO_HARMONY_HVIGORW=%s\n' "$HVIGORW_PATH"
