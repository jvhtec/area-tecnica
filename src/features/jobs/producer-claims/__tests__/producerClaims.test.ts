import { describe, expect, it } from "vitest";

import {
  mergeProducerClaimsIntoContacts,
} from "@/features/jobs/producer-claims/producerClaims";

const claims = [
  {
    job_id: "job-1",
    producer_id: "producer-1",
    display_name: "Ana Ruiz",
  },
  {
    job_id: "job-1",
    producer_id: "producer-2",
    display_name: "Luis Pérez",
  },
];

describe("producer claims", () => {
  it("adds claimed producers to generated-document contacts", () => {
    const contacts = mergeProducerClaimsIntoContacts([], claims);

    expect(contacts).toEqual([
      { name: "Ana Ruiz", role: "Producción", technician_id: "producer-1" },
      { name: "Luis Pérez", role: "Producción", technician_id: "producer-2" },
    ]);
  });

  it("does not duplicate a producer already present in document contacts", () => {
    const contacts = mergeProducerClaimsIntoContacts(
      [{ name: "Ana Ruiz", role: "Producción", technician_id: "producer-1" }],
      claims,
    );

    expect(contacts).toHaveLength(2);
  });
});
