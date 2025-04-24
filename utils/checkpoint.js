const fs = require('fs');
const path = require('path');
const logger = require ('./logger');

const CHECKPOINT_FILE = path.join('../checkpoints/migration_checkpoint.json');

class Checkpoint {
    constructor() {
        this.data = { cases: {} };

        if (fs.existsSync(CHECKPOINT_FILE)) {
            try {
                this.data = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
            } catch (err) {
                // Backup the corrupted file
                const ts = new Date().toISOString().replace(/[:.]/g,'-');
                const corruptFn = path.join(
                    path.dirname(CHECKPOINT_FILE),
                    `migration_checkpoint.corrupt.${ts}.json`
                );
                fs.renameSync(CHECKPOINT_FILE, corruptFn);
                logger.warn(
                    `⚠️  Checkpoint file was invalid JSON. ` +
                    `Backed it up to ${path.basename(corruptFn)} and starting fresh.`
                );
            }
        }
    }

    _write() {
        fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(this.data, null, 2));
    }

    // --- Case Level ---
    isCaseCompleted(casePath) {
        return this.data.cases[casePath]?.status === 'completed';
    }
    
    markCaseStarted(casePath) {
        if (!this.data.cases[casePath]) {
            this.data.cases[casePath] = { status: 'in-progress', files: {} };
            this._write();
        }
    }

    markCaseCompleted(casePath) {
        this.data.cases[casePath].status = 'completed';
        this._write();
    }

    // --- File Level ---

  // --- File level ---
    isFileCompleted(casePath, filePath) {
        return this.data.cases[casePath]?.files[filePath]?.status === 'completed';
    }
    markFileCompleted(casePath, filePath, info = {}) {
        const c = this.data.cases[casePath];
        if (!c) throw new Error(`Case not initialized: ${casePath}`);
        c.files[filePath] = { status: 'completed', ...info };
        this._write();
    }
    markFileFailed(casePath, filePath, error) {
        const c = this.data.cases[casePath];
        if (!c) throw new Error(`Case not initialized: ${casePath}`);
        c.files[filePath] = { status: 'failed', error, timestamp: new Date().toISOString() };
        this._write();
    }

}

module.exports = new Checkpoint();
