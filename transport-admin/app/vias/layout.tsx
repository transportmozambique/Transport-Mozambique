import AdminLayout from "../components/AdminLayout";

export default function ViasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayout>{children}</AdminLayout>;
}
