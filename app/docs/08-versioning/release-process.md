# Release Process

A release is the process of preparing a new version of The Sign Pack Tools and making the updated system available for use.

The release process applies differently to the Extension and the Library.

For Library releases, the `version.json` file acts as the release manifest. It identifies the Library version, release date, release notes, and files associated with the release.

## Release Flow

The general release process is:

```text
Change
  ↓
Identify affected layer
  ↓
Determine version
  ↓
Update version information
  ↓
Prepare release manifest
  ↓
Review changes
  ↓
Test
  ↓
Publish
  ↓
Distribute / Update
```

The exact steps depend on whether the release affects the Extension, the Library, or the architecture.

## 1. Identify the Change

Start by determining what was modified.

Possible areas include:

- Extension
- Library scripts
- Templates
- Production tools
- Design tools
- Shared functionality
- Architecture

The affected layer determines which version component needs to change.

The rules for selecting MAJOR, MINOR, or PATCH are documented in [Major, Minor and Patch](major-minor-patch.md).

## 2. Determine the Version

Choose the next version according to the type of change.

For a Library change:

```text
1.6.3 → 1.6.4
```

For an Extension change:

```text
1.6.3 → 1.7.3
```

For an Architecture change:

```text
1.30.56 → 2.0.0
```

A MAJOR release starts a new architecture generation and resets MINOR and PATCH to zero.

## 3. Update Version Information

The version must be updated to represent the release being prepared.

The version follows:

```text
MAJOR.MINOR.PATCH
```

For example:

```text
1.6.4
```

For Library releases, the version is recorded in the Library release manifest.

## 4. Prepare version.json

Library releases use a `version.json` file as the release manifest.

The file is located at the root of the project:

```text
TheSignPackTools/
└── version.json
```

The current structure is:

```json
{
    "version": "1.0.1",
    "releaseDate": "2026-08-24",
    "releaseNotes": "Patch update test.",
    "files": [
        "scripts/MakeOutline.jsx"
    ]
}
```

The manifest contains four fields.

### version

The `version` field contains the Library release version.

Example:

```json
"version": "1.0.1"
```

This value must follow:

```text
MAJOR.MINOR.PATCH
```

The version should be updated before publishing a new Library release.

For example:

```text
1.6.3 → 1.6.4
```

### releaseDate

The `releaseDate` field records the release date.

Example:

```json
"releaseDate": "2026-08-24"
```

The date uses the following format:

```text
YYYY-MM-DD
```

The value should represent the date on which the release is published.

### releaseNotes

The `releaseNotes` field contains a short description of the changes included in the release.

Example:

```json
"releaseNotes": "Patch update test."
```

Release notes should describe the relevant changes clearly enough to identify what was updated.

For example:

```json
"releaseNotes": "Added the new Bounding Box production tool."
```

### files

The `files` field contains the Library file paths associated with the release.

Example:

```json
"files": [
    "scripts/MakeOutline.jsx"
]
```

Multiple files can be listed:

```json
"files": [
    "scripts/MakeOutline.jsx",
    "scripts/MakeCutContour.jsx",
    "templates/ADA.ai"
]
```

Paths should correspond to files within the Library structure.

The list should contain the files that are part of the release.

The exact behavior of these files during the update process is documented in [Library Update System](../03-library/update-system.md).

## 5. Update the Release Manifest

Before publishing a Library release, update all relevant fields in `version.json`.

For example, a new Library release could change:

```json
{
    "version": "1.0.1",
    "releaseDate": "2026-08-24",
    "releaseNotes": "Patch update test.",
    "files": [
        "scripts/MakeOutline.jsx"
    ]
}
```

to:

```json
{
    "version": "1.0.2",
    "releaseDate": "2026-08-25",
    "releaseNotes": "Updated the Outline production tool.",
    "files": [
        "scripts/MakeOutline.jsx"
    ]
}
```

The version, date, notes, and file list should describe the release being published.

## 6. Review the Release

Before publishing, review the release contents.

For a Library release, verify:

- The version is correct.
- `releaseDate` is correct.
- `releaseNotes` describe the changes.
- Every released file is included in `files`.
- File paths are correct.
- No unrelated files are included.
- New tools are correctly registered.
- Updated scripts are present.
- Templates and other Library resources are complete.

For an Extension release, review the relevant client, host, manifest, and other extension files.

## 7. Test the Release

The release should be tested before distribution.

Library releases should verify both the changed functionality and the Library update process.

For example:

1. Prepare the new Library release.
2. Publish or simulate the release manifest.
3. Check the Library from an installation containing an older version.
4. Confirm that the newer version is detected.
5. Confirm that the appropriate update type is identified.
6. Verify that the required Library files are updated.
7. Test the affected tool or resource.
8. Confirm that existing functionality continues to work.

For example:

