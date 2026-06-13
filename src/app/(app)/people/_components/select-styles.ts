/**
 * Shared className for the native <select> elements across the people feature
 * (search filter, person form, interaction form). We use native <select> rather
 * than a custom widget; this keeps their look uniform. Pass extra classes (e.g.
 * "w-full") via cn() at the call site.
 */
export const NATIVE_SELECT_CLASS =
  "h-9 rounded-lg border border-input bg-card px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";
