# Development Conventions

## File & Class Naming
- File names: kebab-case → `quality-checker.ts`
- Class names: PascalCase → `class QualityChecker`
- Never create: `QualityChecker.ts`, `qualityChecker.ts`, or two files for the same class.
- Before creating a class, search for existing similar names. Merge duplicates — never add a parallel file.

## SOLID (enforced)
- **S**: One class, one reason to change.
- **O**: Extend behaviour without modifying existing code.
- **D**: Depend on abstractions. Use constructor injection everywhere.
- No tight coupling. Create focused interfaces per consumer.

## Build & Link
After any structural change (new file, fixed compile error, restructured imports):
```
npm run build
npm link
codeseeker --help   ← verify Claude Code can reach it
```

## File Creation Rules
Do exactly what was asked, nothing more.
Never create `*-enhanced.ts`, `*-v2.ts`, `*-improved.ts` — edit the original.
Never create documentation files unless explicitly requested by name.

## Architecture Layers (dependency direction: → means "may import")
```
src/mcp/ → src/cli/ → src/storage/
src/cli/commands/ → src/cli/services/ → src/storage/
```
Cross-layer imports in the wrong direction are forbidden.
