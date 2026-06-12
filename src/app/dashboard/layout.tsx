import LegacyGuard from '@/components/LegacyGuard';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LegacyGuard />
      {children}
    </>
  );
}
