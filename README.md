# Application Programming Interface
## Database System of Syllabus of the Subjects of the Federal University of Bahia

# Get Starded

## Install dependencies
```sh
npm install
```

## Enviroments
Make sure to create a `.env` in the root level on your local machine beforehand. Check the existing variables at `./.env.example`

### Mailer (SMTP opcional em desenvolvimento)

- O sistema funciona sem SMTP real em ambiente de desenvolvimento.
- Quando `MAILER_MOCK=true`, o envio de e-mail é simulado (logado no backend) e o fluxo de convite/cadastro continua normalmente.
- Mesmo com `MAILER_MOCK=false`, se `MAILER_USER`/`MAILER_PASSWORD` não estiverem definidos, o backend entra em fallback mock automaticamente.
- Para envio real, defina `MAILER_USER` e `MAILER_PASSWORD` válidos e use `MAILER_MOCK=false`.

### Convite por e-mail (admin)

- Rota: `POST /api/users/invite-email`
- Autorização: usuário autenticado com papel `admin` ou `super_admin`.
- Payload:

```json
{
	"email": "jamilsonj@ufba.br",
	"registrationBaseUrl": "http://localhost:3000"
}
```

- Resultado: gera token de convite, monta o link `/cadastrar/{token}` e envia por e-mail (ou mock/fallback quando SMTP não estiver ativo).

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

## Automatic import on startup (empty database)

If you want the API to automatically import components when starting with an empty `components` table, enable the startup bootstrap vars in `.env`:

```sh
BOOTSTRAP_IMPORT_ON_EMPTY_DB=true
BOOTSTRAP_IMPORT_SOURCE=sigaa-public
BOOTSTRAP_ADMIN_EMAIL=jamilsonj@ufba.br
BOOTSTRAP_ADMIN_NAME=Jamilson
BOOTSTRAP_ADMIN_PASSWORD=Ementas@2026
BOOTSTRAP_SIGAA_SOURCE_TYPE=department
BOOTSTRAP_SIGAA_SOURCE_ID=1114
BOOTSTRAP_SIGAA_ACADEMIC_LEVEL=graduacao
```

Notes:

- Import runs only when `components` is empty.
- The bootstrap user is created/promoted as `super_admin` automatically for the operation.
- For SIAC source, set `BOOTSTRAP_IMPORT_SOURCE=siac` and provide `BOOTSTRAP_SIAC_CD_CURSO` plus `BOOTSTRAP_SIAC_NU_PER_CURSO_INICIAL`.

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

- The API uses a canonical DOCX template to generate all official exported documents.
- Required file name: `UFBA_TEMPLATE.docx` in the API root folder.
- If the template is missing, export fails with explicit server error.

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

- Official PDF is generated strictly from the official DOCX (template-first) to preserve layout fidelity.
- Required converter: LibreOffice (headless) available in host/container.
- If LibreOffice is unavailable, PDF export returns error (no HTML fallback) to avoid fidelity drift.

### Production/Container notes

- Recommended runtime base image: Debian slim with LibreOffice installed.
- Environment variables:
	- `LIBREOFFICE_BIN` (default in Dockerfile: `/usr/bin/libreoffice`)
	- `PDF_CONVERSION_TIMEOUT_MS` (default: `45000`)
- Conversion runs with an isolated LibreOffice user profile per request to reduce cross-request interference and improve reproducibility.

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

