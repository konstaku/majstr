// Runs in each worker before any test file (and before any app module is
// required). Several backend modules read env at require time, and bot.js /
// db.js / generateOpenGraph.js call dotenv.config() themselves — dotenv never
// overrides keys that already exist in process.env, so setting controlled
// values here (empty string for "unset") blocks the real .env from leaking in.
process.env.JWT_ACCESS_TOKEN_SECRET = 'test-secret';
process.env.TELEGRAM_BOT_TOKEN = '12345:TEST_FAKE_TOKEN';
process.env.TELEGRAM_BOT_TOKEN_PREV = '';
process.env.TELEGRAM_ADMIN_CHAT_ID = '';
process.env.WEBHOOK_URL = '';
process.env.CERTIFICATE = '';
process.env.KEYFILE = '';
process.env.CERTIFICATE_API = '';
process.env.KEYFILE_API = '';
process.env.AWS_ACCESS_KEY = 'test';
process.env.AWS_SECRET_ACCESS_KEY = 'test';
process.env.S3_BUCKET = 'test-bucket';
process.env.ALLOWED_ORIGINS = '';
process.env.REVALIDATE_SECRET = '';
process.env.MONGO_PASSWORD = 'unused';
process.env.MONGO_URI = process.env.MONGO_TEST_URI || 'mongodb://127.0.0.1:1/unused';
