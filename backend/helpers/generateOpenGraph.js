const mongoose = require('mongoose');
const AWS = require('aws-sdk');
require('dotenv').config();
const Master = require('./../database/schema/Master');

const MONGO_PASSWORD = process.env.MONGO_PASSWORD;
// const uri = `mongodb+srv://0864380:${MONGO_PASSWORD}@piglets.vfyjg2w.mongodb.net/`;
const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

const { createCanvas, loadImage } = require('canvas');
// const fs = require('fs');
const colorPalette = require('./../data/colors.json');
const Profession = require('./../database/schema/Profession');

// New S3 connection
const s3 = new AWS.S3({
  accessKeyId: AWS_ACCESS_KEY,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
});

async function createOGimageForMaster(master) {
  console.log('Generating OG image for master:', JSON.stringify(master));
  const professions = await Profession.find();

  // Filter out websites and facebook addresses
  const contactsToShow = master.contacts.filter(
    (contact) =>
      contact.contactType !== 'facebook' && contact.contactType !== 'website'
  );

  // Get styles for image
  const {
    dimensions: { width, height, cornerRadius, margin },
    fontStyles: { fontName, fontColor, textMarginLeft, h1, h2, contacts },
  } = generateImageStyles(contactsToShow.length);

  // Logo style
  const logoPosition = {
    w: 239,
    h: 34,
    x: 900,
    y: height - margin - 36 - 24,
  };

  // Create canvas
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');

  // Background fill
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);

  // Card fill
  context.fillStyle = getColorFromId(master._id);
  FillRoundedRect(
    context,
    margin,
    margin,
    width - margin * 2,
    height - margin * 2,
    cornerRadius
  );

  // Put a name on a picture
  context.font = `${h1.weight} ${h1.size}px ${fontName}`;
  context.fillStyle = fontColor;
  const name = removeLastWordIfLong(master.name);
  context.fillText(name, textMarginLeft, h1.marginTop);

  // Put a profession on a picture
  context.font = `${h2.weight} ${h2.size}px ${fontName}`;
  const profession = professions.find(
    (profession) => profession.id === master.professionID
  ).name.ua;
  context.fillText(profession, textMarginLeft, h2.marginTop);

  // Put contacts names on a picture
  context.font = `${contacts.weight} ${contacts.size}px ${fontName}`;
  const contactsNames = contactsToShow
    .map((contact) => contact.contactType + ':')
    .join('\n');
  context.fillText(contactsNames, textMarginLeft, contacts.marginTop);

  // Put contacts values on a picture
  const contactsValues = contactsToShow
    .map((contact) =>
      ['whatsapp', 'viber', 'phone'].includes(contact.contactType)
        ? formatPhoneNumber(contact.value)
        : contact.value
    )
    .join('\n');
  context.fillText(
    contactsValues,
    contacts.valuesMarginLeft,
    contacts.marginTop
  );

  // Render logo and save image
  const logo = await loadImage('./data/img/logo/og-logo.png').catch((err) => {
    console.log('Error loading logo');
    throw err;
  });
  const { w, h, x, y } = logoPosition;
  context.drawImage(logo, x, y, w, h);

  // Upload image to s3
  const imageUrl = await uploadImageToS3(canvas, master);

  // Update master profile
  await Master.findByIdAndUpdate(master._id, {
    OGimage: imageUrl,
  })
    .then(() => console.log(`User ${master._id} OG image updated successfully`))
    .catch(console.error);

  return imageUrl;
}

// Helper function to fill a rectangle with rounded corners
function FillRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
  ctx.fill();
}

// Derives a color from palette based on an ID
function getColorFromId(id) {
  if (!id) return '#ffffff';
  const seed = parseInt(id.toString().slice(-2), 16) % colorPalette.length;
  return colorPalette[seed] + '35';
}

