// tests/search/responses/error_handling.base.test.ts

import { assertEquals, assertTrue, it } from "../../../../deps.test.ts";
import { fetchSearchWrapper } from "../../utils/fetch.ts";
import {
    createTestPatient,
    uniqueString,
} from "../../utils/resource_creators.ts";
import { Bundle, OperationOutcome } from "npm:@types/fhir/r4.d.ts";
import { ITestContext } from "../../types.ts";

export function runErrorHandlingBaseTests(context: ITestContext) {
    it("Server should return appropriate 4xx/5xx codes for other errors", async () => {
        const response = await fetchSearchWrapper({
            authorized: true,
            relativeUrl: `InvalidResource?param=value`,
        });

        assertTrue(
            response.status >= 400 && response.status < 600,
            `Server should return 4xx or 5xx status code for invalid resource type (got ${response.status})`,
        );
    });

    it("Server should return an OperationOutcome with error details when search fails", async () => {
        const response = await fetchSearchWrapper({
            authorized: true,
            relativeUrl: `Patient?invalid_parameter=value`,
        });

        assertTrue(
            response.status >= 400 && response.status < 600,
            `Server should return 4xx or 5xx status code for invalid parameter (got ${response.status})`,
        );

        if (
            response.jsonBody &&
            (response.jsonBody as OperationOutcome).resourceType ===
                "OperationOutcome"
        ) {
            const operationOutcome = response.jsonBody as OperationOutcome;
            assertTrue(
                operationOutcome.issue.some((issue) =>
                    issue.severity === "error"
                ),
                "OperationOutcome should contain at least one error issue",
            );
        } else {
            assertTrue(
                false,
                "Server should return an OperationOutcome for failed searches",
            );
        }
    });

    it("Empty search result should not be treated as an error", async () => {
        const response = await fetchSearchWrapper({
            authorized: true,
            relativeUrl: `Patient?family=NonexistentFamilyName`,
        });

        assertEquals(
            response.status,
            200,
            "Server should return 200 OK for empty search results",
        );

        const bundle = response.jsonBody as Bundle;
        assertEquals(bundle.total, 0, "Bundle should have zero total results");
        assertEquals(bundle.entry?.length ?? 0, 0, "Bundle should have no entries");
    });

    it("Server should process search with unknown subject", async () => {
        const response = await fetchSearchWrapper({
            authorized: true,
            relativeUrl: `Observation?subject=Patient/nonexistent`,
        });

        assertEquals(
            response.status,
            200,
            "Server should return 200 OK for search with unknown subject",
        );

        const bundle = response.jsonBody as Bundle;
        assertEquals(bundle.total, 0, "Bundle should have zero total results");
    });

    it("Server should process search with unknown code", async () => {
        const response = await fetchSearchWrapper({
            authorized: true,
            relativeUrl: `Observation?code=unknown|code`,
        });

        assertEquals(
            response.status,
            200,
            "Server should return 200 OK for search with unknown code",
        );

        const bundle = response.jsonBody as Bundle;
        assertEquals(bundle.total, 0, "Bundle should have zero total results");
    });

    it("Server should return error for syntactically incorrect parameter", async () => {
        const response = await fetchSearchWrapper({
            authorized: true,
            relativeUrl: `Patient?birthdate=not-a-date`,
        });

        assertTrue(
            response.status >= 400 && response.status < 600,
            `Server should return 4xx or 5xx status code for syntactically incorrect parameter (got ${response.status})`,
        );
    });

    if (context.areEmptyParametersAllowed()) {
        it("Server should ignore empty parameters", async () => {
            const emptyFamilyName = uniqueString("EmptyParamTest");
            await createTestPatient(context, { family: emptyFamilyName });
    
            const response = await fetchSearchWrapper({
                authorized: true,
                relativeUrl: `Patient?family=${emptyFamilyName}&empty_param=`,
            });
    
            assertEquals(
                response.status,
                200,
                "Server should return 200 OK when ignoring empty parameters",
            );
    
            const bundle = response.jsonBody as Bundle;
            assertTrue(
                bundle.total! > 0,
                "Bundle should have results despite empty parameter",
            );
        });            
    }

    it("Server should honor 'strict' handling preference", async () => {
        const response = await fetchSearchWrapper({
            authorized: true,
            relativeUrl: `Patient?unknown_param=value`,
            headers: { "Prefer": "handling=strict" },
        });

        assertTrue(
            response.status >= 400 && response.status < 600,
            `Server should return 4xx or 5xx status code for unknown parameter in strict mode (got ${response.status})`,
        );
    });

    if (context.isLenientSearchHandlingSupported()) {
        it("Server should honor 'lenient' handling preference", async () => {
            const response = await fetchSearchWrapper({
                authorized: true,
                relativeUrl: `Patient?unknown_param=value`,
                headers: { "Prefer": "handling=lenient" },
            });

            assertEquals(
                response.status,
                200,
                "Server should return 200 OK for unknown parameter in lenient mode",
            );
        });
    }
}
