# Error Handling

Error handling is responsible for detecting failures, preventing unexpected behavior, and communicating problems clearly when a tool cannot complete its operation.

In The Sign Pack Tools, errors can occur at different levels of the system, including user input, Illustrator document state, JSX execution, CEP communication, and internal tool logic.

The goal of error handling is not only to prevent the extension from crashing, but also to ensure that failures are handled in a predictable and understandable way.

## Error Handling Goals

The error handling system should:

- Detect problems before they cause unexpected behavior.
- Stop an operation when continuing could produce an invalid result.
- Provide useful feedback to the user.
- Preserve the stability of the extension.
- Make technical problems easier to diagnose.
- Avoid silently ignoring failures.
- Prevent partially completed operations when possible.

Error handling should be proportional to the operation being performed. A minor validation problem may only require a warning, while a failure during a critical production operation may require the operation to stop completely.

## Error Categories

Different types of errors can occur within the TSP Tools architecture.

### User Input and Document State

These errors occur when the current Illustrator document does not meet the requirements of a tool.

Examples include:

- No document is open.
- No object is selected when a selection is required.
- Required artwork is missing.
- Required layers do not exist.
- An object is in an unexpected state.
- A document does not contain the information required by the tool.

These conditions should normally be detected before the main operation begins.

### Tool Logic Errors

These occur when the tool's own logic encounters an unexpected condition.

Examples include:

- An expected object cannot be found.
- A calculation produces an invalid result.
- A required value is missing.
- An unexpected object type is encountered.
- A processing step fails.

These errors are normally handled within the tool implementation.

### JSX and Illustrator Errors

Tools that perform operations inside Illustrator commonly use JSX scripts.

An error can occur when:

- A JSX script fails during execution.
- Illustrator rejects an operation.
- An Illustrator object cannot be modified.
- A document operation produces an exception.
- A script encounters an unexpected Illustrator state.

These errors should be handled by the JSX implementation whenever possible.

### CEP Communication Errors

The CEP interface and Illustrator host communicate through the extension's execution mechanisms.

A failure can occur when:

- A JSX file cannot be executed.
- Communication between the interface and Illustrator fails.
- The requested implementation cannot be found.
- A host-side operation returns an unexpected result.

These failures belong to the communication layer rather than to the visual interface itself.

### Infrastructure Errors

The extension also depends on shared infrastructure such as the Library, tool registration, and other application-level systems.

Examples include:

- A required script cannot be found.
- A tool is not correctly registered.
- A Library resource is unavailable.
- A required system file cannot be accessed.

Infrastructure failures may affect more than one tool and should therefore be handled carefully.

## Error Handling Flow

A typical error-handling flow is:

```text
Operation
   ↓
Validation
   ↓
Execute
   ↓
Error detected?
   ├── No → Complete operation
   │
   └── Yes
        ↓
     Handle error
        ↓
     Stop or recover
        ↓
     Notify user
```

For technical errors, additional diagnostic information may be useful during development and maintenance.

The important principle is that an error should have an intentional outcome. The system should not simply continue execution as if nothing happened.

## Validation Before Execution

Whenever possible, tools should validate their prerequisites before modifying the document.

For example:

```text
Check document
      ↓
Check selection
      ↓
Check required objects
      ↓
Check required layers
      ↓
Execute operation
```

This approach prevents predictable errors from occurring during the main operation.

Validation is particularly important for production tools because an incomplete or invalid operation can produce files that appear correct but are not suitable for manufacturing.

## User-Facing Errors

Users should receive a message when an operation cannot be completed and the problem affects their workflow.

A useful error message should explain:

1. What happened.
2. Why the operation could not continue, when known.
3. What the user can do next, when applicable.

For example:

```text
No document is open.

Please open an Illustrator document and try again.
```

Messages should be concise and understandable.

Technical implementation details such as stack traces, internal filenames, or JavaScript exceptions should normally not be exposed to standard users unless they are useful for troubleshooting.

## Notify and Error Handling

The Notify system provides the primary mechanism for communicating operational feedback to the user.

Error handling and Notify have different responsibilities:

```text
Error Handling
      ↓
Detects and handles the problem
      ↓
Notify
      ↓
Communicates the result to the user
```

Notify does not replace error handling.

For example, a tool may detect that no document is open and use a warning or error notification to explain the problem. The validation itself remains part of the tool's logic.

For more information about user notifications, see **Notify System**.

## JSX Error Handling

JSX scripts should protect operations that may fail unexpectedly.

A common pattern is:

```javascript
try {

    // Operation

} catch (e) {

    // Handle error

}
```

The exact implementation depends on the operation being performed.

When an error is caught, the script should determine whether the operation can safely continue. If it cannot, the operation should stop rather than producing an incomplete result.

For example, a production script that fails while creating a required production element should not silently continue and leave the document in an unknown state.

## CEP and JSX Execution

The interface layer may request JSX execution through the CEP communication layer.

Conceptually:

```text
CEP Interface
      ↓
JSX Execution Request
      ↓
Illustrator
      ↓
JSX Script
      ↓
Result / Error
      ↓
CEP Interface
```

Errors can therefore originate either in the interface-to-host communication or inside the JSX script itself.

When diagnosing an error, developers should determine which layer failed before modifying the implementation.

## Safe Failure

A tool should fail safely whenever possible.

Safe failure means that an unsuccessful operation does not leave the document in a misleading or unpredictable state.

For operations that modify documents, consider:

- Validating prerequisites before making changes.
- Performing critical operations only after validation succeeds.
- Stopping when a required operation fails.
- Avoiding silent partial completion.
- Informing the user when the result may be incomplete.

The appropriate strategy depends on the tool.

A simple informational tool may safely stop immediately, while a multi-step production operation may require more careful handling of partial changes.

## Shared Error Handling

Error handling is implemented at multiple levels of the TSP Tools architecture.

Individual tools are responsible for handling problems specific to their operations.

Shared systems are responsible for handling problems related to common functionality.

This separation prevents every tool from having to implement the entire error-handling architecture independently.

Changes to shared execution or communication mechanisms should therefore be tested across multiple tools.

## Future Error Handling Improvements

The current system can be expanded as the TSP Tools architecture grows.

Potential future improvements include:

- More consistent error message formats.
- Centralized error classification.
- More detailed diagnostic information.
- Improved recovery from partial operations.
- Centralized technical logging.
- Better debugging information for Developers and Maintainers.
- Automated testing of common failure conditions.

These improvements should be introduced without making the standard user experience unnecessarily technical.

## Summary

Error handling provides a safety layer between normal tool execution and unexpected conditions.

The main principles are:

- Validate before executing.
- Detect failures explicitly.
- Stop when continuing is unsafe.
- Communicate relevant problems to the user.
- Keep technical details separate from standard user messages.
- Protect document integrity whenever possible.
- Test both successful and unsuccessful workflows.

Error handling is not a single function or file. It is a responsibility shared between the tool implementation, JSX execution, CEP communication, and application infrastructure.