# Library Overview

The **Library** is a core component of The Sign Pack Tools.

It contains scripts, systems, templates, and other resources used by the extension. The Library is designed to separate updateable components from the main CEP interface, allowing parts of The Sign Pack Tools to evolve without requiring the entire extension to be replaced.

## Purpose

The Library was created to make The Sign Pack Tools easier to maintain and update.

Instead of storing every component directly inside the CEP extension, updateable resources can be maintained in the Library.

This creates a separation between:

- The **CEP extension**, which provides the interface and core application structure.
- The **Library**, which provides scripts, systems, templates, and other resources used by the extension.

This separation allows changes to the Library to be distributed independently from changes to the main extension.

## Library Structure

The current Library is organized into three main areas:

```text
library/
├── scripts/
├── system/
└── templates/
```

Each folder has a different role within the system.

### Scripts

The `scripts` folder contains scripts used by The Sign Pack Tools.

These scripts provide the actual functionality behind many of the tools available in the extension.

Keeping scripts in the Library allows them to be maintained and updated independently from the CEP interface.

### System

The `system` folder contains shared components used by multiple parts of The Sign Pack Tools.

These are not necessarily individual user-facing tools. Instead, they provide functionality that can be reused throughout the extension.

Examples include shared systems responsible for functionality such as:

- Notifications
- Logging
- Search
- Library management
- Other common services

Shared systems allow different tools to use the same underlying functionality instead of implementing the same feature multiple times.

### Templates

The `templates` folder contains templates used by The Sign Pack Tools.

These resources are associated with the **File Templates** functionality and provide starting documents for different types of work.

Current template types include:

- Standard
- ADA
- Vehicle

Templates can be maintained through the Library without requiring changes to the main interface structure.

## How the Library Fits Into the Extension

The Library works alongside the main CEP extension.

A simplified view of the architecture is:

```text
User
 │
 ▼
The Sign Pack Tools
 │
 ├── Client
 │    └── Interface
 │
 ├── Host
 │    └── Illustrator communication
 │
 └── Library
      ├── Scripts
      ├── Systems
      └── Templates
```

The user interacts with the CEP interface.

When a tool requires functionality provided by the Library, the extension accesses the appropriate resource and executes or uses it as required.

This allows the user interface and the underlying resources to remain separated.

## Why Use a Library?

Without a Library system, updating a script or template could require replacing or redistributing the entire extension.

With the Library, individual components can be maintained independently.

For example, an update to a production script may only require updating the corresponding Library component rather than installing a completely new version of The Sign Pack Tools.

This provides several benefits:

- Easier maintenance
- Faster updates
- Smaller update scopes
- Separation between interface and resources
- Centralized management of shared components
- Greater flexibility as the system grows

## Library and the CEP Extension

The CEP extension remains responsible for the main application structure and user interface.

The Library provides resources that the extension can use.

This distinction is important when developing or maintaining The Sign Pack Tools.

A change to the interface does not necessarily require a change to the Library.

Likewise, a change to a Library script or template does not necessarily require the CEP interface itself to be modified.

The correct location for a change depends on what is being modified.

## Library Updates

The Library is designed to support updates independently from the main extension.

The update system can determine which Library components need to be updated and retrieve the appropriate versions.

The details of this process are documented separately in [Update System](update-system.md).

## Library as Part of the Architecture

The Library is not simply a folder containing extra files.

It is an architectural layer of The Sign Pack Tools.

Its purpose is to provide a controlled location for resources that need to be shared, maintained, and updated independently from the main CEP application.

As The Sign Pack Tools grows, additional scripts, systems, and templates can be added to the Library while maintaining the separation between the extension interface and its underlying resources.

## Summary

The Library provides a centralized and updateable collection of resources used by The Sign Pack Tools.

Its three main areas are:

| Folder | Purpose |
|---|---|
| `scripts/` | Scripts used by the tools and other parts of the extension |
| `system/` | Shared systems and common functionality |
| `templates/` | Templates used by the File Templates functionality |

The Library allows these components to evolve independently from the main CEP extension, making The Sign Pack Tools easier to maintain and expand.