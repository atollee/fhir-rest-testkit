// tests/version-support.test.ts

import { fetchWrapper } from "../../utils/fetch.ts";
import { ITestContext } from "../../types.ts";
import {
    assertEquals,
    assertExists,
    assertNotEquals,
    it,
} from "../../../../deps.test.ts";
import { CapabilityStatement, Patient } from "npm:@types/fhir/r4.d.ts";

export function runVersionSupportTests(context: ITestContext) {
    const validPatientId = context.getValidPatientId(); // Use a known valid patient ID

    it("Version Support - Check Capability Statement", async () => {
        const response = await fetchWrapper({
            authorized: true,
            relativeUrl: "metadata",
        });

        assertEquals(response.success, true, "Request should be successful");
        assertExists(response.jsonBody, "Response should include JSON body");
        assertEquals(
            response.jsonBody.resourceType,
            "CapabilityStatement",
            "Response should be a CapabilityStatement",
        );

        const metadata = response.jsonBody as CapabilityStatement;
        const rest = metadata && metadata.rest ? metadata.rest[0] : undefined;
        assertExists(
            rest,
            "CapabilityStatement should include REST capabilities",
        );
        assertExists(
            rest.resource,
            "REST capabilities should include resource information",
        );

        const patientResource = rest.resource.find((r) => r.type === "Patient");
        assertExists(
            patientResource,
            "CapabilityStatement should include Patient resource information",
        );
        assertExists(
            patientResource.versioning,
            "Patient resource should specify versioning support",
        );

        // Assuming the server supports versioning, adjust this assertion if necessary
        assertEquals(
            ["versioned", "versioned-update"].includes(
                patientResource.versioning,
            ),
            true,
            "Server should support versioning",
        );
    });

    it("Version Support - Resource has versionId", async () => {
        const response = await fetchWrapper({
            authorized: true,
            relativeUrl: `Patient/${validPatientId}`,
        });

        assertEquals(response.success, true, "Request should be successful");
        assertExists(response.jsonBody, "Response should include JSON body");
        assertExists(response.jsonBody.meta, "Resource should have meta field");
        assertExists(
            response.jsonBody.meta.versionId,
            "Resource should have versionId",
        );
    });

    it("Version Support - Resource has lastUpdated", async () => {
        const response = await fetchWrapper({
            authorized: true,
            relativeUrl: `Patient/${validPatientId}`,
        });

        assertEquals(response.success, true, "Request should be successful");
        assertExists(response.jsonBody, "Response should include JSON body");
        assertExists(response.jsonBody.meta, "Resource should have meta field");
        assertExists(
            response.jsonBody.meta.lastUpdated,
            "Resource should have lastUpdated timestamp",
        );
    });

    it("Version Support - vread operation", async () => {
        // First, get the current version
        const initialResponse = await fetchWrapper({
            authorized: true,
            relativeUrl: `Patient/${validPatientId}`,
        });

        const patient = initialResponse.jsonBody as Patient;
        const versionId = patient?.meta?.versionId;

        // Now, try to read that specific version
        const vreadResponse = await fetchWrapper({
            authorized: true,
            relativeUrl: `Patient/${validPatientId}/_history/${versionId}`,
        });

        const vreadPatient = vreadResponse.jsonBody as Patient;
        assertEquals(
            vreadResponse.success,
            true,
            "vread request should be successful",
        );
        assertEquals(
            vreadPatient.id,
            validPatientId,
            "vread should return the correct resource",
        );
        assertEquals(
            vreadPatient.meta?.versionId,
            versionId,
            "vread should return the correct version",
        );
    });

    it("Version Support - Version-aware update", async () => {
        // First, get the current version
        const initialResponse = await fetchWrapper({
            authorized: true,
            relativeUrl: `Patient/${validPatientId}`,
        });

        const patient = initialResponse.jsonBody as Patient;
        const currentVersion = patient?.meta?.versionId;

        // Now, try to update with version awareness
        const updatedPatient = {
            ...initialResponse.jsonBody,
            active: !patient.active,
        };

        const updateResponse = await fetchWrapper({
            authorized: true,
            relativeUrl: `Patient/${validPatientId}`,
            method: "PUT",
            headers: {
                "If-Match": `W/"${currentVersion}"`,
            },
            body: JSON.stringify(updatedPatient),
        });

        const returnedPatient = updateResponse.jsonBody as Patient;
        assertEquals(
            updateResponse.success,
            true,
            "Version-aware update should be successful",
        );
        assertNotEquals(
            returnedPatient?.meta?.versionId,
            currentVersion,
            "Version should be updated after successful update",
        );
    });

    it("Version Support - Conflict on outdated version update", async () => {
        // First, get the current version
        const initialResponse = await fetchWrapper({
            authorized: true,
            relativeUrl: `Patient/${validPatientId}`,
        });

        const outdatedVersion = "1"; // Assuming this is an old version

        const patient = initialResponse.jsonBody as Patient;

        // Now, try to update with an outdated version
        const updatedPatient = {
            ...initialResponse.jsonBody,
            active: !patient.active,
        };

        const updateResponse = await fetchWrapper({
            authorized: true,
            relativeUrl: `Patient/${validPatientId}`,
            method: "PUT",
            headers: {
                "If-Match": `W/"${outdatedVersion}"`,
            },
            body: JSON.stringify(updatedPatient),
        });

        assertEquals(
            updateResponse.success,
            false,
            "Update with outdated version should fail",
        );
        assertEquals(
            updateResponse.status,
            412,
            "Should return 412 Precondition Failed for outdated version update",
        );
    });
}
