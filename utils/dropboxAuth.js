const fs = require('fs');
const path = require('path');
const axios = require('axios');
const fetch = require('isomorphic-fetch');
const {Dropbox} = require('dropbox');
const logger = require ('./logger');

const TOKEN_PATH = path.join(__dirname, '../tokens/.dropbox_tokens.json');
const REDIRECT_URI = process.env.DROPBOX_REDIRECT_URI;
const CLIENT_ID = process.env.DROPBOX_CLIENT_ID;

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
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: 'code',
        redirect_uri: REDIRECT_URI,
        token_access_type: 'offline'
    });

    return `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
};

const exchangeAuthCodeForTokens = async (code) => {
    const url = 'https://api.dropboxapi.com/oauth2/token';
    const params = new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        client_secret: process.env.DROPBOX_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI
    });

    try {
        const response = await axios.post(url, params,{
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
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
        logger.error('Dropbox Auth | Failed to exchange code for tokens', {
            code,
            response: error.response?.data,
            stack: error.stack
          });
        throw error;
    }
};

const getDbxClient = async() => {
    let tokens = loadTokens();
    if (!tokens) throw new Error('No tokens found; run the OAuth flow first');

    if (Date.now() > tokens.expires_at - 60 * 1000) {
        const params = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: tokens.refresh_token,
            client_id: CLIENT_ID,
            client_secret: process.env.DROPBOX_CLIENT_SECRET,
        });

        const response = await axios.post('https://api.dropboxapi.com/oauth2/token', params,{
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const data = response.data;

        tokens.access_token = data.access_token;
        if (data.refresh_token) tokens.refresh_token = data.refresh_token;
        tokens.expires_at = Date.now() + data.expires_in * 1000;
        saveTokens(tokens);
        logger.info('Dropbox Auth | Refreshed Dropbox access token');
    }

    return new Dropbox({
        accessToken: tokens.access_token,
        clientId: CLIENT_ID,
        clientSecret: process.env.DROPBOX_CLIENT_SECRET,
        refreshToken: tokens.refresh_token,
        fetch
    });
};

module.exports = {
    getAuthUrl,
    exchangeAuthCodeForTokens,
    getDbxClient
};
