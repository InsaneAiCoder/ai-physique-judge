import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type ProgressPoint = {
  date: string;
  physique: number;
  muscle: number;
  symmetry: number;
  conditioning: number;
  weight: number;
};

export function ProgressChart({ data }: { data: ProgressPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid stroke="rgba(148,163,184,0.14)" vertical={false} />
        <XAxis dataKey="date" stroke="#94A3B8" fontSize={12} />
        <YAxis stroke="#94A3B8" fontSize={12} />
        <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: 16, color: '#0F172A' }} />
        <Line type="monotone" dataKey="physique" stroke="#2563EB" strokeWidth={3} dot={false} />
        <Line type="monotone" dataKey="muscle" stroke="#10B981" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="symmetry" stroke="#8B5CF6" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="conditioning" stroke="#F59E0B" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="weight" stroke="#64748B" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
