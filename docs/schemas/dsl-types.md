# DSL Type System

Source of truth: `src/dsl/type-system.ts`. Governs the `type` field on every
`DSLInput` and `DSLOutput` in a capability declaration.

Refs: ADR-006 (unified type system), REQ-047.

---

## Design principle

Types in the DSL follow **GraphQL nullability conventions**: a bare type name is
**nullable by default**; append `!` to mark a field as required/non-null.

This convention is consistent throughout — in the DSL type string, in generated
GraphQL schemas, and in generated TypeScript. It means:

- `string` → nullable string (the field may be absent or null)
- `string!` → required string (the field must be present and non-null)

---

## Type categories

### Primitives

| DSL type | TypeScript equivalent | GraphQL scalar |
|---|---|---|
| `string` | `string \| null` | `String` |
| `number` | `number \| null` | `Float` |
| `boolean` | `boolean \| null` | `Boolean` |
| `object` | `Record<string, unknown> \| null` | `JSON` (custom scalar) |
| `array` | See [Array types](#array-types) | — |

### Specialized (platform-provided)

These map to custom GraphQL scalars and carry semantic validation.

| DSL type | Semantic | TypeScript equivalent | GraphQL scalar |
|---|---|---|---|
| `jwt` | JSON Web Token | `string \| null` | `JWT` |
| `datetime` | ISO-8601 timestamp | `string \| null` | `DateTime` |
| `email` | RFC 5322 email address | `string \| null` | `EmailAddress` |
| `url` | Absolute URL | `string \| null` | `URL` |
| `id` | Opaque identifier | `string \| null` | `ID` |
| `file` | Binary file upload | `File \| null` | `Upload` |
| `element` | DOM/host element reference | `HTMLElement \| null` | `Element` |

### Custom types

Teams define additional types in the `types:` section of the manifest (ADR-008). Custom
types are opaque objects unless a resolver is provided. Name them in `PascalCase`.

```yaml
capabilities:
  - GetUser:
      type: domain
      outputs:
        - name: user
          type: User!   # custom type — must be defined in the types: section
```

---

## Nullability

| Syntax | Nullable? | Description |
|---|---|---|
| `string` | yes | Nullable string |
| `string!` | **no** | Required string |
| `array<string>` | yes | Nullable array of nullable strings |
| `array<string!>` | yes | Nullable array of required strings |
| `array<string!>!` | **no** | Required array of required strings |
| `array<string>!` | **no** | Required array of nullable strings |

---

## Array types

Arrays use the syntax `array<ItemType>` where `ItemType` is any valid type string
(including specialized types and custom types). Both the array itself and its items
carry independent nullability:

```
array<User!>!
  └── array      — non-null (! at the end)
        └── User — non-null items (! inside the brackets)
```

### Parsed representation

The runtime parses type strings into `ParsedType`:

```typescript
interface ParsedType {
  baseType: PrimitiveType | SpecializedType | string; // e.g. 'string', 'array', 'User'
  isArray: boolean;
  itemType?: ParsedType;        // populated when isArray = true
  nullability: {
    nullable: boolean;          // true = field may be null/absent
    itemsNullable?: boolean;    // for arrays: true = items may be null
  };
  original: string;             // the raw DSL string
}
```

---

## Type constraints (DSLInput)

Beyond the base type, `DSLInput` supports constraint metadata used for validation
code generation and documentation:

| Constraint | Applicable to | Description |
|---|---|---|
| `values` | any scalar | Restricts to an enumerated set of strings |
| `formats` | `file` | Allowed MIME types, e.g. `['image/png', 'image/jpeg']` |
| `default` | any | Default value when the input is absent |

Additional constraints (`minLength`, `maxLength`, `pattern`, `min`, `max`, `minItems`,
`maxItems`) are defined in `TypeConstraints` in `type-system.ts` and are available for
validator code generation but are not yet propagated through the Zod manifest schema
directly.

---

## GraphQL mapping

When the codegen builds a GraphQL schema from the DSL, each type string maps to a
scalar. The mapping is implemented in `toGraphQLType()` in `type-system.ts`.

| DSL | GraphQL |
|---|---|
| `string` | `String` |
| `string!` | `String!` |
| `number` | `Float` |
| `boolean` | `Boolean` |
| `id` | `ID` |
| `datetime` | `DateTime` |
| `email` | `EmailAddress` |
| `url` | `URL` |
| `jwt` | `JWT` |
| `file` | `Upload` |
| `element` | `Element` |
| `array<T>` | `[GraphQL(T)]` |
| `array<T!>!` | `[GraphQL(T)!]!` |
| `CustomType` | `CustomType` (passed through) |

---

## Usage in manifests

```yaml
capabilities:
  - SubmitScore:
      type: domain
      inputs:
        - name: gameId
          type: id!               # required opaque ID
        - name: score
          type: number!           # required number
        - name: metadata
          type: object            # optional freeform object
        - name: attachments
          type: array<file!>      # nullable array of required files
          formats: [image/png, image/jpeg]
      outputs:
        - name: leaderboardRank
          type: number!
        - name: badges
          type: array<string!>!   # required array of required strings
```
