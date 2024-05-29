const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const output = fs.createWriteStream(path.resolve(__dirname, 'extension.zip'));
const archive = archiver('zip', {
  zlib: { level: 9 } // Set the compression level
});

output.on('close', function () {
  console.log(archive.pointer() + ' total bytes');
  console.log('Extension zip has been finalized.');
});

archive.on('error', function (err) {
  throw err;
});

// Pipe archive data to the file
archive.pipe(output);

// Append files from the 'dist' directory
archive.directory('dist/', false);

// Append manifest and icon files
archive.file('src/manifest.json', { name: 'manifest.json' });
archive.directory('src/icons/', 'icons');

archive.finalize();
