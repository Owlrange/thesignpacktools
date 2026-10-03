# Updating the Library

The Library is designed to allow resources used by **The Sign Pack Tools** to be updated independently from the main CEP extension.

This makes it possible to improve tools, update templates, fix bugs, and add functionality without necessarily replacing the complete CEP extension.

The Library Update System retrieves the appropriate resources from the project's central repository and updates the local Library used by The Sign Pack Tools.

This page explains how Library updates should be approached by people creating or maintaining tools.

## What Does a Library Update Mean?

A Library update means changing one or more resources inside the `library/` directory without replacing the complete CEP extension.

For example, a new version of a tool may only require an updated JSX script.

Instead of replacing the entire extension:

```text
The Sign Pack Tools
        │
        ├── CEP Interface
        ├── Host
        └── Library
              │
              └── Updated Tool
```

the updated resource can be distributed through the Library Update System.

The system can retrieve the updated resource from the project's central repository and save it to the user's local Library.

This separation allows the main extension and its resources to evolve independently.

## The Repository as the Source of Updates

The Library Update System requires a central source from which updated Library resources can be obtained.

The project's Git repository acts as this source.

The general relationship is:

```text
Git Repository
      │
      │ Updated Library Resources
      ↓
Library Update System
      │
      ↓
User's Local Library
      │
      ↓
The Sign Pack Tools
```

This means that modifying a file locally is not enough to make the change available to other users.

The updated resource must first go through the development and review process and then be published to the repository used by the Library Update System.

Once the updated resource is available in the repository, the update system can make it available to installed copies of The Sign Pack Tools.

## When Should You Update the Library?

A Library update is appropriate when the change affects resources that are maintained inside the Library.

Typical examples include:

- Fixing an existing JSX tool
- Improving the behavior of a tool
- Adding a new tool script
- Updating a production script
- Updating a File Template
- Correcting a bug in a Library resource
- Adding functionality to an existing Library resource

Not every change belongs in the Library.

Changes to the CEP interface, extension configuration, host architecture, or other components outside the Library may require an update to the main extension itself.

When in doubt, first determine where the functionality actually lives.

## What Can Be Updated?

The Library currently contains several different types of resources.

### Scripts

Files inside:

```text
library/scripts/
```

contain the implementation of tools and other executable resources.

These are likely to be the most frequently updated Library resources.

For example:

```text
library/scripts/
    CheckImageQuality.jsx
    MakeOutline.jsx
    MakeCutContour.jsx
    ...
```

A Tool Creator may modify one of these scripts to correct behavior or add functionality.

### Templates

Files inside:

```text
library/templates/
```

contain resources used by the File Templates system.

Templates may need to be updated when production requirements, document standards, or company workflows change.

### System Components

Files inside:

```text
library/system/
```

support the internal operation of the Library Update System.

The current system contains:

```text
library/system/
├── cacheManager.jsx
├── readFile.jsx
└── saveFile.jsx
```

These files are different from normal tool scripts and are maintained as part of the Library infrastructure.

Detailed information about these components and their internal behavior is covered separately in the **Library System** documentation.

## Updating a Tool as a Tool Creator

A Designer or Production Artist does not need to be an experienced programmer to contribute a new tool.

A typical workflow can be:

```text
Identify a repetitive task
        ↓
Describe the desired behavior
        ↓
Create or modify the script
        ↓
Test the script in Illustrator
        ↓
Refine the behavior
        ↓
Register the tool in The Sign Pack Tools
        ↓
Test the complete tool
        ↓
Submit for Developer review
```

The important part is that the Tool Creator understands the desired behavior and the production problem being solved.

More information about creating tools is available in the **Development & Tool Creation** section.

## Developer Review

**All new or modified scripts must be reviewed by a Developer before they are distributed to other users.**

This applies even when the change appears to be small or isolated.

The purpose of the review is to verify that the change:

- Follows the architecture of The Sign Pack Tools
- Does not introduce unnecessary dependencies
- Does not interfere with existing functionality
- Handles Illustrator documents and objects safely
- Does not introduce avoidable performance problems
- Does not create unexpected side effects
- Is appropriate for distribution to other workstations

Developer review does not mean that every tool must be rewritten by a Developer.

The Tool Creator remains responsible for understanding and testing the behavior of the tool, while the Developer verifies that the implementation is safe to integrate into the larger system.

## Publishing the Update

After a change has been tested and approved, the updated Library resource must be published to the project's Git repository.

The general process is:

```text
Create or modify resource
        ↓
Test locally
        ↓
Developer Review
        ↓
Update repository
        ↓
Library Update System
        ↓
Users receive updated resource
```

The repository therefore represents the version of the Library that is available for distribution.

A change that exists only on a developer's local computer is not yet available to the Library Update System.

The exact Git workflow used to commit, review, merge, and publish changes is documented separately in the **Development & Tool Creation** and **Developer** documentation.

