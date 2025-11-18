// imganalyser.js
import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const getDominantColors = (imageUrl) => {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, 'dominant_color.py');

    execFile(
      'python3',
      [scriptPath, imageUrl],
      (error, stdout, stderr) => {
        if (error) {
          console.error('Python error:', stderr.toString().trim() || error.message);
          return resolve(null);
        }

        const out = stdout.toString().trim();
        try {
          const data = JSON.parse(out);
          resolve(data);
        } catch (e) {
          console.error('JSON parse error:', out);
          resolve(null);
        }
      }
    );
  });
};

// Test
//(async () => {
//  const TEST_IMAGE_URL = 'https://i.scdn.co/image/ab67616d0000b273cc0a502a680b72631ada6193';
//
//  console.log('\n--- Color Extraction Test (overall + corners + center) ---');
//  const data = await getDominantColors(TEST_IMAGE_URL);
//
//  console.log(JSON.stringify(data, null, 2));
//})();
