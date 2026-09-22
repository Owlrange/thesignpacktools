# Search System

The **Search System** allows users to find tools and functionality within **The Sign Pack Tools** without having to navigate through the complete tool categories manually.

Instead of requiring users to know which category contains a specific tool, the Search System provides an additional way to discover available functionality.

The Search System works alongside the main tool organization and does not replace the category structure.

## Search Purpose

The primary purpose of the Search System is to make existing functionality easier to discover.

A user may know what they want to accomplish without knowing the exact name or category of the tool.

For example, a user may search for:

```text
crop
```

and find:

**Make Crop Marks**

Similarly, a search for:

```text
vinyl
```

may identify:

**Create Cut Contour**

Search therefore provides an additional path to functionality that is already available through the normal interface.

## Search and Tool Categories

The Search System works together with the categories defined in The Sign Pack Tools.

The normal navigation structure is:

```text
Category
   ↓
Tool
```

Search provides an alternative path:

```text
Search Term
   ↓
Search System
   ↓
Matching Tool
   ↓
Tool
```

Both paths ultimately lead to the same tool.

Search does not create a separate version of a tool or implement a different execution mechanism.

## Searchable Tool Information

The Search System can use information associated with a tool to determine whether it matches a search.

A tool definition can contain information such as:

- Tool ID
- Tool title
- Description
- Tags
- Category
- Associated information links

For example, a tool definition may contain:

```js
{
    id: "cutcontour",
    title: "Create Cut Contour",
    description: "Create a cut contour for flexible materials such as vinyl.",
    help: "...",
    tags: ["cut", "contour", "vinyl"]
}
```

This provides multiple pieces of information that can be used when searching.

A user does not necessarily need to search for the exact tool title.

For example:

```text
Search: vinyl
       ↓
Tag / Description
       ↓
Create Cut Contour
```

## Search Index

The Search System uses an index to organize the information that can be searched.

The index acts as a searchable representation of the available content rather than being the actual implementation of the tools.

A simplified representation is:

```text
Tool Definitions
      ↓
Search Index
      ↓
Search Query
      ↓
Matching Results
```

The index allows the search system to evaluate the available searchable information and return relevant results.

The structure and implementation of the index are documented separately in **Search Index**.

## Search Results

Search results provide the user with enough information to identify the relevant functionality.

A result may include information such as:

- Tool name
- Description
- Category
- Associated tags
- Additional information or help

The result should allow the user to understand what the tool does before opening or executing it.

Search therefore acts as a discovery layer rather than simply matching file names.

## Search and Tool Execution

Finding a tool through Search does not create a different execution path.

Once the user selects a result, the selected tool is executed using the same tool system used by normal category navigation.

The simplified flow is:

```text
User Search
     ↓
Search Result
     ↓
Tool Selection
     ↓
Tool ID
     ↓
Tool Execution
     ↓
Adobe Illustrator
```

This separation is important because the Search System is responsible for **finding** functionality, while the Tool System is responsible for **executing** it.

## Search and the Library

Many of the tools available through The Sign Pack Tools are implemented as resources stored in the Library.

The Search System can expose these tools without requiring users to know where the implementation files are stored.

The relationship can be represented as:

```text
Library
   ↓
Tool Definitions
   ↓
Search Index
   ↓
Search System
   ↓
User
   ↓
Tool
```

The user interacts with the searchable tool information rather than directly with the Library files.

## Search Content and Documentation

Searchable information should describe the functionality in terms that users are likely to understand.

This may include:

- The official tool name
- Common terminology
- Production terminology
- Alternative terms
- Material names
- Workflow-related keywords

For example, a tool related to cut contours may benefit from searchable terms such as:

```text
cut
contour
vinyl
cutting
```

The goal is to make useful functionality discoverable even when the user's search term does not exactly match the tool title.

The process for adding or modifying searchable content is documented in **Adding Searchable Content**.

## Search Is an Additional Navigation Layer

The Search System does not replace the category structure.

Categories remain important because they provide context and allow users to browse related functionality.

Search provides a faster alternative when the user already knows approximately what they are looking for.

The two systems therefore serve different purposes:

```text
Categories
   ↓
Browse and understand available functionality

Search
   ↓
Quickly discover specific functionality
```

Both lead to the same underlying tool system.

## Maintaining Search Content

Search content should be maintained whenever the available tools change.

When a new tool is added, its searchable information should be reviewed.

When a tool's purpose changes, its searchable terms may also need to be updated.

When a tool is removed, its corresponding searchable information should no longer remain available as an active result.

Keeping the search content synchronized with the toolset prevents users from receiving outdated or misleading results.

## Adding Searchable Content

Adding a new tool does not necessarily mean that its search behavior will be optimal automatically.

The Tool Creator should consider which terms a user would reasonably use to find the functionality.

For example, a tool called:

```text
Create Bounding Box
```

may benefit from terms such as:

```text
bounding
box
dimensions
size
```

The exact implementation of searchable content depends on the Search System and its index.

Detailed procedures are documented in **Adding Searchable Content**.

## Search System Responsibilities

The Search System is responsible for:

- Receiving search queries
- Evaluating searchable content
- Finding relevant matches
- Presenting results
- Providing a path to the selected functionality

It is not responsible for implementing the tools themselves.

The separation can be summarized as:

```text
Search System
    ↓
Finds the tool

Tool System
    ↓
Executes the tool

```

This separation allows each part of the system to evolve independently.

## Summary

The **Search System** provides an additional way to discover functionality within The Sign Pack Tools.

It uses searchable information associated with tools to connect user queries with relevant functionality.

The overall flow is:

```text
User
  ↓
Search Query
  ↓
Search System
  ↓
Search Index
  ↓
Search Result
  ↓
Tool ID
  ↓
Tool System
  ↓
Tool execution
```

The Search System is therefore a **discovery layer**, not a separate tool execution system.

The next documentation pages describe the structure of the Search Index and the process for adding searchable content to new or existing tools.