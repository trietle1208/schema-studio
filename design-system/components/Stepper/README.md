# Stepper

The numbered steps of a dialog that is a path with an end: Import Records (Source → Map columns → Settings → Review & import). It sits under the title of the modal, on `bg-2` with a hairline below.

- Props: `steps` (labels), `current` (index from 0), `onStep(index)` (a step that is done becomes a button that goes back to it; leave it out and none is clickable), `label` (the `aria-label` of the list, default "Steps").
- Each step is a 20px box with its number in mono and its label. **Current:** `accent` box, label in `ink-1`, `aria-current="step"`. **Done:** a check in a `bg-4` box, label in `ink-2`. **Ahead:** an outlined box and `ink-3`; it is never a button. The hairlines between the steps turn `line-3` once they are behind the current step.
- Steps are for what has to be done in order. A dialog with options that can be set in any order (Export Schema) is not a stepper.
