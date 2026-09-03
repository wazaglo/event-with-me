@echo off
setlocal

set REGION=us-east-1
set PROFILE=target
set ALLOWED_ORIGIN=https://d2k75xjjxtat1p.amplifyapp.com
set COMMON_VARS=ALLOWED_ORIGIN=%ALLOWED_ORIGIN%,EVENTS_TABLE=events-prod,REGISTRATIONS_TABLE=registrations-prod,AUDIT_TABLE=audit-logs-prod,REGISTRATION_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/814330181503/registration-queue-prod,SES_SOURCE_EMAIL=noreply@azubisuccess.space,SNS_TOPIC_ARN=arn:aws:sns:us-east-1:814330181503:event-confirmations-prod

set FUNCTIONS=createEvent-prod listEvents-prod updateEvent-prod getEvent-prod deleteEvent-prod registerParticipant-prod listRegistrations-prod getRegistrations-prod deleteRegistration-prod checkIn-prod walkInRegistration-prod updateRegistration-prod printBadge-prod getAuditLog-prod ticketProcessing-prod

for %%F in (%FUNCTIONS%) do (
  echo Updating %%F ...
  aws lambda update-function-configuration --function-name %%F --region %REGION% --profile %PROFILE% --environment "Variables={%COMMON_VARS%}" > nul
  echo Done %%F
)

echo.
echo All Lambda CORS origins updated to %ALLOWED_ORIGIN%
