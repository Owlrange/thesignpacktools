# Version System

The Sign Pack Tools uses a three-component version system:

```text id="ywm9qw"
MAJOR.MINOR.PATCH
```

The three components represent different layers of the system:

- **MAJOR** — Architecture generation
- **MINOR** — Extension revision
- **PATCH** — Library revision

Although the format uses the familiar `MAJOR.MINOR.PATCH` structure, its meaning is specific to The Sign Pack Tools and does not follow conventional Semantic Versioning definitions.

## Version Architecture

The version number represents the state of three different layers of the system.

```text id="8u1rui"
1.30.56
│  │  │
│  │  └── Library revision
│  └───── Extension revision
└──────── Architecture generation
```

For example:

```text id="olilvu"
1.30.56
```

means:

- Architecture generation: `1`
- Extension revision: `30`
- Library revision: `56`

This allows the version number to communicate which part of the system has changed.

## MAJOR — Architecture Generation

The **MAJOR** component identifies the architecture generation of The Sign Pack Tools.

A MAJOR release represents a fundamental change to the technical architecture or foundation of the system.

Examples may include:

- Changing the extension platform
- Replacing CEP with another extension architecture such as UXP
- Major changes to the communication model between Illustrator and the extension
- Rebuilding the system around a substantially different architecture
- Other changes that create a new generation of the application

A MAJOR change creates a new architecture generation.

When MAJOR increases, both MINOR and PATCH are reset to zero.

For example:

```text id="uxkzjb"
1.30.56 → 2.0.0
```

The previous Extension and Library revision numbers are not carried into the new architecture generation.

The new generation starts from:

```text id="2.0.0"
```

This provides a clear boundary between generations of the system.

## MINOR — Extension Revision

The **MINOR** component identifies revisions to the main extension.

It is used when the extension itself changes without creating a new architecture generation.

Examples include changes to:

- HTML
- CSS
- Client-side JavaScript
- CEP integration
- Extension interface
- Extension behavior
- Extension-level features
- Communication between the client and host
- Other components that belong to the main extension

For example:

```text id="mz3h6n"
1.5.3 → 1.6.3
```

Here, the Extension revision increases from `5` to `6`.

The Library revision remains `3`.

The PATCH component is therefore preserved when MINOR increases.

## PATCH — Library Revision

The **PATCH** component identifies revisions to the Library.

It is used for changes that affect resources maintained by the Library without changing the main Extension architecture or revision.

Examples include:

- Adding a new tool
- Updating an existing tool
- Fixing a bug in a Library script
- Adding or modifying templates
- Updating Library resources
- Other changes distributed through the Library update system

For example:

```text id="2ctcbd"
1.6.3 → 1.6.4
```

The Extension revision remains `6`, while the Library revision increases from `3` to `4`.

## Independent Extension and Library Revisions

One of the main purposes of this version system is to keep the Extension and Library revisions independent.

A Library update does not require a new Extension revision.

For example:

```text id="culigr"
1.6.3 → 1.6.4
```

Only the Library changed.

Likewise, an Extension update does not reset the Library revision:

```text id="p4vb13"
1.6.4 → 1.7.4
```

The Extension changed while the Library remained at revision `4`.

This allows the Library to evolve independently from the main Extension.

## Version Progression

The version system follows three progression rules.

### Library Revision

A Library change increments PATCH while preserving MAJOR and MINOR:

```text id="fxrle1"
1.6.3 → 1.6.4
```

### Extension Revision

An Extension change increments MINOR while preserving MAJOR and PATCH:

```text id="glrew0"
1.6.3 → 1.7.3
```

### Architecture Generation

An architectural change increments MAJOR and resets both lower components:

```text id="wk3kwf"
1.30.56 → 2.0.0
```

This establishes a new generation of the system.

## Cumulative Version Numbers

Within an architecture generation, MINOR and PATCH values can continue to grow.

For example:

```text id="hxgcb4"
1.5.3
1.6.3
1.6.4
1.7.4
1.25.40
1.30.56
```

There is no requirement to reset PATCH when MINOR increases.

For example:

```text id="d01e57"
1.6.3 → 1.7.3
```

The Library remains at revision `3`.

Likewise, there is no requirement to reset MINOR when PATCH increases:

```text id="05kqfh"
1.6.3 → 1.6.4
```

The Extension remains at revision `6`.

The exception is MAJOR.

