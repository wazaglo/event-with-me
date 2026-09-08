// Generates four separate CloudFormation templates under infra/:
//   auth.yaml     Cognito user pool, client, groups
//   data.yaml     DynamoDB tables + SNS confirmation topic
//   lambdas.yaml  IAM role + Python 3.13 Lambda functions (imports data exports)
//   api.yaml      REST API + stage + lambda permissions (imports auth + lambdas)
// Stacks are linked via Exports/ImportValue keyed on the BASE name.
// Lambdas are zipped + uploaded to S3 by scripts/deploy-stack.sh before deploy.
// EWM_CODE_MANIFEST points at a JSON map {functionName: contentHash} produced
// by the deploy script; the hash goes into each S3Key so CFN sees a code
// change when contents change (a fixed key would leave functions stale).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = process.env.EWM_BASE || "event-with-me";
const MANIFEST = process.env.EWM_CODE_MANIFEST
  ? JSON.parse(readFileSync(process.env.EWM_CODE_MANIFEST, "utf8"))
  : {};
const here = (f) => fileURLToPath(new URL(`./${f}`, import.meta.url));
const sub = (s) => ({ "Fn::Sub": s });
const ref = (s) => ({ Ref: s });
const getAtt = (l, a) => ({ "Fn::GetAtt": [l, a] });
const imp = (name) => ({ "Fn::ImportValue": `${BASE}-${name}` });
const exported = (value, name) => ({
  Value: value,
  Export: { Name: `${BASE}-${name}` },
});

// file: handler path under backend/, tables it reads/writes
const FUNCS = [
  { id: "CreateEvent", file: "backend/events/createEvent.py" },
  { id: "ListEvents", file: "backend/events/listEvents.py" },
  { id: "GetEvent", file: "backend/events/getEvent.py" },
  { id: "UpdateEvent", file: "backend/events/updateEvent.py" },
  { id: "DeleteEvent", file: "backend/events/deleteEvent.py" },
  { id: "RegisterParticipant", file: "backend/registrations/registerParticipant.py" },
  { id: "ListRegistrations", file: "backend/registrations/listRegistrations.py" },
  { id: "GetRegistrations", file: "backend/registrations/getRegistrations.py" },
  { id: "GetRegistration", file: "backend/registrations/getRegistration.py" },
  { id: "UpdateRegistration", file: "backend/registrations/updateRegistration.py" },
  { id: "DeleteRegistration", file: "backend/registrations/deleteRegistration.py" },
  { id: "CheckIn", file: "backend/registrations/checkIn.py" },
  { id: "WalkInRegistration", file: "backend/registrations/walkInRegistration.py" },
  { id: "PrintBadge", file: "backend/registrations/printBadge.py" },
  { id: "GetAuditLog", file: "backend/registrations/getAuditLog.py" },
];

const header = (name) => ({
  AWSTemplateFormatVersion: "2010-09-09",
  Description: `event-with-me ${name} stack`,
});

