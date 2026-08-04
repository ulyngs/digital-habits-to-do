'use strict';

const {
    SecretsManagerClient,
    GetSecretValueCommand
} = require('@aws-sdk/client-secrets-manager');

/** Default Secrets Manager secret id (name or ARN). Override with BC_SECRETS_NAME. */
const DEFAULT_SECRET_ID = 'digital-habits-todo/basecamp';

const CREDENTIAL_KEYS = ['BC_CLIENT_ID', 'BC_CLIENT_SECRET', 'BC_DEV_CLIENT_SECRET'];

let cached = null;
let loadPromise = null;

function credentialsFromEnv() {
    const fromEnv = {};
    let any = false;
    for (const key of CREDENTIAL_KEYS) {
        const value = process.env[key];
        fromEnv[key] = value || '';
        if (value) {
            any = true;
        }
    }
    return any ? fromEnv : null;
}

function applyToProcessEnv(credentials) {
    for (const key of CREDENTIAL_KEYS) {
        if (credentials[key]) {
            process.env[key] = credentials[key];
        }
    }
}

async function fetchFromSecretsManager() {
    const secretId = process.env.BC_SECRETS_NAME || DEFAULT_SECRET_ID;
    const region =
        process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION_NAME;

    const client = new SecretsManagerClient(region ? { region } : {});
    const response = await client.send(
        new GetSecretValueCommand({ SecretId: secretId })
    );

    if (!response.SecretString) {
        throw new Error(`Secrets Manager secret "${secretId}" has no SecretString`);
    }

    let parsed;
    try {
        parsed = JSON.parse(response.SecretString);
    } catch (error) {
        throw new Error(
            `Secrets Manager secret "${secretId}" must be JSON: ${error.message}`
        );
    }

    const credentials = {};
    for (const key of CREDENTIAL_KEYS) {
        credentials[key] = typeof parsed[key] === 'string' ? parsed[key] : '';
    }

    if (!credentials.BC_CLIENT_SECRET && !credentials.BC_DEV_CLIENT_SECRET) {
        throw new Error(
            `Secrets Manager secret "${secretId}" is missing BC_CLIENT_SECRET / BC_DEV_CLIENT_SECRET`
        );
    }

    return credentials;
}

/**
 * Resolve Basecamp OAuth credentials.
 * - Local / shell: use BC_* process.env values when present.
 * - Amplify WEB_COMPUTE: load once from Secrets Manager via the SSR Compute IAM role.
 */
async function ensureBasecampCredentials() {
    if (cached) {
        return cached;
    }
    if (loadPromise) {
        return loadPromise;
    }

    loadPromise = (async () => {
        const fromEnv = credentialsFromEnv();
        if (fromEnv) {
            cached = fromEnv;
            return cached;
        }

        cached = await fetchFromSecretsManager();
        applyToProcessEnv(cached);
        return cached;
    })().finally(() => {
        loadPromise = null;
    });

    return loadPromise;
}

module.exports = {
    DEFAULT_SECRET_ID,
    ensureBasecampCredentials
};
