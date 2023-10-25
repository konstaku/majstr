const mongoose = require('mongoose');
const AWS = require('aws-sdk');
require('dotenv').config();

const MONGO_PASSWORD = process.env.MONGO_PASSWORD;
const uri = `mongodb+srv://0864380:${MONGO_PASSWORD}@piglets.vfyjg2w.mongodb.net/`;
const COOKIE = process.env.INSTAGRAM_COOKIE;
const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

const masterSchema = new mongoose.Schema({
  name: String,
  professionID: String,
  countryID: String,
  locationID: String,
  contacts: [
    {
      contactType: String,
      value: String,
    },
  ],
  about: String,
  photo: String,
  likes: { type: Number, default: 0 },
});

const Master = mongoose.model('Master', masterSchema);

const s3 = new AWS.S3({
  accessKeyId: AWS_ACCESS_KEY,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
});

async function main() {
  await mongoose.connect(uri);
  console.log('Database connected');

  await fetchAndSaveInstagramPhotos();

  return;

  async function fetchAndSaveInstagramPhotos() {
    const masters = await Master.find();

    for await (const master of masters) {
      const instaContact = master.contacts.filter(
        (contact) => contact.contactType === 'instagram'
      );

      console.log('instaContact:', instaContact);

      if (instaContact.length) {
        const handle = instaContact[0].value;
        const id = master._id;

        console.log(`fetching photo for user ${handle}`);

        const photoUrl = await fetch(
          `https://www.instagram.com/${handle}/?__a=1&__d=1`,
          { method: 'GET', headers: { Cookie: COOKIE } }
        )
          .then((response) => response.json())
          .then((result) => result.graphql.user.profile_pic_url)
          .catch(console.error);

        const photo = await fetch(photoUrl)
          .then((response) => response.blob())
          .then((blob) => blob.arrayBuffer())
          .then(Buffer.from)
          .catch(console.error);

        const uploadParams = {
          Bucket: 'chupakabra-test',
          Key: `userpics/${id}.jpg`,
          Body: photo,
        };

        s3.upload(uploadParams, (err, data) => {
          if (err) {
            console.log(err);
            return;
          }

          console.log('Upload to s3 successful', data.Location);

          Master.findByIdAndUpdate(id, {
            photo: data.Location,
          })
            .then(() =>
              console.log(`User ${id} database entry updated successfully`)
            )
            .catch(console.error);
        });
      }
    }
  }
}

main().catch(console.error);