// ─── auth.yaml ───────────────────────────────────────────────────────────────
const auth = {
  ...header("authentication (Cognito)"),
  Resources: {
    UserPool: {
      Type: "AWS::Cognito::UserPool",
      Properties: {
        UserPoolName: sub(`${BASE}-users`),
        AutoVerifiedAttributes: ["email"],
        UsernameAttributes: ["email"],
        Policies: {
          PasswordPolicy: {
            MinimumLength: 8,
            RequireUppercase: true,
            RequireLowercase: true,
            RequireNumbers: true,
            RequireSymbols: false,
          },
        },
        Schema: [
          { Name: "email", AttributeDataType: "String", Required: true, Mutable: true },
          { Name: "name", AttributeDataType: "String", Required: false, Mutable: true },
          { Name: "phone_number", AttributeDataType: "String", Required: false, Mutable: true },
        ],
      },
    },
    UserPoolClient: {
      Type: "AWS::Cognito::UserPoolClient",
      Properties: {
        ClientName: "EventRegistrationUserPool",
        UserPoolId: ref("UserPool"),
        ExplicitAuthFlows: [
          "ALLOW_USER_PASSWORD_AUTH",
          "ALLOW_REFRESH_TOKEN_AUTH",
          "ALLOW_USER_SRP_AUTH",
        ],
        GenerateSecret: false,
      },
    },
    AdminGroup: {
      Type: "AWS::Cognito::UserPoolGroup",
      Properties: {
        GroupName: "Admin",
        UserPoolId: ref("UserPool"),
        Description: "Full system access",
      },
    },
    RegOfficerGroup: {
      Type: "AWS::Cognito::UserPoolGroup",
      Properties: {
        GroupName: "RegistrationOfficer",
        UserPoolId: ref("UserPool"),
        Description: "Walk-in + participants",
      },
    },
    CheckinOfficerGroup: {
      Type: "AWS::Cognito::UserPoolGroup",
      Properties: {
        GroupName: "CheckinOfficer",
        UserPoolId: ref("UserPool"),
        Description: "Check-in only",
      },
    },
  },
  Outputs: {
    UserPoolId: exported(ref("UserPool"), "auth-UserPoolId"),
    UserPoolArn: exported(getAtt("UserPool", "Arn"), "auth-UserPoolArn"),
    UserPoolClientId: exported(ref("UserPoolClient"), "auth-UserPoolClientId"),
  },
};

// ─── data.yaml ───────────────────────────────────────────────────────────────
const data = {
  ...header("data layer (DynamoDB + SNS)"),
  Resources: {
    EventsTable: {
      Type: "AWS::DynamoDB::Table",
      Properties: {
        TableName: sub(`${BASE}-events`),
        BillingMode: "PAY_PER_REQUEST",
        AttributeDefinitions: [{ AttributeName: "eventId", AttributeType: "S" }],
        KeySchema: [{ AttributeName: "eventId", KeyType: "HASH" }],
      },
    },
    RegistrationsTable: {
      Type: "AWS::DynamoDB::Table",
      Properties: {
        TableName: sub(`${BASE}-registrations`),
        BillingMode: "PAY_PER_REQUEST",
        AttributeDefinitions: [
          { AttributeName: "registrationId", AttributeType: "S" },
          { AttributeName: "email", AttributeType: "S" },
          { AttributeName: "eventId", AttributeType: "S" },
          { AttributeName: "createdAt", AttributeType: "S" },
        ],
        KeySchema: [{ AttributeName: "registrationId", KeyType: "HASH" }],
        GlobalSecondaryIndexes: [
          {
            IndexName: "email-eventId-index",
            KeySchema: [
              { AttributeName: "email", KeyType: "HASH" },
              { AttributeName: "eventId", KeyType: "RANGE" },
            ],
            Projection: { ProjectionType: "ALL" },
          },
          {
            IndexName: "eventId-createdAt-index",
            KeySchema: [
              { AttributeName: "eventId", KeyType: "HASH" },
              { AttributeName: "createdAt", KeyType: "RANGE" },
            ],
            Projection: { ProjectionType: "ALL" },
          },
        ],
      },
    },
    AuditTable: {
      Type: "AWS::DynamoDB::Table",
      Properties: {
        TableName: sub(`${BASE}-audit-logs`),
        BillingMode: "PAY_PER_REQUEST",
        AttributeDefinitions: [{ AttributeName: "auditId", AttributeType: "S" }],
        KeySchema: [{ AttributeName: "auditId", KeyType: "HASH" }],
      },
    },
    ConfirmationTopic: {
      Type: "AWS::SNS::Topic",
      Properties: { TopicName: sub(`${BASE}-confirmations`) },
    },
    // Dead-letter for confirmation messages the email Lambda keeps failing
    // on (e.g. SES rejects the recipient); inspect and replay manually.
    ConfirmationDLQ: {
      Type: "AWS::SQS::Queue",
      Properties: { QueueName: sub(`${BASE}-confirmations-dlq`), MessageRetentionPeriod: 1209600 },
    },
    ConfirmationDLQPolicy: {
      Type: "AWS::SQS::QueuePolicy",
      Properties: {
        Queues: [ref("ConfirmationDLQ")],
        PolicyDocument: {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: { Service: "sns.amazonaws.com" },
              Action: "sqs:SendMessage",
              Resource: getAtt("ConfirmationDLQ", "Arn"),
              Condition: {
                ArnEquals: {
                  "aws:SourceArn": sub(
                    `arn:aws:sns:\${AWS::Region}:\${AWS::AccountId}:${BASE}-confirmations`,
                  ),
                },
              },
            },
          ],
        },
      },
    },
  },
  Outputs: {
    EventsTable: exported(ref("EventsTable"), "data-EventsTable"),
    RegistrationsTable: exported(ref("RegistrationsTable"), "data-RegistrationsTable"),
    AuditTable: exported(ref("AuditTable"), "data-AuditTable"),
    ConfirmationTopicArn: exported(ref("ConfirmationTopic"), "data-ConfirmationTopicArn"),
    ConfirmationDLQArn: exported(getAtt("ConfirmationDLQ", "Arn"), "data-ConfirmationDLQArn"),
  },
};

