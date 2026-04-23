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
docker exec api-bdcp-postgres-1 psql -U admin -d postgres -c "CREATE DATABASE testdatabase;"
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