When MAJOR increases, both lower components reset:

```text id="6zgf37"
1.30.56 → 2.0.0
```

This means the counters are cumulative within an architecture generation, but a new architecture generation starts a new version sequence.

## Version Growth

There is no fixed maximum value for MINOR or PATCH.

Versions such as:

```text id="q3n2za"
1.9.12
1.10.12
1.25.40
1.30.56
```

are all valid.

The components are numeric, so reaching `10`, `20`, `30`, or higher does not create a technical problem.

The version can therefore continue to grow throughout the lifetime of an architecture generation.

When the architecture changes, the version starts again at the next MAJOR generation:

```text id="x0857b"
1.30.56 → 2.0.0
```

## Version Comparison

The Library update system compares versions numerically, one component at a time.

For example:

```text id="oi7gek"
1.9.56
1.10.1
```

The comparison is numerical:

```text id="yjfedf"
9 < 10
```

Therefore:

```text id="r2zlcj"
1.9.56 < 1.10.1
```

The system does not compare the version as a text string.

Internally, the version is divided into numeric components and compared from left to right.

The comparison follows this logic:

1. Compare MAJOR.
2. If MAJOR is equal, compare MINOR.
3. If MINOR is equal, compare PATCH.
4. If all components are equal, the versions are considered equal.

The Library system identifies the type of available update according to the component that changed.

For example:

```text id="4f4t2w"
1.5.3 → 2.0.0
```

is identified as a **major** update.

```text id="05m8kq"
1.5.3 → 1.6.3
```

is identified as a **minor** update.

```text id="6zgf37"
1.6.3 → 1.6.4
```

is identified as a **patch** update.

## Library Release Manifest

Library releases use a `version.json` file as the release manifest.

The file contains the information required to identify a Library release.

A release manifest currently has the following structure:

```json id="e7qvjw"
{
    "version": "1.0.1",
    "releaseDate": "2026-08-24",
    "releaseNotes": "Patch update test.",
    "files": [
        "scripts/MakeOutline.jsx"
    ]
}
```

The fields represent:

- `version` — Library release version
- `releaseDate` — Release date
- `releaseNotes` — Description of the release
- `files` — Files associated with the release

The `version` value is the version compared by the Library update system.

For example, an installed Library may have:

```text id="a9h3d1"
1.0.1
```

while the remote release manifest contains:

```text id="b4x7s2"
1.0.2
```

The update system can then identify that a newer PATCH revision is available.

The complete release procedure is documented in [Release Process](release-process.md).

## Relationship Between Extension and Library

The version number represents both the Extension and Library state, but the two layers can evolve independently.

For example:

```text id="k1p7r4"
1.5.3
```

may represent:

- Architecture generation `1`
- Extension revision `5`
- Library revision `3`

A Library release changes only the PATCH component:

```text id="n5c2w8"
1.5.3 → 1.5.4
```

An Extension release then changes MINOR while preserving the current Library revision:

```text id="v6m3q9"
1.5.4 → 1.6.4
```

Another Library release can then increment PATCH again:

```text id="z8r4t1"
1.6.4 → 1.6.5
```

This creates a continuous representation of the current state of both layers.

## Architecture Boundaries

A MAJOR release marks a boundary between architecture generations.

For example:

```text id="m4s7d2"
Generation 1
1.30.56
     │
     │ Architecture change
     ▼
Generation 2
2.0.0
```

The previous MINOR and PATCH values belong to the previous architecture generation.

They are therefore not carried into the new generation.

This makes it possible to identify the architecture generation directly from the first component of the version.

## Versioning Principles

The version system follows these principles:

1. **MAJOR represents architecture generations.**
2. **MINOR represents revisions to the main Extension.**
3. **PATCH represents revisions to the Library.**
4. **MINOR changes preserve the current PATCH value.**
5. **PATCH changes preserve the current MINOR value.**
6. **MAJOR changes reset both MINOR and PATCH to zero.**
7. **Version components are compared numerically.**
8. **MINOR and PATCH have no predefined maximum value.**
9. **Extension and Library revisions can evolve independently.**
10. **A new architecture generation starts a new version sequence.**
11. **Library releases use `version.json` as their release manifest.**
12. **The `version` field in the release manifest identifies the published Library version.**

The resulting version system provides a compact representation of the current architecture, Extension revision, and Library revision of The Sign Pack Tools.