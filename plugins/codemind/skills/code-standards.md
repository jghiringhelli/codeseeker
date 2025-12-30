# CodeMind Coding Standards Skill

This skill helps Claude write code that follows the project's established patterns.

## When to use this skill:
- When writing new code (functions, classes, modules)
- When adding validation logic
- When implementing error handling
- When adding logging
- When writing tests

## How to use:

Before writing code that involves validation, error handling, logging, or testing:

1. Check if `.codemind/coding-standards.json` exists in the project
2. If it exists, read the relevant category:
   - For validation: use the `validation` patterns
   - For error handling: use the `error-handling` patterns
   - For logging: use the `logging` patterns
   - For tests: use the `testing` patterns

3. Follow the `preferred` pattern with highest `confidence`
4. Use the provided `import` statement
5. Match the `example` code style

## Example:

When asked to "add email validation", first check standards:
```json
{
  "validation": {
    "validator-isemail": {
      "preferred": "validator.isEmail()",
      "import": "const validator = require('validator');",
      "confidence": "high"
    }
  }
}
```

Then use that pattern instead of inventing a new one.

## Benefits:
- Maintains code consistency across the project
- Uses battle-tested patterns already in use
- Reduces review feedback on style issues