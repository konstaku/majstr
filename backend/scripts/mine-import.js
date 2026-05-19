/**
 * Research-mode ingestion: load a Telegram Desktop JSON export into the
 * RawMessage collection. One-shot deep-study entrypoint (mode: 'research').
 *
 * Idempotent: re-running upserts on (chatID, messageID), so a re-export with
 * newer messages can be re-imported safely with no duplicates.
 *
 * Usage (from backend/):
 *   node scripts/mine-import.js --file ../chat-history/italy/veneto/result.json --chat italy/veneto
 *
 * Args:
 *   --file <path>   REQUIRED — path to result.json
 *   --chat <slug>   optional human label stored on the MiningRun (e.g. italy/veneto)
 *
 * Env (see backend/.env):
 *   MONGO_URI / MONGO_PASSWORD   connection (same as database/db.js)
 *   MONGO_DB_NAME                optional: isolate into a separate DB
 *   MINING_HASH_SALT             REQUIRED — salts the author-id hash
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');

const { runDB } = require('../database/db');
const RawMessage = require('../database/schema/RawMessage');
const MiningRun = require('../database/schema/MiningRun');
const { parseExport } = require('../mining/ingest/parseExport');
const { detectLang } = require('../mining/ingest/detectLang');

function arg(name) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const filePath = arg('--file');
  const chatSlug = arg('--chat') || null;
  if (!filePath) throw new Error('--file <path to result.json> is required');

  const salt = process.env.MINING_HASH_SALT;
  if (!salt) throw new Error('MINING_HASH_SALT is required (see backend/.env)');
  const hashAuthor = (id) =>
    id == null
      ? null
      : crypto.createHmac('sha256', salt).update(String(id)).digest('hex').slice(0, 24);

  const abs = path.resolve(filePath);
  console.log(`Reading ${abs} ...`);
  const exportObj = JSON.parse(fs.readFileSync(abs, 'utf8'));
  const { chat, messages, stats } = parseExport(exportObj);
  console.log(
    `Chat "${chat.name}" (${chat.type}, id ${chat.id}) — ` +
      `${stats.total} entries: ${stats.parsed} text, ${stats.service} service, ${stats.empty} empty`
  );

  await runDB();

  const run = await MiningRun.create({
    mode: 'research',
    chatID: chat.id,
    source: chatSlug || path.basename(abs),
    startedAt: new Date(),
  });

  let upserted = 0;
  let modified = 0;
  let watermark = 0;
  const BATCH = 1000;

  try {
    for (let i = 0; i < messages.length; i += BATCH) {
      const slice = messages.slice(i, i + BATCH);
      const ops = slice.map((m) => {
        if (m.messageID > watermark) watermark = m.messageID;
        const { _fromId, ...rest } = m;
        return {
          updateOne: {
            filter: { chatID: m.chatID, messageID: m.messageID },
            update: {
              $set: {
                ...rest,
                fromHash: hashAuthor(_fromId),
                lang: detectLang(m.text),
                runRef: run._id,
              },
            },
            upsert: true,
          },
        };
      });
      const res = await RawMessage.bulkWrite(ops, { ordered: false });
      upserted += res.upsertedCount || 0;
      modified += res.modifiedCount || 0;
      process.stdout.write(
        `\r  ingested ${Math.min(i + BATCH, messages.length)}/${messages.length}`
      );
    }
    process.stdout.write('\n');

    run.counts.ingested = stats.parsed;
    run.watermark = watermark;
    run.finishedAt = new Date();
    await run.save();

    console.log(
      `Done. run=${run._id} | new=${upserted} updated=${modified} ` +
        `watermark=${watermark}`
    );
  } catch (err) {
    run.error = err.message;
    run.finishedAt = new Date();
    await run.save().catch(() => {});
    throw err;
  } finally {
    await mongoose.disconnect();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('mine-import failed:', err.message);
    process.exit(1);
  });
