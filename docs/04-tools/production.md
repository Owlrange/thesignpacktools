# Production

The **Production** category contains tools specifically designed to prepare, inspect, and validate artwork for production.

These tools support production requirements such as cutting, printing, finishing, file preparation, and pre-production checks.

For the scope and boundaries of the tool categories, see **Tools Overview**.

## Current Tools

The current Production category includes:

- **Prod Preparation**
- **Create Outline**
- **Create Cut Contour**
- **Create Bounding Box**
- **Make White Ink**
- **Grommets / Hole Marks**
- **Pre-flighting**

The available tools may change as production requirements and workflows evolve.

## Prod Preparation

**Prod Preparation** prepares an Illustrator document for production.

The tool can perform cleanup and document preparation tasks required before a file is sent to production.

Depending on the workflow, this may include operations such as:

- Cleaning unnecessary elements
- Removing or organizing layers
- Preparing production-related document structures
- Performing other predefined preparation tasks

The exact operations performed by the tool are determined by its implementation and the production workflow it supports.

## Create Outline

**Create Outline** creates an outline around artwork for cutting rigid materials.

It is intended for workflows involving materials such as:

- ACM
- Aluminum
- Acrylic
- Other rigid substrates

The tool automates the creation of the production outline based on the artwork.

The resulting outline is intended to provide the geometry required by downstream cutting processes.

## Create Cut Contour

**Create Cut Contour** creates a cut contour for artwork intended for flexible materials.

Typical applications include:

- Vinyl
- Printed vinyl
- Vehicle graphics
- Other flexible materials requiring a contour cut

The tool creates the appropriate cut contour around the artwork instead of requiring it to be constructed manually.

The exact contour behavior depends on the production workflow and the implementation of the tool.

## Create Bounding Box

**Create Bounding Box** creates a bounding box representing the overall dimensions of the artwork.

The bounding box can be used to define the overall size of the artwork, including the white edge or other areas relevant to the production workflow.

This information can be important when determining the final dimensions of a printed or manufactured piece.

## Make White Ink

**Make White Ink** prepares artwork for white ink printing.

The tool creates or prepares the required white ink artwork according to the production workflow.

White ink can be used in printing processes where additional white ink layers are required beneath, above, or within the printed artwork.

The exact structure and behavior of the white ink output depend on the production requirements and the implementation of the tool.

## Grommets / Hole Marks

**Grommets / Hole Marks** creates marks used to indicate locations for grommets or holes.

These marks provide visual or production information that can be used during finishing and installation.

The tool supports different production workflows where the location of hardware or mounting holes needs to be represented in the artwork.

The tool does not define a single universal grommet standard. Specific placement and sizing requirements depend on the project and production workflow.

## Pre-flighting

**Pre-flighting** checks the Illustrator document for potential production issues before manufacturing.

The purpose of the tool is to identify conditions that may cause problems during production or require additional review.

The preflight system can evaluate production-related elements such as:

- Required production layers
- Production colors
- Stroke properties
- Artwork structure
- Images and other document elements
- Production-specific requirements

The exact checks performed by Pre-flighting may evolve as new production requirements are incorporated into The Sign Pack Tools.

## Production Workflow

Production tools can be used at different points during file preparation.

A simplified workflow may look like:

```text id="z8d8i4"
Artwork
   ↓
Prod Preparation
   ↓
Production Tools
   ↓
Pre-flighting
   ↓
Production File
```

Not every project requires every Production tool.

The appropriate tools depend on the material, printing method, finishing process, and other requirements of the project.

## Production Tools and Production Standards

The Production category is closely connected to the production standards used by **The Sign Pack**.

A tool may automate a requirement, create a standardized production element, or verify that a document follows a specific production workflow.

Using a Production tool does not replace understanding the requirements behind the operation.

For detailed production knowledge and project-specific requirements, users should refer to the appropriate resources provided through the **Info System** and **TSP University**.

The Sign Pack Tools provides the functionality and automation; the associated production documentation provides the knowledge required to use that functionality correctly.

## Production Layers and Elements

Several Production tools create or interact with elements that have a specific role in the production file.

Examples include:

- Cut contours
- Outlines
- Bounding boxes
- White ink artwork
- Grommet and hole marks
- Production preparation layers

These elements should be treated as production data rather than ordinary design artwork.

Their names, colors, stroke properties, structure, and other characteristics may be important to downstream production workflows.

The exact requirements for each element are documented separately where appropriate.

## Production Tool Implementation

Each visible Production tool is backed by an implementation that performs the actual operation.

For many tools, the implementation is an Adobe Illustrator JSX script stored in the Library.

The general relationship is:

```text id="2u6bbr"
Production Tool
       ↓
tools.js
       ↓
JSX Implementation
       ↓
Adobe Illustrator
```

For example:

```js id="j3kv7h"
outline: { file: "MakeOutline.jsx" }
cutcontour: { file: "MakeCutContour.jsx" }
whiteInk: { file: "MakeWhiteInk.jsx" }
preflight: { file: "preflight.jsx" }
```

The user normally does not need to interact directly with these implementation files.

Technical information about tool registration and implementation is documented in **Development & Tool Creation**.

## Adding New Production Tools

A new tool may belong in the Production category when it addresses a clearly defined production requirement.

Typical reasons for creating a new Production tool include:

- Automating a repetitive production task
- Creating a required production element
- Preparing artwork for a specific manufacturing process
- Validating a production requirement
- Reducing manual production preparation
- Standardizing a production workflow

The general development process is:

```text id="bq4zck"
Production Requirement
        ↓
Tool Implementation
        ↓
Testing with Production Files
        ↓
Tool Registration
        ↓
Developer Review
        ↓
Documentation
        ↓
Library Update
```

New Production tools should be tested with realistic production files before being distributed to other users.

The technical process for creating and registering a new tool is documented in **Development & Tool Creation**.

## Tool Updates

Production tools stored in the Library can be updated independently from the main CEP extension.

This allows production requirements, bug fixes, and workflow improvements to be incorporated without necessarily replacing the complete extension.

The Library update process is documented in **Updating the Library**.

## Summary

The **Production** category provides tools for preparing and validating artwork for manufacturing.

The current tools focus on:

- Production preparation
- Rigid-material outlines
- Flexible-material cut contours
- Artwork bounding boxes
- White ink preparation
- Grommet and hole marks
- Production preflight

These tools help transform design artwork into files that are ready for downstream production processes.

Production tools automate and standardize specific operations, but they should always be used together with the applicable production requirements and documentation.