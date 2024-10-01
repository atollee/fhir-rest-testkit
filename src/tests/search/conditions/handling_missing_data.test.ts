// tests/search/parameters/handling_missing_data.test.ts

import {
    assertEquals,
    assertExists,
    assertTrue,
    it,
} from "../../../../deps.test.ts";
import { fetchWrapper } from "../../utils/fetch.ts";
import { createTestAllergyIntolerance } from "../../utils/resource_creators.ts";
import { AllergyIntolerance, Bundle } from "npm:@types/fhir/r4.d.ts";
import { ITestContext } from "../../types.ts";

export function runHandlingMissingDataTests(context: ITestContext) {
    it("Should only return AllergyIntolerance resources with active clinical status", async () => {
        const activeAllergy = await createTestAllergyIntolerance(context, {
            clinicalStatus: {
                coding: [{
                    system:
                        "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
                    code: "active",
                }],
            },
        });

        await createTestAllergyIntolerance(context, {
            clinicalStatus: {
                coding: [{
                    system:
                        "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
                    code: "inactive",
                }],
            },
        });

        await createTestAllergyIntolerance(context, {}); // No clinical status

        const response = await fetchWrapper({
            authorized: true,
            relativeUrl:
                `AllergyIntolerance?clinical-status=http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical|active`,
        });

        assertEquals(
            response.status,
            200,
            "Server should process the search successfully",
        );
        const bundle = response.jsonBody as Bundle;
        assertExists(bundle.entry, "Bundle should contain entries");
        assertEquals(
            bundle.entry.length,
            1,
            "Only one AllergyIntolerance should be returned",
        );
        assertEquals(
            (bundle.entry[0].resource as AllergyIntolerance).id,
            activeAllergy.id,
            "The returned AllergyIntolerance should be the one with active clinical status",
        );
    });

    it("Should return AllergyIntolerance resources with missing clinical status", async () => {
        const allergyWithoutStatus = await createTestAllergyIntolerance(
            context,
            {},
        );

        await createTestAllergyIntolerance(context, {
            clinicalStatus: {
                coding: [{
                    system:
                        "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
                    code: "active",
                }],
            },
        });

        const response = await fetchWrapper({
            authorized: true,
            relativeUrl: `AllergyIntolerance?clinical-status:missing=true`,
        });

        assertEquals(
            response.status,
            200,
            "Server should process the search successfully",
        );
        const bundle = response.jsonBody as Bundle;
        assertExists(bundle.entry, "Bundle should contain entries");
        assertEquals(
            bundle.entry.length,
            1,
            "Only one AllergyIntolerance should be returned",
        );
        assertEquals(
            (bundle.entry[0].resource as AllergyIntolerance).id,
            allergyWithoutStatus.id,
            "The returned AllergyIntolerance should be the one without clinical status",
        );
    });

    it("Should return empty result when combining active status and missing modifier", async () => {
        await createTestAllergyIntolerance(context, {
            clinicalStatus: {
                coding: [{
                    system:
                        "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
                    code: "active",
                }],
            },
        });

        await createTestAllergyIntolerance(context, {}); // No clinical status

        const response = await fetchWrapper({
            authorized: true,
            relativeUrl:
                `AllergyIntolerance?clinical-status=http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical|active&clinical-status:missing=true`,
        });

        assertEquals(
            response.status,
            200,
            "Server should process the search successfully",
        );
        const bundle = response.jsonBody as Bundle;
        assertExists(bundle.entry, "Bundle should contain entries");
        assertEquals(
            bundle.entry.length,
            0,
            "No AllergyIntolerance should be returned",
        );
    });

    it("Should return both active and missing clinical status AllergyIntolerance resources using _filter", async () => {
        const activeAllergy = await createTestAllergyIntolerance(context, {
            clinicalStatus: {
                coding: [{
                    system:
                        "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
                    code: "active",
                }],
            },
        });

        const allergyWithoutStatus = await createTestAllergyIntolerance(
            context,
            {},
        );

        await createTestAllergyIntolerance(context, {
            clinicalStatus: {
                coding: [{
                    system:
                        "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
                    code: "inactive",
                }],
            },
        });

        const response = await fetchWrapper({
            authorized: true,
            relativeUrl:
                `AllergyIntolerance?_filter=clinical-status eq 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical|active' or clinical-status eq null`,
        });

        assertEquals(
            response.status,
            200,
            "Server should process the _filter search successfully",
        );
        const bundle = response.jsonBody as Bundle;
        assertExists(bundle.entry, "Bundle should contain entries");
        assertEquals(
            bundle.entry.length,
            2,
            "Two AllergyIntolerance resources should be returned",
        );
        assertTrue(
            bundle.entry.some((entry) =>
                (entry.resource as AllergyIntolerance).id === activeAllergy.id
            ),
            "Results should include the AllergyIntolerance with active clinical status",
        );
        assertTrue(
            bundle.entry.some((entry) =>
                (entry.resource as AllergyIntolerance).id ===
                    allergyWithoutStatus.id
            ),
            "Results should include the AllergyIntolerance without clinical status",
        );
    });
}
