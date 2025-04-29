const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');
const migrateDropboxPathIntoClio = require('./core');

const mappingPath = path.join(__dirname, "../../mapping.json");

const runMigration = async () => {
    if (!fs.existsSync(mappingPath)) {
        logger.error("Mapping file not found!");
        process.exit(1);
    }

    const mappings = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));

    logger.info(`Starting migration for ${mappings.length} mappings`);

    for (const [index, map] of mappings.entries()) {
        const {matterId, folderPath, display_number} = map;

        logger.info(`[${index + 1}/${mappings.length}] Migrating matter ${display_number} (Matter ID: ${matterId}) from Dropbox folder: ${folderPath}`);

        try {
            await migrateDropboxPathIntoClio(folderPath, matterId);
            logger.info(`✅ Successfully migrated ${display_number}`);
        } catch (error) {
            logger.error(`❌ Failed migrating ${display_number}:`, error);
        }
    }
    logger.info('🎉 Migration run completed.');
};

runMigration();
