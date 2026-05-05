# Application Programming Interface
## Database System of Syllabus of the Subjects of the Federal University of Bahia

# Get Starded

## Install dependencies
```sh
npm install
```

## Enviroments
Make sure to create a `.env` in the root level on your local machine beforehand. Check the existing variables at `./.env.example`

## Postgresql
Run `npm run postgres:create` to create and run a docker image for a Postgres server.

If you use `docker compose`, the local PostgreSQL port exposed by this project is `15432` to avoid conflicts with a host PostgreSQL already running on `5432`.

## Test Database
Make sure `DB_TEST_NAME` exists before running tests. With Docker Compose, you can create it with:

```sh
docker exec ementas-api-postgres-1 psql -U admin -d postgres -c "CREATE DATABASE testdatabase;"
```

## Migrations
### Running migrations
Run `npm run migration:run` in order to execute the migrations locally. Although is worth mentioning that `npm run dev` will run the migrations too.
### Reverting migrations
Run `npm run migration:revert` to revert all migrations.
### Generate migrations
Run `npm run migration:generate migration_name` to generate a new migration based in changes made on entities. Make sure to run `migration:run` before that to keep the migration in order and avoid issues.
### Create migration
Run `npm run migration:create migration_name` in order to manually create migrations. This will create a template migration file that can be used to make changes in the database that doesn't require a change in the entities, for example: inserting data, installing plugins, create new users etc.

## Development database reset

When you need to rebuild the local database from scratch during development:

```sh
npm run db:reset:dev
```

This command drops and recreates schema `public`, then reapplies migrations.

## SIGAA reconciliation for existing components

To reconcile already imported components with richer SIGAA metadata (including prerequisites) without hardcoded course rules:

```sh
npm run sigaa:reconcile -- --sourceType=department --sourceId=1114 --academicLevel=graduacao
```

Optional operator selection by e-mail:

```sh
npm run sigaa:reconcile -- --sourceType=program --sourceId=1820 --academicLevel=mestrado --userEmail=admin@ufba.br
```

## SIAC reconciliation for existing components

To import/reconcile components by curriculum course (usually richer in prerequisites):

```sh
npm run siac:reconcile -- --cdCurso=112140 --nuPerCursoInicial=20111
```

Optional operator selection by e-mail:

```sh
npm run siac:reconcile -- --cdCurso=112140 --nuPerCursoInicial=20111 --userEmail=admin@ufba.br
```

## DOCX template for export

- The API uses a generic DOCX template to generate exported documents.
- Default file name: `UFBA_TEMPLATE.docx` in the API root folder.
- Optional override: set `DOCX_TEMPLATE_PATH` in `.env` with an absolute path or a path relative to the API root.
- Legacy compatibility: if `UFBA_TEMPLATE.docx` is not found, the API still attempts `IC045.docx`.

### Recommended placeholders for higher fidelity

To preserve UFBA crest, fonts and layout, edit only text placeholders in the DOCX template and keep style definitions untouched:

- `{{COMPONENT_CODE}}`
- `{{COMPONENT_NAME}}`
- `{{DEPARTMENT}}`
- `{{SEMESTER}}`
- `{{PREREQUERIMENTS}}`
- `{{SYLLABUS}}`
- `{{OBJECTIVE}}`
- `{{PROGRAM}}`
- `{{METHODOLOGY}}`
- `{{LEARNING_ASSESSMENT}}`
- `{{BIBLIOGRAPHY}}`

Backend field mapping used in export:

- `component.code -> {{COMPONENT_CODE}}`
- `component.name -> {{COMPONENT_NAME}}`
- `component.department -> {{DEPARTMENT}}`
- `component.semester -> {{SEMESTER}}`
- `component.prerequeriments -> {{PREREQUERIMENTS}}`
- `component.syllabus -> {{SYLLABUS}}`
- `component.objective -> {{OBJECTIVE}}`
- `component.program -> {{PROGRAM}}`
- `component.methodology -> {{METHODOLOGY}}`
- `component.learningAssessment -> {{LEARNING_ASSESSMENT}}`
- `component.bibliography -> {{BIBLIOGRAPHY}}`

## PDF export runtime

- Preferred conversion: LibreOffice (headless) when available in the host/container.
- Fallback conversion: Puppeteer + Chromium.
- In Docker image, Chromium is installed and exposed via `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser`.

## Run lint
```sh
npm run lint:check
```

## Fix lint errors (if applicable)
```sh
npm run lint:fix
```

## Run typecheck (compile the .ts into .js without creating the dist/ folder)
```sh
npm run typecheck
```

## Start project locally
```sh
npm run dev
```

