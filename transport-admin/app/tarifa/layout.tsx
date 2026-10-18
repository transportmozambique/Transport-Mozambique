import AdminLayout from "../components/AdminLayout";

export default function TarifaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayout>{children}</AdminLayout>;
}
