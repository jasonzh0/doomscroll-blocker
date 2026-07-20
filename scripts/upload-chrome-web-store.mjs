import { readFile } from 'node:fs/promises';

const [packagePath] = process.argv.slice(2);

if (!packagePath) {
  throw new Error(
    'Usage: node scripts/upload-chrome-web-store.mjs <package.zip>'
  );
}

const accessToken = requiredEnv('CWS_ACCESS_TOKEN');
const publisherId = requiredEnv('CWS_PUBLISHER_ID');
const extensionId = requiredEnv('CWS_EXTENSION_ID');
const itemName = `publishers/${publisherId}/items/${extensionId}`;
const authorization = `Bearer ${accessToken}`;

const upload = await request(
  `https://chromewebstore.googleapis.com/upload/v2/${itemName}:upload`,
  {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/zip',
    },
    body: await readFile(packagePath),
  }
);

let uploadState = upload.uploadState;

for (
  let attempt = 0;
  uploadState === 'IN_PROGRESS' && attempt < 12;
  attempt += 1
) {
  await new Promise((resolve) => setTimeout(resolve, 5_000));
  const status = await request(
    `https://chromewebstore.googleapis.com/v2/${itemName}:fetchStatus`,
    { headers: { Authorization: authorization } }
  );
  uploadState = status.lastAsyncUploadState ?? 'IN_PROGRESS';
}

if (uploadState !== 'SUCCEEDED') {
  throw new Error(`Chrome Web Store upload ended in state: ${uploadState}`);
}

console.log(
  `Uploaded ${extensionId} version ${
    upload.crxVersion ?? 'successfully'
  } to Chrome Web Store.`
);

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function request(url, options) {
  const response = await fetch(url, options);
  const responseText = await response.text();
  let body;

  try {
    body = JSON.parse(responseText);
  } catch {
    throw new Error(
      `Chrome Web Store API returned invalid JSON (${response.status}).`
    );
  }

  if (!response.ok) {
    throw new Error(
      `Chrome Web Store API request failed (${response.status}): ${
        body.error?.message ?? responseText
      }`
    );
  }

  return body;
}
