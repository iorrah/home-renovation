# Home Renovation Web App

The frontend for the Home Renovation platform, where contractors manage renovation projects and homeowners follow their progress. It talks to the Home Renovation API over GraphQL, with a WebSocket connection for real-time updates.

## Features

- Log in with role-based access for contractors and homeowners
- Create, edit, and delete jobs and track their status
- View job history, with undo and redo of changes
- Chat in real time with the homeowner on a project
- Export PDF reports

## Screenshots

### Login

![Login page with username and password fields](../docs/screenshots/01%20Login.png)

### Jobs

![Jobs list for a contractor, showing each job's status, address, cost and homeowners](../docs/screenshots/02%20Jobs.png)

### Job details

![Job details page with details, homeowners, report export and history on the left, and the live chat on the right](../docs/screenshots/03%20Job%20Details.png)

### New job

![New job form with description, address and cost fields](../docs/screenshots/04%20Add%20Job.png)

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Data:** GraphQL, graphql-ws, TanStack React Query
- **Forms and validation:** React Hook Form, Zod
- **UI:** shadcn/ui (Radix), Tailwind CSS 4, Lucide Icons, Sonner

## Getting Started

The API must be running at http://localhost:4000.

From the repository root:

    pnpm dev:app

The app will be available at http://localhost:3000.

## Scripts

Run these from the `app` package:

| Script           | Description                                         |
| ---------------- | --------------------------------------------------- |
| `pnpm dev`       | Start the dev server on port 3000                   |
| `pnpm build`     | Create a production build                           |
| `pnpm start`     | Serve the production build on port 3000             |
| `pnpm lint`      | Lint with ESLint                                    |
| `pnpm typecheck` | Generate Next.js types and run the TypeScript check |
| `pnpm format`    | Format the code with Prettier                       |
