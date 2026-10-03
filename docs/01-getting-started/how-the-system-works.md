# How the System Works

The Sign Pack Tools is composed of several components that work together to provide a unified tool environment inside Adobe Illustrator.

At a high level, the system consists of the user interface, tool definitions, JavaScript logic, Illustrator JSX scripts, shared systems, and external resources.

This page provides a conceptual overview of how these components relate to each other. Detailed implementation information is covered in the Development and Code Reference sections.

<!-- SCREENSHOT PLACEHOLDER
Suggested image:
Main The Sign Pack Tools interface showing all four main categories.

Suggested caption:
"The Sign Pack Tools main interface."
-->

## System Overview

The current user interface is organized into four main categories:

```text
THE SIGN PACK TOOLS
│
├── File Templates
│   ├── Standard Template
│   ├── ADA Template
│   └── Vehicle Template
│
├── Tools
│   ├── Create Reference Layer
│   ├── Artboard Stroke
│   ├── Create Multiple Artboards
│   ├── Save as PDF
│   ├── Safe to Flexi
│   ├── Make Crop Marks
│   └── Rename Artboards
│
├── Design Tools
│   ├── Check Named Colors
│   ├── Check Image Quality
│   ├── SQFT Callout
│   ├── SQFT Calculator
│   └── Scale Factor
│
└── Production
    ├── Prod Preparation
    ├── Create Outline
    ├── Create Cut Contour
    ├── Create Bounding Box
    ├── Make White Ink
    ├── Grommets / Hole Marks
    └── Pre-flighting
```

These categories represent the current organization of the user interface. The available tools may change as the system evolves.

## File Templates

The **File Templates** category contains tools for creating documents based on predefined templates.

The current templates include:

- **Standard Template**
- **ADA Template**
- **Vehicle Template**

Templates can also provide access to additional documentation or resources when appropriate.

For example, the ADA and Vehicle templates currently include links to relevant resources in the Info System.

<!-- SCREENSHOT PLACEHOLDER
Suggested image:
The File Templates category expanded in the TSP Tools interface.
-->

## Tools

The **Tools** category contains general-purpose utilities that support common Illustrator and workflow tasks.

The current tools include:

- **Create Reference Layer**
- **Artboard Stroke**
- **Create Multiple Artboards**
- **Save as PDF**
- **Safe to Flexi**
- **Make Crop Marks**
- **Rename Artboards**

These tools cover a range of tasks involving documents, artboards, file preparation, and output.

The category is intentionally broad because these tools do not belong exclusively to the Design or Production categories.

<!-- SCREENSHOT PLACEHOLDER
Suggested image:
The Tools category expanded in the TSP Tools interface.
-->

## Design Tools

The **Design Tools** category contains tools intended to support design-related tasks.

The current tools include:

- **Check Named Colors**
- **Check Image Quality**
- **SQFT Callout**
- **SQFT Calculator**
- **Scale Factor**

These tools can assist with artwork inspection, design calculations, image quality, and other tasks that may occur during the design workflow.

<!-- SCREENSHOT PLACEHOLDER
Suggested image:
The Design Tools category expanded in the TSP Tools interface.
-->

## Production

The **Production** category contains tools intended to assist with production preparation and production-specific requirements.

The current tools include:

- **Prod Preparation**
- **Create Outline**
- **Create Cut Contour**
- **Create Bounding Box**
- **Make White Ink**
- **Grommets / Hole Marks**
- **Pre-flighting**

These tools can prepare artwork for production, create production-specific elements, and identify potential issues before a file moves forward in the workflow.

<!-- SCREENSHOT PLACEHOLDER
Suggested image:
The Production category expanded in the TSP Tools interface.
-->

## How a Tool Is Connected to Its Script

The user interface does not contain the complete implementation of every tool.

The menu defines the tool's user-facing information, while `tools.js` associates a tool ID with the JSX file responsible for performing the operation.

For example, a simplified relationship looks like this:

```text
Menu
 │
 │  tool ID
 ▼
tools.js
 │
 │  JSX filename
 ▼
JSX Script
 │
 ▼
Adobe Illustrator
```

For example:

```text
Create Cut Contour
        │
        ▼
   cutcontour
        │
        ▼
MakeCutContour.jsx
        │
        ▼
Adobe Illustrator
```

This separation allows the interface information and the implementation of a tool to be managed independently.

## The Menu Definition

The `menu.js` file defines the structure presented to the user.

It contains information such as:

- Category ID
- Category title
- Category icon
- Tool ID
- Tool title
- Tool description
- Help URL
- Search tags

A simplified example is:

```javascript
{
    id: "cutcontour",
    title: "Create Cut Contour",
    description: "Create a cut contour for flexible materials such as vinyl.",
    help: "...",
    tags: [
        "cut",
        "contour",
        "vinyl"
    ]
}
```

The menu therefore controls how a tool is presented and categorized in the interface.

## The Tool Definition

