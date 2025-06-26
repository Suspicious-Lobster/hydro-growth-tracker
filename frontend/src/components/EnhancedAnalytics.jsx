import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';

const EnhancedAnalytics = ({ data }) => {
  const analyticsData = data.map((entry, index, array) => ({
    date: entry.date,
    height: entry.height,
    growthRate: index === 0 ? 0 : (entry.height - array[index - 1].height).toFixed(2)
  }));

  return (
    <div className="bg-brandGray-light p-6 rounded-xl shadow-lg border border-hydro-dark">
      <h2 className="text-2xl font-semibold text-center mb-4 text-hydro-light">
        📊 Enhanced Growth Analytics
      </h2>
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={analyticsData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
          <XAxis dataKey="date" stroke="#A7F3D0" tick={{ fontSize: 12 }}/>
          <YAxis stroke="#A7F3D0" tick={{ fontSize: 12 }}/>
          <Tooltip 
            contentStyle={{ backgroundColor: '#1E293B', borderRadius: '10px', borderColor: '#34D399' }} 
            labelStyle={{ color: '#34D399' }}
            itemStyle={{ color: '#A7F3D0' }}
          />
          <Legend wrapperStyle={{ color: '#34D399', fontSize: '14px' }}/>
          <Line 
            type="monotone" 
            dataKey="height" 
            stroke="#34D399" 
            strokeWidth={3} 
            dot={{ stroke: '#34D399', strokeWidth: 2 }}
            name="Plant Height (cm)"
          />
          <Line 
            type="monotone" 
            dataKey="growthRate" 
            stroke="#F59E0B" 
            strokeWidth={3} 
            dot={{ stroke: '#F59E0B', strokeWidth: 2 }}
            name="Growth Rate (cm/day)"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default EnhancedAnalytics;
