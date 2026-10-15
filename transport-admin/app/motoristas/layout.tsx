import AdminLayout from "../components/AdminLayout";

export default function MotoristasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayout>{children}</AdminLayout>;
}