// ─── lambdas.yaml ────────────────────────────────────────────────────────────
// The confirmation-email function consumes the SNS topic instead of serving
// an API route, so it gets its own resource block (not in FUNCS).
const EMAIL_FUNC = {
  id: "SendConfirmationEmail",
  file: "backend/notifications/sendConfirmationEmail.py",
};

// Fn::ImportValue is not allowed inside IAM policy documents, but the table
// names are deterministic (BASE-*) so the role scopes them via Fn::Sub ARNs.
const TABLE_ARN = (suffix) =>
  sub(`arn:aws:dynamodb:\${AWS::Region}:\${AWS::AccountId}:table/${BASE}-${suffix}`);
const REG_TABLE_ARN = sub(
  `arn:aws:dynamodb:\${AWS::Region}:\${AWS::AccountId}:table/${BASE}-registrations`,
);
const REG_INDEX_ARN = sub(
  `arn:aws:dynamodb:\${AWS::Region}:\${AWS::AccountId}:table/${BASE}-registrations/index/*`,
);
const TOPIC_ARN = sub(`arn:aws:sns:\${AWS::Region}:\${AWS::AccountId}:${BASE}-confirmations`);

const lambdaRole = {
  Type: "AWS::IAM::Role",
  Properties: {
    RoleName: sub(`${BASE}-lambda-role`),
    AssumeRolePolicyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { Service: "lambda.amazonaws.com" },
          Action: "sts:AssumeRole",
        },
      ],
    },
    ManagedPolicyArns: ["arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"],
    Policies: [
      {
        PolicyName: "dynamodb-access",
        PolicyDocument: {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: [
                "dynamodb:GetItem",
                "dynamodb:PutItem",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem",
                "dynamodb:Query",
                "dynamodb:Scan",
              ],
              Resource: [
                TABLE_ARN("events"),
                REG_TABLE_ARN,
                REG_INDEX_ARN,
                TABLE_ARN("audit-logs"),
              ],
            },
          ],
        },
      },
      {
        PolicyName: "sns-publish",
        PolicyDocument: {
          Version: "2012-10-17",
          Statement: [{ Effect: "Allow", Action: "sns:Publish", Resource: [TOPIC_ARN] }],
        },
      },
    ],
  },
};

const baseName = (f) => f.split("/").pop().replace(/\.py$/, "");
const codeKey = (name) =>
  sub(`\${CodePrefix}${name}${MANIFEST[name] ? `-${MANIFEST[name]}` : ""}.zip`);

