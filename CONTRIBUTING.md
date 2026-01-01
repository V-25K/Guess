# Contributing to Linkaroo

## Development Setup
1. Clone the repository
2. Run `npm install`
3. Create a `.env` file with required settings (see `devvit.json` for required keys)
4. Run `npm run dev` for local testing

## Code Standards
- Use TypeScript strict mode
- Follow existing naming conventions (camelCase functions, PascalCase types)
- Add JSDoc comments for public methods
- Run `npm run type-check` before committing

## Testing
- Run `npm run test` for unit tests
- Run `npm run test:coverage` for coverage report
- Add tests for new features

## Deployment
1. Run `npm run predeploy` to validate
2. Run `npm run deploy` to upload to Reddit
3. Test on playtest subreddit before publishing