## Updating an Existing Tool

When modifying an existing tool, the preferred approach is to identify the smallest component that needs to change.

For example:

```text
Existing Tool
    ↓
Identify problem
    ↓
Modify the JSX script
    ↓
Test
    ↓
Developer Review
    ↓
Publish updated resource to repository
    ↓
Library Update System
```

Avoid modifying unrelated parts of the extension simply because they are nearby in the project structure.

Keeping changes isolated makes testing easier and reduces the possibility of introducing unrelated problems.

## Adding a New Tool

Adding a new tool normally involves more than creating a JSX file.

A new tool generally requires:

1. A tool implementation inside `library/scripts/`
2. A tool entry in `library/tools.js`
3. A user-facing definition in `library/menu.js`
4. Testing inside Illustrator
5. Developer review
6. Appropriate documentation
7. Publishing the required Library resources to the repository

The relationship between these files is:

```text
NewTool.jsx
     ↓
tools.js
     ↓
Tool ID + implementation mapping
     ↓
menu.js
     ↓
User-facing tool
```

Once the required resources have been reviewed and published to the repository, they can become available through the Library Update System.

The complete process is documented in **Adding a New Tool**.

## Testing Before Publishing

Library resources should be tested before being submitted for distribution.

At minimum, verify:

- The script runs without errors
- The expected Illustrator objects are affected
- Existing functionality still works
- The tool behaves correctly with realistic production files
- The tool works with the intended document scale
- The tool does not unintentionally modify unrelated objects
- The tool can be executed through The Sign Pack Tools interface

Testing by the Tool Creator does not replace Developer review.

Both steps are required before a change is published for distribution to other users.

## Developer Responsibilities

Developers and Maintainers are responsible for changes that affect the architecture, infrastructure, or distribution of the Library.

This includes:

- Library update mechanisms
- Cache behavior
- Resource loading
- Resource saving
- Versioning
- Shared infrastructure
- Changes that affect multiple tools
- Changes that could affect existing installations
- Reviewing new or modified scripts
- Publishing approved Library resources to the repository

The Developer is responsible for ensuring that the repository contains the version of the Library that should be distributed to users.

## Updating the Library vs. Updating the Extension

The distinction between the Library and the main extension is important.

A simplified model is:

```text
Main Extension
    ├── Client
    ├── CSXS
    └── Host

Library
    ├── Scripts
    ├── System
    └── Templates
```

If the change only affects a Library resource, the Library update mechanism may be sufficient.

If the change requires modifications to the CEP interface, extension configuration, host architecture, or other components outside the Library, the main extension may need to be updated.

The exact release process depends on the type of change.

## Versioning

Library updates need a way to determine whether an installed resource is current.

The Library Update System therefore works together with the project's version information and update infrastructure.

Versioning is documented separately in the **Versioning** section.

When creating or distributing updates, do not change version information arbitrarily.

A version should represent a real change to the resource being distributed.

## Updating Shared System Files

Extra care is required when changing files inside:

```text
library/system/
```

These files support the Library Update System itself.

Changes to these components should not be treated as normal Library updates.

Detailed procedures for modifying, testing, and maintaining the Library System are documented separately for Developers and Maintainers.

## Documentation Should Be Updated Too

A change to the Library should not automatically mean that only the code is updated.

If the behavior of a tool changes, its documentation may also need to change.

For example:

```text
Code Change
     ↓
Test
     ↓
Developer Review
     ↓
Repository Update
     ↓
Library Update
     ↓
Documentation Update
```

Keeping the code and documentation synchronized makes future maintenance significantly easier.

This is especially important for tools created by people who may later no longer be responsible for maintaining them.

## A Practical Rule

When working on The Sign Pack Tools, a useful rule is:

> Change the smallest component that solves the problem.

If a tool can be fixed by changing its JSX script, do not modify the Library Update System.

If a new tool can be added by registering a new script, do not redesign the menu system.

If the problem is caused by the update infrastructure itself, involve a Developer before changing the system files.

And before any new or modified script is distributed to other users, it must be reviewed by a Developer and published to the appropriate repository.

This separation keeps the architecture predictable and makes the project easier to maintain as more tools are added.

## Summary

The Library Update System allows The Sign Pack Tools to evolve without requiring every Library change to become a complete extension release.

The general process is:

```text
Identify the change
        ↓
Determine where the change belongs
        ↓
Create or modify the resource
        ↓
Test
        ↓
Developer Review
        ↓
Publish to Git Repository
        ↓
Library Update System
        ↓
Update users' local Libraries
        ↓
Update documentation
```

The Git repository acts as the central source for the Library resources that are available for distribution.

The Library Update System then provides a mechanism for installed copies of The Sign Pack Tools to obtain those resources and keep their local Library up to date.

The Library therefore acts not only as a collection of files, but as a controlled distribution layer through which The Sign Pack Tools can evolve over time.