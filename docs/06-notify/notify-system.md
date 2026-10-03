# Notify System

The **Notify System** provides a consistent way for **The Sign Pack Tools** to communicate information to the user.

Instead of each tool implementing its own notification behavior, the system provides a shared mechanism that can be used by different parts of the extension.

Notifications can be used to communicate events such as successful operations, warnings, and errors.

## Notify Purpose

The primary purpose of the Notify System is to provide consistent user feedback.

A typical interaction can be represented as:

```text
User
  ↓
Tool
  ↓
Operation
  ↓
Notify
  ↓
User Feedback
```

For example, a tool may complete an operation and notify the user that the process was successful.

If a problem occurs, the tool can instead provide a warning or error notification.

## Notification Types

Notifications can communicate different types of information depending on the situation.

Common examples include:

- Success
- Information
- Warning
- Error

The type of notification helps communicate the importance of the message.

For example:

```text
Success
Operation completed successfully.

Warning
The operation completed, but something requires attention.

Error
The operation could not be completed.
```

The exact appearance and behavior of notifications are determined by the implementation of the Notify System.

## Shared Notification Behavior

The Notify System provides a shared mechanism so that different tools can communicate with the user consistently.

Without a shared system, individual tools could implement different notification styles:

```text
Tool A → alert()
Tool B → custom message
Tool C → console only
Tool D → custom notification
```

A shared system instead provides a common interface:

```text
Tool A ─┐
Tool B ─┤
Tool C ─┼→ Notify System → User
Tool D ─┘
```

This makes the user experience more predictable and makes notification behavior easier to maintain.

## Notifications and Tool Execution

Notifications are normally used around operations performed by tools.

A simplified execution flow is:

```text
User
  ↓
Select Tool
  ↓
Tool Execution
  ↓
Operation Result
  ↓
Notify User
```

For example:

```text
User
  ↓
Check Image Quality
  ↓
Images analyzed
  ↓
Results available
  ↓
Notification
```

The notification communicates the result of the operation; it does not perform the operation itself.

## Notifications and Errors

The Notify System can also be used when an operation cannot be completed normally.

A tool may encounter situations such as:

- No document is open
- Required objects are missing
- An operation cannot be performed
- An unexpected condition occurs

Instead of silently failing, the tool can provide feedback to the user.

A simplified flow is:

```text
Tool
  ↓
Operation
  ↓
Problem Detected
  ↓
Notify
  ↓
User
```

Error handling and notification are related, but they are not the same system.

The code responsible for detecting and handling an error remains part of the tool or application logic.

The Notify System provides the mechanism for communicating the result to the user.

## Notify and JSX

Many tools in The Sign Pack Tools use Adobe Illustrator JSX scripts for their implementation.

Because JSX execution can occur separately from the CEP interface, communication between the script and the interface must be handled appropriately.

The Notify System can be used as part of this communication flow when a tool needs to provide feedback after executing a script.

A simplified architecture is:

```text
CEP Interface
      ↓
Tool
      ↓
JSX
      ↓
Operation
      ↓
Result
      ↓
Notification
      ↓
User
```

The exact communication mechanism depends on the implementation of the extension.

Technical details about communication between the CEP interface and JSX are documented in **Development & Tool Creation**.

## Notifications and User Experience

Notifications should communicate useful information without unnecessarily interrupting the user's workflow.

A notification should generally answer one of these needs:

- Confirm that an operation completed
- Inform the user about an important result
- Warn about a condition requiring attention
- Explain why an operation could not be completed

Messages should be concise and related to the operation that generated them.

For example:

```text
Good:
"PDF exported successfully."

Less useful:
"Done."

Good:
"No document is currently open."

Less useful:
"Error."
```

Useful messages reduce ambiguity and make troubleshooting easier.

## Notifications and Logging

The Notify System and the **Logger System** serve different purposes.

**Notify** communicates with the user.

**Logger** records information useful for development, debugging, and maintenance.

The distinction can be represented as:

```text
Operation
    │
    ├──→ Notify → User
    │
    └──→ Logger → Developer / Maintainer
```

A message may therefore be useful to both systems, but the information presented to each audience may be different.

User notifications should generally remain concise, while logs can contain additional technical information.

## Using Notify in Tools

When creating or modifying a tool, user-facing feedback should use the shared Notify System where appropriate rather than creating an independent notification mechanism.

This helps maintain consistent behavior across the extension.

A typical pattern is:

```text
Start Operation
      ↓
Perform Operation
      ↓
Determine Result
      ↓
Notify User
```

The exact function or API used to generate the notification is implementation-specific and should be documented in the technical code reference.

## Maintaining the Notify System

Changes to the Notify System can affect multiple tools at once.

Because it is shared infrastructure, changes should be treated differently from changes to an individual tool.

Before modifying the system, consider:

- Which tools depend on it?
- Does the change affect existing notification types?
- Does the change alter the user experience?
- Are existing error and success messages still displayed correctly?
- Does the change affect communication between the CEP interface and JSX?

Shared infrastructure changes should be tested across the functionality that depends on it.

## Summary

The **Notify System** provides a shared mechanism for communicating information from The Sign Pack Tools to the user.

Its primary responsibilities are:

- Providing consistent user feedback
- Communicating successful operations
- Displaying warnings
- Communicating errors
- Supporting feedback from tool execution

Notify and Logger have different responsibilities:

```text
Notify
  ↓
Communicates with the User

Logger
  ↓
Supports Developers and Maintainers
```

The Notify System is therefore part of the infrastructure of The Sign Pack Tools rather than a user-facing tool category.

Its implementation details and available functions are documented separately in the technical code reference.