import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
export const db = DynamoDBDocumentClient.from(client);

export const EVENTS_TABLE = process.env.EVENTS_TABLE;
export const REGISTRATIONS_TABLE = process.env.REGISTRATIONS_TABLE;
export const AUDIT_TABLE = process.env.AUDIT_TABLE;
