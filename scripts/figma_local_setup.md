# Local Figma setup

This is a safe local workflow for using your Figma access token without exposing it in the browser or repository.

## 1. Create a local environment file

Create a file named `.env.local` in the project root with:

```bash
FIGMA_ACCESS_TOKEN=your_token_here
```

## 2. Run a local script

You can use a small Node.js script that reads the token from the environment and calls the Figma REST API.

Example:

```bash
node scripts/figma-client.js <file-key>
```

## 3. What the script does

- reads `FIGMA_ACCESS_TOKEN` from the environment
- sends a request to `https://api.figma.com/v1/files/:key`
- prints the file metadata and document structure

## 4. Security notes

- do not commit `.env.local`
- keep the token only on your machine
- use a local shell environment or a `.env.local` file that is ignored by git
