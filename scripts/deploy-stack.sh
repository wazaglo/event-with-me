#!/usr/bin/env bash
# Deploy the event-with-me backend as four CloudFormation stacks in order:
#   ewm-auth -> ewm-data -> ewm-lambdas -> ewm-api
# Each stack imports the previous ones' exports, so ordering matters on
# first deploy; updates are per-stack and independent.
# Requires: configured aws cli, zip, node.
# Usage: scripts/deploy-stack.sh [base-name]   (default: event-with-me)
set -euo pipefail
cd "$(dirname "$0")/.."

export AWS_MAX_ATTEMPTS=5
export AWS_RETRY_MODE=adaptive

BASE="${1:-event-with-me}"
REGION="${AWS_REGION:-us-east-1}"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
BUCKET="event-with-me-deploy-${ACCOUNT}"
PREFIX="$BASE/"

# Ensure artifact bucket exists
if ! aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  aws s3 mb "s3://$BUCKET"
fi

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

# Each lambda zip: handler file at root + shared/ python package under shared/.
# The S3 key embeds a content hash: CFN only sees a code change when the key
# changes, so reusing a fixed key would leave functions on stale zips.
# ticketProcessing is not a CloudFormation-managed function (the SES
# workstream replaces it); skip it so its zip never lands unused in S3.
echo '{}' > "$STAGE/manifest.json"
for f in backend/events/*.py backend/registrations/*.py; do
  name="$(basename "$f" .py)"
  [ "$name" = "ticketProcessing" ] && continue
  rm -rf "$STAGE/$name"
  mkdir -p "$STAGE/$name/shared"
  cp "$f" "$STAGE/$name/$name.py"
  cp backend/shared/*.py "$STAGE/$name/shared/"
  hash="$(cd "$STAGE/$name" && find . -type f -exec md5sum {} \; | LC_ALL=C sort | md5sum | cut -c1-12)"
  (cd "$STAGE/$name" && zip -qr "$STAGE/$name.zip" .)
  aws s3 cp "$STAGE/$name.zip" "s3://$BUCKET/$PREFIX$name-$hash.zip" >/dev/null
  python3 - "$STAGE/manifest.json" "$name" "$hash" <<'PY'
import json, sys
p, name, h = sys.argv[1:4]
m = json.load(open(p)); m[name] = h; json.dump(m, open(p, "w"))
PY
  echo "packed $name-$hash"
done

EWM_BASE="$BASE" EWM_CODE_MANIFEST="$STAGE/manifest.json" node infra/generate-template.mjs

deploy() { # deploy <stack-suffix> [ParameterKey=...,ParameterValue=... ...]
  local suffix="$1"; shift
  local name="$BASE-$suffix"

  aws s3 cp "infra/$suffix.yaml" "s3://$BUCKET/${PREFIX}$suffix.yaml" >/dev/null
  local url="https://s3.amazonaws.com/$BUCKET/${PREFIX}$suffix.yaml"

  local pargs=()
  local update_args=()
  for p in "$@"; do
    local key="${p%%=*}" value="${p#*=}"
    pargs+=(ParameterKey="$key",ParameterValue="$value")
    update_args+=(ParameterKey="$key",ParameterValue="$value")
  done

  # A rolled-back stack can't be updated; delete it so we can recreate.
  existing="$(aws cloudformation describe-stacks --stack-name "$name" --region "$REGION" \
    --query 'Stacks[0].StackStatus' --output text 2>/dev/null || true)"
  case "$existing" in
    ROLLBACK_COMPLETE|ROLLBACK_FAILED|CREATE_FAILED)
      echo "==> deleting failed stack $name ($existing)"
      aws cloudformation delete-stack --stack-name "$name" --region "$REGION"
      aws cloudformation wait stack-delete-complete --stack-name "$name" --region "$REGION"
      existing="" ;;
  esac

  if [ -n "$existing" ]; then
    echo "==> update $name"
    if ! aws cloudformation update-stack --stack-name "$name" --template-url "$url" \
      --region "$REGION" --capabilities CAPABILITY_NAMED_IAM \
      --parameters ${update_args[@]+"${update_args[@]}"} 2>/tmp/cfn-err; then
      if grep -q "No updates are to be performed" /tmp/cfn-err; then
        echo "    (no changes)"
      else
        cat /tmp/cfn-err >&2; return 1
      fi
    fi
  else
    echo "==> create $name"
    aws cloudformation create-stack --stack-name "$name" --template-url "$url" \
      --region "$REGION" --capabilities CAPABILITY_NAMED_IAM \
      --parameters ${pargs[@]+"${pargs[@]}"}
  fi

  # Poll until the stack reaches a terminal state (create/update paths differ).
  while true; do
    status="$(aws cloudformation describe-stacks --stack-name "$name" --region "$REGION" \
      --query 'Stacks[0].StackStatus' --output text)"
    case "$status" in
      *_COMPLETE) echo "    $status"; break ;;
      *ROLLBACK*|*FAILED*)
        echo "    $status" >&2
      aws cloudformation describe-stack-events --stack-name "$name" --region "$REGION" \
        --query 'reverse(StackEvents[].{l:LogicalResourceId,r:ResourceStatusReason,s:ResourceStatus})' \
        --output text | grep FAILED | head -5 >&2
        return 1 ;;
      *) sleep 10 ;;
    esac
  done
}

deploy auth
deploy data
deploy lambdas "CodeBucket=$BUCKET" "CodePrefix=$PREFIX"
deploy api

# The ApiDeployment resource in CFN is not replaced when the API body
# changes (Description is mutable to CFN), which would leave the stage
# serving a stale snapshot. Redeploy the stage explicitly so every API
# definition change goes live.
API_ID="$(aws cloudformation describe-stacks --stack-name "$BASE-api" --region "$REGION" \
  --query 'Stacks[0].Outputs[?ExportName==`'"$BASE"'-api-BaseUrl`].OutputValue' --output text \
  | sed 's|https://||; s|\.execute-api.*||')"
if [ -n "$API_ID" ] && [ "$API_ID" != "None" ]; then
  aws apigateway create-deployment --rest-api-id "$API_ID" --stage-name prod \
    --description "deploy $(date -u +%Y%m%dT%H%M%SZ)" >/dev/null \
    && echo "==> stage prod redeployed (api $API_ID)"
fi

echo
echo "==> Outputs"
for s in auth data api; do
  aws cloudformation describe-stacks --stack-name "$BASE-$s" --region "$REGION" \
    --query "Stacks[0].Outputs" --output table
done
