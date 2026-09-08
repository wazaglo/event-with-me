#!/usr/bin/env bash
# Change the CORS origin (ALLOWED_ORIGIN) all Lambda functions return.
# The lambdas CloudFormation stack owns every function's environment, so the
# supported path is to update the stack's AllowedOrigin parameter; anything
# set via `aws lambda update-function-configuration` by hand gets overwritten
# on the next stack update.
#
# Usage: scripts/update-cors-origin.sh https://your-domain.example.com [base-name]
set -euo pipefail
cd "$(dirname "$0")/.."

ORIGIN="${1:?usage: update-cors-origin.sh <allowed-origin> [base-name]}"
BASE="${2:-event-with-me}"
REGION="${AWS_REGION:-us-east-1}"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
BUCKET="event-with-me-deploy-${ACCOUNT}"

STATUS="$(aws cloudformation update-stack --stack-name "$BASE-lambdas" --region "$REGION" \
  --use-previous-template \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameters ParameterKey=CodeBucket,ParameterValue="$BUCKET" \
               ParameterKey=CodePrefix,ParameterValue="$BASE/" \
               ParameterKey=AllowedOrigin,ParameterValue="$ORIGIN" \
  2>&1 || true)"
if echo "$STATUS" | grep -q "No updates are to be performed"; then
  echo "Already set to $ORIGIN"
  exit 0
fi
echo "$STATUS"
aws cloudformation wait stack-update-complete --stack-name "$BASE-lambdas" --region "$REGION"
echo "==> lambdas stack updated: ALLOWED_ORIGIN=$ORIGIN"
