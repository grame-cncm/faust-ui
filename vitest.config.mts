import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
    test: {
        // `npm run coverage`: what the unit and browser tests run of the sources
        coverage: {
            provider: "v8",
            include: ["src/**/*.ts"],
            exclude: ["src/**/*.d.ts"],
            reporter: ["text-summary", "text", "html"]
        },
        projects: [
            {
                test: {
                    name: "unit",
                    include: ["test/**/*.test.ts"],
                    exclude: ["test/browser/**"]
                }
            },
            {
                test: {
                    name: "browser",
                    include: ["test/browser/**/*.test.ts"],
                    // Load the styles of the components, as the bundle does
                    css: true,
                    browser: {
                        enabled: true,
                        headless: true,
                        provider: playwright(),
                        instances: [{ browser: "chromium", viewport: { width: 1280, height: 900 } }]
                    }
                }
            }
        ]
    }
});
