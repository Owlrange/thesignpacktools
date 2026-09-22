# Folder Structure

The Sign Pack Tools is organized into separate folders according to the role each component performs within the extension.

The main project structure is:

```text
TheSignPackTools/
│
├── client/
│   ├── css/
│   ├── icons/
│   ├── js/
│   ├── index.html
│   └── preflight.html
│
├── CSXS/
│   └── manifest.xml
│
├── docs/
│
├── host/
│   ├── main.jsx
│   └── main_preflight.jsx
│
├── library/
│   ├── scripts/
│   ├── system/
│   └── templates/
│
├── menu.js
├── tools.js
└── version.json
```

The structure is divided into four main areas:

- **Client** — the user interface of the extension.
- **CSXS** — CEP configuration.
- **Host** — JSX communication and host-side functionality.
- **Library** — scripts, systems, and templates used by the extension.

The `docs` folder contains the project documentation and is not part of the runtime extension itself.

## Client

The `client` folder contains the visual interface of The Sign Pack Tools.

```text
client/
├── css/
├── icons/
├── js/
├── index.html
└── preflight.html
```

### CSS

The `css` folder contains the stylesheets used by the extension interface.

These files control the appearance, layout, and visual behavior of the CEP panels.

### Icons

The `icons` folder contains the icons used throughout the interface.

Menu categories and other interface elements can reference these icons.

### JS

The `js` folder contains the JavaScript used by the client-side interface.

This layer is responsible for functionality such as:

- User interaction
- Interface behavior
- Tool execution
- Search
- Notifications
- Communication with the host
- Other client-side systems

### index.html

`index.html` is the main entry point for the standard The Sign Pack Tools interface.

It loads the user interface and the resources required by the extension.

### preflight.html

`preflight.html` is the interface entry point for the Pre-flighting system.

The Pre-flighting interface is separated from the main tool interface because it has its own workflow and functionality.

## CSXS

The `CSXS` folder contains the configuration required by Adobe CEP.

```text
CSXS/
└── manifest.xml
```

### manifest.xml

The `manifest.xml` file defines how Adobe CEP recognizes and loads The Sign Pack Tools.

It contains configuration information such as:

- Extension identification
- Extension version
- CEP compatibility
- Adobe application host configuration
- Panel configuration

The manifest is a fundamental part of the CEP extension.

## Host

The `host` folder contains JSX files responsible for host-side functionality.

```text
host/
├── main.jsx
└── main_preflight.jsx
```

These scripts run in Adobe Illustrator's scripting environment rather than directly inside the CEP client interface.

### main.jsx

`main.jsx` is the main host-side script used by the extension.

It provides the connection between the CEP client and Adobe Illustrator's scripting environment.

### main_preflight.jsx

`main_preflight.jsx` provides host-side functionality specifically associated with the Pre-flighting system.

The separation between `main.jsx` and `main_preflight.jsx` allows the Pre-flighting system to have its own host-side execution environment.

## Library

The `library` folder contains components that can be managed and updated independently from the main extension interface.

```text
library/
├── scripts/
├── system/
└── templates/
```

The Library is one of the important architectural components of The Sign Pack Tools.

### scripts

The `scripts` folder contains scripts used by the tools and other parts of the system.

Because these scripts are stored in the Library, they can be updated without necessarily replacing the entire CEP extension.

### system

The `system` folder contains shared system components used by the extension.

These components provide functionality that can be used by multiple tools rather than belonging to a single tool.

Examples may include shared functionality for:

- Notifications
- Logging
- Search
- Updates
- Other common services

The specific systems contained in this folder are documented in the corresponding sections of this documentation.

### templates

The `templates` folder contains templates used by The Sign Pack Tools.

These templates are associated with the **File Templates** functionality and can be maintained through the Library system.

## Root Files

Several important files are located at the root of the extension.

### menu.js

`menu.js` defines the structure of the tools displayed in the main interface.

It contains information such as:

- Category names
- Tool names
- Tool IDs
- Descriptions
- Help links
- Search tags
- Category icons

The current main categories are:

```text
File Templates
Tools
Design Tools
Production
```

### tools.js

`tools.js` connects the tool IDs defined by `menu.js` to their implementations.

Conceptually, the execution flow is:

```text
User selects a tool
        ↓
     menu.js
        ↓
      Tool ID
        ↓
     tools.js
        ↓
   Tool implementation
        ↓
 Adobe Illustrator
```

This separation allows the menu definition and the implementation of the tools to be maintained independently.

### version.json

The version file contains version information used by the extension.

Version information is important for identifying the current release and supporting the Library and update systems.

The versioning system is documented in the **Versioning** section.

## Documentation

The `docs` folder contains the documentation for The Sign Pack Tools.

```text
docs/
```

This folder is used to maintain the project's documentation and is not required for the extension to operate.

Documentation is maintained separately so that technical information, development instructions, and system references can evolve alongside the project.

## How the Parts Fit Together

The main architecture can be viewed as:

```text
                 The Sign Pack Tools
                         │
          ┌──────────────┼──────────────┐
          │              │              │
       Client          Host           Library
          │              │              │
      Interface       JSX/CEP       Scripts
          │              │           Systems
          │              │          Templates
          └──────────────┼──────────────┘
                         │
                         ▼
                 Adobe Illustrator
```

The **Client** provides the interface that the user interacts with.

The **Host** provides the connection to Adobe Illustrator's scripting environment.

The **Library** provides scripts, systems, and templates that support the extension and can be updated independently.

The **CSXS** configuration tells Adobe CEP how the extension should be loaded.

Together, these components form the runtime structure of The Sign Pack Tools.

## Important Note

Not every file in the project needs to be modified when adding or updating functionality.

For example:

- Interface changes generally involve the `client` folder.
- CEP configuration changes involve `CSXS`.
- Host-side functionality involves `host`.
- Reusable or updateable components belong in `library`.
- Tool definitions are maintained through `menu.js` and `tools.js`.

The appropriate location depends on the type of change being made.

For a deeper explanation of how these components communicate with each other, see [Architecture](../07-development/architecture.md).