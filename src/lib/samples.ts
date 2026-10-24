import ml from "../../data/samples/ml.json";
import recruiter from "../../data/samples/recruiter.json";
import sde from "../../data/samples/sde.json";
import type { TailorResponse } from "./tailor-schemas";

export interface Sample {
  id: string;
  label: string;
  jobText: string;
  steer: string;
  response: TailorResponse;
}

/** Real pipeline output saved by scripts/make-samples.ts, so a sample loads instantly with no API call. */
export const SAMPLES = [sde, ml, recruiter] as unknown as Sample[];
