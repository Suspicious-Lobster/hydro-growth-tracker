import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";

function GrowthChart({ data }) {
  return (
    <div className="w-full h-80 bg-brandGray-light rounded-xl shadow-xl p-4">
      <h2 className="text-xl font-semibold text-hydro mb-4">
        📈 Growth and Nutrient Chart
      </h2>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
          <XAxis dataKey="date" stroke="#ccc" />
          <YAxis stroke="#ccc" />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="height" stroke="#34D399" strokeWidth={2} name="Height (cm)" />
          <Line type="monotone" dataKey="nutrientStrength" stroke="#60A5FA" strokeWidth={2} name="Nutrient Strength (ml)" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default GrowthChart;
