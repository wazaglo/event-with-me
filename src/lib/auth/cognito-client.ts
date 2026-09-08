import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
} from "amazon-cognito-identity-js";

const poolData = {
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID as string,
  ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID as string,
};

export const userPool = new CognitoUserPool(poolData);

export interface CognitoSession {
  idToken: string;
  accessToken: string;
  email: string;
  name: string;
  groups: string[];
  sub: string;
}

function parseGroups(idToken: string): string[] {
  try {
    const payload = JSON.parse(atob(idToken.split(".")[1]));
    return payload["cognito:groups"] ?? [];
  } catch {
    return [];
  }
}

function parsePayload(idToken: string): Record<string, string> {
  try {
    return JSON.parse(atob(idToken.split(".")[1]));
  } catch {
    return {};
  }
}

// Holds the CognitoUser mid-challenge so completeNewPassword can use it
let pendingNewPasswordUser: CognitoUser | null = null;
let pendingUserAttributes: Record<string, string> = {};

export function signIn(email: string, password: string): Promise<CognitoSession> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool });
    const authDetails = new AuthenticationDetails({ Username: email, Password: password });

    user.authenticateUser(authDetails, {
      onSuccess(result) {
        pendingNewPasswordUser = null;
        pendingUserAttributes = {};
        const idToken = result.getIdToken().getJwtToken();
        const payload = parsePayload(idToken);
        resolve({
          idToken,
          accessToken: result.getAccessToken().getJwtToken(),
          email: payload.email ?? email,
          name: payload.name ?? payload.email ?? email,
          groups: parseGroups(idToken),
          sub: payload.sub ?? "",
        });
      },
      onFailure(err) {
        reject(new Error(err.message ?? "Sign in failed"));
      },
      newPasswordRequired(userAttributes, _requiredAttributes) {
        pendingNewPasswordUser = user;
        // Strip non-writable Cognito fields, ensure name is always present
        const { email_verified, phone_number_verified, ...writableAttrs } = userAttributes;
        void email_verified;
        void phone_number_verified;
        if (!writableAttrs.name) writableAttrs.name = writableAttrs.email ?? email;
        pendingUserAttributes = writableAttrs;
        reject(new Error("NEW_PASSWORD_REQUIRED"));
      },
    });
  });
}

export function completeNewPassword(newPassword: string): Promise<CognitoSession> {
  return new Promise((resolve, reject) => {
    if (!pendingNewPasswordUser) {
      return reject(new Error("No pending password challenge. Please sign in again."));
    }
    pendingNewPasswordUser.completeNewPasswordChallenge(newPassword, pendingUserAttributes, {
      onSuccess(result) {
        pendingNewPasswordUser = null;
        pendingUserAttributes = {};
        const idToken = result.getIdToken().getJwtToken();
        const payload = parsePayload(idToken);
        resolve({
          idToken,
          accessToken: result.getAccessToken().getJwtToken(),
          email: payload.email ?? "",
          name: payload.name ?? payload.email ?? "",
          groups: parseGroups(idToken),
          sub: payload.sub ?? "",
        });
      },
      onFailure(err) {
        reject(new Error(err.message ?? "Password change failed"));
      },
    });
  });
}

export function signOut(): void {
  const user = userPool.getCurrentUser();
  if (user) user.signOut();
}

export function getSession(): Promise<CognitoSession | null> {
  return new Promise((resolve) => {
    const user = userPool.getCurrentUser();
    if (!user) return resolve(null);

    user.getSession(
      (
        err: Error | null,
        session: {
          isValid: () => boolean;
          getIdToken: () => { getJwtToken: () => string };
          getAccessToken: () => { getJwtToken: () => string };
        } | null,
      ) => {
        if (err || !session || !session.isValid()) return resolve(null);
        const idToken = session.getIdToken().getJwtToken();
        const payload = parsePayload(idToken);
        resolve({
          idToken,
          accessToken: session.getAccessToken().getJwtToken(),
          email: payload.email ?? "",
          name: payload.name ?? payload.email ?? "",
          groups: parseGroups(idToken),
          sub: payload.sub ?? "",
        });
      },
    );
  });
}

export function forgotPassword(email: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool });
    user.forgotPassword({
      onSuccess: () => resolve(),
      onFailure: (err) => reject(new Error(err.message)),
    });
  });
}

export function confirmPassword(email: string, code: string, newPassword: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool });
    user.confirmPassword(code, newPassword, {
      onSuccess: () => resolve(),
      onFailure: (err) => reject(new Error(err.message)),
    });
  });
}
