// Single source of truth for the S3 bucket. The default keeps current
// production behavior; override with S3_BUCKET in .env.
module.exports = {
  S3_BUCKET: process.env.S3_BUCKET || 'chupakabra-test',
};