```text
Local:
1.6.3

Remote:
1.6.4
```

The Library should identify the remote version as a PATCH update.

## 8. Verify Version Comparison

The Library update system compares the installed version with the version reported by the remote release manifest.

Conceptually:

```text
Local Library
      │
      ▼
Local Version
      │
      │
      ├──────────────┐
      │              │
      │              ▼
      │       version.json
      │              │
      │       manifest.version
      │              │
      └────── compareVersions()
                     │
                     ▼
              Update available?
```

The comparison determines whether the remote release is newer and identifies the type of version change.

Examples:

```text
1.6.3 → 1.6.4
```

PATCH update.

```text
1.6.4 → 1.7.4
```

MINOR update.

```text
1.30.56 → 2.0.0
```

MAJOR update.

## 9. Publish the Library Release

After the release has been reviewed and tested, publish the updated Library resources and release manifest through the repository used by the Library update system.

The published `version.json` becomes the remote release manifest used by the update process.

The manifest provides the update system with information about:

- The current Library version
- Release date
- Release notes
- Files associated with the release

Once published, installed Libraries can detect the new version during the update check.

## Library Release

A typical Library release follows this pattern:

```text
Modify Library
      ↓
Increment PATCH
      ↓
Update version.json
      ↓
Set release date
      ↓
Write release notes
      ↓
List release files
      ↓
Review
      ↓
Test
      ↓
Publish
      ↓
Users receive update
```

Example:

```text
1.6.3 → 1.6.4
```

The main Extension does not need to receive a new MINOR version simply because the Library changed.

This separation allows Library resources to evolve independently from the Extension.

## Extension Release

An Extension release follows a different process because the Extension is not distributed through the Library update mechanism.

A typical Extension release follows:

```text
Modify Extension
      ↓
Increment MINOR
      ↓
Update Extension version information
      ↓
Review Extension
      ↓
Test CEP / client / host
      ↓
Publish Extension
      ↓
Deploy new Extension version
```

For example:

```text
1.6.4 → 1.7.4
```

The current Library revision remains part of the version.

## Architecture Release

An architecture release requires broader review and testing.

Examples include:

- Migrating from CEP to UXP
- Replacing the communication model
- Rebuilding the extension foundation
- Introducing a substantially different application architecture

The version moves to the next MAJOR generation:

```text
1.30.56 → 2.0.0
```

The new generation starts at:

```text
2.0.0
```

MINOR and PATCH are reset to zero.

Because an architecture release can affect multiple parts of the system, testing and documentation should cover all affected components.

## Documentation

Documentation should be updated when a release introduces changes that affect users, Tool Creators, or Developers.

Examples include:

- New tools
- Changed tool behavior
- New installation requirements
- New Library behavior
- Changed development procedures
- Architecture changes
- Removed or deprecated functionality

Documentation should be updated as part of the release work.

## Release History

Each release should be recorded in the project history.

At minimum, record:

- Version number
- Release date
- Main changes
- New tools
- Important fixes
- Architecture changes, when applicable

The release history is maintained in the [Changelog](../11-changelog/releases.md).

The `releaseNotes` field in `version.json` provides the release-specific notes used by the Library release manifest.

## Release Checklist

Before publishing a Library release, verify:

- [ ] Change scope identified
- [ ] MAJOR / MINOR / PATCH determined
- [ ] `version.json` updated
- [ ] `version` verified
- [ ] `releaseDate` verified
- [ ] `releaseNotes` written
- [ ] `files` list verified
- [ ] Changed files reviewed
- [ ] New or modified tools tested
- [ ] Library update tested
- [ ] Documentation updated when necessary
- [ ] Release information recorded
- [ ] Release manifest and Library resources published

For an Extension release:

- [ ] Change scope identified
- [ ] MINOR version determined
- [ ] Extension version information updated
- [ ] Changed files reviewed
- [ ] Extension tested
- [ ] Documentation updated when necessary
- [ ] Release information recorded
- [ ] Extension package/distribution verified
- [ ] Extension published

## Release Principles

The release process follows these principles:

1. **The version must represent the actual scope of the change.**
2. **Library releases use `version.json` as their release manifest.**
3. **The `version` field identifies the Library release version.**
4. **The `releaseDate` field records when the release was published.**
5. **The `releaseNotes` field describes the release.**
6. **The `files` field identifies the files associated with the release.**
7. **Library releases should remain independent from Extension releases whenever possible.**
8. **Extension releases preserve the current Library revision.**
9. **MAJOR releases create a new architecture generation.**
10. **MAJOR releases reset MINOR and PATCH to zero.**
11. **A release should be reviewed and tested before publication.**
12. **Documentation and release history should evolve with the system.**

A correctly prepared release keeps the version information, Library resources, release manifest, documentation, and distributed system synchronized.