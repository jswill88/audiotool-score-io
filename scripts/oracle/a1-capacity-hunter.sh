#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
env_file="${1:-$script_dir/a1-capacity-hunter.env}"

config_names=(
  OCI_PROFILE
  OCI_REGION
  OCI_TENANCY_ID
  OCI_COMPARTMENT_ID
  OCI_SUBNET_ID
  OCI_IMAGE_ID
  OCI_SSH_PUBLIC_KEY_FILE
  OCI_AVAILABILITY_DOMAINS
  OCI_DISPLAY_NAME
  OCI_OCPUS
  OCI_MEMORY_GBS
  OCI_BOOT_VOLUME_GBS
  OCI_SLEEP_SECONDS
  OCI_MAX_ATTEMPTS
  OCI_DRY_RUN
  OCI_CONFIG_FILE
  OCI_LOG_DIR
)

capture_env_override() {
  local name="$1"
  if [[ "${!name+x}" ]]; then
    printf -v "__override_$name" '%s' "${!name}"
  fi
}

apply_env_override() {
  local name="$1"
  local override_name="__override_$name"
  if [[ "${!override_name+x}" ]]; then
    printf -v "$name" '%s' "${!override_name}"
  fi
}

for config_name in "${config_names[@]}"; do
  capture_env_override "$config_name"
done

if [[ -f "$env_file" ]]; then
  # shellcheck disable=SC1090
  source "$env_file"
fi

for config_name in "${config_names[@]}"; do
  apply_env_override "$config_name"
done

OCI_PROFILE="${OCI_PROFILE:-DEFAULT}"
OCI_REGION="${OCI_REGION:-}"
OCI_TENANCY_ID="${OCI_TENANCY_ID:-}"
OCI_COMPARTMENT_ID="${OCI_COMPARTMENT_ID:-}"
OCI_SUBNET_ID="${OCI_SUBNET_ID:-}"
OCI_IMAGE_ID="${OCI_IMAGE_ID:-}"
OCI_SSH_PUBLIC_KEY_FILE="${OCI_SSH_PUBLIC_KEY_FILE:-$HOME/.ssh/oracle_audiotool_score_io.pub}"
OCI_AVAILABILITY_DOMAINS="${OCI_AVAILABILITY_DOMAINS:-}"
OCI_DISPLAY_NAME="${OCI_DISPLAY_NAME:-audiotool-score-io-a1}"
OCI_OCPUS="${OCI_OCPUS:-1}"
OCI_MEMORY_GBS="${OCI_MEMORY_GBS:-6}"
OCI_BOOT_VOLUME_GBS="${OCI_BOOT_VOLUME_GBS:-50}"
OCI_SLEEP_SECONDS="${OCI_SLEEP_SECONDS:-1800}"
OCI_MAX_ATTEMPTS="${OCI_MAX_ATTEMPTS:-0}"
OCI_DRY_RUN="${OCI_DRY_RUN:-false}"
OCI_CONFIG_FILE="${OCI_CONFIG_FILE:-$HOME/.oci/config}"
OCI_LOG_DIR="${OCI_LOG_DIR:-$repo_root/tmp/oracle}"

expand_path() {
  local value="$1"
  if [[ "$value" == "~/"* ]]; then
    printf '%s/%s\n' "$HOME" "${value#~/}"
  else
    printf '%s\n' "$value"
  fi
}

log_dir="$(expand_path "$OCI_LOG_DIR")"
mkdir -p "$log_dir"
log_file="$log_dir/a1-capacity-hunter.log"

die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

timestamp() {
  date -u '+%Y-%m-%dT%H:%M:%SZ'
}

require_var() {
  local name="$1"
  local value="${!name:-}"
  [[ -n "$value" ]] || die "$name is required. Copy a1-capacity-hunter.env.example to a1-capacity-hunter.env and fill it in."
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "$1 is not installed or not on PATH."
}

oci_args=()
if [[ -n "$OCI_PROFILE" ]]; then
  oci_args+=(--profile "$OCI_PROFILE")
fi
if [[ -n "$OCI_REGION" ]]; then
  oci_args+=(--region "$OCI_REGION")
fi

oci_cli() {
  oci "${oci_args[@]}" "$@"
}

load_availability_domains() {
  if [[ -n "$OCI_AVAILABILITY_DOMAINS" ]]; then
    printf '%s\n' "$OCI_AVAILABILITY_DOMAINS" | tr ', ' '\n' | sed '/^$/d'
    return
  fi

  require_var OCI_TENANCY_ID
  oci_cli iam availability-domain list \
    --compartment-id "$OCI_TENANCY_ID" \
    --query 'data[].name' \
    --output json \
    | tr -d '[]",' \
    | sed 's/^[[:space:]]*//; s/[[:space:]]*$//; /^$/d'
}

shape_config_json() {
  printf '{"ocpus":%s,"memoryInGBs":%s}\n' "$OCI_OCPUS" "$OCI_MEMORY_GBS"
}

