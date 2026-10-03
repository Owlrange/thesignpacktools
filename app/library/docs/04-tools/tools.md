# Tools

The **Tools** category contains general-purpose utilities for **Adobe Illustrator**.

These tools primarily work with Illustrator functionality and document structure and can be used across different roles and stages of the workflow.

For the scope and boundaries of the tool categories, see **Tools Overview**.

## Current Tools

The current Tools category includes:

- **Create Reference Layer**
- **Artboard Stroke**
- **Create Multiple Artboards**
- **Save as PDF**
- **Safe to Flexi**
- **Make Crop Marks**
- **Rename Artboards**

The available tools may change as new workflow requirements are identified.

## Create Reference Layer

**Create Reference Layer** creates a reference layer within the Illustrator document.

Reference layers can be used to keep visual or structural information separate from the main artwork.

The tool simplifies the creation and configuration of this document structure without requiring the user to perform each step manually.

## Artboard Stroke

**Artboard Stroke** creates a stroke based on the dimensions of an Illustrator artboard.

This can be useful when an artboard boundary needs to be represented as an actual Illustrator object.

The tool automates the creation of the stroke based on the existing artboard dimensions.

## Create Multiple Artboards

**Create Multiple Artboards** creates a new artboard for each selected object.

This simplifies workflows where multiple objects need to become individual artboards.

Instead of manually creating and sizing each artboard, the tool uses the selected objects as the basis for the new artboards.

## Save as PDF

**Save as PDF** saves the document's artboards as a PDF.

The tool provides a consistent way to perform the export without requiring the user to repeat the process manually through Illustrator's interface.

The exact export behavior and PDF settings depend on the implementation of the tool.

## Safe to Flexi

**Safe to Flexi** prepares and saves a file in a format intended to be safely opened in **Flexi**.

This tool simplifies the workflow when Illustrator artwork needs to be transferred to another application used in the production environment.

The tool handles the preparation required by the workflow instead of requiring the user to perform each step manually.

## Make Crop Marks

**Make Crop Marks** creates crop marks based on the artwork or document structure.

Crop marks can be useful when artwork requires visual or production reference marks.

The tool automates their creation instead of requiring them to be generated manually.

## Rename Artboards

**Rename Artboards** allows Illustrator artboards to be renamed through the tool.

Consistent artboard names can be useful when documents contain multiple artboards or when names are used by downstream workflows.

The tool simplifies the process of renaming artboards without requiring each artboard to be managed manually through Illustrator's standard interface.

## Role Independence

The Tools category is intentionally not divided between Designers and Production Artists.

The same Illustrator operation may be useful at different stages of the workflow.

For example:

```text
Designer
   ↓
Create Multiple Artboards
   ↓
Continue Artwork

Production Artist
   ↓
Rename Artboards
   ↓
Prepare File
```

The role of the person using a tool does not determine its category.

Tools provide reusable Illustrator functionality that can support whoever needs the operation.

## Tool Implementation

Each visible tool is backed by an implementation that performs the actual operation.

For many Tools, the implementation is an Adobe Illustrator JSX script stored in the Library.

The general relationship is:

```text
Tool
  ↓
tools.js
  ↓
JSX Implementation
  ↓
Adobe Illustrator
```

The tool ID is registered in `library/tools.js`, which maps the tool to its implementation file.

For example:

```js
create: { file: "MakeNewArtboards.jsx" }
```

The user normally does not need to interact with this implementation directly.

Technical details about tool registration and implementation are documented in **Development & Tool Creation**.

## Adding New Tools

A new Illustrator utility may be added to this category when its primary purpose is to provide general-purpose Illustrator functionality.

The tool should have a clearly defined purpose and provide a useful improvement over performing the operation manually.

The process generally involves:

```text
Tool Implementation
        ↓
Tool Registration
        ↓
Tool Definition
        ↓
User Interface
        ↓
Testing
        ↓
Developer Review
```

The technical process for creating and registering a new tool is documented in **Development & Tool Creation**.

## Tool Updates

Tools stored in the Library can be updated independently from the main CEP extension.

This allows improvements and bug fixes to be distributed without necessarily requiring a complete extension update.

The Library update process is documented in **Updating the Library**.

## Summary

The **Tools** category provides general-purpose utilities for Adobe Illustrator.

The current tools focus on operations such as:

- Managing artboards
- Managing document structure
- Creating reference layers
- Creating crop marks
- Exporting files
- Preparing files for other applications
- Renaming document elements

The category is intentionally role-independent.

A tool belongs here because of **what it does**, not because of **who uses it**.