# Update System

The **Library Update System** is responsible for keeping the Library resources used by The Sign Pack Tools up to date.

The system allows scripts, templates, and other Library resources to be updated independently from the main CEP extension.

This means that many changes can be distributed without requiring users to reinstall the entire The Sign Pack Tools extension.

## Purpose

The purpose of the Update System is to provide a controlled way to distribute and maintain Library resources.

This allows the development team to:

- Update scripts without replacing the entire extension
- Update templates as production requirements change
- Correct bugs in Library resources
- Distribute improvements independently
- Keep installed workstations synchronized with the available Library resources

The main CEP extension and the Library can therefore evolve at different rates.

## How Updates Work

At a high level, the update process follows this model:

```text id="l8v3cq"
Installed The Sign Pack Tools
        │
        ▼
   Check Library
        │
        ▼
Compare available information
        │
        ├── Up to date
        │
        └── Update available
                │
                ▼
        Retrieve updated resources
                │
                ▼
        Save to local Library
                │
                ▼
          Updated Library
```

The exact implementation of this process is handled by the Library's internal system.

## Independent Updates

One of the main advantages of the Library is that individual resources can be updated without requiring a new version of the CEP extension.

For example, suppose a production script contains a bug.

Without an independent Library:

```text id="e98tvx"
Fix script
   ↓
Build new CEP extension
   ↓
Distribute new extension
   ↓
Reinstall extension
```

With the Library Update System:

```text id="vlg3cg"
Fix script
   ↓
Update Library resource
   ↓
Workstations receive the update
```

This reduces the scope of many maintenance operations.

## What Can Be Updated?

The Library can contain different types of resources that may require updates.

### Scripts

Scripts are one of the primary resources maintained through the Library.

A script can be corrected, improved, or replaced without necessarily changing the CEP interface.

### Templates

Templates can be updated when design or production requirements change.

Because templates are stored in the Library, updated versions can be distributed independently from the main extension.

### System Components

The Library also contains internal system components used to manage Library operations.

These components are located in:

```text id="m9q2zr"
library/
└── system/
    ├── cacheManager.jsx
    ├── readFile.jsx
    └── saveFile.jsx
```

These files support the internal operation of the Library Update System.

Unlike normal tool scripts and templates, changes to these files can affect the update mechanism itself and should therefore be treated as system-level changes.

## Local Library

The Library resources used by The Sign Pack Tools are maintained locally on each workstation.

The Update System works with this local Library to determine whether resources need to be updated and to maintain the current local versions.

A simplified model is:

```text id="q4k7mz"
Available Library
        │
        ▼
  Update System
        │
        ▼
 Local Library
        │
        ▼
The Sign Pack Tools
```

This allows the extension to use the resources available on the local workstation while keeping them synchronized with the current Library.

## Version Information

Version information is used by the system to determine the state of Library resources.

The update process can use this information to identify whether the local Library is current or whether newer resources are available.

Versioning is documented separately in the [Version System](../08-versioning/version-system.md) section.

## Cache

The Update System uses cached information as part of its operation.

Cache-related functionality is handled by:

```text id="a7d4nx"
library/system/cacheManager.jsx
```

The cache allows the system to retain information locally between operations and can help avoid unnecessary work during the update process.

The exact cache structure and behavior are implementation details documented in the development documentation.

## Reading and Saving Resources

The Library Update System needs to read and save files during its operation.

These functions are supported by:

```text id="f2m9cz"
library/system/readFile.jsx
library/system/saveFile.jsx
```

Together with the cache manager, these components provide part of the internal infrastructure required to maintain the local Library.

## Update Scope

Updates should be limited to the resources that actually changed.

For example:

```text id="i6d6fg"
Library
│
├── scripts
│    ├── Tool A       → no update
│    ├── Tool B       → update
│    └── Tool C       → no update
│
├── templates
│    └── ADA Template → update
│
└── system
     └── cacheManager → no update
```

In this example, only the changed resources need to be updated.

The rest of the installed Library can remain unchanged.

## Why This Matters

The Library Update System creates an important separation between **application deployment** and **resource updates**.

The CEP extension contains the main application structure and user interface.

The Library contains resources that can change more frequently.

This means that a change to a production script, template, or other Library resource does not automatically require a new extension installation.

This approach is particularly useful in an internal production environment where tools may need frequent corrections and improvements.

## Important Considerations

The Library Update System should be treated as part of the infrastructure of The Sign Pack Tools.

Normal Library resources, such as scripts and templates, can be updated as part of regular maintenance.

The files inside `library/system/` require additional care because they support the update mechanism itself.

Changes to the update infrastructure should be tested before being distributed.

## Troubleshooting

If a Library update does not complete correctly, the local Library may contain an outdated or incomplete resource.

Possible symptoms include:

- A tool stops working after an update.
- A new version of a tool does not appear.
- A template does not reflect the latest changes.
- Different workstations appear to have different Library versions.

Update-related problems should be investigated through the Library and its system components before manually replacing files.

See [Library Problems](../10-troubleshooting/library-problems.md) for common problems and recovery procedures.

## Development

Developers working on the Library should consider the impact of updates on existing workstations.

Changes to individual scripts or templates generally have a limited scope.

Changes to the files inside `library/system/` can affect the update mechanism itself and may therefore affect the entire Library.

The process for preparing and maintaining Library updates is documented in [Updating the Library](../07-development/updating-the-library.md).

## Summary

The Library Update System allows The Sign Pack Tools to maintain scripts, templates, and other Library resources independently from the main CEP extension.

Its main goals are:

- Keep installed Libraries current
- Distribute script updates
- Distribute template updates
- Correct and improve existing resources
- Reduce unnecessary extension installations
- Keep workstations synchronized
- Simplify ongoing maintenance

The Library therefore acts not only as a collection of resources, but also as a mechanism for continuously delivering improvements to The Sign Pack Tools.