const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require ('./logger');
const { clioRequestWithBackoff } = require('./clio');

const TOKEN_PATH = path.join(__dirname, '../tokens/.clio_tokens.json');

const loadTokens = () => {
    if (fs.existsSync(TOKEN_PATH)) {
        return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    }
    return null;
};

const saveTokens = (tokens) => {
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2), {mode: 0o600});
};

const getAuthUrl = () => {
    const state = crypto.randomBytes(16).toString('hex');

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: process.env.CLIO_CLIENT_ID,
        redirect_uri: process.env.CLIO_REDIRECT_URI,
        state: state,
        redirect_on_decline: 'true'
    });

    return `https://eu.app.clio.com/oauth/authorize?${params.toString()}`;
};

const exchangeAuthCodeForTokens = async (code) => {
    const url = 'https://eu.app.clio.com/oauth/token';

    const params = new URLSearchParams({
        client_id: process.env.CLIO_CLIENT_ID,
        client_secret: process.env.CLIO_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.CLIO_REDIRECT_URI
    });

    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };

    try {
        const axiosConfig = {
            method: 'post',
            url,
            headers,
            data: params
        };

        const response = await clioRequestWithBackoff(axiosConfig, {
            maxRetries: 8,
            baseDelay: 1000
        });

        const data = response.data;

        const expiresAt = Date.now() + data.expires_in * 1000;

        const tokens = {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_at: expiresAt
        };

        saveTokens(tokens);
        return tokens;
    } catch (error) {
        logger.error("Clio Auth | Error exchanging authorization code:", {
            code,
            response: error.response?.data,
            stack: error.stack
        });
        throw error;
    }
};

const getAccessToken = async () => {
    let tokens = loadTokens();
    if (!tokens) throw new Error('No tokens found; run the Oauth flow first');

    // Handle refresh for nearly expiring tokens
    if (Date.now() > tokens.expires_at - 60 * 1000) {
        const url = 'https://eu.app.clio.com/oauth/token';

        const params = new URLSearchParams({
            client_id: process.env.CLIO_CLIENT_ID,
            client_secret: process.env.CLIO_CLIENT_SECRET,
            grant_type: 'refresh_token',
            refresh_token: tokens.refresh_token
        });

        const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };

        const axiosConfig = {
            method: 'post',
            url,
            headers,
            data: params
        };

        const response = await clioRequestWithBackoff(axiosConfig, {
            maxRetries: 8,
            baseDelay: 1000
        });

        const data = response.data;

        tokens.access_token = data.access_token;
        if (data.refresh_token) tokens.refresh_token = data.refresh_token;
        if (data.expires_in) {
            tokens.expires_at = Date.now() + data.expires_in * 1000;
        }
        saveTokens(tokens);
        logger.info(`Clio Auth | Refreshed Clio access token`);
    }

    return tokens.access_token;
};

module.exports = {
    getAuthUrl,
    exchangeAuthCodeForTokens,
    getAccessToken
};
