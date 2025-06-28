#!/usr/bin/env bash
set -Eeuo pipefail

# Environment variables set by the user
CROSS_SEED_HOST="${CROSS_SEED_HOST:?}"
CROSS_SEED_API_KEY="${CROSS_SEED_API_KEY:?}"
CROSS_SEED_SLEEP_INTERVAL="${CROSS_SEED_SLEEP_INTERVAL:-30}"

# Environment variables set by sabnzbd (try multiple possible names)
SAB_COMPLETE_DIR="${SAB_COMPLETE_DIR:-${1:-}}"
SAB_PP_STATUS="${SAB_PP_STATUS:-0}"

# Debug: Print all environment variables for troubleshooting
printf "DEBUG: All SAB environment variables:\n" >&2
env | grep -i sab | sort >&2 || true
printf "DEBUG: Script arguments: %s\n" "$*" >&2
printf "DEBUG: Complete dir resolved to: %s\n" "${SAB_COMPLETE_DIR}" >&2

# Validate we have a path to work with
if [[ -z "${SAB_COMPLETE_DIR}" ]]; then
    printf "ERROR: No download path provided. SAB_COMPLETE_DIR is empty and no argument given.\n" >&2
    exit 1
fi

# Function to search for cross-seed
search() {
    local status_code
    status_code=$(curl \
        --silent \
        --output /dev/null \
        --write-out "%{http_code}" \
        --request POST \
        --data-urlencode "path=${SAB_COMPLETE_DIR}" \
        --header "X-Api-Key: ${CROSS_SEED_API_KEY}" \
        "http://${CROSS_SEED_HOST}/api/webhook"
    )

    printf "cross-seed search returned with HTTP status code %s and path %s\n" "${status_code}" "${SAB_COMPLETE_DIR}" >&2

    sleep "${CROSS_SEED_SLEEP_INTERVAL}"
}

main() {
    # Check if post-processing was successful
    if [[ "${SAB_PP_STATUS}" -ne 0 ]]; then
        printf "post-processing failed with sabnzbd status code %s\n" "${SAB_PP_STATUS}" >&2
        exit 1
    fi

    search
}

main "$@"