const lambdaResources = { LambdaRole: lambdaRole };
const lambdaOutputs = {};
for (const f of FUNCS) {
  lambdaResources[`${f.id}Function`] = {
    Type: "AWS::Lambda::Function",
    DependsOn: ["LambdaRole"],
    Properties: {
      FunctionName: `${BASE}-${f.id}`,
      Runtime: "python3.13",
      Architectures: ["x86_64"],
      Handler: `${baseName(f.file)}.handler`,
      Role: getAtt("LambdaRole", "Arn"),
      Timeout: 15,
      MemorySize: 256,
      Code: {
        S3Bucket: ref("CodeBucket"),
        S3Key: codeKey(baseName(f.file)),
      },
      Environment: {
        Variables: {
          EVENTS_TABLE: imp("data-EventsTable"),
          REGISTRATIONS_TABLE: imp("data-RegistrationsTable"),
          AUDIT_TABLE: imp("data-AuditTable"),
          ALLOWED_ORIGIN: ref("AllowedOrigin"),
          SNS_TOPIC_ARN: imp("data-ConfirmationTopicArn"),
        },
      },
    },
  };
  lambdaOutputs[`${f.id}Arn`] = exported(getAtt(`${f.id}Function`, "Arn"), `lambdas-${f.id}Arn`);
}

// ─── confirmation email (SNS -> SES) ────────────────────────────────────────
// Separate role from the shared LambdaRole (least privilege): this function
// only sends mail from the verified identity, stamps emailSentAt on the
// registration it just emailed, and unsubscribes removed attendee emails.
const emailRole = {
  Type: "AWS::IAM::Role",
  Properties: {
    RoleName: sub(`${BASE}-email-role`),
    AssumeRolePolicyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { Service: "lambda.amazonaws.com" },
          Action: "sts:AssumeRole",
        },
      ],
    },
    ManagedPolicyArns: ["arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"],
    Policies: [
      {
        PolicyName: "ses-send",
        PolicyDocument: {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: ["ses:SendEmail", "ses:SendRawEmail"],
              Resource: sub(`arn:aws:ses:\${AWS::Region}:\${AWS::AccountId}:identity/*`),
            },
          ],
        },
      },
      {
        PolicyName: "registration-stamp",
        PolicyDocument: {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: "dynamodb:UpdateItem",
              Resource: REG_TABLE_ARN,
            },
          ],
        },
      },
      {
        PolicyName: "topic-unsubscribe",
        PolicyDocument: {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: ["sns:Unsubscribe", "sns:ListSubscriptionsByTopic"],
              Resource: TOPIC_ARN,
            },
          ],
        },
      },
    ],
  },
};

lambdaResources.EmailRole = emailRole;
lambdaResources[`${EMAIL_FUNC.id}Function`] = {
  Type: "AWS::Lambda::Function",
  DependsOn: ["EmailRole"],
  Properties: {
    FunctionName: `${BASE}-${EMAIL_FUNC.id}`,
    Runtime: "python3.13",
    Architectures: ["x86_64"],
    Handler: "sendConfirmationEmail.handler",
    Role: getAtt("EmailRole", "Arn"),
    Timeout: 30,
    MemorySize: 256,
    Code: {
      S3Bucket: ref("CodeBucket"),
      S3Key: codeKey("sendConfirmationEmail"),
    },
    Environment: {
      Variables: {
        REGISTRATIONS_TABLE: imp("data-RegistrationsTable"),
        AUDIT_TABLE: imp("data-AuditTable"),
        // SES refuses mail from an unverified identity, so this is a hard
        // requirement for the email path; override with a verified sender.
        SES_SOURCE_EMAIL: ref("SourceEmail"),
      },
    },
  },
};
lambdaResources.EmailInvokePermission = {
  Type: "AWS::Lambda::Permission",
  Properties: {
    Action: "lambda:InvokeFunction",
    FunctionName: getAtt(`${EMAIL_FUNC.id}Function`, "Arn"),
    Principal: "sns.amazonaws.com",
    SourceArn: imp("data-ConfirmationTopicArn"),
  },
};
lambdaResources.EmailSubscription = {
  Type: "AWS::SNS::Subscription",
  Properties: {
    TopicArn: imp("data-ConfirmationTopicArn"),
    Protocol: "lambda",
    Endpoint: getAtt(`${EMAIL_FUNC.id}Function`, "Arn"),
    RedrivePolicy: {
      deadLetterTargetArn: imp("data-ConfirmationDLQArn"),
    },
  },
};
lambdaOutputs[`${EMAIL_FUNC.id}Arn`] = exported(
  getAtt(`${EMAIL_FUNC.id}Function`, "Arn"),
  `lambdas-${EMAIL_FUNC.id}Arn`,
);

