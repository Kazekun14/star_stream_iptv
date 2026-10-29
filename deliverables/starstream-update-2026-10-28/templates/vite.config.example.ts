// Optional neutral build configuration for a NEW isolated frontend workspace.
// Preserve/review the original site's configuration instead of overwriting it.
// This template has no environment-specific API proxy or deployment settings.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({ plugins: [react()] });
