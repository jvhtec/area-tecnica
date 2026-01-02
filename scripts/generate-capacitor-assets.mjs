#!/usr/bin/env node
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

async function generateAssets() {
  console.log('Generating Capacitor assets...');

  // 1. Create 1024x1024 icon from 512x512
  console.log('Creating 1024x1024 app icon...');
  await sharp(join(rootDir, 'public/icon-512.png'))
    .resize(1024, 1024, {
      kernel: sharp.kernel.lanczos3,
      fit: 'fill'
    })
    .png()
    .toFile(join(rootDir, 'assets/icon.png'));
  console.log('✓ Created assets/icon.png (1024x1024)');

  // 2. Create 2732x2732 splash screen with centered icon
  console.log('Creating 2732x2732 splash screen...');

  // Read the icon and resize to reasonable splash size (512x512)
  const iconBuffer = await sharp(join(rootDir, 'public/icon-512.png'))
    .resize(512, 512)
    .png()
    .toBuffer();

  // Create white background and composite icon in center
  await sharp({
    create: {
      width: 2732,
      height: 2732,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
    .composite([{
      input: iconBuffer,
      top: Math.floor((2732 - 512) / 2),
      left: Math.floor((2732 - 512) / 2)
    }])
    .png()
    .toFile(join(rootDir, 'assets/splash.png'));
  console.log('✓ Created assets/splash.png (2732x2732)');

  console.log('\nAssets generated successfully!');
  console.log('Run: npx @capacitor/assets generate');
}

generateAssets().catch(console.error);