const lambdas = {
  ...header("compute (Lambda functions)"),
  Parameters: {
    CodeBucket: {
      Type: "String",
      Description: "S3 bucket holding lambda zips (uploaded by scripts/deploy-stack.sh)",
    },
    CodePrefix: {
      Type: "String",
      Default: "event-with-me/",
      Description: "S3 key prefix for lambda zips",
    },
    AllowedOrigin: {
      Type: "String",
      Default: "*",
      Description: "CORS origin injected into Lambda responses",
    },
    SourceEmail: {
      Type: "String",
      Default: "noreply@azubisuccess.space",
      Description: "Verified SES sender identity for confirmation emails",
    },
  },
  Resources: lambdaResources,
  Outputs: lambdaOutputs,
};

// ─── api.yaml ────────────────────────────────────────────────────────────────
function integration(funcId) {
  const id = funcId.replace(/Function$/, "");
  return {
    type: "aws_proxy",
    httpMethod: "POST",
    uri: `arn:aws:apigateway:\${AWS::Region}:lambda:path/2015-03-31/functions/\${Uri${id}}/invocations`,
  };
}

function optionsOps() {
  return {
    consumes: ["application/json"],
    produces: ["application/json"],
    "x-amazon-apigateway-integration": {
      type: "mock",
      requestTemplates: { "application/json": '{"statusCode": 200}' },
      responses: {
        default: {
          statusCode: "200",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Headers": "'Content-Type,Authorization'",
            "method.response.header.Access-Control-Allow-Methods": "'GET,POST,PUT,DELETE,OPTIONS'",
            "method.response.header.Access-Control-Allow-Origin": "'*'",
          },
        },
      },
      passthroughBehavior: "when_no_match",
    },
    responses: {
      200: {
        description: "OK",
        headers: {
          "Access-Control-Allow-Headers": { type: "string" },
          "Access-Control-Allow-Methods": { type: "string" },
          "Access-Control-Allow-Origin": { type: "string" },
        },
      },
    },
  };
}

function method(logicalId, authed) {
  const m = {
    "x-amazon-apigateway-integration": integration(logicalId),
    responses: { 200: { description: "OK" } },
  };
  if (authed) m.security = [{ cognitoAuthorizer: [] }];
  return m;
}

const apiBody = {
  swagger: "2.0",
  info: { title: `${BASE}-api`, version: "1.0" },
  // Authorizer must be declared inline in securityDefinitions WITH
  // x-amazon-apigateway-authtype; without the authtype key the importer
  // silently drops the scheme ("unexpected name or location").
  securityDefinitions: {
    cognitoAuthorizer: {
      type: "apiKey",
      name: "Authorization",
      in: "header",
      "x-amazon-apigateway-authtype": "cognito_user_pools",
      "x-amazon-apigateway-authorizer": {
        type: "cognito_user_pools",
        identitySource: "method.request.header.Authorization",
        providerARNs: ["${PoolArn}"],
      },
    },
  },
  paths: {
    "/events": {
      get: method("ListEventsFunction", false),
      post: method("CreateEventFunction", true),
      options: optionsOps(),
    },
    "/events/{eventId}": {
      get: method("GetEventFunction", false),
      put: method("UpdateEventFunction", true),
      delete: method("DeleteEventFunction", true),
      options: optionsOps(),
    },
    "/events/{eventId}/register": {
      post: method("RegisterParticipantFunction", false),
      options: optionsOps(),
    },
    "/events/{eventId}/registrations": {
      get: method("ListRegistrationsFunction", true),
      options: optionsOps(),
    },
    "/events/{eventId}/walk-in": {
      post: method("WalkInRegistrationFunction", true),
      options: optionsOps(),
    },
    "/registrations/by-email/{email}": {
      get: method("GetRegistrationsFunction", true),
      options: optionsOps(),
    },
    "/registrations/{id}": {
      get: method("GetRegistrationFunction", true),
      put: method("UpdateRegistrationFunction", true),
      delete: method("DeleteRegistrationFunction", true),
      options: optionsOps(),
    },
    "/registrations/{id}/checkin": {
      post: method("CheckInFunction", true),
      options: optionsOps(),
    },
    "/registrations/{id}/print": {
      post: method("PrintBadgeFunction", true),
      options: optionsOps(),
    },
    "/audit": {
      get: method("GetAuditLogFunction", true),
      options: optionsOps(),
    },
  },
};