// Formats any phone number to a readable format
function formatPhoneNumber(phoneNumber) {
  const cleaned = phoneNumber.replace(/\D/g, ''); // Remove all non-numeric characters

  const lastTwoBlocksLength = 4; // Length of the last two blocks (XX XX)
  const remainingLength = cleaned.length - lastTwoBlocksLength;

  if (remainingLength > 0) {
    let formattedNumber = cleaned.slice(0, remainingLength);
    const lastTwoBlocks = cleaned.slice(remainingLength);

    // Break the remaining part into chunks of max 3 digits
    const chunks = [];
    while (formattedNumber.length > 0) {
      const chunkLength = Math.min(3, formattedNumber.length);
      chunks.unshift(
        formattedNumber.slice(formattedNumber.length - chunkLength)
      );
      formattedNumber = formattedNumber.slice(
        0,
        formattedNumber.length - chunkLength
      );
    }

    // Construct the final formatted number
    return `+${chunks.join(' ')} ${lastTwoBlocks.match(/\d{2}/g).join(' ')}`;
  }

  // Return the original input if it doesn't match the criteria
  return phoneNumber;
}

// Removes last piece of name if it won't fit
function removeLastWordIfLong(str) {
  if (str.length > 20) {
    // Split the string into words
    const words = str.split(' ');

    if (words.length > 1) {
      // Remove the last word from the array
      words.pop();

      // Join the remaining words back into a string
      return words.join(' ');
    }
  }

  // Return the original string if it's not longer than 20 characters or has only one word
  return str;
}

// Calculate styles for a contact
function generateImageStyles(numberOfContacts) {
  // Dimensions and margins
  const width = 1200;
  const height = 627;
  const margin = 24;
  const cornerRadius = 40;

  // Font styles
  const fontName = 'Unbounded';
  const fontColor = '#171923';
  const textMarginLeft = margin + 36;
  // h1
  const h1Size = 72;
  const h1Weight = 600;
  const h1MarginTop = 72 + h1Size;
  // h2
  const h2Size = 48;
  const h2Weight = 400;
  const h2MarginTop = h1MarginTop + margin + h2Size;
  // contacts
  const contactsSize = 32;
  const contactsWeight = 400;
  const contactsMarginTop =
    height - margin - 36 - numberOfContacts * contactsSize;
  const contactsValuesMarginLeft = 240 + textMarginLeft;

  return {
    dimensions: {
      width,
      height,
      margin,
      cornerRadius,
    },
    fontStyles: {
      fontName,
      fontColor,
      textMarginLeft,
      h1: {
        size: h1Size,
        weight: h1Weight,
        marginTop: h1MarginTop,
      },
      h2: {
        size: h2Size,
        weight: h2Weight,
        marginTop: h2MarginTop,
      },
      contacts: {
        size: contactsSize,
        weight: contactsWeight,
        marginTop: contactsMarginTop,
        valuesMarginLeft: contactsValuesMarginLeft,
      },
    },
  };
}

// Uploader function
async function uploadImageToS3(canvas, master) {
  const buffer = canvas.toBuffer('image/png');
  const uploadParams = {
    Bucket: 'chupakabra-test',
    Key: `user-og/${master._id}.jpg`,
    Body: buffer,
  };

  return new Promise((resolve, reject) => {
    s3.upload(uploadParams, (err, data) => {
      if (err) {
        reject(err);
        throw new Error(err);
      }
      console.log('Upload to s3 successful');
      resolve(data.Location);
    });
  }).catch(console.error);
}

// for (const master of masters) {
//   createOGimageForMaster(master);
// }

// Create images for all masters
// fetch('https://api.konstaku.com:5000/?q=masters')
//   .then((response) => {
//     if (response.ok) {
//       return response.json();
//     } else {
//       return Promise.reject(response);
//     }
//   })
//   .then((masters) => {
//     for (const master of masters) {
//       createOGimageForMaster(master);
//     }
//   })
//   .catch((error) => {
//     if (error.name === 'AbortError') return;
//     console.error(error);
//     setIsError(true);
//   });

module.exports = createOGimageForMaster;
