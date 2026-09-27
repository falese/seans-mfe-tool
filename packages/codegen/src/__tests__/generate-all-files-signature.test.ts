/**
 * `generateAllFiles` carries no option it ignores (#332).
 *
 * It used to accept `force` and `dryRun` and read neither: it is a pure
 * plan+render and never writes, so both belong to `writeGeneratedFiles`, which
 * honours them. A caller passing `dryRun: true` — and #140's premise is that
 * agent code calls this directly — reasonably expected it to mean something.
 *
 * Test files are excluded from typecheck (ts-jest runs with isolatedModules),
 * so an ordinary call here could not prove anything about the signature. This
 * asks the TypeScript checker for the declared options type instead.
 */
import * as path from 'path';
import * as ts from 'typescript';

const SOURCE = path.resolve(__dirname, '..', 'unified-generator.ts');

function declaredOptionKeys(): string[] {
  const program = ts.createProgram([SOURCE], {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    esModuleInterop: true,
    strict: true,
    skipLibCheck: true,
    noEmit: true,
  });
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(SOURCE);
  if (!sourceFile) throw new Error(`cannot load ${SOURCE}`);

  let keys: string[] | undefined;
  sourceFile.forEachChild((node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'generateAllFiles') {
      const options = node.parameters[2];
      const type = checker.getNonNullableType(checker.getTypeAtLocation(options));
      keys = checker.getPropertiesOfType(type).map((p) => p.getName()).sort();
    }
  });
  if (!keys) throw new Error('generateAllFiles not found');
  return keys;
}

describe('generateAllFiles signature (#332)', () => {
  it('accepts only the options it reads', () => {
    expect(declaredOptionKeys()).toEqual(['frameworkVariant']);
  }, 60_000);
});