const apiResources = {
  Api: {
    Type: "AWS::ApiGateway::RestApi",
    Properties: {
      Name: `${BASE}-api`,
      // JSON body rendered under Fn::Sub: ${PoolArn} and every lambda-uri
      // placeholder come from the variable map below.
      Body: {
        "Fn::Sub": [
          JSON.stringify(apiBody),
          {
            PoolArn: imp("auth-UserPoolArn"),
            ...Object.fromEntries(FUNCS.map((f) => [`Uri${f.id}`, imp(`lambdas-${f.id}Arn`)])),
          },
        ],
      },
      EndpointConfiguration: { Types: ["REGIONAL"] },
    },
  },
};
const apiPermissions = {};
for (const f of FUNCS) {
  apiPermissions[`${f.id}ApiPermission`] = {
    Type: "AWS::Lambda::Permission",
    Properties: {
      Action: "lambda:InvokeFunction",
      FunctionName: imp(`lambdas-${f.id}Arn`),
      Principal: "apigateway.amazonaws.com",
      SourceArn: sub(`arn:aws:execute-api:\${AWS::Region}:\${AWS::AccountId}:\${Api}/*`),
    },
  };
}
Object.assign(apiResources, apiPermissions, {
  ApiDeployment: {
    Type: "AWS::ApiGateway::Deployment",
    DependsOn: Object.keys(apiPermissions),
    // No StageName here: the ApiStage resource owns the stage; a
    // deployment that also creates it collides with it.
    // Note: a body change does NOT replace this resource (Description is
    // mutable to CFN), so deploy-stack.sh runs `create-deployment --stage
    // prod` after every update to repoint the stage at a fresh snapshot.
    Properties: { RestApiId: ref("Api") },
  },
  ApiStage: {
    Type: "AWS::ApiGateway::Stage",
    Properties: {
      RestApiId: ref("Api"),
      DeploymentId: ref("ApiDeployment"),
      StageName: ref("StageName"),
      MethodSettings: [
        { ResourcePath: "/*", HttpMethod: "*", ThrottlingBurstLimit: 50, ThrottlingRateLimit: 25 },
      ],
    },
  },
});

const api = {
  ...header("edge (API Gateway)"),
  Parameters: {
    StageName: { Type: "String", Default: "prod" },
  },
  Resources: apiResources,
  Outputs: {
    ApiBaseUrl: exported(
      sub(`https://\${Api}.execute-api.\${AWS::Region}.amazonaws.com/\${StageName}`),
      "api-BaseUrl",
    ),
  },
};

writeFileSync(here("auth.yaml"), JSON.stringify(auth, null, 2));
writeFileSync(here("data.yaml"), JSON.stringify(data, null, 2));
writeFileSync(here("lambdas.yaml"), JSON.stringify(lambdas, null, 2));
writeFileSync(here("api.yaml"), JSON.stringify(api, null, 2));
console.log(`Wrote auth.yaml, data.yaml, lambdas.yaml, api.yaml (base: ${BASE})`);
