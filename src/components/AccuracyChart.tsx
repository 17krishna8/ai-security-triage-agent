"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function AccuracyChart({
  memoryOn,
  memoryOff,
}: {
  memoryOn: { decisionAccuracy: number; severityAccuracy: number };
  memoryOff: { decisionAccuracy: number; severityAccuracy: number };
}) {
  const data = [
    { metric: "Decision accuracy", "Memory ON": memoryOn.decisionAccuracy, "Memory OFF": memoryOff.decisionAccuracy },
    { metric: "Severity accuracy", "Memory ON": memoryOn.severityAccuracy, "Memory OFF": memoryOff.severityAccuracy },
  ];

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="metric" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
          <Tooltip formatter={(v) => `${v}%`} />
          <Legend />
          <Bar dataKey="Memory ON" fill="#0891b2" radius={[6, 6, 0, 0]} />
          <Bar dataKey="Memory OFF" fill="#94a3b8" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
