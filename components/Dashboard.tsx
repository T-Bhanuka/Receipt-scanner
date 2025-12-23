
import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LabelList
} from 'recharts';
import { Receipt, Category } from '../types';

interface DashboardProps {
  receipts: Receipt[];
  monthlyBudget: number;
}

// Category-specific color mapping
const CATEGORY_COLORS: Record<string, string> = {
  [Category.Food]: '#10b981', // Emerald
  [Category.Furniture]: '#f59e0b', // Amber
  [Category.Stationery]: '#3b82f6', // Blue
  [Category.Medicine]: '#f43f5e', // Rose
  [Category.BabyAccessories]: '#ec4899', // Pink
  [Category.MobileAccessories]: '#14b8a6', // Teal
  [Category.PetItems]: '#f97316', // Orange
  [Category.Other]: '#64748b' // Slate
};

const Dashboard: React.FC<DashboardProps> = ({ receipts, monthlyBudget }) => {
  const totalSpent = receipts.reduce((sum, r) => sum + r.total, 0);
  const budgetProgress = Math.min((totalSpent / monthlyBudget) * 100, 100);

  // Category distribution calculation
  const categoryData = Object.values(Category).map(cat => {
    const spentInCategory = receipts.reduce((sum, r) => {
      // Aggregate from individual items
      const itemTotal = r.items
        .filter(i => i.category === cat)
        .reduce((s, i) => s + i.price, 0);
      
      // Fallback to receipt category if no item-level category matches (unlikely with new AI logic)
      if (r.items.length === 0 && r.category === cat) return sum + r.total;
      return sum + itemTotal;
    }, 0);
    return { name: cat, value: spentInCategory, fill: CATEGORY_COLORS[cat] };
  }).filter(d => d.value > 0);

  // Last 7 days spending
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayTotal = receipts
      .filter(r => new Date(r.timestamp).toDateString() === d.toDateString())
      .reduce((sum, r) => sum + r.total, 0);
    return { name: dateStr, amount: dayTotal };
  }).reverse();

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central" 
        fontSize={10} 
        fontWeight="bold"
        className="drop-shadow-sm pointer-events-none"
      >
        {percent > 0.05 ? name : ''}
      </text>
    );
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Budget Card */}
      <div className="bg-slate-900/60 border border-slate-800 p-8 rounded-[2rem] shadow-2xl overflow-hidden relative group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/10 blur-[80px] -mr-16 -mt-16 group-hover:bg-purple-600/20 transition-all"></div>
        <div className="relative z-10">
          <div className="flex justify-between items-end mb-6">
            <div>
              <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mb-2">Spent this month</p>
              <h2 className="text-4xl font-black text-white">
                Rs. {totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
            </div>
            <div className="text-right">
              <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mb-1">Budget</p>
              <p className="text-xl font-black text-indigo-400">Rs. {monthlyBudget.toLocaleString()}</p>
            </div>
          </div>
          
          <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden shadow-inner">
            <div 
              className={`h-full transition-all duration-1000 ease-out rounded-full shadow-[0_0_15px_rgba(139,92,246,0.5)] ${totalSpent > monthlyBudget ? 'bg-red-500' : 'bg-gradient-to-r from-indigo-500 to-purple-600'}`}
              style={{ width: `${budgetProgress}%` }}
            ></div>
          </div>
          
          <div className="mt-4 flex justify-between text-[11px] font-black uppercase tracking-tighter text-slate-500">
            <span>Progress</span>
            <span className={totalSpent > monthlyBudget ? 'text-red-400' : 'text-purple-400'}>
              {budgetProgress.toFixed(1)}% Utilized
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Spending by Day */}
        <div className="bg-slate-900/60 p-6 rounded-[2rem] border border-slate-800 h-80 shadow-lg">
          <h3 className="text-slate-200 font-bold mb-6 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-indigo-500 rounded-full"></span>
            Daily Trend (Rs.)
          </h3>
          <ResponsiveContainer width="100%" height="80%">
            <BarChart data={last7Days}>
              <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis hide />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '16px', color: '#f8fafc' }}
                cursor={{ fill: '#1e293b' }}
                formatter={(val: number) => `Rs. ${val.toFixed(2)}`}
              />
              <Bar dataKey="amount" fill="url(#colorGradient)" radius={[6, 6, 6, 6]} barSize={36} />
              <defs>
                <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={1}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={1}/>
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Categories breakdown */}
        <div className="bg-slate-900/60 p-6 rounded-[2rem] border border-slate-800 h-80 shadow-lg">
          <h3 className="text-slate-200 font-bold mb-6 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-purple-500 rounded-full"></span>
            Category Mix
          </h3>
          <ResponsiveContainer width="100%" height="80%">
            <PieChart>
              <Pie
                data={categoryData}
                innerRadius={60}
                outerRadius={90}
                paddingAngle={4}
                dataKey="value"
                stroke="#0f172a"
                strokeWidth={2}
                labelLine={false}
                label={renderCustomizedLabel}
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '16px', color: '#f8fafc' }}
                formatter={(val: number) => `Rs. ${val.toFixed(2)}`}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Legend */}
      <div className="bg-slate-900/40 p-6 rounded-[2rem] border border-slate-800">
        <h4 className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-4">Color Key</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
            <div key={cat} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></div>
              <span className="text-[10px] font-bold text-slate-300">{cat}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
