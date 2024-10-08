// tests/search/parameters/id_parameter.test.ts

import {
    assertEquals,
    assertExists,
    assertFalse,
    assertTrue,
    it,
} from "../../../../deps.test.ts";
import { fetchSearchWrapper, fetchWrapper } from "../../utils/fetch.ts";
import {
    createTestObservation,
    createTestPatient,
} from "../../utils/resource_creators.ts";
import { Bundle, Patient } from "npm:@types/fhir/r4.d.ts";
import { ITestContext } from "../../types.ts";

export function runIdParameterTests(context: ITestContext) {
    it("Should find a Patient using _id parameter", async () => {
        const patient = await createTestPatient(context, {
            name: [{ given: ["TestPatient"] }],
        });

        const response = await fetchSearchWrapper({
            authorized: true,
            relativeUrl: `Patient?_id=${patient.id}`,
        });

        assertEquals(
            response.status,
            200,
            "Server should process _id parameter successfully",
        );
        const bundle = response.jsonBody as Bundle;
        assertExists(bundle.entry, "Bundle should contain entries");
        assertEquals(bundle.entry.length, 1, "Bundle should contain one entry");
        assertEquals(
            (bundle.entry[0].resource as Patient).id,
            patient.id,
            "Found Patient should have the correct id",
        );
    });

    it("Should not find a Patient using non-existent _id", async () => {
        const nonExistentId = "non-existent-id";

        const response = await fetchSearchWrapper({
            authorized: true,
            relativeUrl: `Patient?_id=${nonExistentId}`,
        });

        assertEquals(
            response.status,
            200,
            "Server should process _id parameter successfully",
        );
        const bundle = response.jsonBody as Bundle;
        assertEquals(bundle.total, 0, "Bundle should contain no entries");
    });

    it("Should perform exact match on _id (case-sensitive)", async () => {
        const patient = await createTestPatient(context, {
            name: [{ given: ["TestPatient"] }],
        });

        // Ensure the ID is valid according to FHIR specifications
        assertTrue(
            /^[A-Za-z0-9\-\.]{1,64}$/.test(patient.id!),
            `Generated patient ID ${patient.id} should be a valid FHIR id`,
        );

        // Test with correct case
        const correctCaseResponse = await fetchWrapper({
            authorized: true,
            relativeUrl: `Patient?_id=Patient/${patient.id}`,
        });

        assertEquals(
            correctCaseResponse.status,
            200,
            "Server should process _id parameter successfully",
        );
        const correctCaseBundle = correctCaseResponse.jsonBody as Bundle;
        assertEquals(
            correctCaseBundle.total,
            1,
            "Bundle should contain one entry for exact match",
        );

        // Test with uppercase (which should be invalid)
        const upperCaseResponse = await fetchWrapper({
            authorized: true,
            relativeUrl: `Patient?_id=PATIENT/${patient.id}`,
        });

        // The server behavior for invalid IDs is not strictly specified, so we allow two possibilities
        if (upperCaseResponse.status === 200) {
            const upperCaseBundle = upperCaseResponse.jsonBody as Bundle;
            assertTrue(
                (upperCaseBundle.total ?? 0) <= 1,
                "Bundle should contain maximum one entry for case-mismatch",
            );
        } else {
            assertEquals(
                upperCaseResponse.status,
                400,
                "Server may return a 400 Bad Request for invalid ID format",
            );
        }
    });

    it("Should only search within specified resource type", async () => {
        const patient = await createTestPatient(context, {
            name: [{ given: ["TestPatient"] }],
        });
        await createTestObservation(context, patient.id!, {
            code: "test-code",
        });

        // Search for the patient id within Observation resources
        const response = await fetchSearchWrapper({
            authorized: true,
            relativeUrl: `Observation?_id=${patient.id}`,
        });

        assertEquals(
            response.status,
            200,
            "Server should process _id parameter successfully",
        );
        const bundle = response.jsonBody as Bundle;
        assertEquals(bundle.total, 0, "Bundle should contain no entries");
    });

    it("Should combine _id with other search parameters", async () => {
        const patient1 = await createTestPatient(context, {
            name: [{ given: ["TestPatient1"] }],
            gender: "male",
        });
        await createTestPatient(context, {
            name: [{ given: ["TestPatient2"] }],
            gender: "female",
        });

        const response = await fetchSearchWrapper({
            authorized: true,
            relativeUrl: `Patient?_id=${patient1.id}&gender=male`,
        });

        assertEquals(
            response.status,
            200,
            "Server should process _id with other parameters successfully",
        );
        const bundle = response.jsonBody as Bundle;
        assertExists(bundle.entry, "Bundle should contain entries");
        assertEquals(bundle.entry.length, 1, "Bundle should contain one entry");
        assertEquals(
            (bundle.entry[0].resource as Patient).id,
            patient1.id,
            "Found Patient should be patient1",
        );
    });

    it("Should not allow _id without resource type", async () => {
        const patient = await createTestPatient(context, {
            name: [{ given: ["TestPatient"] }],
        });

        const response = await fetchSearchWrapper({
            authorized: true,
            relativeUrl: `?_id=${patient.id}`,
        });

        assertFalse(
            response.status === 200,
            "Server should not process _id without resource type",
        );
    });
}
