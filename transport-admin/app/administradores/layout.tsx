import AdminLayout from "../components/AdminLayout";

export default function AdministradoresLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayout>{children}</AdminLayout>;
}
