import { HumanName } from "npm:@types/fhir/r4.d.ts";
import { HumanNameOptions } from "./types.ts";

export function createHumanName(options: HumanNameOptions): HumanName {
    return {
        family: options.family,
        given: options.given,
        prefix: options.prefix,
        suffix: options.suffix,
        text: options.text,
    };
}
