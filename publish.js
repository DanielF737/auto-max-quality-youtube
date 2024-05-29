require('dotenv').config();

const webstore = require('chrome-webstore-upload')({
  extensionId: process.env.EXTENSION_ID,
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  refreshToken: process.env.REFRESH_TOKEN
});

const fs = require('fs');
const path = require('path');

const zipPath = path.resolve(__dirname, 'extension.zip');

async function uploadAndPublish() {
  // Read the ZIP file
  const extensionSource = fs.createReadStream(zipPath);

  try {
    // Upload the ZIP file
    console.log('Uploading the extension...');
    const uploadResponse = await webstore.upload({ source: extensionSource });
    console.log('Upload Response:', uploadResponse);

    // Publish the extension
    console.log('Publishing the extension...');
    const publishResponse = await webstore.publish();
    console.log('Publish Response:', publishResponse);

  } catch (error) {
    console.error('Error during upload and publish:', error);
  }
}

uploadAndPublish();
