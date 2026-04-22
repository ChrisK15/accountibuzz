// Root index — redirect logic lives in `_layout.tsx`'s `useProtectedRoute`.
// This file intentionally renders nothing; the effect in the root gate will
// replace the route based on session state.
export default function Index() {
  return null;
}
