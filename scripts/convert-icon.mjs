
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const input = 'icons/icon-512.webp';
const output = 'assets/icon.png';

sharp(input)
    .png()
    .toFile(output)
    .then(() => console.log(`Successfully converted ${input} to ${output}`))
    .catch(err => {
        console.error('Error converting icon:', err);
        process.exit(1);
    });
