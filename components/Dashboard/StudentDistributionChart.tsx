import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { BranchStat } from '../../types';

interface Props {
  data: BranchStat[];
}

const StudentDistributionChart: React.FC<Props> = ({ data }) => {
  const totalStudents = data.reduce((acc, curr) => acc + curr.count, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-700 p-3 rounded-xl shadow-xl">
          <p className="text-slate-900 dark:text-white font-semibold">{payload[0].name}</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            {payload[0].value} Öğrenci
          </p>
          <p className="text-xs mt-1" style={{ color: payload[0].payload.color }}>
            {((payload[0].value / totalStudents) * 100).toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-[400px] relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={80}
            outerRadius={120}
            paddingAngle={5}
            dataKey="count"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.color} 
                className="hover:opacity-80 transition-opacity duration-300 cursor-pointer"
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            verticalAlign="bottom" 
            height={36} 
            iconType="circle"
            formatter={(value) => <span className="text-slate-600 dark:text-slate-300 ml-1">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
      
      {/* Center Text */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none pb-8">
        <div className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight">{totalStudents}</div>
        <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mt-1">Öğrenci</div>
      </div>
    </div>
  );
};

export default StudentDistributionChart;