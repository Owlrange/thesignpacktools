# Major, Minor and Patch

The version of The Sign Pack Tools follows the format:

```text
MAJOR.MINOR.PATCH
```

Each component represents a different layer of the system:

| Component | Represents | Used for |
|---|---|---|
| **MAJOR** | Architecture | Changes to the system architecture |
| **MINOR** | Extension | Changes to the main extension |
| **PATCH** | Library | Changes to Library resources |

The goal is to identify which part of The Sign Pack Tools changed.

## MAJOR

**MAJOR** represents the architecture generation of the system.

Increase MAJOR when the fundamental architecture changes enough to create a new generation of The Sign Pack Tools.

Examples include:

- Changing the extension platform
- Replacing CEP with UXP
- Changing the communication architecture
- Rebuilding the extension around a substantially different technical foundation
- Other architecture-level changes that require the system to be treated as a new generation

When MAJOR increases, both MINOR and PATCH reset to zero.

Example:

```text
1.30.56 → 2.0.0
```

The previous Extension and Library revision numbers are not carried into the new architecture generation.

### MAJOR Rule

```text
Architecture change
        ↓
MAJOR + 1
        ↓
MINOR = 0
PATCH = 0
```

## MINOR

**MINOR** represents the revision of the main extension.

Increase MINOR when the extension changes but the underlying architecture remains the same.

Examples include changes to:

- HTML
- CSS
- Client-side JavaScript
- CEP integration
- Extension interface
- Extension behavior
- Extension-level features
- Communication between the client and host
- Other components belonging to the main extension

When MINOR increases, PATCH remains unchanged.

Example:

```text
1.6.3 → 1.7.3
```

The Extension revision increased from `6` to `7`, while the Library remains at revision `3`.

### MINOR Rule

```text
Extension change
        ↓
MINOR + 1
        ↓
PATCH remains unchanged
```

## PATCH

**PATCH** represents the revision of the Library.

Increase PATCH when changes are made to resources distributed through the Library while the main extension architecture and revision remain unchanged.

Examples include:

- Adding a new tool
- Updating an existing tool
- Fixing a Library script
- Modifying a production script
- Updating templates
- Updating Library resources
- Other changes distributed through the Library update system

When PATCH increases, MAJOR and MINOR remain unchanged.

Example:

```text
1.6.3 → 1.6.4
```

The Library revision increased from `3` to `4`.

### PATCH Rule

```text
Library change
        ↓
PATCH + 1
```

## Choosing the Correct Component

When preparing a release, identify the highest-level part of the system that changed.

Use **PATCH** when the change is limited to the Library.

Use **MINOR** when the main extension changes.

Use **MAJOR** when the architecture itself changes.

For example:

```text
New Library tool
1.6.3 → 1.6.4
```

```text
New extension feature
1.6.4 → 1.7.4
```

```text
New architecture
1.30.56 → 2.0.0
```

The version should reflect the actual layer affected by the change.

## Version Progression Examples

A normal sequence of Library and Extension releases may look like:

```text
1.5.3
  ↓
1.5.4   Library update
  ↓
1.6.4   Extension update
  ↓
1.6.5   Library update
  ↓
1.7.5   Extension update
```

The Library revision is preserved when the Extension revision changes.

When the architecture changes, the sequence starts a new generation:

```text
1.30.56
     ↓
2.0.0
```

From there, the new generation progresses independently:

```text
2.0.0
  ↓
2.1.0   Extension update
  ↓
2.1.1   Library update
  ↓
2.2.1   Extension update
```

## Quick Reference

Use this table when deciding which component to change:

| Change | Version Change |
|---|---|
| Library script changed | `PATCH + 1` |
| New Library tool | `PATCH + 1` |
| Library bug fix | `PATCH + 1` |
| Template changed | `PATCH + 1` |
| Extension UI changed | `MINOR + 1` |
| Extension feature added | `MINOR + 1` |
| CEP integration changed | `MINOR + 1` |
| Extension communication changed | `MINOR + 1` |
| Architecture replaced | `MAJOR + 1`, reset MINOR/PATCH |
| CEP → UXP | `MAJOR + 1`, reset MINOR/PATCH |
| New architecture generation | `MAJOR + 1`, reset MINOR/PATCH |

## Summary

The rule can be remembered as:

```text
PATCH
Library changed.

MINOR
Extension changed.

MAJOR
Architecture changed.
Reset MINOR and PATCH.
```

In short:

```text
Library      → PATCH
Extension    → MINOR
Architecture → MAJOR
```

For a MAJOR release:

```text
1.30.56 → 2.0.0
```

For a MINOR release:

```text
1.6.3 → 1.7.3
```

For a PATCH release:

```text
1.6.3 → 1.6.4
```

These rules should be applied before starting the release process documented in [Release Process](release-process.md).