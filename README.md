# Mini Cypris

Mini Cypris is an Angular application for exploring scientific papers from CORE.
The [project brief](docs/project.md) describes the research search experience.

## Setup

Use Node.js **22.23.2** and npm **10.9.8**, as pinned in `.nvmrc` and
`package.json`. If you use nvm, run `nvm install` and `nvm use` from the
repository root. Then install dependencies from `package-lock.json`.

```bash
npm ci
```

## Run locally

```bash
npm start
```

Open [http://localhost:4200](http://localhost:4200) to view the app. The
development server reloads the app when you edit the source.

## Build and test

```bash
npm run build
npm test
```

The production build writes static files to `dist/scipris/browser/`. The test
command runs the Vitest suite once using jsdom.

Run the orchestrator check from the repository root to install from the lockfile,
validate and regenerate the CORE client, build the app, and run tests in CI mode.
The check requires Java 11 or newer for generation.

```bash
bash scripts/verify.sh
```

See the [CORE API client guide](docs/api-client.md) for generation, proxy
configuration, and client usage.
