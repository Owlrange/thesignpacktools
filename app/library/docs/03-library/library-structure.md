# Library Structure

The Library is organized into separate folders and configuration files according to the role they perform within The Sign Pack Tools.

The current structure is:

```text id="3v2f8p"
library/
│
├── scripts/
├── system/
├── templates/
├── menu.js
└── tools.js
```

Each component has a specific responsibility within the Library and the extension.

## Scripts

The `scripts` folder contains the executable scripts used by The Sign Pack Tools.

These scripts provide the implementation of individual tools and other operations performed by the extension.

A simplified example is:

```text id="7b6m2x"
library/
└── scripts/
    ├── ToolA.jsx
    ├── ToolB.jsx
    ├── ToolC.jsx
    └── ...
```

Scripts stored in this location can be maintained independently from the CEP interface.

This is particularly useful when a tool needs to be corrected or improved without changing the user interface itself.

## System

The `system` folder contains files responsible for the internal operation of the Library update and version system.

The current contents are:

```text id="c1w9ak"
library/
└── system/
    ├── cacheManager.jsx
    ├── readFile.jsx
    └── saveFile.jsx
```

These files support the mechanisms required to manage Library data and files during the update process.

### cacheManager.jsx

`cacheManager.jsx` is responsible for cache-related operations used by the Library system.

It helps manage locally stored information used during the Library workflow.

### readFile.jsx

`readFile.jsx` provides functionality for reading files used by the Library system.

### saveFile.jsx

`saveFile.jsx` provides functionality for saving files used by the Library system.

These files are infrastructure for the Library itself rather than user-facing tools.

They should therefore be treated as system components and should not normally be modified when creating a new tool.

## Templates

The `templates` folder contains files used by the **File Templates** functionality.

Templates provide predefined starting points for different types of work.

The current File Templates category includes:

- Standard Template
- ADA Template
- Vehicle Template

Templates are stored in the Library so that they can be maintained independently from the main CEP interface.

## menu.js

`menu.js` defines the tools and categories displayed in the The Sign Pack Tools interface.

It contains information such as:

- Category names
- Tool names
- Tool IDs
- Descriptions
- Help links
- Search tags
- Category icons

The current main categories are:

```text id="j9p2qn"
File Templates
Tools
Design Tools
Production
```

Unlike the files in `scripts/`, `menu.js` does not contain the implementation of the tools.

Instead, it defines how tools are presented and organized in the user interface.

When adding a new tool, `menu.js` is one of the files that may need to be updated.

## tools.js

`tools.js` connects tool IDs defined in `menu.js` to the files that implement the corresponding functionality.

For example:

```text id="5c4x1r"
Tool ID
   ↓
tools.js
   ↓
Script file
   ↓
Adobe Illustrator
```

The file contains the mapping between a tool and its implementation.

A simplified example is:

```javascript id="y4m7qp"
checkimagequality: {
    file: "CheckImageQuality.jsx"
}
```

This tells the system which script should be executed when the corresponding tool is selected.

When adding a new tool, `tools.js` is therefore another file that may need to be updated.

## Adding a New Tool

The relationship between `menu.js`, `tools.js`, and the script implementation is important when creating new tools.

A typical new tool requires three components:

```text id="p8h3kd"
1. Script
      ↓
2. tools.js
      ↓
3. menu.js
```

For example:

```text id="q6r2zs"
NewTool.jsx
     │
     ▼
tools.js
     │
     ▼
Tool ID + configuration
     │
     ▼
menu.js
     │
     ▼
Tool appears in the interface
```

The script provides the functionality.

`tools.js` tells the system which file implements the tool.

`menu.js` defines how the tool appears to the user.

The complete process for adding a new tool is documented in [Adding a New Tool](../07-development/adding-a-new-tool.md).

## Resource Types

The Library can therefore be understood as containing three main types of resources:

| Component | Purpose |
|---|---|
| `scripts/` | Executable scripts and tool implementations |
| `system/` | Internal files supporting the Library update/version system |
| `templates/` | Files used as starting templates |
| `menu.js` | Defines the user-facing tool structure |
| `tools.js` | Maps tool IDs to their implementations |

## Separation of Responsibilities

Each component has a different responsibility.

```text id="n7d4qa"
                  Library
                     │
       ┌─────────────┼─────────────┐
       │             │             │
    scripts/      system/      templates/
       │             │             │
   Tool logic    Update system   Templates
                     │
              ┌──────┴──────┐
              │             │
           menu.js       tools.js
              │             │
              └──────┬──────┘
                     │
              Tool registration
```

This separation makes it easier to identify where a change should be made.

For example:

- Changing what a tool actually does → `scripts/`
- Changing the Library update mechanism → `system/`
- Changing a File Template → `templates/`
- Adding or reorganizing a tool in the interface → `menu.js`
- Connecting a tool ID to its implementation → `tools.js`

## Important Considerations

The Library is part of the runtime system.

Files should not be moved or renamed without checking whether other components depend on their current location.

This is particularly important for:

- Files inside `system/`
- Tool scripts referenced by `tools.js`
- Tools defined in `menu.js`
- Templates referenced by the File Templates system

When changing the location or name of an existing resource, all corresponding references must be updated.

## Summary

The Library contains both runtime resources and configuration files that support The Sign Pack Tools.

```text id="d3k8wf"
library/
├── scripts/      → Tool implementations
├── system/       → Library update/version system
├── templates/    → File Templates
├── menu.js       → Tool/menu definitions
└── tools.js      → Tool-to-script mapping
```

Understanding this structure is essential when maintaining the Library or adding new functionality to The Sign Pack Tools.