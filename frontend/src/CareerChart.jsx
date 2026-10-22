import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function CareerChart({ results }) {
  return <div className="chart-panel">
    <div className="chart-title">Your match overview <span>RELATIVE SCORES</span></div>
    <div className="chart"><ResponsiveContainer width="100%" height={220}>
      <BarChart data={results} layout="vertical" margin={{left: 6, right: 22, top: 4, bottom: 4}}>
        <CartesianGrid strokeDasharray="3 3" stroke="#263347" horizontal={false}/>
        <XAxis type="number" domain={[0, 100]} tick={{fill:'#9ba9bc',fontSize:11}} axisLine={false} tickLine={false}/>
        <YAxis type="category" dataKey="career" width={125} tick={{fill:'#d7e0ee',fontSize:11}} axisLine={false} tickLine={false}/>
        <Tooltip contentStyle={{background:'#111d2d',border:'1px solid #304158',borderRadius:10}}/>
        <Bar dataKey="score" fill="#78e0bd" radius={[0, 5, 5, 0]} barSize={17}/>
      </BarChart>
    </ResponsiveContainer></div>
  </div>;
}