launch_instance() {
  local ad="$1"
  local shape_config
  shape_config="$(shape_config_json)"

  local command=(
    oci "${oci_args[@]}" compute instance launch
    --availability-domain "$ad"
    --compartment-id "$OCI_COMPARTMENT_ID"
    --subnet-id "$OCI_SUBNET_ID"
    --image-id "$OCI_IMAGE_ID"
    --shape VM.Standard.A1.Flex
    --shape-config "$shape_config"
    --ssh-authorized-keys-file "$OCI_SSH_PUBLIC_KEY_FILE"
    --display-name "$OCI_DISPLAY_NAME"
    --assign-public-ip true
    --boot-volume-size-in-gbs "$OCI_BOOT_VOLUME_GBS"
    --wait-for-state RUNNING
    --max-wait-seconds 1800
    --wait-interval-seconds 30
    --query 'data.id'
    --raw-output
  )

  printf '%s\n' "Trying availability domain: $ad" | tee -a "$log_file"
  printf 'Command: %q ' "${command[@]}" >> "$log_file"
  printf '\n' >> "$log_file"

  if [[ "$OCI_DRY_RUN" == "true" ]]; then
    printf 'Dry run; not launching.\n' | tee -a "$log_file"
    return 2
  fi

  local output status
  set +e
  output="$("${command[@]}" 2>&1)"
  status=$?
  set -e

  printf '%s\n' "$output" >> "$log_file"

  if [[ "$status" -eq 0 ]]; then
    local instance_id="$output"
    printf 'Created instance: %s\n' "$instance_id" | tee -a "$log_file"
    print_public_ip "$instance_id" || true
    return 0
  fi

  printf 'Launch failed in %s:\n%s\n' "$ad" "$output" | tee -a "$log_file"
  return 1
}

print_public_ip() {
  local instance_id="$1"
  local vnic_id public_ip

  vnic_id="$(oci_cli compute vnic-attachment list \
    --compartment-id "$OCI_COMPARTMENT_ID" \
    --instance-id "$instance_id" \
    --query 'data[0]."vnic-id"' \
    --raw-output)"

  public_ip="$(oci_cli network vnic get \
    --vnic-id "$vnic_id" \
    --query 'data."public-ip"' \
    --raw-output)"

  printf 'Public IP: %s\n' "$public_ip" | tee -a "$log_file"
}

main() {
  require_command oci
  if [[ -z "${OCI_CLI_AUTH:-}" && ! -f "$(expand_path "$OCI_CONFIG_FILE")" ]]; then
    die "OCI CLI config not found at $(expand_path "$OCI_CONFIG_FILE"). Run 'oci setup config' first, or set OCI_CONFIG_FILE/OCI_CLI_AUTH for your auth method."
  fi
  require_var OCI_COMPARTMENT_ID
  require_var OCI_SUBNET_ID
  require_var OCI_IMAGE_ID

  OCI_SSH_PUBLIC_KEY_FILE="$(expand_path "$OCI_SSH_PUBLIC_KEY_FILE")"
  [[ -f "$OCI_SSH_PUBLIC_KEY_FILE" ]] || die "SSH public key not found: $OCI_SSH_PUBLIC_KEY_FILE"

  local availability_domain
  availability_domains=()
  while IFS= read -r availability_domain; do
    availability_domains+=("$availability_domain")
  done < <(load_availability_domains)
  [[ "${#availability_domains[@]}" -gt 0 ]] || die "No availability domains found."

  printf 'A1 capacity hunter started at %s\n' "$(timestamp)" | tee -a "$log_file"
  printf 'Log file: %s\n' "$log_file"
  printf 'Target: VM.Standard.A1.Flex, %s OCPU, %s GB RAM, %s GB boot volume\n' \
    "$OCI_OCPUS" "$OCI_MEMORY_GBS" "$OCI_BOOT_VOLUME_GBS" | tee -a "$log_file"

  local attempt=1
  while true; do
    printf '\nAttempt %s at %s\n' "$attempt" "$(timestamp)" | tee -a "$log_file"

    local ad
    for ad in "${availability_domains[@]}"; do
      if launch_instance "$ad"; then
        printf 'Success. Stop this script and migrate DuckDNS to the new public IP after setup.\n'
        exit 0
      fi
    done

    if [[ "$OCI_MAX_ATTEMPTS" != "0" && "$attempt" -ge "$OCI_MAX_ATTEMPTS" ]]; then
      die "Reached OCI_MAX_ATTEMPTS=$OCI_MAX_ATTEMPTS without creating an instance."
    fi

    attempt=$((attempt + 1))
    printf 'No capacity yet. Sleeping %s seconds...\n' "$OCI_SLEEP_SECONDS" | tee -a "$log_file"
    sleep "$OCI_SLEEP_SECONDS"
  done
}

main "$@"