The `tools.js` file connects the tool ID to the JSX file that performs the operation.

For example:

```javascript
cutcontour: {
    file: "MakeCutContour.jsx"
}
```

This means that when the `cutcontour` tool is executed, the system knows which JSX file should be loaded.

The tool definition therefore acts as a bridge between the user-facing tool and its Illustrator-side implementation.

## Tool Execution

When a user selects a tool, the general execution flow is:

```text
User
 │
 ▼
Menu / Interface
 │
 ▼
Tool ID
 │
 ▼
runTool()
 │
 ▼
TOOLS definition
 │
 ▼
JSX filename
 │
 ▼
runJSX()
 │
 ▼
JSX Script
 │
 ▼
Adobe Illustrator
```

Not every operation necessarily follows exactly the same sequence, but this represents the general architecture used by the current tools.

## Special Tool Behavior

Some tools may require behavior beyond simply executing a JSX file.

For example, the current Pre-flighting tool is handled directly by `runTool()` before the normal tool lookup is performed.

Conceptually:

```text
User selects Pre-flighting
          │
          ▼
       runTool()
          │
          ▼
   Special handling
          │
          ▼
 openPreflight()
```

This allows tools with more complex interfaces or execution requirements to use specialized behavior while other tools can continue using the standard `runJSX()` mechanism.

## JavaScript and JSX

The extension uses JavaScript for its application logic and JSX for operations that need to interact with Adobe Illustrator's scripting environment.

JavaScript is responsible for tasks such as:

- Managing the interface
- Responding to user actions
- Identifying the selected tool
- Calling shared functions
- Executing JSX
- Handling notifications
- Opening external resources

JSX is used to perform Illustrator-specific operations.

This separation allows the extension to provide a consistent interface while individual Illustrator operations remain modular.

## Shared Systems

In addition to the individual tools, The Sign Pack Tools contains systems that support multiple parts of the application.

These include:

### Library

The Library manages scripts, resources, and other components used by the extension.

It also provides the foundation for distributing updates to those components.

### Search

The Search system allows users to locate tools and other searchable resources.

The tool definitions already contain information such as descriptions and tags that can be used to support this functionality.

### Notify

The Notify system provides user-facing feedback when an operation completes, requires attention, or encounters a problem.


### Info System

The Info System provides access to external documentation and resources, including TSP University.

The content itself remains maintained in TSP University rather than being duplicated inside The Sign Pack Tools.

## The Library and Updates

The Library allows certain components of the system to be updated independently from the main extension.

A simplified update flow is:

```text
Developer
    │
    ▼
Updated Scripts / Resources
    │
    ▼
Library
    │
    ▼
Library Update System
    │
    ▼
User's TSP Tools
```

The details of the Library structure and update process are documented separately in the Library section.

## External Resources

The Sign Pack Tools can connect users to external resources when additional information is required.

The Info System provides links to resources such as TSP University.

This keeps the extension focused on providing tools and workflow functionality while allowing external knowledge resources to remain maintained in their appropriate systems.

## A Typical Tool Execution

A typical tool execution can be summarized as:

```text
1. User selects a tool
          │
          ▼
2. Interface identifies the tool ID
          │
          ▼
3. runTool() receives the ID
          │
          ▼
4. TOOLS identifies the associated JSX file
          │
          ▼
5. runJSX() executes the script
          │
          ▼
6. Adobe Illustrator performs the operation
          │
          ▼
7. The extension provides appropriate feedback
```

Some tools may use specialized execution paths instead of the standard `runJSX()` process.

## Designed for Expansion

The system is designed so that new tools can be added without rebuilding the entire extension.

A typical new tool requires:

- A tool entry in the menu
- A tool definition
- A JSX script when Illustrator-side functionality is required
- Appropriate help or documentation links when applicable
- Search tags when useful
- Documentation describing the new functionality

This structure allows the system to grow while maintaining a consistent relationship between the user interface and the underlying implementation.

## Documentation and the System

The documentation is maintained alongside the system so that changes to the extension can be documented as the project evolves.

When a new tool or system is introduced, the appropriate documentation should be updated at the same time.

The documentation therefore serves two purposes:

1. It helps users understand and use The Sign Pack Tools.
2. It provides developers with the information required to maintain and extend the system.

## Where to Learn More

This page provides a conceptual overview of the current architecture.

For more detailed information, continue to:

- **Library** — Library structure and update system
- **Search** — Search functionality and searchable content
- **Notify & Logger** — Notifications, logging, and debugging
- **Development** — Extension architecture and development workflow
- **Code Reference** — Functions, scripts, and technical implementation
- **Versioning** — Version numbers and release management

<!-- FUTURE IMAGES
Suggested documentation screenshots:
1. Main TSP Tools interface
2. File Templates expanded
3. Tools expanded
4. Design Tools expanded
5. Production expanded
6. Example of a tool being executed
7. Library/update workflow
-->