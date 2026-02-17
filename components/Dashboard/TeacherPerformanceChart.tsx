
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { TeacherStat } from '../../types';

interface Props {
    data: TeacherStat[];
}

const TeacherPerformanceChart: React.FC<Props> = ({ data }) => {
    // Sort data strictly for visual hierarchy (Top 10)
    const sortedData = [...data].sort((a, b) => b.studentCount - a.studentCount).slice(0, 10);

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-700 p-3 rounded-xl shadow-xl z-50">
                    <p className="text-slate-900 dark:text-white font-semibold mb-1">{payload[0].payload.name}</p>
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                            <span className="w-2 h-2 rounded-full bg-pnr-blue"></span>
                            <span>Öğrenci: <b>{payload[0].value}</b></span>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={sortedData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" opacity={0.5} />
                    <XAxis type="number" hide />
                    <YAxis
                        type="category"
                        dataKey="name"
                        width={100}
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9', opacity: 0.4 }} />
                    <Bar
                        dataKey="studentCount"
                        fill="#3b82f6"
                        radius={[0, 4, 4, 0]}
                        barSize={16}
                    >
                        {sortedData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index < 3 ? '#8b5cf6' : '#94a3b8'} />
                        ))}
                        <LabelList dataKey="studentCount" position="right" fontSize={11} fill="#64748b" />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default TeacherPerformanceChart;
