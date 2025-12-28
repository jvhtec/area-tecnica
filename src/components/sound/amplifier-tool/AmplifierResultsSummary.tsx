import React from "react";
import type { AmplifierResults } from "./types";

export const AmplifierResultsSummary: React.FC<{ results: AmplifierResults }> = ({ results }) => (
  <div className="mt-6 border rounded-lg overflow-hidden">
    <div className="bg-muted px-4 py-3">
      <h3 className="text-lg font-semibold">Required Amplifiers</h3>
    </div>

    <div className="p-4 space-y-4">
      {Object.entries(results.perSection).map(([section, data]) => (
        data.totalAmps > 0 && (
          <div key={section} className="space-y-2 pb-4 border-b last:border-b-0 last:pb-0">
            <div className="font-medium capitalize text-sm text-muted-foreground">
              {section}
              {data.mirrored ? " (Mirrored)" : ""}
            </div>
            {data.details.map((detail, index) => (
              <div key={index} className="text-sm pl-4">
                {detail}
              </div>
            ))}
            {data.details.length > 1 && (
              <div className="text-sm pl-4 font-medium">
                Total amplifiers for {section}: {data.totalAmps}
              </div>
            )}
          </div>
        )
      ))}
    </div>

    <div className="bg-muted/50 px-4 py-3 border-t space-y-2">
      <div className="font-semibold text-sm text-muted-foreground">Summary</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
        {results.completeRaks > 0 && (
          <div className="flex justify-between">
            <span>LA-RAKs required:</span>
            <span className="font-medium">{results.completeRaks}</span>
          </div>
        )}
        {results.looseAmplifiers > 0 && (
          <div className="flex justify-between">
            <span>Loose LA12X amplifiers:</span>
            <span className="font-medium">{results.looseAmplifiers}</span>
          </div>
        )}
        {results.plmRacks > 0 && (
          <div className="flex justify-between">
            <span>PLM20000 Racks:</span>
            <span className="font-medium">{results.plmRacks}</span>
          </div>
        )}
        {results.loosePLMAmps > 0 && (
          <div className="flex justify-between">
            <span>Loose PLM20000D amplifiers:</span>
            <span className="font-medium">{results.loosePLMAmps}</span>
          </div>
        )}
      </div>
      <div className="flex justify-between font-semibold pt-2 border-t">
        <span>Total amplifiers needed:</span>
        <span>{results.totalAmplifiersNeeded}</span>
      </div>
    </div>
  </div>
);

