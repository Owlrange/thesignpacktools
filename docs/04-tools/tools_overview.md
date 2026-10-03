# Tools Overview

The **Tools** section contains the functionality available through **The Sign Pack Tools**.

The tools are organized according to their purpose within the workflow, allowing users to find the functionality they need without having to work directly with individual scripts.

The current tool organization includes:

- **File Templates**
- **Tools**
- **Design Tools**
- **Production**

Each category has a defined purpose within the system. A tool may be useful at different stages of the workflow, but its category is determined primarily by **what the tool does**.

## Category Scope

The four categories represent different types of functionality within The Sign Pack Tools.

### File Templates

**File Templates** provides standardized starting documents for common project types.

Templates are intended to establish the initial document structure and settings required for a specific workflow.

The current templates include:

- **Standard Template**
- **ADA Template**
- **Vehicle Template**

File Templates are focused on **creating the starting point for a project**.

### Tools

The **Tools** category contains general-purpose utilities that primarily work with Adobe Illustrator's native functionality and document structure.

These tools are not tied to a specific design discipline or production requirement and may be useful to both Designers and Production Artists.

Examples include:

- Artboard operations
- Document organization
- Reference layers
- Crop marks
- File export
- Artboard naming

Tools are focused on **working with Illustrator and the document itself**.

### Design Tools

The **Design Tools** category contains tools that operate on or evaluate the artwork during the design process.

These tools support activities such as:

- Artwork inspection
- Image quality verification
- Color verification
- Design-related calculations
- Artwork dimensions
- Scale and sizing

The current tools include:

- **Check Named Colors**
- **Check Image Quality**
- **SQFT Callout**
- **SQFT Calculator**
- **Scale Factor**

Design Tools are focused on **creating, evaluating, and preparing the artwork from a design perspective**.

### Production

The **Production** category contains tools specifically related to production requirements and manufacturing preparation.

These tools can modify artwork or perform checks according to requirements needed by downstream production processes.

The current tools include:

- **Prod Preparation**
- **Create Outline**
- **Create Cut Contour**
- **Create Bounding Box**
- **Make White Ink**
- **Grommets / Hole Marks**
- **Pre-flighting**

Production tools are focused on **preparing and validating artwork for manufacturing**.

## Category Boundaries

The categories should be understood as a classification system rather than completely isolated stages.

A useful distinction is:

```text
File Templates
    ↓
Create the starting document

Tools
    ↓
Work with Illustrator and document structure

Design Tools
    ↓
Work with or evaluate the artwork

Production
    ↓
Prepare and validate artwork for manufacturing
```

This distinction is based on the **primary purpose of the functionality**, not necessarily on the person using it.

For example, a Production Artist may use a Design Tool to check image resolution, while a Designer may use a general Tool to rename artboards.

The user's role does not determine the category.

## Category Comparison

| Category | Primary Purpose | Typical Examples |
|---|---|---|
| **File Templates** | Create standardized starting documents | Standard, ADA, Vehicle |
| **Tools** | Work with Illustrator and document structure | Artboards, references, export |
| **Design Tools** | Evaluate and prepare artwork | Image quality, colors, SQFT |
| **Production** | Prepare artwork for manufacturing | Cut contours, white ink, preflight |

This distinction provides a consistent way to decide where new functionality should belong.

## Tools Are Part of a Larger Workflow

The categories are intended to organize the available functionality, but they should not be considered completely isolated systems.

A typical workflow may use tools from several categories:

```text
File Template
      ↓
Design Tools
      ↓
Tools
      ↓
Production
      ↓
Pre-flight
```

A Designer may begin with a template, use Design Tools while creating the artwork, use general Tools to manage the document, and then use Production tools before the file is delivered.

The exact workflow depends on the type of project.

The order is therefore an example rather than a required sequence.

## Tools and Production Standards

The tools are designed to support the workflows and standards used by **The Sign Pack**.

A tool may automate a specific operation, enforce a particular file structure, or prepare artwork for a downstream production process.

However, using a tool does not replace understanding the production requirements behind the task.

When a tool links to additional information, users should refer to the appropriate resources for the complete production requirements.

The **Info System** can provide links to relevant information maintained through **TSP University**.

The Sign Pack Tools documentation explains how the system provides access to this information, while the production knowledge itself is maintained separately.

## Tools and Scripts

The visible tool in The Sign Pack Tools interface is backed by an implementation that performs the actual operation.

For many tools, this implementation is an Adobe Illustrator JSX script stored in the Library.

The relationship can be represented as:

```text
User
  ↓
The Sign Pack Tools Interface
  ↓
Tool
  ↓
Library Script
  ↓
Adobe Illustrator
```

The user normally does not need to interact directly with the script.

This separation allows the interface to remain simple while the underlying functionality can be developed and updated independently.

## Finding a Tool

The Sign Pack Tools provides a structured interface for finding available tools.

Tools are organized by category and can also be discovered through the system's search functionality.

A tool's description and, when available, associated information links can provide additional context about its purpose.

The Search System is documented separately in the **Search** section.

## Creating and Maintaining Tools

The tool system is designed to allow new functionality to be added over time.

A new tool generally consists of:

```text
Tool Implementation
        ↓
Tool Registration
        ↓
Tool Definition
        ↓
User Interface
```

For Tool Creators, the important concept is that adding a tool involves both its functionality and its registration within The Sign Pack Tools.

Developers and Maintainers are responsible for ensuring that new tools follow the architecture of the system and do not interfere with existing functionality.

The complete development process is documented in the **Development & Tool Creation** section.

## Tool Updates

Tools stored in the Library can be updated independently from the main CEP extension.

This allows improvements and bug fixes to be distributed without necessarily requiring a complete extension update.

The general update flow is:

```text
Tool Change
     ↓
Testing
     ↓
Developer Review
     ↓
Git Repository
     ↓
Library Update System
     ↓
Updated Tool
```

The Library update process is documented in **Updating the Library**.

## Growing the Toolset

The toolset is expected to evolve as new production requirements and workflow improvements are identified.

A new requirement may result in:

- A completely new tool
- An improvement to an existing tool
- A new template
- A new production check
- A new design utility
- An improvement to an existing workflow

New functionality should solve a clearly identified problem rather than simply add functionality for its own sake.

When a new tool is proposed, its category should be determined by its primary purpose.

This keeps the organization predictable as the toolset grows.

## Summary

The Tools section provides a centralized way to access functionality designed for different parts of The Sign Pack workflow.

The current categories are:

```text
File Templates
Tools
Design Tools
Production
```

Their primary purposes can be summarized as:

- **File Templates** — create standardized starting documents.
- **Tools** — work with Illustrator and document structure.
- **Design Tools** — work with or evaluate artwork.
- **Production** — prepare and validate artwork for manufacturing.

These categories provide the organizational foundation for the tools available through The Sign Pack Tools.

Individual category pages focus on the tools themselves. This overview defines the category boundaries and should be used as the reference when determining where new functionality belongs.