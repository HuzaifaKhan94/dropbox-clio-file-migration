require('dotenv').config();
const path = require('path');
const express = require('express');
const logger = require('./utils/logger');
const bodyParser = require('body-parser');
const { getDropboxFolderTree, getFileStream } = require('./utils/dropbox');
const { fetchAllMatters } = require('./utils/clio');
const dropboxAuth = require('./utils/dropboxAuth');
const clioAuth = require('./utils/clioAuth');

const app = express();
const PORT = process.env.MAPPING_UI_PORT || 3001;

app.use('/', express.static(path.join(__dirname, 'ui')));
app.use(bodyParser.json());

app.get('/api/dropbox/folders', async (req, res) => {
    try {
        const tree = await getDropboxFolderTree(process.env.DROPBOX_LEADS_FOLDER_PATH);
        res.json({ folders: tree.children.filter( c => c.type === 'folder')});
    } catch (error) {
        logger.error(error);
        res.status(500).json({error: error.message });
    }
});

app.get('/api/clio/matters', async (req, res) => {
    try {
        const matters = await fetchAllMatters();
        res.json({matters});
    } catch (error) {
        logger.error(error);
        res.status(500).json({error: error.message});
    }
});

app.get('/api/mapping', (req, res) => {
    try {
        const mapping = require('./mapping.json');
        res.json({mapping});
    } catch (error) {
        logger.error(error);
        res.status(500).json({ error: 'Cannot load mapping.json' });
    }
});

app.get('/auth/clio/callback', async (req, res) => {
    const {code} = req.query;
    try {
        await clioAuth.exchangeAuthCodeForTokens(code);
        res.json({status: 'ok', message: "Authentication successful"});
    } catch (error) {
        logger.error(error);
        res.status(500).json({error: error.message});
    }
});

app.get('/auth/dropbox/callback', async (req, res) => {
    const {code} = req.query;
    try {
        await dropboxAuth.exchangeAuthCodeForTokens(code);
        res.json({status: 'ok', message: "Authentication successful"});
    } catch (error) {
        logger.error(error);
        res.status(500).json({error: error.message});
    }
});

app.post('/api/mapping', (req, res) => {
    try {
        const mapping = req.body.mapping;
        require('fs').writeFileSync(
            path.join(__dirname, 'mapping.json'),
            JSON.stringify(mapping, null, 2)
        );
        res.json({status: 'ok'});
    } catch (err) {
        logger.error(error);
        res.status(500).json({ error: err.message });
    }
});

logger.info(`Go here to authorize Dropbox: ${dropboxAuth.getAuthUrl()}`);
logger.info(`Go here to authorize Clio: ${clioAuth.getAuthUrl()}`);

app.listen(PORT, () => {
    logger.info(`+---------- Server listening on port ${PORT} ----------+`)
});
